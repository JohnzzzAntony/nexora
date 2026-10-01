import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { forbidden, redirect, unauthorized } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { AppError } from "@/lib/api/errors";
import type { Permission } from "@/lib/permissions/catalog";
import { loadContext, type OrgContext } from "@/lib/tenancy/load";
import { db } from "@/lib/db";

export const ORG_COOKIE = "duoonex_org";

export { loadContext, requirePermission, type OrgContext } from "@/lib/tenancy/load";

/** Active organization for the signed-in user (cookie preference, else first membership). */
export const getOrganizationContext = cache(async (): Promise<OrgContext | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const preferred = (await cookies()).get(ORG_COOKIE)?.value;
  return (preferred && (await loadContext(user.id, preferred))) || (await loadContext(user.id, undefined));
});

/** For pages/layouts: redirects to login or onboarding when there is no usable context. */
export async function requireOrganizationAccess(options: { allowCustomer?: boolean } = {}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const ctx = await getOrganizationContext();
  if (!ctx) redirect("/onboarding");
  const policy = await db.organizationSettings.findUnique({ where: { organizationId: ctx.organization.id }, select: { requireEmailVerification: true } });
  if (policy?.requireEmailVerification && !user.emailVerifiedAt) redirect("/verify-email");
  if (ctx.isCustomer && !options.allowCustomer) redirect("/portal");
  return ctx;
}

/** For pages: renders the 403 page when a permission is missing. */
export async function requirePagePermission(...anyOf: Permission[]) {
  const ctx = await requireOrganizationAccess();
  if (anyOf.length && !anyOf.some(p => ctx.can(p))) forbidden();
  return ctx;
}

/** For route handlers and server actions: throws AppError (401/403). */
export async function requireApiContext(): Promise<OrgContext> {
  const ctx = await getOrganizationContext();
  if (!ctx) {
    if (!(await getCurrentUser())) throw new AppError("UNAUTHENTICATED", "Please sign in to continue.", 401);
    throw new AppError("NO_ORGANIZATION", "You are not a member of an active organization.", 403);
  }
  const [policy, user] = await Promise.all([db.organizationSettings.findUnique({ where: { organizationId: ctx.organization.id }, select: { requireEmailVerification: true } }), getCurrentUser()]);
  if (policy?.requireEmailVerification && !user?.emailVerifiedAt) throw new AppError("EMAIL_NOT_VERIFIED", "Verify your email to access this workspace.", 403);
  return ctx;
}


export { unauthorized };
