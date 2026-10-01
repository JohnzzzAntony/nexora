"use client";

import { useState, useTransition } from "react";
import { Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormAlert, FormField } from "@/components/auth/form-field";
import { TimezoneSelect } from "@/components/auth/timezone-select";
import { createOrganizationAction } from "@/server/onboarding/actions";

export function CreateOrganizationStep({ timezones }: { timezones: string[] }) {
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    startTransition(async () => {
      const result = await createOrganizationAction({ name, timezone });
      if (!result.ok) {
        if (result.error.fieldErrors) setErrors(result.error.fieldErrors);
        else setFormError(result.error.message);
        toast.error(result.error.message);
        return;
      }
      toast.success("Organization created");
      window.location.assign("/onboarding");
    });
  }

  return (
    <div className="mx-auto max-w-lg rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
      <div className="mb-6 space-y-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Building2 className="size-5" aria-hidden="true" /></span>
        <h1 className="text-2xl font-semibold tracking-tight">Create your organization</h1>
        <p className="text-sm text-muted-foreground">You&apos;re not a member of any organization yet. Create one to get started, or ask a colleague to invite you to theirs.</p>
      </div>
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormAlert message={formError} />
        <FormField label="Organization name" name="name" autoComplete="organization" required autoFocus value={name} onChange={e => setName(e.target.value)} error={errors.name} placeholder="Acme Inc." />
        <TimezoneSelect detect timezones={timezones} value={timezone} onChange={setTimezone} error={errors.timezone} />
        <Button type="submit" className="h-10 w-full" disabled={pending}>
          {pending ? <><Loader2 className="animate-spin" aria-hidden="true" /> Creating…</> : "Create organization"}
        </Button>
      </form>
    </div>
  );
}
