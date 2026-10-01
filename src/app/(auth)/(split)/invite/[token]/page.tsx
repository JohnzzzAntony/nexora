import type { Metadata } from "next";
import Link from "next/link";
import { Building2, MailWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthHeading } from "@/components/auth/auth-shell";
import { FormAlert } from "@/components/auth/form-field";
import { AcceptInvitationButton, InvitationSignupForm, OpenOrganizationButton, SignOutAndReturnButton } from "@/components/auth/invitation-actions";
import { findInvitation, invitationStateMessage } from "@/server/auth/service";

export const metadata: Metadata = { title: "Join your team", referrer: "no-referrer" };

function InvitationSummary({ organization, role, inviter }: { organization: string; role: string; inviter: string }) {
  return (
    <div className="mb-6 flex items-center gap-3 rounded-xl border bg-muted/40 p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Building2 className="size-5" aria-hidden="true" /></span>
      <div className="min-w-0 text-sm">
        <p className="truncate font-medium">{organization}</p>
        <p className="text-muted-foreground">{inviter} invited you as <span className="font-medium text-foreground">{role}</span></p>
      </div>
    </div>
  );
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = raw.trim().slice(0, 256);
  const { state, invitation } = await findInvitation(token);
  const returnTo = `/invite/${encodeURIComponent(token)}`;

  if (state !== "valid" || !invitation) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600"><MailWarning className="size-6" aria-hidden="true" /></div>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Invitation unavailable</h1>
          <p className="text-sm text-muted-foreground">{invitationStateMessage(state)}</p>
        </div>
        <Button asChild variant="outline" className="w-full"><Link href="/login">Go to sign in</Link></Button>
      </div>
    );
  }

  const email = invitation.email.trim().toLowerCase();
  const summary = <InvitationSummary organization={invitation.organization.name} role={invitation.role.name} inviter={invitation.invitedBy.name} />;
  const [user, existingAccount] = await Promise.all([
    getCurrentUser(),
    db.user.findUnique({ where: { email }, select: { id: true } }),
  ]);

  // Signed in as someone else: the invitation must be accepted by its addressee.
  if (user && user.email.toLowerCase() !== email) {
    return (
      <>
        <AuthHeading title={`Join ${invitation.organization.name}`} />
        {summary}
        <div className="space-y-4">
          <FormAlert tone="info" message={`You're signed in as ${user.email}, but this invitation was sent to ${email}. Sign out, then open the invitation link again.`} />
          <SignOutAndReturnButton returnTo={returnTo} label="Sign out and continue" />
        </div>
      </>
    );
  }

  if (existingAccount) {
    if (!user) {
      return (
        <>
          <AuthHeading title={`Join ${invitation.organization.name}`} description={`Sign in as ${email} to accept this invitation.`} />
          {summary}
          <Button asChild className="h-10 w-full"><Link href={`/login?next=${encodeURIComponent(returnTo)}`}>Sign in to accept</Link></Button>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Forgot your password? <Link href="/forgot-password" className="font-medium text-primary hover:underline">Reset it</Link>
          </p>
        </>
      );
    }
    const membership = await db.membership.findUnique({
      where: { organizationId_userId: { organizationId: invitation.organizationId, userId: user.id } },
      select: { status: true },
    });
    if (membership?.status === "DEACTIVATED") {
      return (
        <>
          <AuthHeading title={`Join ${invitation.organization.name}`} />
          {summary}
          <FormAlert message="Your access to this organization has been deactivated. Ask an administrator to reactivate your account; accepting an invitation does not restore access automatically." />
        </>
      );
    }
    if (membership?.status === "ACTIVE") {
      return (
        <>
          <AuthHeading title="You're already a member" description={`You already have access to ${invitation.organization.name}.`} />
          {summary}
          <OpenOrganizationButton organizationId={invitation.organizationId} label={`Open ${invitation.organization.name}`} />
        </>
      );
    }
    return (
      <>
        <AuthHeading title={`Join ${invitation.organization.name}`} description={`Signed in as ${user.email}.`} />
        {summary}
        <AcceptInvitationButton token={token} organizationName={invitation.organization.name} />
      </>
    );
  }

  return (
    <>
      <AuthHeading title={`Join ${invitation.organization.name}`} description="Create your account to accept the invitation." />
      {summary}
      <InvitationSignupForm token={token} email={email} />
    </>
  );
}
