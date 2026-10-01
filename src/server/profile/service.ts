import "server-only";
import type { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/api/errors";
import { writeAudit } from "@/lib/audit";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { rateLimit } from "@/lib/rate-limit";
import { OWNER_ROLE_KEY } from "@/lib/permissions/catalog";
import type { OrgContext } from "@/lib/tenancy/context";
import { NOTIFICATION_EVENTS } from "@/server/profile/events";
import type { changePasswordSchema, preferencesSchema, profileSchema } from "@/server/profile/schemas";

type Meta = { ip?: string; userAgent?: string };

export async function updateProfile(ctx: OrgContext, input: z.output<typeof profileSchema>) {
  await db.user.update({ where: { id: ctx.user.id }, data: input });
  return { updated: true };
}

/** Changes the password and signs out every other session. */
export async function changePassword(ctx: OrgContext, currentSessionId: string, input: z.output<typeof changePasswordSchema>, meta: Meta) {
  const limited = await rateLimit(`pwchange:${ctx.user.id}`, 5, 15 * 60);
  if (!limited.allowed) throw new AppError("RATE_LIMITED", "Too many attempts. Please wait a few minutes and try again.", 429);
  const user = await db.user.findUniqueOrThrow({ where: { id: ctx.user.id }, select: { passwordHash: true } });
  // SSO-only accounts have no password yet and may set one directly.
  if (user.passwordHash) {
    if (!input.currentPassword || !(await verifyPassword(input.currentPassword, user.passwordHash))) {
      throw new AppError("VALIDATION_ERROR", "Your current password is incorrect.", 400);
    }
  }
  const passwordHash = await hashPassword(input.newPassword);
  const revoked = await db.$transaction(async tx => {
    await tx.user.update({ where: { id: ctx.user.id }, data: { passwordHash } });
    const result = await tx.session.updateMany({ where: { userId: ctx.user.id, revokedAt: null, id: { not: currentSessionId } }, data: { revokedAt: new Date() } });
    await writeAudit({ organizationId: ctx.organization.id, userId: ctx.user.id, action: user.passwordHash ? "user.password_changed" : "user.password_set", entityType: "user", entityId: ctx.user.id, after: { revokedSessions: result.count }, ip: meta.ip, userAgent: meta.userAgent }, tx);
    return result.count;
  });
  return { revokedSessions: revoked };
}

export async function listSessions(userId: string, currentSessionId: string) {
  const rows = await db.session.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, ip: true, userAgent: true, createdAt: true, lastSeenAt: true, expiresAt: true, revokedAt: true },
  });
  const now = new Date();
  return rows.map(s => ({
    id: s.id,
    ip: s.ip,
    userAgent: s.userAgent,
    createdAt: s.createdAt.toISOString(),
    lastSeenAt: s.lastSeenAt.toISOString(),
    status: s.revokedAt ? ("signed_out" as const) : s.expiresAt < now ? ("expired" as const) : ("active" as const),
    current: s.id === currentSessionId,
  }));
}

export async function revokeSession(ctx: OrgContext, currentSessionId: string, sessionId: string, meta: Meta) {
  if (sessionId === currentSessionId) throw new AppError("CURRENT_SESSION", "Use Sign out to end the session on this device.", 400);
  const result = await db.session.updateMany({ where: { id: sessionId, userId: ctx.user.id, revokedAt: null }, data: { revokedAt: new Date() } });
  if (result.count) await writeAudit({ organizationId: ctx.organization.id, userId: ctx.user.id, action: "auth.session_revoked", entityType: "session", entityId: sessionId, ip: meta.ip, userAgent: meta.userAgent });
  return { revoked: result.count };
}

export async function revokeOtherSessions(ctx: OrgContext, currentSessionId: string, meta: Meta) {
  const result = await db.session.updateMany({ where: { userId: ctx.user.id, revokedAt: null, id: { not: currentSessionId } }, data: { revokedAt: new Date() } });
  if (result.count) await writeAudit({ organizationId: ctx.organization.id, userId: ctx.user.id, action: "auth.sessions_revoked", entityType: "user", entityId: ctx.user.id, after: { count: result.count }, ip: meta.ip, userAgent: meta.userAgent });
  return { revoked: result.count };
}

