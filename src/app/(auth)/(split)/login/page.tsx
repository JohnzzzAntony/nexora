import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { features } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthHeading } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { safeNextPath } from "@/server/auth/redirect";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  if (await getCurrentUser()) redirect(next);
  const error = typeof params.error === "string" ? params.error.slice(0, 64) : undefined;
  return (
    <>
      <AuthHeading title="Welcome back" description="Sign in to your Nexora workspace." />
      <LoginForm next={next} sso={{ google: features.googleSso, microsoft: features.microsoftSso }} initialError={error} neonEnabled={features.neonAuth} />
    </>
  );
}
