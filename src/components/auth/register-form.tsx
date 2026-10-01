"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormAlert, FormField, PasswordField } from "@/components/auth/form-field";
import { TimezoneSelect } from "@/components/auth/timezone-select";
import { SsoButtons } from "@/components/auth/sso-buttons";
import { registerAction } from "@/server/auth/actions";

type Fields = { name: string; email: string; password: string; organizationName: string; timezone: string };

export function RegisterForm({ timezones, sso }: { timezones: string[]; sso: { google: boolean; microsoft: boolean } }) {
  const [values, setValues] = useState<Fields>({ name: "", email: "", password: "", organizationName: "", timezone: "UTC" });
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (key: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) => setValues(v => ({ ...v, [key]: e.target.value }));

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setErrors({});
    startTransition(async () => {
      const result = await registerAction(values);
      if (!result.ok) {
        setErrors((result.error.fieldErrors ?? {}) as typeof errors);
        if (!result.error.fieldErrors) setFormError(result.error.message);
        return;
      }
      const signedIn = await signIn("credentials", { email: result.data.email, password: values.password, redirect: false });
      if (!signedIn?.ok || signedIn.error) {
        toast.success("Account created. Please sign in.");
        window.location.assign("/login?next=/onboarding");
        return;
      }
      toast.success("Your workspace is ready");
      window.location.assign("/onboarding");
    });
  }

  return (
    <div className="space-y-6">
      <SsoButtons sso={sso} callbackUrl="/onboarding" disabled={pending} />
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormAlert message={formError} />
        <FormField label="Full name" name="name" autoComplete="name" required autoFocus value={values.name} onChange={set("name")} error={errors.name} />
        <FormField label="Work email" name="email" type="email" autoComplete="email" inputMode="email" required value={values.email} onChange={set("email")} error={errors.email} placeholder="you@company.com" />
        <PasswordField
          label="Password" name="password" autoComplete="new-password" required value={values.password} onChange={set("password")}
          error={errors.password} hint="At least 8 characters with a letter and a number."
        />
        <FormField label="Organization name" name="organizationName" autoComplete="organization" required value={values.organizationName} onChange={set("organizationName")} error={errors.organizationName} placeholder="Acme Inc." />
        <TimezoneSelect detect timezones={timezones} value={values.timezone} onChange={tz => setValues(v => ({ ...v, timezone: tz }))} error={errors.timezone} />
        <Button type="submit" className="h-10 w-full" disabled={pending}>
          {pending ? <><Loader2 className="animate-spin" aria-hidden="true" /> Creating your workspace…</> : "Create account"}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account? <Link href="/login" className="font-medium text-primary hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
