import "server-only";
import { AppError } from "@/lib/api/errors";
import { db } from "@/lib/db";
import { CUSTOMER_ROLE_KEY, type Permission } from "@/lib/permissions/catalog";

export type OrgContext = {
  user: { id: string; email: string; name: string; avatarUrl: string | null; isSuperAdmin: boolean };
  organization: { id: string; name: string; slug: string; timezone: string; plan: string; logoUrl: string | null; onboardingDoneAt: Date | null };
  membership: { id: string; roleId: string; roleKey: string; roleName: string; departmentId: string | null; locationId: string | null; customerId: string | null };
  permissions: ReadonlySet<Permission>;
  teamIds: string[];
  isCustomer: boolean;
  via: "session" | "apiKey";
  can: (permission: Permission) => boolean;
};

export async function loadContext(userId: string, organizationId: string | undefined, via: OrgContext["via"] = "session", scopes?: string[]): Promise<OrgContext | null> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, avatarUrl: true, isSuperAdmin: true, isActive: true } });
  if (!user?.isActive) return null;
  const memberships = await db.membership.findMany({
    where: { userId, status: "ACTIVE", ...(organizationId ? { organizationId } : {}) },
    orderBy: { joinedAt: "asc" },
    take: 1,
    include: {
      organization: { select: { id: true, name: true, slug: true, timezone: true, plan: true, logoUrl: true, onboardingDoneAt: true } },
      role: { select: { id: true, key: true, name: true, permissions: { select: { permission: true } } } },
    },
  });
  const m = memberships[0];
  if (!m) return null;
  let granted = m.role.permissions.map(p => p.permission as Permission);
  if (scopes) granted = granted.filter(p => scopes.includes(p));
  const permissions = new Set<Permission>(granted);
  const teams = await db.teamMember.findMany({ where: { userId, team: { organizationId: m.organizationId } }, select: { teamId: true } });
  const { isActive: _active, ...publicUser } = user;
  return {
    user: publicUser,
    organization: m.organization,
    membership: { id: m.id, roleId: m.role.id, roleKey: m.role.key, roleName: m.role.name, departmentId: m.departmentId, locationId: m.locationId, customerId: m.customerId },
    permissions,
    teamIds: teams.map(t => t.teamId),
    isCustomer: m.role.key === CUSTOMER_ROLE_KEY,
    via,
    can: (p: Permission) => permissions.has(p),
  };
}

export function requirePermission(ctx: OrgContext, ...anyOf: Permission[]) {
  if (!anyOf.some(p => ctx.can(p))) throw new AppError("FORBIDDEN", "You do not have permission to perform this action.", 403);
}
