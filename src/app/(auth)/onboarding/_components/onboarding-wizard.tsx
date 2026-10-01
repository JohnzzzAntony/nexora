"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, Mail, Pencil, Plus, Trash2, X, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormAlert, FormField } from "@/components/auth/form-field";
import { TimezoneSelect } from "@/components/auth/timezone-select";
import { cn } from "@/lib/utils";
import { ONBOARDING_STEPS, LAST_STEP } from "@/server/onboarding/steps";
import type { OnboardingData } from "@/server/onboarding/service";
import {
  addCategoryAction, addDepartmentAction, addTeamAction, completeStepAction, deleteCategoryAction, finishOnboardingAction, inviteUserAction,
  removeDepartmentAction, removeTeamAction, renameCategoryAction, revokeInvitationAction, saveAdminProfileAction, saveCompanyAction, saveSlaTargetsAction,
} from "@/server/onboarding/actions";

type ActionError = { code: string; message: string; fieldErrors?: Record<string, string> };

/** Runs a server action inside a transition with toast feedback. */
function useAction() {
  const [pending, start] = useTransition();
  const run = <T,>(fn: () => Promise<ActionResult<T>>, opts: { success?: string; onOk?: (data: T) => void; onError?: (error: ActionError) => void } = {}) =>
    start(async () => {
      const result = await fn();
      if (!result.ok) {
        toast.error(result.error.message);
        opts.onError?.(result.error);
        return;
      }
      if (opts.success) toast.success(opts.success);
      opts.onOk?.(result.data);
    });
  return [pending, run] as const;
}

function useStepNav() {
  const router = useRouter();
  return {
    go: (step: number) => router.push(`/onboarding?step=${step}`),
    refresh: () => router.refresh(),
  };
}

