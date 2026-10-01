"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormAlert, FormField, PasswordField } from "@/components/auth/form-field";
import { requestPasswordResetAction, resendVerificationAction, resetPasswordAction } from "@/server/auth/actions";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setFormError(null);
    startTransition(async () => {
      const result = await requestPasswordResetAction({ email });
      if (!result.ok) {
        if (result.error.fieldErrors?.email) setError(result.error.fieldErrors.email);
        else setFormError(result.error.message);
        return;
      }
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="space-y-5 text-center" role="status">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"><MailCheck className="size-6" aria-hidden="true" /></div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold">Check your inbox</h2>
          <p className="text-sm text-muted-foreground">If an account exists for <span className="font-medium text-foreground">{email}</span>, we sent a link to reset your password. The link expires in 1 hour.</p>
        </div>
        <Button variant="ghost" asChild><Link href="/login">Back to sign in</Link></Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <FormAlert message={formError} />
      <FormField label="Email" name="email" type="email" autoComplete="email" inputMode="email" required autoFocus value={email} onChange={e => setEmail(e.target.value)} error={error} placeholder="you@company.com" />
      <Button type="submit" className="h-10 w-full" disabled={pending}>
        {pending ? <><Loader2 className="animate-spin" aria-hidden="true" /> Sending…</> : "Send reset link"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Remembered it? <Link href="/login" className="font-medium text-primary hover:underline">Sign in</Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    if (password !== confirmPassword) {
      setErrors({ confirmPassword: "Passwords do not match" });
      return;
    }
    startTransition(async () => {
      const result = await resetPasswordAction({ token, password, confirmPassword });
      if (!result.ok) {
        const fe = result.error.fieldErrors ?? {};
        if (fe.password || fe.confirmPassword) setErrors({ password: fe.password, confirmPassword: fe.confirmPassword });
        else setFormError(result.error.message);
        return;
      }
      setDone(true);
      toast.success("Password updated");
    });
  }

  if (done) {
    return (
      <div className="space-y-5 text-center" role="status">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600"><CheckCircle2 className="size-6" aria-hidden="true" /></div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold">Password updated</h2>
          <p className="text-sm text-muted-foreground">For your security we signed you out of all devices. Sign in with your new password.</p>
        </div>
        <Button asChild className="w-full"><Link href="/login">Sign in</Link></Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <FormAlert message={formError} />
      {formError ? <p className="text-sm"><Link href="/forgot-password" className="font-medium text-primary hover:underline">Request a new reset link</Link></p> : null}
      <PasswordField label="New password" name="password" autoComplete="new-password" required autoFocus value={password} onChange={e => setPassword(e.target.value)} error={errors.password} hint="At least 8 characters with a letter and a number." />
      <PasswordField label="Confirm new password" name="confirmPassword" autoComplete="new-password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} error={errors.confirmPassword} />
      <Button type="submit" className="h-10 w-full" disabled={pending}>
        {pending ? <><Loader2 className="animate-spin" aria-hidden="true" /> Updating…</> : "Set new password"}
      </Button>
    </form>
  );
}

export function ResendVerificationButton({ variant = "default" }: { variant?: "default" | "outline" }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  return (
    <div className="space-y-3">
      <Button
        type="button" variant={variant} className="w-full" disabled={pending}
        onClick={() => startTransition(async () => {
          const result = await resendVerificationAction();
          if (!result.ok) {
            setMessage({ tone: "error", text: result.error.message });
            toast.error(result.error.message);
            return;
          }
          const text = result.data.sent ? "Verification email sent. Check your inbox." : "Your email address is already verified.";
          setMessage({ tone: "success", text });
          toast.success(text);
        })}
      >
        {pending ? <><Loader2 className="animate-spin" aria-hidden="true" /> Sending…</> : "Resend verification email"}
      </Button>
      <FormAlert message={message?.text} tone={message?.tone} />
    </div>
  );
}
