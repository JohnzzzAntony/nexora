"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormAlert, FormField, PasswordField } from "@/components/auth/form-field";
import { SsoButtons } from "@/components/auth/sso-buttons";

const OAUTH_ERRORS: Record<string, string> = {
  OAuthEmail: "Your identity provider did not return a verified email address.",
  AccessDenied: "This account is not allowed to sign in. Contact your administrator.",
  OAuthAccountNotLinked: "This email is already linked to a different sign-in method.",
  OAuthSignin: "Could not start single sign-on. Please try again.",
  OAuthCallback: "Single sign-on failed. Please try again.",
  SessionRequired: "Please sign in to continue.",
};

function credentialError(code?: string | null) {
  if (!code) return null;
  if (code === "CredentialsSignin") return "Incorrect email or password.";
  // Errors thrown by the credentials provider (e.g. rate limiting) are passed through verbatim.
  if (code.length < 200 && !code.includes("Error")) return code;
  return "Sign-in failed. Please try again.";
}

export function LoginForm({ next, sso, initialError, neonEnabled = false }: { next: string; sso: { google: boolean; microsoft: boolean }; initialError?: string; neonEnabled?: boolean }) {
  const [provider, setProvider] = useState("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(initialError ? (OAUTH_ERRORS[initialError] ?? "Sign-in failed. Please try again.") : null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) nextErrors.email = "Enter a valid email address";
    if (!password) nextErrors.password = "Enter your password";
    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length) return;
    startTransition(async () => {
      const result = await signIn(provider, { email: email.trim().toLowerCase(), password, redirect: false });
      if (!result || result.error || !result.ok) {
        setFormError(credentialError(result?.error) ?? "Sign-in failed. Please try again.");
        return;
      }
      // Full navigation so every server component sees the new session cookie.
      window.location.assign(next);
    });
  }

  return (
    <div className="space-y-6">
      <SsoButtons sso={sso} callbackUrl={next} disabled={pending} />
      <form onSubmit={submit} noValidate className="space-y-4" aria-describedby={formError ? "login-error" : undefined}>
        <div id="login-error"><FormAlert message={formError} /></div>
        {neonEnabled && <label className="grid gap-1.5 text-sm font-medium">Account type<select value={provider} onChange={e => setProvider(e.target.value)} className="h-10 rounded-md border bg-background px-3"><option value="credentials">Nexora workspace account</option><option value="neon">Neon Auth account</option></select>{provider === "neon" && <span className="text-xs font-normal text-muted-foreground">Use a verified account registered with your Neon Auth service.</span>}</label>}
        <FormField
          label="Work email" name="email" type="email" autoComplete="email" inputMode="email" autoFocus required
          value={email} onChange={e => setEmail(e.target.value)} error={errors.email} placeholder="you@company.com"
        />
        <PasswordField
          label="Password" name="password" autoComplete="current-password" required
          value={password} onChange={e => setPassword(e.target.value)} error={errors.password}
          labelAction={<Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">Forgot password?</Link>}
        />
        <Button type="submit" className="h-10 w-full" disabled={pending}>
          {pending ? <><Loader2 className="animate-spin" aria-hidden="true" /> Signing in…</> : "Sign in"}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        New to Nexora?{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">Create an account</Link>
      </p>
    </div>
  );
}