export function OnboardingWizard({ step, data, timezones }: { step: number; data: OnboardingData; timezones: string[] }) {
  const progress = Math.round(((step - 1) / (LAST_STEP - 1)) * 100);
  return (
    <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
      <nav aria-label="Setup steps" className="lg:sticky lg:top-24 lg:self-start">
        <div className="mb-4 lg:hidden">
          <div className="mb-2 flex justify-between text-xs font-medium text-muted-foreground"><span>Step {step} of {LAST_STEP}</span><span>{ONBOARDING_STEPS[step - 1].title}</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Setup progress">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <ol className="hidden space-y-1 lg:block">
          {ONBOARDING_STEPS.map(s => {
            const reachable = s.step <= data.onboardingStep;
            const done = s.step < data.onboardingStep && s.step !== step;
            const current = s.step === step;
            const inner = (
              <>
                <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                  current ? "border-primary bg-primary text-primary-foreground" : done ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground")}>
                  {done ? <Check className="size-3.5" aria-hidden="true" /> : s.step}
                </span>
                <span className="truncate">{s.title}</span>
                {s.optional ? <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">Optional</span> : null}
              </>
            );
            const cls = cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm", current ? "bg-background font-medium shadow-sm ring-1 ring-border" : "text-muted-foreground");
            return (
              <li key={s.step}>
                {reachable && !current
                  ? <Link href={`/onboarding?step=${s.step}`} className={cn(cls, "hover:bg-background/70 hover:text-foreground")}>{inner}</Link>
                  : <span className={cn(cls, !reachable && "opacity-60")} aria-current={current ? "step" : undefined}>{inner}</span>}
              </li>
            );
          })}
        </ol>
      </nav>
      <section aria-labelledby="step-title" className="min-w-0">
        {step === 1 && <CompanyStep data={data} timezones={timezones} />}
        {step === 2 && <AdminStep data={data} />}
        {step === 3 && <DepartmentsStep data={data} />}
        {step === 4 && <TeamsStep data={data} />}
        {step === 5 && <InviteStep data={data} />}
        {step === 6 && <CategoriesStep data={data} />}
        {step === 7 && <SlaStep data={data} />}
        {step === 8 && <FinishStep data={data} />}
      </section>
    </div>
  );
}

function StepCard({ step, description, children, footer }: { step: number; description: ReactNode; children: ReactNode; footer: ReactNode }) {
  const meta = ONBOARDING_STEPS[step - 1];
  return (
    <div className="rounded-2xl border bg-card shadow-sm">
      <div className="space-y-1.5 border-b p-6 sm:p-8">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">Step {step} of {LAST_STEP}{meta.optional ? " · Optional" : ""}</p>
        <h1 id="step-title" className="text-2xl font-semibold tracking-tight">{meta.title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="p-6 sm:p-8">{children}</div>
      <div className="flex flex-col-reverse gap-2 border-t bg-muted/30 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">{footer}</div>
    </div>
  );
}

function BackButton({ step }: { step: number }) {
  if (step <= 1) return <span />;
  return <Button variant="ghost" asChild><Link href={`/onboarding?step=${step - 1}`}>Back</Link></Button>;
}

function PendingLabel({ pending, children, label = "Saving…" }: { pending: boolean; children: ReactNode; label?: string }) {
  return pending ? <><Loader2 className="animate-spin" aria-hidden="true" /> {label}</> : <>{children}</>;
}

/** Footer for list-style steps whose rows are saved individually. */
function ContinueFooter({ step, hasItems }: { step: number; hasItems: boolean }) {
  const nav = useStepNav();
  const [pending, run] = useAction();
  return (
    <>
      <BackButton step={step} />
      <Button disabled={pending} onClick={() => run(() => completeStepAction({ step }), { onOk: d => nav.go(d.step) })}>
        <PendingLabel pending={pending} label="Continuing…">{hasItems ? "Continue" : "Skip for now"}</PendingLabel>
      </Button>
    </>
  );
}

// ───────── Step 1 ─────────
function CompanyStep({ data, timezones }: { data: OnboardingData; timezones: string[] }) {
  const nav = useStepNav();
  const [values, setValues] = useState(data.company);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, run] = useAction();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    run(() => saveCompanyAction(values), { success: "Company details saved", onOk: d => nav.go(d.step), onError: err => setErrors(err.fieldErrors ?? {}) });
  };
  return (
    <form onSubmit={submit} noValidate>
      <StepCard step={1} description="How your organization appears to your team and customers."
        footer={<><BackButton step={1} /><Button type="submit" disabled={pending}><PendingLabel pending={pending}>Save and continue</PendingLabel></Button></>}>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2"><FormField label="Organization name" required value={values.name} onChange={e => setValues(v => ({ ...v, name: e.target.value }))} error={errors.name} autoComplete="organization" /></div>
          <TimezoneSelect timezones={timezones} value={values.timezone} onChange={tz => setValues(v => ({ ...v, timezone: tz }))} error={errors.timezone} />
          <FormField label="Support email (optional)" type="email" value={values.supportEmail} onChange={e => setValues(v => ({ ...v, supportEmail: e.target.value }))} error={errors.supportEmail} placeholder="support@company.com" hint="Shown to requesters and used as the reply-to for ticket email." />
        </div>
      </StepCard>
    </form>
  );
}

// ───────── Step 2 ─────────
function AdminStep({ data }: { data: OnboardingData }) {
  const nav = useStepNav();
  const [values, setValues] = useState({ name: data.admin.name, jobTitle: data.admin.jobTitle, phone: data.admin.phone });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, run] = useAction();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    run(() => saveAdminProfileAction(values), { success: "Profile saved", onOk: d => nav.go(d.step), onError: err => setErrors(err.fieldErrors ?? {}) });
  };
  return (
    <form onSubmit={submit} noValidate>
      <StepCard step={2} description="Confirm the details of the administrator account."
        footer={<><BackButton step={2} /><Button type="submit" disabled={pending}><PendingLabel pending={pending}>Save and continue</PendingLabel></Button></>}>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Full name" required value={values.name} onChange={e => setValues(v => ({ ...v, name: e.target.value }))} error={errors.name} autoComplete="name" />
          <FormField label="Email" value={data.admin.email} readOnly disabled />
          <FormField label="Job title (optional)" value={values.jobTitle} onChange={e => setValues(v => ({ ...v, jobTitle: e.target.value }))} error={errors.jobTitle} autoComplete="organization-title" placeholder="IT Manager" />
          <FormField label="Phone (optional)" type="tel" value={values.phone} onChange={e => setValues(v => ({ ...v, phone: e.target.value }))} error={errors.phone} autoComplete="tel" />
        </div>
      </StepCard>
    </form>
  );
}

