import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireOrganizationAccess } from "@/lib/tenancy/context";
import { AppShell } from "@/components/shell/app-shell";
import { SIDEBAR_COOKIE, type ShellData } from "@/components/shell/types";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrganizationAccess();
  const isAdmin = ctx.membership.roleKey === "owner" || ctx.membership.roleKey === "admin";
  if (!ctx.organization.onboardingDoneAt && isAdmin) redirect("/onboarding");

  const [memberships, cookieStore] = await Promise.all([
    db.membership.findMany({
      where: { userId: ctx.user.id, status: "ACTIVE" },
      include: { organization: { select: { id: true, name: true } } },
      orderBy: { joinedAt: "asc" },
    }),
    cookies(),
  ]);

  const data: ShellData = {
    user: { id: ctx.user.id, name: ctx.user.name, email: ctx.user.email, avatarUrl: ctx.user.avatarUrl },
    organization: { id: ctx.organization.id, name: ctx.organization.name, logoUrl: ctx.organization.logoUrl, slug: ctx.organization.slug },
    role: ctx.membership.roleName,
    permissions: [...ctx.permissions],
    organizations: memberships.map(m => ({ id: m.organization.id, name: m.organization.name })),
    sidebarCollapsed: cookieStore.get(SIDEBAR_COOKIE)?.value === "collapsed",
  };

  return <AppShell data={data}>{children}</AppShell>;
}
