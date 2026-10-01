"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Building2, Laptop, Loader2, LogOut, Monitor, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { FormAlert, FormField, PasswordField } from "@/components/auth/form-field";
import { ResendVerificationButton } from "@/components/auth/password-reset-forms";
import { NOTIFICATION_EVENTS } from "@/server/profile/events";
import {
  changePasswordAction, leaveOrganizationAction, revokeOtherSessionsAction, revokeSessionAction, saveNotificationPreferencesAction, updateProfileAction,
} from "@/server/profile/actions";
import { cn } from "@/lib/utils";

export type ProfileTab = "profile" | "password" | "sessions" | "notifications" | "organizations";

type SessionRow = { id: string; ip: string | null; userAgent: string | null; createdAt: string; lastSeenAt: string; status: "active" | "expired" | "signed_out"; current: boolean };
type Preference = { eventType: string; inApp: boolean; email: boolean };
type MembershipRow = { organizationId: string; organizationName: string; roleName: string; status: "ACTIVE" | "DEACTIVATED"; joinedAt: string; isLastOwner: boolean };

type Props = {
  initialTab: ProfileTab;
  timezone: string;
  organizationName: string;
  activeOrganizationId: string;
  profile: { name: string; email: string; jobTitle: string; phone: string; avatarUrl: string; emailVerified: boolean };
  hasPassword: boolean;
  sessions: SessionRow[];
  preferences: Preference[];
  memberships: MembershipRow[];
};

function Section({ title, description, children, className }: { title: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border bg-card p-5 shadow-sm sm:p-6", className)}>
      <div className="mb-5 space-y-1">
        <h2 className="text-base font-semibold">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function ProfileTabs(props: Props) {
  const [tab, setTab] = useState<ProfileTab>(props.initialTab);
  const onTab = (value: string) => {
    setTab(value as ProfileTab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", value);
    window.history.replaceState(null, "", url);
  };
  return (
    <Tabs value={tab} onValueChange={onTab} className="gap-6">
      <div className="-mx-1 overflow-x-auto px-1">
        <TabsList className="w-max">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="password">Password</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="organizations">Organizations</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="profile"><ProfileForm profile={props.profile} /></TabsContent>
      <TabsContent value="password"><PasswordForm hasPassword={props.hasPassword} /></TabsContent>
      <TabsContent value="sessions"><SessionsPanel sessions={props.sessions} timezone={props.timezone} /></TabsContent>
      <TabsContent value="notifications"><PreferencesPanel preferences={props.preferences} organizationName={props.organizationName} /></TabsContent>
      <TabsContent value="organizations"><OrganizationsPanel memberships={props.memberships} activeOrganizationId={props.activeOrganizationId} /></TabsContent>
    </Tabs>
  );
}

// ───────── Profile ─────────
function ProfileForm({ profile }: { profile: Props["profile"] }) {
  const router = useRouter();
  const [values, setValues] = useState({ name: profile.name, jobTitle: profile.jobTitle, phone: profile.phone, avatarUrl: profile.avatarUrl });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => setValues(v => ({ ...v, [key]: e.target.value }));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    start(async () => {
      const result = await updateProfileAction(values);
      if (!result.ok) {
        setErrors(result.error.fieldErrors ?? {});
        toast.error(result.error.message);
        return;
      }
      toast.success("Profile updated");
      router.refresh();
    });
  };
  return (
    <div className="space-y-6">
      <Section title="Personal details" description="Your name and photo are visible to colleagues in this and other organizations you belong to.">
        <form onSubmit={submit} noValidate className="space-y-5">
          <div className="flex items-center gap-4">
            <UserAvatar name={values.name || profile.name} src={/^https:\/\//i.test(values.avatarUrl) ? values.avatarUrl : undefined} size="xl" />
            <div className="min-w-0 text-sm">
              <p className="truncate font-medium">{values.name || profile.name}</p>
              <p className="truncate text-muted-foreground">{profile.email}</p>
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Full name" required value={values.name} onChange={set("name")} error={errors.name} autoComplete="name" />
            <FormField label="Job title" value={values.jobTitle} onChange={set("jobTitle")} error={errors.jobTitle} autoComplete="organization-title" />
            <FormField label="Phone" type="tel" value={values.phone} onChange={set("phone")} error={errors.phone} autoComplete="tel" />
            <FormField label="Avatar URL (optional)" type="url" value={values.avatarUrl} onChange={set("avatarUrl")} error={errors.avatarUrl} placeholder="https://…" hint="Link to a square image served over https." />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>{pending ? <><Loader2 className="animate-spin" aria-hidden="true" /> Saving…</> : "Save changes"}</Button>
          </div>
        </form>
      </Section>
      <Section title="Email address" description="Used to sign in and to receive notifications.">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">{profile.email}</span>
            {profile.emailVerified ? <Badge variant="secondary">Verified</Badge> : <Badge variant="outline">Not verified</Badge>}
          </div>
          {!profile.emailVerified ? <div className="sm:w-64"><ResendVerificationButton variant="outline" /></div> : null}
        </div>
      </Section>
    </div>
  );
}

// ───────── Password ─────────
function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const router = useRouter();
  const empty = { currentPassword: "", newPassword: "", confirmPassword: "" };
  const [values, setValues] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => setValues(v => ({ ...v, [key]: e.target.value }));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    if (values.newPassword !== values.confirmPassword) { setErrors({ confirmPassword: "Passwords do not match" }); return; }
    start(async () => {
      const result = await changePasswordAction(values);
      if (!result.ok) {
        if (result.error.fieldErrors) setErrors(result.error.fieldErrors);
        else if (result.error.message.toLowerCase().includes("current password")) setErrors({ currentPassword: result.error.message });
        else setFormError(result.error.message);
        toast.error(result.error.message);
        return;
      }
      setValues(empty);
      const n = result.data.revokedSessions;
      toast.success(n ? `Password updated. Signed out ${n} other session${n === 1 ? "" : "s"}.` : "Password updated");
      router.refresh();
    });
  };
  return (
    <Section title={hasPassword ? "Change password" : "Set a password"}
      description={hasPassword ? "Changing your password signs you out of every other device." : "You sign in with single sign-on. Setting a password lets you also sign in with email."}>
      <form onSubmit={submit} noValidate className="max-w-md space-y-4">
        <FormAlert message={formError} />
        <input type="text" name="username" autoComplete="username" className="hidden" readOnly aria-hidden="true" tabIndex={-1} />
        {hasPassword ? <PasswordField label="Current password" autoComplete="current-password" required value={values.currentPassword} onChange={set("currentPassword")} error={errors.currentPassword} /> : null}
        <PasswordField label="New password" autoComplete="new-password" required value={values.newPassword} onChange={set("newPassword")} error={errors.newPassword} hint="At least 8 characters with a letter and a number." />
        <PasswordField label="Confirm new password" autoComplete="new-password" required value={values.confirmPassword} onChange={set("confirmPassword")} error={errors.confirmPassword} />
        <Button type="submit" disabled={pending}>{pending ? <><Loader2 className="animate-spin" aria-hidden="true" /> Updating…</> : hasPassword ? "Update password" : "Set password"}</Button>
      </form>
    </Section>
  );
}

// ───────── Sessions ─────────
function describeAgent(ua: string | null) {
  if (!ua) return { label: "Unknown device", icon: Monitor };
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /node|undici|curl/i.test(ua) ? "API client" : "Browser";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X|Macintosh/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : null;
  const mobile = /Mobile|iPhone|Android/.test(ua);
  return { label: os ? `${browser} on ${os}` : browser, icon: mobile ? Smartphone : Laptop };
}

function formatDate(iso: string, timezone: string) {
  try {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(iso));
  } catch {
    return new Date(iso).toISOString();
  }
}