// ───────── Shared list UI ─────────
function AddRow({ label, placeholder, onAdd, pending, error, children }: { label: string; placeholder: string; onAdd: (name: string, reset: () => void) => void; pending: boolean; error?: string; children?: ReactNode }) {
  const [name, setName] = useState("");
  return (
    <form
      noValidate
      onSubmit={e => { e.preventDefault(); if (name.trim()) onAdd(name.trim(), () => setName("")); }}
      className="space-y-1.5"
    >
      <Label htmlFor={`add-${label}`}>{label}</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input id={`add-${label}`} value={name} onChange={e => setName(e.target.value)} placeholder={placeholder} maxLength={80} className="h-10" aria-invalid={error ? true : undefined} />
        {children}
        <Button type="submit" variant="outline" className="h-10 shrink-0" disabled={pending || !name.trim()}>
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />} Add
        </Button>
      </div>
      <FieldError message={error} />
    </form>
  );
}

function ItemList({ items, empty, render }: { items: { id: string }[]; empty: string; render: (item: any) => ReactNode }) {
  if (!items.length) return <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return <ul className="divide-y rounded-xl border">{items.map(item => <li key={item.id} className="flex items-center gap-3 px-4 py-3">{render(item)}</li>)}</ul>;
}

function RemoveButton({ label, onRemove }: { label: string; onRemove: (done: () => void) => void }) {
  const [pending, setPending] = useState(false);
  return (
    <Button type="button" variant="ghost" size="icon" className="ml-auto size-8 text-muted-foreground hover:text-destructive" aria-label={label} disabled={pending}
      onClick={() => { setPending(true); onRemove(() => setPending(false)); }}>
      {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
    </Button>
  );
}

// ───────── Step 3 ─────────
function DepartmentsStep({ data }: { data: OnboardingData }) {
  const nav = useStepNav();
  const [pending, run] = useAction();
  const [error, setError] = useState<string>();
  return (
    <StepCard step={3} description="Departments group people and route requests, e.g. IT, HR, Finance or Facilities." footer={<ContinueFooter step={3} hasItems={data.departments.length > 0} />}>
      <div className="space-y-6">
        <AddRow label="Department name" placeholder="e.g. IT" pending={pending} error={error}
          onAdd={(name, reset) => { setError(undefined); run(() => addDepartmentAction({ name }), { success: `Added ${name}`, onOk: () => { reset(); nav.refresh(); }, onError: e => setError(e.fieldErrors?.name ?? e.message) }); }} />
        <ItemList items={data.departments} empty="No departments yet. You can add them later in Settings."
          render={(d: OnboardingData["departments"][number]) => (<>
            <span className="text-sm font-medium">{d.name}</span>
            <RemoveButton label={`Remove ${d.name}`} onRemove={done => removeDepartmentAction({ id: d.id }).then(r => { done(); if (!r.ok) toast.error(r.error.message); else { toast.success(`Removed ${d.name}`); nav.refresh(); } })} />
          </>)} />
      </div>
    </StepCard>
  );
}

// ───────── Step 4 ─────────
function TeamsStep({ data }: { data: OnboardingData }) {
  const nav = useStepNav();
  const [pending, run] = useAction();
  const [departmentId, setDepartmentId] = useState("");
  const [error, setError] = useState<string>();
  return (
    <StepCard step={4} description="Teams work tickets and tasks together, e.g. Service Desk or Network Operations." footer={<ContinueFooter step={4} hasItems={data.teams.length > 0} />}>
      <div className="space-y-6">
        <AddRow label="Team name" placeholder="e.g. Service Desk" pending={pending} error={error}
          onAdd={(name, reset) => { setError(undefined); run(() => addTeamAction({ name, departmentId: departmentId || undefined }), { success: `Added ${name}`, onOk: () => { reset(); nav.refresh(); }, onError: e => setError(e.fieldErrors?.name ?? e.message) }); }}>
          {data.departments.length > 0 && (
            <select aria-label="Department (optional)" value={departmentId} onChange={e => setDepartmentId(e.target.value)}
              className="h-10 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 sm:w-48">
              <option value="">No department</option>
              {data.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
        </AddRow>
        <ItemList items={data.teams} empty="No teams yet. You can add them later in Settings."
          render={(t: OnboardingData["teams"][number]) => (<>
            <div className="min-w-0"><p className="truncate text-sm font-medium">{t.name}</p>{t.departmentName ? <p className="text-xs text-muted-foreground">{t.departmentName}</p> : null}</div>
            <RemoveButton label={`Remove ${t.name}`} onRemove={done => removeTeamAction({ id: t.id }).then(r => { done(); if (!r.ok) toast.error(r.error.message); else { toast.success(`Removed ${t.name}`); nav.refresh(); } })} />
          </>)} />
      </div>
    </StepCard>
  );
}

// ───────── Step 5 ─────────
function InviteStep({ data }: { data: OnboardingData }) {
  const nav = useStepNav();
  const defaultRole = data.roles.find(r => r.key === "agent")?.id ?? data.roles[0]?.id ?? "";
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(defaultRole);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, run] = useAction();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    run(() => inviteUserAction({ email, roleId }), {
      success: `Invitation sent to ${email.trim()}`,
      onOk: () => { setEmail(""); nav.refresh(); },
      onError: err => setErrors(err.fieldErrors ?? { email: err.message }),
    });
  };
  const role = data.roles.find(r => r.id === roleId);
  return (
    <StepCard step={5} description="Invite colleagues by email. Invitations expire after 7 days." footer={<ContinueFooter step={5} hasItems={data.invitations.length > 0} />}>
      <div className="space-y-6">
        <form onSubmit={submit} noValidate className="space-y-2">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px_auto] sm:items-end">
            <FormField label="Email address" type="email" value={email} onChange={e => setEmail(e.target.value)} error={errors.email} placeholder="colleague@company.com" autoComplete="off" />
            <div className="space-y-1.5 self-start">
              <Label htmlFor="invite-role">Role</Label>
              <select id="invite-role" value={roleId} onChange={e => setRoleId(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30">
                {data.roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <FieldError message={errors.roleId} />
            </div>
            <Button type="submit" className="h-10 self-start sm:mt-[1.625rem]" disabled={pending || !email.trim() || !roleId}>
              {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Mail aria-hidden="true" />} Send invite
            </Button>
          </div>
          {role?.description ? <p className="text-xs text-muted-foreground">{role.name}: {role.description}</p> : null}
        </form>
        <div className="space-y-2">
          <h2 className="text-sm font-medium">Pending invitations</h2>
          <ItemList items={data.invitations} empty="No pending invitations."
            render={(i: OnboardingData["invitations"][number]) => (<>
              <div className="min-w-0"><p className="truncate text-sm font-medium">{i.email}</p><p className="text-xs text-muted-foreground">{i.roleName} · expires {new Date(i.expiresAt).toLocaleDateString()}</p></div>
              <RemoveButton label={`Revoke invitation for ${i.email}`} onRemove={done => revokeInvitationAction({ id: i.id }).then(r => { done(); if (!r.ok) toast.error(r.error.message); else { toast.success("Invitation revoked"); nav.refresh(); } })} />
            </>)} />
        </div>
      </div>
    </StepCard>
  );
}

// ───────── Step 6 ─────────
function CategoryRow({ category }: { category: OnboardingData["categories"][number] }) {
  const nav = useStepNav();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [error, setError] = useState<string>();
  const [pending, run] = useAction();
  if (editing) {
    return (
      <form className="flex w-full flex-col gap-1" noValidate onSubmit={e => {
        e.preventDefault();
        setError(undefined);
        run(() => renameCategoryAction({ id: category.id, name }), { success: "Category renamed", onOk: () => { setEditing(false); nav.refresh(); }, onError: err => setError(err.fieldErrors?.name ?? err.message) });
      }}>
        <div className="flex items-center gap-2">
          <Input aria-label={`New name for ${category.name}`} value={name} onChange={e => setName(e.target.value)} maxLength={80} autoFocus className="h-9" aria-invalid={error ? true : undefined} />
          <Button type="submit" size="icon" variant="ghost" className="size-8" aria-label="Save name" disabled={pending || !name.trim()}>{pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}</Button>
          <Button type="button" size="icon" variant="ghost" className="size-8" aria-label="Cancel" onClick={() => { setEditing(false); setName(category.name); setError(undefined); }}><X aria-hidden="true" /></Button>
        </div>
        <FieldError message={error} />
      </form>
    );
  }
  return (
    <>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{category.name}</p>
        {category.subcategories ? <p className="text-xs text-muted-foreground">{category.subcategories} subcategor{category.subcategories === 1 ? "y" : "ies"}</p> : null}
      </div>
      <Button type="button" variant="ghost" size="icon" className="ml-auto size-8 text-muted-foreground" aria-label={`Rename ${category.name}`} onClick={() => setEditing(true)}><Pencil aria-hidden="true" /></Button>
      <Button type="button" variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" aria-label={`Delete ${category.name}`} disabled={pending}
        onClick={() => {
          if (!window.confirm(`Delete "${category.name}"${category.subcategories ? " and its subcategories" : ""}?`)) return;
          run(() => deleteCategoryAction({ id: category.id }), { success: `Deleted ${category.name}`, onOk: () => nav.refresh() });
        }}>
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
      </Button>
    </>
  );
}

function CategoriesStep({ data }: { data: OnboardingData }) {
  const nav = useStepNav();
  const [pending, run] = useAction();
  const [error, setError] = useState<string>();
  return (
    <StepCard step={6} description="Categories help requesters file tickets in the right place. We created a starter set — rename, remove or add your own." footer={<ContinueFooter step={6} hasItems />}>
      <div className="space-y-6">
        <AddRow label="Category name" placeholder="e.g. Facilities" pending={pending} error={error}
          onAdd={(name, reset) => { setError(undefined); run(() => addCategoryAction({ name }), { success: `Added ${name}`, onOk: () => { reset(); nav.refresh(); }, onError: e => setError(e.fieldErrors?.name ?? e.message) }); }} />
        <ItemList items={data.categories} empty="No categories. Add at least one so requesters can classify tickets." render={(c: OnboardingData["categories"][number]) => <CategoryRow category={c} />} />
      </div>
    </StepCard>
  );
}

// ───────── Step 7 ─────────
type Unit = "minutes" | "hours";
const split = (minutes: number): { value: string; unit: Unit } => (minutes % 60 === 0 ? { value: String(minutes / 60), unit: "hours" } : { value: String(minutes), unit: "minutes" });
const toMinutes = (d: { value: string; unit: Unit }) => {
  const n = Number(d.value);
  return Number.isFinite(n) ? Math.round(d.unit === "hours" ? n * 60 : n) : NaN;
};

function DurationInput({ label, value, onChange }: { label: string; value: { value: string; unit: Unit }; onChange: (v: { value: string; unit: Unit }) => void }) {
  return (
    <div className="flex gap-2">
      <Input type="number" inputMode="decimal" min={0} step="any" aria-label={`${label} amount`} value={value.value} onChange={e => onChange({ ...value, value: e.target.value })} className="h-9 w-24" />
      <select aria-label={`${label} unit`} value={value.unit} onChange={e => onChange({ ...value, unit: e.target.value as Unit })}
        className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30">
        <option value="minutes">minutes</option>
        <option value="hours">hours</option>
      </select>
    </div>
  );
}

function SlaStep({ data }: { data: OnboardingData }) {
  const nav = useStepNav();
  const [rows, setRows] = useState(() => (data.sla?.targets ?? []).map(t => ({ ...t, first: split(t.firstResponseMinutes), resolution: split(t.resolutionMinutes) })));
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, run] = useAction();
  const [skipping, skip] = useAction();

  if (!data.sla) {
    return (
      <StepCard step={7} description="Response and resolution targets per priority." footer={<ContinueFooter step={7} hasItems={false} />}>
        <FormAlert tone="info" message="No default SLA policy exists for this organization. You can create one later in Settings → SLA." />
      </StepCard>
    );
  }

  const save = () => {
    setFormError(null);
    const targets = rows.map(r => ({ id: r.id, firstResponseMinutes: toMinutes(r.first), resolutionMinutes: toMinutes(r.resolution) }));
    const invalid = targets.find(t => !Number.isInteger(t.firstResponseMinutes) || !Number.isInteger(t.resolutionMinutes) || t.firstResponseMinutes < 1 || t.resolutionMinutes < 1);
    if (invalid) { setFormError("Enter a positive duration for every target."); return; }
    run(() => saveSlaTargetsAction({ targets }), { success: "SLA targets saved", onOk: d => nav.go(d.step), onError: e => setFormError(e.message) });
  };

  return (
    <StepCard step={7} description={`Targets for the “${data.sla.name}” policy. Timers count business hours only (Mon–Fri, 9:00–17:00 by default).`}
      footer={<>
        <BackButton step={7} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="ghost" disabled={pending || skipping} onClick={() => skip(() => completeStepAction({ step: 7 }), { onOk: d => nav.go(d.step) })}><PendingLabel pending={skipping} label="Skipping…">Keep defaults</PendingLabel></Button>
          <Button disabled={pending || skipping} onClick={save}><PendingLabel pending={pending}>Save and continue</PendingLabel></Button>
        </div>
      </>}>
      <div className="space-y-4">
        <FormAlert message={formError} />
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th scope="col" className="px-4 py-2.5 font-medium">Priority</th><th scope="col" className="px-4 py-2.5 font-medium">First response</th><th scope="col" className="px-4 py-2.5 font-medium">Resolution</th></tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r, i) => (
                <tr key={r.id}>
                  <th scope="row" className="px-4 py-3 text-left font-medium"><span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: r.color }} aria-hidden="true" />{r.priority}</span></th>
                  <td className="px-4 py-3"><DurationInput label={`${r.priority} first response`} value={r.first} onChange={v => setRows(rs => rs.map((x, j) => (j === i ? { ...x, first: v } : x)))} /></td>
                  <td className="px-4 py-3"><DurationInput label={`${r.priority} resolution`} value={r.resolution} onChange={v => setRows(rs => rs.map((x, j) => (j === i ? { ...x, resolution: v } : x)))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </StepCard>
  );
}

// ───────── Step 8 ─────────
function FinishStep({ data }: { data: OnboardingData }) {
  const [pending, run] = useAction();
  const summary = [
    { label: "Departments", value: data.departments.length, step: 3 },
    { label: "Teams", value: data.teams.length, step: 4 },
    { label: "Pending invitations", value: data.invitations.length, step: 5 },
    { label: "Ticket categories", value: data.categories.length, step: 6 },
  ];
  return (
    <StepCard step={8} description="Review your setup. Everything can be changed later in Settings."
      footer={<>
        <BackButton step={8} />
        <Button disabled={pending} onClick={() => run(() => finishOnboardingAction(), { success: "Your workspace is ready", onOk: d => window.location.assign(d.redirectTo) })}>
          <PendingLabel pending={pending} label="Finishing…">Go to dashboard</PendingLabel>
        </Button>
      </>}>
      <div className="space-y-6">
        <div className="flex items-center gap-4 rounded-xl bg-primary/5 p-5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><PartyPopper className="size-5" aria-hidden="true" /></span>
          <div><p className="font-medium">{data.company.name} is ready to go</p><p className="text-sm text-muted-foreground">Time zone: {data.company.timezone}{data.company.supportEmail ? ` · Support: ${data.company.supportEmail}` : ""}</p></div>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2">
          {summary.map(s => (
            <div key={s.label} className="flex items-center justify-between rounded-xl border p-4">
              <div><dt className="text-sm text-muted-foreground">{s.label}</dt><dd className="text-2xl font-semibold tabular-nums">{s.value}</dd></div>
              <Link href={`/onboarding?step=${s.step}`} className="text-sm font-medium text-primary hover:underline">Edit</Link>
            </div>
          ))}
        </dl>
      </div>
    </StepCard>
  );
}
