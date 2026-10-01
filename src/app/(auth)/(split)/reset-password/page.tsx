import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AuthHeading } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/password-reset-forms";

export const metadata: Metadata = { title: "Choose a new password", referrer: "no-referrer" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token: raw } = await searchParams;
  const token = typeof raw === "string" ? raw.trim() : "";
  if (!token) {
    return (
      <>
        <AuthHeading title="Reset link missing" description="This page needs the link from your password reset email. Request a new one if it expired." />
        <Button asChild className="w-full"><Link href="/forgot-password">Request a reset link</Link></Button>
      </>
    );
  }
  return (
    <>
      <AuthHeading title="Choose a new password" description="Signing in with the new password will be required on all your devices." />
      <ResetPasswordForm token={token} />
    </>
  );
}
