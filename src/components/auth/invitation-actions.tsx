"use client";

import { useState, useTransition } from "react";
import { signIn, signOut } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormAlert, FormField, PasswordField } from "@/components/auth/form-field";
import { acceptInvitationAction, acceptInvitationWithAccountAction, openOrganizationAction } from "@/server/auth/actions";

export function AcceptInvitationButton({ token, organizationName }: { token: string; organizationName: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <FormAlert message={error} />
      <Button
        className="h-10 w-full" disabled={pending}
        onClick={() => startTransition(async () => {
          setError(null);
          const result = await acceptInvitationAction({ token });
          if (!result.ok) {
            setError(result.error.message);
            toast.error(result.error.message);
            return;
          }
          toast.success(`You joined ${organizationName}`);
          window.location.assign(result.data.redirectTo);
        })}
      >
        {pending ? <><Loader2 className="animate-spin" aria-hidden="true" /> Joining…</> : `Join ${organizationName}`}
      </Button>
    </div>
  );
}

export function OpenOrganizationButton({ organizationId, label }: { organizationId: string; label: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      className="h-10 w-full" disabled={pending}
      onClick={() => startTransition(async () => {
        const result = await openOrganizationAction({ organizationId });
        if (!result.ok) {
          toast.error(result.error.message);
          return;
        }
        window.location.assign(result.data.redirectTo);
      })}
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null} {label}
    </Button>
  );
}

export function SignOutAndReturnButton({ returnTo, label = "Sign out" }: { returnTo: string; label?: string }) {
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="outline" className="h-10 w-full" disabled={pending}
      onClick={() => { setPending(true); void signOut({ callbackUrl: returnTo }); }}
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null} {label}
    </Button>
  );
}

export function InvitationSignupForm({ token, email }: { token: string; email: string }) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ name?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    startTransition(async () => {
      const result = await acceptInvitationWithAccountAction({ token, name, password });
      if (!result.ok) {
        const fe = result.error.fieldErrors;
        if (fe && (fe.name || fe.password)) setErrors({ name: fe.name, password: fe.password });
        else setFormError(result.error.message);
        return;
      }
      const signedIn = await signIn("credentials", { email: result.data.email, password, redirect: false });
      if (!signedIn?.ok || signedIn.error) {
        toast.success("Account created. Please sign in.");
        window.location.assign(`/login?next=${encodeURIComponent(result.data.redirectTo)}`);
        return;
      }
      toast.success("Welcome aboard");
      window.location.assign(result.data.redirectTo);
    });
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <FormAlert message={formError} />
      <FormField label="Email" name="email" type="email" value={email} readOnly disabled autoComplete="email" />
      <FormField label="Full name" name="name" autoComplete="name" required autoFocus value={name} onChange={e => setName(e.target.value)} error={errors.name} />
      <PasswordField label="Choose a password" name="password" autoComplete="new-password" required value={password} onChange={e => setPassword(e.target.value)} error={errors.password} hint="At least 8 characters with a letter and a number." />
      <Button type="submit" className="h-10 w-full" disabled={pending}>
        {pending ? <><Loader2 className="animate-spin" aria-hidden="true" /> Creating account…</> : "Create account and join"}
      </Button>
    </form>
  );
}
