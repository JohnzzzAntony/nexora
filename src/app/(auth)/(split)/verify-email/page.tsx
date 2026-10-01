import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, MailWarning, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { ResendVerificationButton } from "@/components/auth/password-reset-forms";
import { verifyEmailToken } from "@/server/auth/service";

export const metadata: Metadata = { title: "Verify your email", referrer: "no-referrer" };

function StatusIcon({ tone, children }: { tone: "success" | "warning" | "info"; children: React.ReactNode }) {
  const styles = { success: "bg-emerald-500/10 text-emerald-600", warning: "bg-amber-500/10 text-amber-600", info: "bg-primary/10 text-primary" }[tone];
  return <div className={`mx-auto flex size-12 items-center justify-center rounded-full ${styles}`}>{children}</div>;
}

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token: raw } = await searchParams;
  const token = typeof raw === "string" ? raw.trim().slice(0, 256) : "";
  const user = await getCurrentUser();

  if (token) {
    const verified = await verifyEmailToken(token);
    if (verified) {
      return (
        <div className="space-y-6 text-center" role="status">
          <StatusIcon tone="success"><CheckCircle2 className="size-6" aria-hidden="true" /></StatusIcon>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight">Email verified</h1>
            <p className="text-sm text-muted-foreground">Thanks for confirming your email address.</p>
          </div>
          <Button asChild className="w-full"><Link href={user ? "/dashboard" : "/login"}>{user ? "Continue to workspace" : "Sign in"}</Link></Button>
        </div>
      );
    }
    return (
      <div className="space-y-6 text-center">
        <StatusIcon tone="warning"><MailWarning className="size-6" aria-hidden="true" /></StatusIcon>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Link expired or already used</h1>
          <p className="text-sm text-muted-foreground">
            {user?.emailVerifiedAt ? "Your email address is already verified." : "Verification links are valid for 24 hours and can be used once."}
          </p>
        </div>
        {user && !user.emailVerifiedAt ? <ResendVerificationButton /> : null}
        {!user ? <Button asChild className="w-full"><Link href="/login?next=/verify-email">Sign in to request a new link</Link></Button> : null}
        {user?.emailVerifiedAt ? <Button asChild className="w-full"><Link href="/dashboard">Continue to workspace</Link></Button> : null}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6 text-center">
        <StatusIcon tone="info"><Mail className="size-6" aria-hidden="true" /></StatusIcon>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Verify your email</h1>
          <p className="text-sm text-muted-foreground">Open the link in the verification email we sent you, or sign in to request a new one.</p>
        </div>
        <Button asChild className="w-full"><Link href="/login?next=/verify-email">Sign in</Link></Button>
      </div>
    );
  }

  if (user.emailVerifiedAt) {
    return (
      <div className="space-y-6 text-center" role="status">
        <StatusIcon tone="success"><CheckCircle2 className="size-6" aria-hidden="true" /></StatusIcon>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">You&apos;re verified</h1>
          <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">{user.email}</span> is confirmed.</p>
        </div>
        <Button asChild className="w-full"><Link href="/dashboard">Continue to workspace</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-center">
      <StatusIcon tone="info"><Mail className="size-6" aria-hidden="true" /></StatusIcon>
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Check your inbox</h1>
        <p className="text-sm text-muted-foreground">We sent a verification link to <span className="font-medium text-foreground">{user.email}</span>. It expires in 24 hours.</p>
      </div>
      <ResendVerificationButton />
      <Button asChild variant="ghost" className="w-full"><Link href="/dashboard">Do this later</Link></Button>
    </div>
  );
}
