import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { requireOrganizationAccess } from "@/lib/tenancy/context";
import { PageHeader } from "@/components/ui/page-header";
import { getNotificationPreferences, listMemberships, listSessions } from "@/server/profile/service";
import { ProfileTabs, type ProfileTab } from "./_components/profile-tabs";

export const metadata: Metadata = { title: "Profile" };

const TABS: ProfileTab[] = ["profile", "password", "sessions", "notifications", "organizations"];

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const ctx = await requireOrganizationAccess();
  const current = await getCurrentUser();
  if (!current) redirect("/login?next=/profile");
  const { tab: raw } = await searchParams;
  const tab = TABS.find(t => t === (Array.isArray(raw) ? raw[0] : raw)) ?? "profile";

  const [user, sessions, preferences, memberships] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: ctx.user.id }, select: { name: true, email: true, jobTitle: true, phone: true, avatarUrl: true, passwordHash: true, emailVerifiedAt: true } }),
    listSessions(ctx.user.id, current.sessionId),
    getNotificationPreferences(ctx),
    listMemberships(ctx.user.id),
  ]);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader title="Profile" description="Manage your personal details, security and notification preferences." />
      <ProfileTabs
        initialTab={tab}
        timezone={ctx.organization.timezone}
        organizationName={ctx.organization.name}
        activeOrganizationId={ctx.organization.id}
        profile={{ name: user.name, email: user.email, jobTitle: user.jobTitle ?? "", phone: user.phone ?? "", avatarUrl: user.avatarUrl ?? "", emailVerified: Boolean(user.emailVerifiedAt) }}
        hasPassword={Boolean(user.passwordHash)}
        sessions={sessions}
        preferences={preferences}
        memberships={memberships}
      />
    </div>
  );
}
