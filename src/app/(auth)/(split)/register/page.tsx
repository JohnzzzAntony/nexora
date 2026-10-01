import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { features } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthHeading } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Create your account" };

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  // The ?plan= hint from the pricing section is intentionally ignored here: every workspace
  // starts on Free and upgrades through billing settings.
  const timezones = ["UTC", ...Intl.supportedValuesOf("timeZone").filter(tz => tz !== "UTC")];
  return (
    <>
      <AuthHeading title="Create your workspace" description="Set up your organization in under a minute. No credit card required." />
      <RegisterForm timezones={timezones} sso={{ google: features.googleSso, microsoft: features.microsoftSso }} />
    </>
  );
}
