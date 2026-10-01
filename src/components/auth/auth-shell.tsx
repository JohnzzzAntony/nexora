import type { ReactNode } from "react";
import { CheckCircle2, Clock3, ShieldCheck, Workflow } from "lucide-react";
import { Logo, LogoMark } from "@/components/marketing/logo";

const POINTS = [
  { icon: CheckCircle2, text: "Tickets, tasks and projects in one workspace" },
  { icon: Clock3, text: "SLA timers that respect business hours" },
  { icon: Workflow, text: "Automation rules, approvals and escalations" },
  { icon: ShieldCheck, text: "Role-based access and a complete audit trail" },
];

/** Split-screen frame: brand panel (lg+) and a centered form column. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <aside className="relative hidden overflow-hidden bg-[oklch(0.2_0.06_275)] text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 size-[28rem] rounded-full bg-[oklch(0.55_0.24_275)] opacity-40 blur-3xl" />
          <div className="absolute -bottom-32 right-0 size-[26rem] rounded-full bg-[oklch(0.6_0.2_220)] opacity-25 blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.05)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
        </div>
        <div className="relative flex items-center gap-2 text-lg font-semibold"><LogoMark /> Nexora</div>
        <div className="relative max-w-md space-y-8">
          <div className="space-y-3">
            <h2 className="text-4xl font-semibold leading-tight tracking-tight">Connect. Assign. Achieve.</h2>
            <p className="text-base text-white/70">A modern workspace for managing tickets, tasks, teams and everyday business operations.</p>
          </div>
          <ul className="space-y-3">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-white/85">
                <span className="flex size-8 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15"><Icon className="size-4" aria-hidden="true" /></span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/50">&copy; {new Date().getFullYear()} Nexora</p>
      </aside>
      <main className="flex flex-col px-5 py-8 sm:px-10">
        <div className="lg:hidden"><Logo /></div>
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">{children}</div>
      </main>
    </div>
  );
}

export function AuthHeading({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <div className="mb-7 space-y-1.5">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}