const STATUS: Record<SessionRow["status"], { label: string; variant: "secondary" | "outline" }> = {
  active: { label: "Active", variant: "secondary" },
  expired: { label: "Expired", variant: "outline" },
  signed_out: { label: "Signed out", variant: "outline" },
};

function SessionsPanel({ sessions, timezone }: { sessions: SessionRow[]; timezone: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const others = sessions.filter(s => s.status === "active" && !s.current).length;

  const revoke = (id: string) => {
    setBusy(id);
    start(async () => {
      const result = await revokeSessionAction({ id });
      setBusy(null);
      if (!result.ok) { toast.error(result.error.message); return; }
      toast.success("Session signed out");
      router.refresh();
    });
  };

  return (
    <Section title="Sessions and sign-in history" description={`Devices that signed in to your account, most recent first. Times are shown in ${timezone.replace(/_/g, " ")}.`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{others ? `${others} other active session${others === 1 ? "" : "s"}` : "No other active sessions"}</p>
        <ConfirmDialog
          title="Sign out other sessions?"
          description="Every device except this one will be signed out immediately."
          confirmLabel="Sign out others"
          variant="destructive"
          onConfirm={async () => {
            const result = await revokeOtherSessionsAction();
            if (!result.ok) { toast.error(result.error.message); return false; }
            toast.success(result.data.revoked ? `Signed out ${result.data.revoked} session${result.data.revoked === 1 ? "" : "s"}` : "No other sessions to sign out");
            router.refresh();
          }}
          trigger={<Button variant="outline" size="sm" disabled={!others}><LogOut aria-hidden="true" /> Sign out other sessions</Button>}
        />
      </div>
      {sessions.length === 0 ? (
        <EmptyState title="No sessions yet" description="Sign-ins to your account will appear here." size="sm" />
      ) : (
        <ul className="divide-y rounded-xl border">
          {sessions.map(s => {
            const agent = describeAgent(s.userAgent);
            const Icon = agent.icon;
            return (
              <li key={s.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Icon className="size-4" aria-hidden="true" /></span>
                  <div className="min-w-0 space-y-0.5 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{agent.label}</span>
                      {s.current ? <Badge>This device</Badge> : <Badge variant={STATUS[s.status].variant}>{STATUS[s.status].label}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {s.ip ? `IP ${s.ip} · ` : ""}Signed in {formatDate(s.createdAt, timezone)} · Last seen {formatDate(s.lastSeenAt, timezone)}
                    </p>
                  </div>
                </div>
                {s.current ? (
                  <Button variant="ghost" size="sm" className="self-start sm:self-center" onClick={() => void signOut({ callbackUrl: "/login" })}>Sign out</Button>
                ) : s.status === "active" ? (
                  <Button variant="ghost" size="sm" className="self-start text-destructive hover:text-destructive sm:self-center" disabled={pending && busy === s.id} onClick={() => revoke(s.id)}>
                    {pending && busy === s.id ? <Loader2 className="animate-spin" aria-hidden="true" /> : null} Sign out
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

// ───────── Notifications ─────────
function PreferencesPanel({ preferences, organizationName }: { preferences: Preference[]; organizationName: string }) {
  const initial = Object.fromEntries(preferences.map(p => [p.eventType, { inApp: p.inApp, email: p.email }]));
  const [prefs, setPrefs] = useState<Record<string, { inApp: boolean; email: boolean }>>(initial);
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(prefs) !== JSON.stringify(saved);
  const toggle = (event: string, channel: "inApp" | "email", value: boolean) => setPrefs(p => ({ ...p, [event]: { ...p[event], [channel]: value } }));
  const save = () => start(async () => {
    const result = await saveNotificationPreferencesAction({ preferences: Object.entries(prefs).map(([eventType, v]) => ({ eventType, ...v })) });
    if (!result.ok) { toast.error(result.error.message); return; }
    setSaved(prefs);
    toast.success("Notification preferences saved");
  });

  return (
    <Section title="Notification preferences" description={`Choose how you hear about activity in ${organizationName}. Preferences apply to this organization only.`}>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">Event</th>
              <th scope="col" className="w-24 px-4 py-2.5 text-center font-medium">In-app</th>
              <th scope="col" className="w-24 px-4 py-2.5 text-center font-medium">Email</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {NOTIFICATION_EVENTS.map(e => {
              const value = prefs[e.key] ?? { inApp: true, email: true };
              return (
                <tr key={e.key}>
                  <th scope="row" className="px-4 py-3 text-left font-normal">
                    <span className="block font-medium">{e.label}</span>
                    <span className="block text-xs text-muted-foreground">{e.description}</span>
                  </th>
                  <td className="px-4 py-3 text-center"><Switch checked={value.inApp} onCheckedChange={v => toggle(e.key, "inApp", v)} aria-label={`${e.label}: in-app`} /></td>
                  <td className="px-4 py-3 text-center"><Switch checked={value.email} onCheckedChange={v => toggle(e.key, "email", v)} aria-label={`${e.label}: email`} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        {dirty ? <Button variant="ghost" onClick={() => setPrefs(saved)} disabled={pending}>Discard</Button> : null}
        <Button onClick={save} disabled={pending || !dirty}>{pending ? <><Loader2 className="animate-spin" aria-hidden="true" /> Saving…</> : "Save preferences"}</Button>
      </div>
    </Section>
  );
}

// ───────── Organizations ─────────
function OrganizationsPanel({ memberships, activeOrganizationId }: { memberships: MembershipRow[]; activeOrganizationId: string }) {
  const router = useRouter();
  return (
    <Section title="Organizations" description="Workspaces you belong to and your role in each.">
      <ul className="divide-y rounded-xl border">
        {memberships.map(m => (
          <li key={m.organizationId} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Building2 className="size-4" aria-hidden="true" /></span>
              <div className="min-w-0 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium">{m.organizationName}</span>
                  {m.organizationId === activeOrganizationId ? <Badge>Current</Badge> : null}
                  {m.status === "DEACTIVATED" ? <Badge variant="outline">Deactivated</Badge> : null}
                </div>
                <p className="text-xs text-muted-foreground">{m.roleName} · joined {new Date(m.joinedAt).toLocaleDateString("en-US", { dateStyle: "medium" })}</p>
              </div>
            </div>
            {m.isLastOwner ? (
              <p className="text-xs text-muted-foreground sm:max-w-[220px] sm:text-right">You&apos;re the only owner. Transfer ownership before leaving.</p>
            ) : (
              <ConfirmDialog
                title={`Leave ${m.organizationName}?`}
                description="You will lose access to its tickets, tasks and projects. An administrator must invite you again to rejoin."
                confirmLabel="Leave organization"
                variant="destructive"
                onConfirm={async () => {
                  const result = await leaveOrganizationAction({ organizationId: m.organizationId });
                  if (!result.ok) { toast.error(result.error.message); return false; }
                  toast.success(`You left ${m.organizationName}`);
                  if (result.data.wasActiveOrganization) window.location.assign("/dashboard");
                  else router.refresh();
                }}
                trigger={<Button variant="ghost" size="sm" className="self-start text-destructive hover:text-destructive sm:self-center">Leave</Button>}
              />
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}
