import type { Metadata } from "next";
import { AuthHeading } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/password-reset-forms";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthHeading title="Forgot your password?" description="Enter the email you use for Nexora and we'll send you a reset link." />
      <ForgotPasswordForm />
    </>
  );
}
