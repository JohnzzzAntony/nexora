"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldError, FormAlert, FormField } from "@/components/auth/form-field";
import { submitDemoRequestAction } from "./actions";

const TEAM_SIZES = ["1-10", "11-50", "51-200", "201-1000", "1000+"];
const EMPTY = { name: "", email: "", company: "", teamSize: "", message: "", website: "" };

export function DemoRequestForm({ configured }: { configured: boolean }) {
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  const sizeId = useId();
  const messageId = useId();
  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setValues(v => ({ ...v, [key]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    start(async () => {
      const result = await submitDemoRequestAction(values);
      if (!result.ok) {
        if (result.error.fieldErrors) setErrors(result.error.fieldErrors);
        else setFormError(result.error.message);
        toast.error(result.error.message);
        return;
      }
      setSent(true);
      toast.success("Request sent");
    });
  };

  if (sent) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 text-center" role="status">
        <span className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600"><CheckCircle2 className="size-6" aria-hidden="true" /></span>
        <h2 className="text-xl font-semibold">Thanks, we received your request</h2>
        <p className="max-w-sm text-sm text-muted-foreground">We&apos;ll reply to <span className="font-medium text-foreground">{values.email}</span> to find a time that works.</p>
        <Button variant="outline" asChild><Link href="/">Back to home</Link></Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5" aria-describedby={!configured ? "contact-disabled" : undefined}>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Request a demo</h2>
        <p className="text-sm text-muted-foreground">All fields except the message are required.</p>
      </div>
      {!configured ? <div id="contact-disabled"><FormAlert tone="info" message="Contact form is not configured. Please try again later." /></div> : null}
      <FormAlert message={formError} />
      <fieldset disabled={!configured || pending} className="space-y-5 disabled:opacity-70">
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Full name" name="name" autoComplete="name" required value={values.name} onChange={set("name")} error={errors.name} />
          <FormField label="Work email" name="email" type="email" autoComplete="email" required value={values.email} onChange={set("email")} error={errors.email} />
          <FormField label="Company" name="company" autoComplete="organization" required value={values.company} onChange={set("company")} error={errors.company} />
          <div className="space-y-1.5">
            <Label htmlFor={sizeId}>Team size</Label>
            <select id={sizeId} name="teamSize" required value={values.teamSize} onChange={set("teamSize")} aria-invalid={errors.teamSize ? true : undefined} aria-describedby={errors.teamSize ? `${sizeId}-error` : undefined}
              className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30">
              <option value="" disabled>Select…</option>
              {TEAM_SIZES.map(s => <option key={s} value={s}>{s} people</option>)}
            </select>
            <FieldError id={`${sizeId}-error`} message={errors.teamSize} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={messageId}>What would you like to see? (optional)</Label>
          <Textarea id={messageId} name="message" rows={4} maxLength={2000} value={values.message} onChange={set("message")} aria-invalid={errors.message ? true : undefined} />
          <FieldError message={errors.message} />
        </div>
        <div className="hidden" aria-hidden="true">
          <label>Website<input tabIndex={-1} autoComplete="off" name="website" value={values.website} onChange={set("website")} /></label>
        </div>
        <Button type="submit" className="h-10 w-full" disabled={!configured || pending}>
          {pending ? <><Loader2 className="animate-spin" aria-hidden="true" /> Sending…</> : "Request demo"}
        </Button>
      </fieldset>
    </form>
  );
}
