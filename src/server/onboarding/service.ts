import "server-only";
import { Prisma } from "@prisma/client";
import type { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { AppError } from "@/lib/api/errors";
import { writeAudit } from "@/lib/audit";
import { randomToken, sha256 } from "@/lib/crypto";
import { sendEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { requirePermission, type OrgContext } from "@/lib/tenancy/load";
import { OWNER_ROLE_KEY } from "@/lib/permissions/catalog";
import { LAST_STEP } from "@/server/onboarding/steps";
import type { adminSchema, companySchema, inviteSchema, slaSchema, teamSchema } from "@/server/onboarding/schemas";

const INVITATION_DAYS = 7;

export function assertCanOnboard(ctx: OrgContext) {
  requirePermission(ctx, "settings.manage");
}

const audit = (ctx: OrgContext, action: string, entityType: string, entityId: string | null, extra: { before?: unknown; after?: unknown } = {}) =>
  writeAudit({ organizationId: ctx.organization.id, userId: ctx.user.id, action, entityType, entityId, ...extra });

/** Marks `step` complete; never moves progress backwards, so repeating a step is harmless. */
export async function completeStep(ctx: OrgContext, step: number) {
  const next = Math.min(step + 1, LAST_STEP);
  await db.organization.updateMany({ where: { id: ctx.organization.id, onboardingStep: { lt: next } }, data: { onboardingStep: next } });
  return { step: next };
}

// ── Step 1: company ──
export async function saveCompany(ctx: OrgContext, input: z.output<typeof companySchema>) {
  const orgId = ctx.organization.id;
  const before = await db.organization.findUniqueOrThrow({ where: { id: orgId }, select: { name: true, timezone: true, settings: { select: { supportEmail: true } } } });
  await db.$transaction([
    db.organization.update({ where: { id: orgId }, data: { name: input.name, timezone: input.timezone } }),
    db.organizationSettings.upsert({ where: { organizationId: orgId }, create: { organizationId: orgId, supportEmail: input.supportEmail }, update: { supportEmail: input.supportEmail } }),
  ]);
  await audit(ctx, "organization.updated", "organization", orgId, {
    before: { name: before.name, timezone: before.timezone, supportEmail: before.settings?.supportEmail ?? null },
    after: input,
  });
  return completeStep(ctx, 1);
}

// ── Step 2: admin profile ──
export async function saveAdminProfile(ctx: OrgContext, input: z.output<typeof adminSchema>) {
  await db.user.update({ where: { id: ctx.user.id }, data: { name: input.name, jobTitle: input.jobTitle, phone: input.phone } });
  return completeStep(ctx, 2);
}

// ── Step 3: departments ──
async function nameTaken(model: "department" | "team", orgId: string, name: string) {
  const where = { organizationId: orgId, name: { equals: name, mode: "insensitive" as const } };
  const found = model === "department"
    ? await db.department.findFirst({ where, select: { id: true } })
    : await db.team.findFirst({ where, select: { id: true } });
  return Boolean(found);
}

export async function addDepartment(ctx: OrgContext, name: string) {
  if (await nameTaken("department", ctx.organization.id, name)) throw new AppError("DUPLICATE", `A department named "${name}" already exists.`, 409);
  const department = await db.department.create({ data: { organizationId: ctx.organization.id, name }, select: { id: true, name: true } });
  await audit(ctx, "department.created", "department", department.id, { after: { name } });
  return department;
}

export async function removeDepartment(ctx: OrgContext, id: string) {
  const department = await db.department.findFirst({ where: { id, organizationId: ctx.organization.id }, select: { id: true, name: true } });
  if (!department) return { removed: false };
  await db.department.delete({ where: { id: department.id } });
  await audit(ctx, "department.deleted", "department", department.id, { before: { name: department.name } });
  return { removed: true };
}

// ── Step 4: teams ──
export async function addTeam(ctx: OrgContext, input: z.output<typeof teamSchema>) {
  const orgId = ctx.organization.id;
  if (input.departmentId && !(await db.department.findFirst({ where: { id: input.departmentId, organizationId: orgId }, select: { id: true } }))) {
    throw new AppError("VALIDATION_ERROR", "Select a valid department.", 400);
  }
  if (await nameTaken("team", orgId, input.name)) throw new AppError("DUPLICATE", `A team named "${input.name}" already exists.`, 409);
  const team = await db.team.create({ data: { organizationId: orgId, name: input.name, departmentId: input.departmentId }, select: { id: true, name: true } });
  await audit(ctx, "team.created", "team", team.id, { after: input });
  return team;
}

export async function removeTeam(ctx: OrgContext, id: string) {
  const team = await db.team.findFirst({ where: { id, organizationId: ctx.organization.id }, select: { id: true, name: true } });
  if (!team) return { removed: false };
  await db.team.delete({ where: { id: team.id } });
  await audit(ctx, "team.deleted", "team", team.id, { before: { name: team.name } });
  return { removed: true };
}

// ── Step 5: invitations ──
export async function inviteUser(ctx: OrgContext, input: z.output<typeof inviteSchema>) {
  const orgId = ctx.organization.id;
  const limited = await rateLimit(`invite:${orgId}`, 50, 3600);
  if (!limited.allowed) throw new AppError("RATE_LIMITED", "Too many invitations sent recently. Please try again later.", 429);
  const role = await db.role.findFirst({ where: { id: input.roleId, organizationId: orgId }, select: { id: true, key: true, name: true } });
  if (!role) throw new AppError("VALIDATION_ERROR", "Select a valid role.", 400);
  if (role.key === OWNER_ROLE_KEY && ctx.membership.roleKey !== OWNER_ROLE_KEY) throw new AppError("FORBIDDEN", "Only owners can invite other owners.", 403);
  const member = await db.membership.findFirst({ where: { organizationId: orgId, user: { email: input.email } }, select: { id: true } });
  if (member) throw new AppError("ALREADY_MEMBER", `${input.email} is already a member of this organization.`, 409);

  const token = randomToken();
  const invitation = await db.$transaction(async tx => {
    // Re-inviting replaces any pending invitation for the same address.
    await tx.invitation.updateMany({ where: { organizationId: orgId, email: input.email, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
    return tx.invitation.create({
      data: { organizationId: orgId, email: input.email, roleId: role.id, tokenHash: sha256(token), invitedById: ctx.user.id, expiresAt: new Date(Date.now() + INVITATION_DAYS * 86_400_000) },
      select: { id: true, email: true, expiresAt: true },
    });
  });
  await sendEmail({
    to: input.email,
    template: "invitation",
    organizationId: orgId,
    data: { inviter: ctx.user.name, organization: ctx.organization.name, role: role.name, url: `${env.appUrl}/invite/${token}` },
    entityType: "invitation",
    entityId: invitation.id,
  });
  await audit(ctx, "invitation.created", "invitation", invitation.id, { after: { email: input.email, role: role.key } });
  return { id: invitation.id, email: invitation.email, roleName: role.name, expiresAt: invitation.expiresAt };
}

export async function revokeInvitation(ctx: OrgContext, id: string) {
  const invitation = await db.invitation.findFirst({ where: { id, organizationId: ctx.organization.id, acceptedAt: null, revokedAt: null }, select: { id: true, email: true } });
  if (!invitation) return { revoked: false };
  await db.invitation.update({ where: { id: invitation.id }, data: { revokedAt: new Date() } });
  await audit(ctx, "invitation.revoked", "invitation", invitation.id, { before: { email: invitation.email } });
  return { revoked: true };
}

// ── Step 6: categories (top level) ──
async function categoryNameTaken(orgId: string, name: string, exceptId?: string) {
  const found = await db.ticketCategory.findFirst({
    where: { organizationId: orgId, parentId: null, name: { equals: name, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  return Boolean(found);
}

export async function addCategory(ctx: OrgContext, name: string) {
  if (await categoryNameTaken(ctx.organization.id, name)) throw new AppError("DUPLICATE", `A category named "${name}" already exists.`, 409);
  const category = await db.ticketCategory.create({ data: { organizationId: ctx.organization.id, name }, select: { id: true, name: true } });
  await audit(ctx, "category.created", "ticket_category", category.id, { after: { name } });
  return category;
}

export async function renameCategory(ctx: OrgContext, id: string, name: string) {
  const category = await db.ticketCategory.findFirst({ where: { id, organizationId: ctx.organization.id, parentId: null }, select: { id: true, name: true } });
  if (!category) throw new AppError("CATEGORY_NOT_FOUND", "Category not found.", 404);
  if (category.name === name) return category;
  if (await categoryNameTaken(ctx.organization.id, name, id)) throw new AppError("DUPLICATE", `A category named "${name}" already exists.`, 409);
  const updated = await db.ticketCategory.update({ where: { id }, data: { name }, select: { id: true, name: true } });
  await audit(ctx, "category.updated", "ticket_category", id, { before: { name: category.name }, after: { name } });
  return updated;
}

export async function deleteCategory(ctx: OrgContext, id: string) {
  const category = await db.ticketCategory.findFirst({ where: { id, organizationId: ctx.organization.id, parentId: null }, select: { id: true, name: true } });
  if (!category) return { removed: false };
  try {
    await db.$transaction([
      db.ticketCategory.deleteMany({ where: { parentId: category.id, organizationId: ctx.organization.id } }),
      db.ticketCategory.delete({ where: { id: category.id } }),
    ]);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2003" || error.code === "P2014")) {
      throw new AppError("CATEGORY_IN_USE", "This category is in use and can't be deleted. Deactivate it from settings instead.", 409);
    }
    throw error;
  }
  await audit(ctx, "category.deleted", "ticket_category", category.id, { before: { name: category.name } });
  return { removed: true };
}

// ── Step 7: SLA ──
export async function saveSlaTargets(ctx: OrgContext, input: z.output<typeof slaSchema>) {
  const policy = await db.sLAPolicy.findFirst({
    where: { organizationId: ctx.organization.id, isDefault: true },
    select: { id: true, targets: { select: { id: true, firstResponseMinutes: true, resolutionMinutes: true } } },
  });
  if (!policy) throw new AppError("SLA_NOT_FOUND", "The default SLA policy was not found.", 404);
  const known = new Map(policy.targets.map(t => [t.id, t]));
  const updates = input.targets.filter(t => known.has(t.id));
  if (updates.length !== input.targets.length) throw new AppError("VALIDATION_ERROR", "Some SLA targets do not belong to this organization.", 400);
  await db.$transaction(updates.map(t => db.sLATarget.update({ where: { id: t.id }, data: { firstResponseMinutes: t.firstResponseMinutes, resolutionMinutes: t.resolutionMinutes } })));
  await audit(ctx, "sla_policy.updated", "sla_policy", policy.id, {
    before: policy.targets,
    after: updates,
  });
  return completeStep(ctx, 7);
}

// ── Step 8: finish ──
export async function finishOnboarding(ctx: OrgContext) {
  const done = await db.organization.updateMany({ where: { id: ctx.organization.id, onboardingDoneAt: null }, data: { onboardingDoneAt: new Date(), onboardingStep: LAST_STEP } });
  if (done.count) await audit(ctx, "organization.onboarding_completed", "organization", ctx.organization.id);
  return { redirectTo: "/dashboard" };
}

/** Everything the wizard renders, loaded in one pass and scoped to the organization. */
export async function loadOnboardingData(ctx: OrgContext) {
  const orgId = ctx.organization.id;
  const [org, user, departments, teams, roles, invitations, categories, policy] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: orgId }, select: { name: true, timezone: true, onboardingStep: true, settings: { select: { supportEmail: true } } } }),
    db.user.findUniqueOrThrow({ where: { id: ctx.user.id }, select: { name: true, email: true, jobTitle: true, phone: true } }),
    db.department.findMany({ where: { organizationId: orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.team.findMany({ where: { organizationId: orgId }, orderBy: { name: "asc" }, select: { id: true, name: true, department: { select: { name: true } } } }),
    db.role.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "asc" }, select: { id: true, key: true, name: true, description: true } }),
    db.invitation.findMany({
      where: { organizationId: orgId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" }, take: 100,
      select: { id: true, email: true, expiresAt: true, role: { select: { name: true } } },
    }),
    db.ticketCategory.findMany({
      where: { organizationId: orgId, parentId: null }, orderBy: { name: "asc" },
      select: { id: true, name: true, _count: { select: { children: true } } },
    }),
    db.sLAPolicy.findFirst({
      where: { organizationId: orgId, isDefault: true },
      select: { id: true, name: true, targets: { orderBy: { priority: { order: "asc" } }, select: { id: true, firstResponseMinutes: true, resolutionMinutes: true, priority: { select: { name: true, color: true } } } } },
    }),
  ]);
  const assignableRoles = roles.filter(r => r.key !== OWNER_ROLE_KEY || ctx.membership.roleKey === OWNER_ROLE_KEY);
  return {
    company: { name: org.name, timezone: org.timezone, supportEmail: org.settings?.supportEmail ?? "" },
    onboardingStep: Math.min(Math.max(org.onboardingStep, 1), LAST_STEP),
    admin: { name: user.name, email: user.email, jobTitle: user.jobTitle ?? "", phone: user.phone ?? "" },
    departments,
    teams: teams.map(t => ({ id: t.id, name: t.name, departmentName: t.department?.name ?? null })),
    roles: assignableRoles.map(r => ({ id: r.id, key: r.key, name: r.name, description: r.description })),
    invitations: invitations.map(i => ({ id: i.id, email: i.email, roleName: i.role.name, expiresAt: i.expiresAt.toISOString() })),
    categories: categories.map(c => ({ id: c.id, name: c.name, subcategories: c._count.children })),
    sla: policy ? { id: policy.id, name: policy.name, targets: policy.targets.map(t => ({ id: t.id, priority: t.priority.name, color: t.priority.color, firstResponseMinutes: t.firstResponseMinutes, resolutionMinutes: t.resolutionMinutes })) } : null,
  };
}
export type OnboardingData = Awaited<ReturnType<typeof loadOnboardingData>>;