/** Effective preferences for every configurable event (missing rows default to on/on). */
export async function getNotificationPreferences(ctx: OrgContext) {
  const rows = await db.notificationPreference.findMany({ where: { userId: ctx.user.id, organizationId: ctx.organization.id } });
  const byType = new Map(rows.map(r => [r.eventType, r]));
  return NOTIFICATION_EVENTS.map(e => ({ eventType: e.key, inApp: byType.get(e.key)?.inApp ?? true, email: byType.get(e.key)?.email ?? true }));
}

export async function saveNotificationPreferences(ctx: OrgContext, input: z.output<typeof preferencesSchema>) {
  const userId = ctx.user.id;
  const organizationId = ctx.organization.id;
  await db.$transaction(input.preferences.map(p => db.notificationPreference.upsert({
    where: { userId_organizationId_eventType: { userId, organizationId, eventType: p.eventType } },
    create: { userId, organizationId, eventType: p.eventType, inApp: p.inApp, email: p.email },
    update: { inApp: p.inApp, email: p.email },
  })));
  return { saved: input.preferences.length };
}

export async function listMemberships(userId: string) {
  const memberships = await db.membership.findMany({
    where: { userId },
    orderBy: { joinedAt: "asc" },
    select: { id: true, status: true, joinedAt: true, organization: { select: { id: true, name: true } }, role: { select: { key: true, name: true } } },
  });
  const ownedOrgIds = memberships.filter(m => m.role.key === OWNER_ROLE_KEY && m.status === "ACTIVE").map(m => m.organization.id);
  const ownerCounts = ownedOrgIds.length
    ? await db.membership.groupBy({ by: ["organizationId"], where: { organizationId: { in: ownedOrgIds }, status: "ACTIVE", role: { key: OWNER_ROLE_KEY } }, _count: { _all: true } })
    : [];
  const counts = new Map(ownerCounts.map(c => [c.organizationId, c._count._all]));
  return memberships.map(m => ({
    organizationId: m.organization.id,
    organizationName: m.organization.name,
    roleName: m.role.name,
    status: m.status,
    joinedAt: m.joinedAt.toISOString(),
    isLastOwner: m.role.key === OWNER_ROLE_KEY && m.status === "ACTIVE" && (counts.get(m.organization.id) ?? 0) <= 1,
  }));
}

export async function leaveOrganization(ctx: OrgContext, organizationId: string, meta: Meta) {
  const membership = await db.membership.findUnique({
    where: { organizationId_userId: { organizationId, userId: ctx.user.id } },
    select: { id: true, status: true, role: { select: { key: true, name: true } } },
  });
  if (!membership) throw new AppError("MEMBERSHIP_NOT_FOUND", "You are not a member of this organization.", 404);
  await db.$transaction(async tx => {
    if (membership.role.key === OWNER_ROLE_KEY && membership.status === "ACTIVE") {
      const owners = await tx.membership.count({ where: { organizationId, status: "ACTIVE", role: { key: OWNER_ROLE_KEY } } });
      if (owners <= 1) throw new AppError("LAST_OWNER", "You are the only owner. Transfer ownership to another member before leaving.", 409);
    }
    await tx.teamMember.deleteMany({ where: { userId: ctx.user.id, team: { organizationId } } });
    await tx.notificationPreference.deleteMany({ where: { userId: ctx.user.id, organizationId } });
    await tx.membership.delete({ where: { id: membership.id } });
    await writeAudit({ organizationId, userId: ctx.user.id, action: "membership.left", entityType: "membership", entityId: membership.id, before: { role: membership.role.key }, ip: meta.ip, userAgent: meta.userAgent }, tx);
  });
  return { left: true, wasActiveOrganization: organizationId === ctx.organization.id };
}
