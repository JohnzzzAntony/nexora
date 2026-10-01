"use server";

import { safeAction, withContext, type ActionResult } from "@/lib/actions";
import { AppError } from "@/lib/api/errors";
import { getCurrentUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { writeAudit } from "@/lib/audit";
import { createOrganization } from "@/server/organizations/bootstrap";
import { requestMeta, setActiveOrganizationCookie } from "@/server/auth/request";
import {
  adminSchema, companySchema, createOrganizationSchema, idSchema, inviteSchema, nameSchema, renameSchema, slaSchema, stepSchema, teamSchema,
} from "@/server/onboarding/schemas";
import * as onboarding from "@/server/onboarding/service";

/** For signed-in users who do not belong to any organization yet (e.g. first SSO sign-in). */
export async function createOrganizationAction(input: { name: string; timezone: string }): Promise<ActionResult<{ organizationId: string }>> {
  return safeAction(async () => {
    const user = await getCurrentUser();
    if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in to continue.", 401);
    const limited = await rateLimit(`org-create:${user.id}`, 3, 3600);
    if (!limited.allowed) throw new AppError("RATE_LIMITED", "Too many organizations created recently. Please try again later.", 429);
    const data = createOrganizationSchema.parse(input);
    const meta = await requestMeta();
    const { organization } = await createOrganization({ name: data.name, ownerId: user.id, timezone: data.timezone });
    await writeAudit({ organizationId: organization.id, userId: user.id, action: "organization.created", entityType: "organization", entityId: organization.id, after: { name: organization.name }, ip: meta.ip, userAgent: meta.userAgent });
    await setActiveOrganizationCookie(organization.id);
    return { organizationId: organization.id };
  });
}

export async function saveCompanyAction(input: { name: string; timezone: string; supportEmail?: string }) {
  return withContext(async ctx => { onboarding.assertCanOnboard(ctx); return onboarding.saveCompany(ctx, companySchema.parse(input)); });
}

export async function saveAdminProfileAction(input: { name: string; jobTitle?: string; phone?: string }) {
  return withContext(async ctx => { onboarding.assertCanOnboard(ctx); return onboarding.saveAdminProfile(ctx, adminSchema.parse(input)); });
}

export async function addDepartmentAction(input: { name: string }) {
  return withContext(async ctx => { onboarding.assertCanOnboard(ctx); return onboarding.addDepartment(ctx, nameSchema.parse(input).name); });
}

export async function removeDepartmentAction(input: { id: string }) {
  return withContext(async ctx => { onboarding.assertCanOnboard(ctx); return onboarding.removeDepartment(ctx, idSchema.parse(input).id); });
}

export async function addTeamAction(input: { name: string; departmentId?: string }) {
  return withContext(async ctx => { onboarding.assertCanOnboard(ctx); return onboarding.addTeam(ctx, teamSchema.parse(input)); });
}

export async function removeTeamAction(input: { id: string }) {
  return withContext(async ctx => { onboarding.assertCanOnboard(ctx); return onboarding.removeTeam(ctx, idSchema.parse(input).id); });
}

export async function inviteUserAction(input: { email: string; roleId: string }) {
  return withContext(async ctx => { onboarding.assertCanOnboard(ctx); return onboarding.inviteUser(ctx, inviteSchema.parse(input)); });
}

export async function revokeInvitationAction(input: { id: string }) {
  return withContext(async ctx => { onboarding.assertCanOnboard(ctx); return onboarding.revokeInvitation(ctx, idSchema.parse(input).id); });
}

export async function addCategoryAction(input: { name: string }) {
  return withContext(async ctx => { onboarding.assertCanOnboard(ctx); return onboarding.addCategory(ctx, nameSchema.parse(input).name); });
}

export async function renameCategoryAction(input: { id: string; name: string }) {
  return withContext(async ctx => { onboarding.assertCanOnboard(ctx); const data = renameSchema.parse(input); return onboarding.renameCategory(ctx, data.id, data.name); });
}

export async function deleteCategoryAction(input: { id: string }) {
  return withContext(async ctx => { onboarding.assertCanOnboard(ctx); return onboarding.deleteCategory(ctx, idSchema.parse(input).id); });
}

export async function saveSlaTargetsAction(input: { targets: { id: string; firstResponseMinutes: number; resolutionMinutes: number }[] }) {
  return withContext(async ctx => { onboarding.assertCanOnboard(ctx); return onboarding.saveSlaTargets(ctx, slaSchema.parse(input)); });
}

/** Continue / Skip for steps whose data is saved row-by-row. */
export async function completeStepAction(input: { step: number }) {
  return withContext(async ctx => { onboarding.assertCanOnboard(ctx); return onboarding.completeStep(ctx, stepSchema.parse(input).step); });
}

export async function finishOnboardingAction() {
  return withContext(async ctx => { onboarding.assertCanOnboard(ctx); return onboarding.finishOnboarding(ctx); });
}
