import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight, BarChart3, BookOpen, Boxes, Check, ChevronDown, Clock3, FileLock2, Fingerprint, Globe, KeyRound, LayoutGrid, ListChecks,
  Mail, MessageSquare, MessagesSquare, ScrollText, ShieldCheck, Ticket, Users, Webhook, Workflow, Code2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AssetMock, HeroProductMock, KanbanMock, KnowledgeMock, ReportMock, SlaMock, TicketConversationMock, WorkflowMock,
} from "@/components/marketing/illustrations";

function SectionHeading({ eyebrow, title, description, align = "center" }: { eyebrow: string; title: ReactNode; description?: ReactNode; align?: "center" | "left" }) {
  return (
    <div className={cn("max-w-2xl space-y-3", align === "center" && "mx-auto text-center")}>
      <p className="text-sm font-semibold text-primary">{eyebrow}</p>
      <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      {description ? <p className="text-pretty text-base text-muted-foreground sm:text-lg">{description}</p> : null}
    </div>
  );
}

const container = "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8";

// ───────── Hero ─────────
export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-18rem] h-[38rem] w-[64rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,oklch(0.62_0.2_275/0.22),transparent)] dark:bg-[radial-gradient(closest-side,oklch(0.55_0.22_275/0.35),transparent)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:56px_56px] opacity-40 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]" />
      </div>
      <div className={cn(container, "pb-16 pt-16 sm:pb-24 sm:pt-24")}>
        <div className="mx-auto max-w-3xl space-y-7 text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <span className="size-1.5 rounded-full bg-emerald-500" /> Tickets, tasks, SLAs and assets in one workspace
          </p>
          <h1 className="text-balance text-5xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">
            Connect. Assign. <span className="bg-gradient-to-r from-primary to-[oklch(0.6_0.2_220)] bg-clip-text text-transparent">Achieve.</span>
          </h1>
          <p className="mx-auto max-w-2xl text-pretty text-lg text-muted-foreground sm:text-xl">
            A modern workspace for managing tickets, tasks, teams and everyday business operations.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto"><Link href="/register">Get Started <ArrowRight aria-hidden="true" /></Link></Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto"><Link href="/contact">Book a Demo</Link></Button>
          </div>
          <p className="text-sm text-muted-foreground">Free plan available · No credit card required</p>
        </div>
        <div className="relative mx-auto mt-14 max-w-5xl sm:mt-20">
          <div aria-hidden="true" className="absolute -inset-x-6 -bottom-6 top-10 -z-10 rounded-[2rem] bg-gradient-to-b from-primary/15 to-transparent blur-2xl" />
          <HeroProductMock />
        </div>
      </div>
    </section>
  );
}

// ───────── Overview ─────────
const OVERVIEW = [
  { icon: Ticket, title: "Tickets", text: "Capture requests from the portal, email or API and route them to the right team." },
  { icon: ListChecks, title: "Tasks & projects", text: "Plan work with checklists, dependencies, milestones and boards." },
  { icon: Workflow, title: "Automation", text: "Assign, escalate and notify with rules instead of manual triage." },
  { icon: Clock3, title: "SLA tracking", text: "Business-hour aware timers with warnings before targets are missed." },
  { icon: BarChart3, title: "Reporting", text: "Volume, backlog, resolution time and SLA performance at a glance." },
  { icon: BookOpen, title: "Knowledge base", text: "Publish answers so people can help themselves before they ask." },
  { icon: Boxes, title: "Assets", text: "Know who has which device, its history and related tickets." },
  { icon: Users, title: "Teams & roles", text: "Departments, teams and granular permissions for every role." },
];

export function Overview() {
  return (
    <section id="product" className={cn(container, "scroll-mt-20 py-20 sm:py-28")}>
      <SectionHeading eyebrow="Product overview" title="Everything your service teams need, without the sprawl" description="Nexora brings requests, planned work and the knowledge behind them into one place, so nothing falls between tools." />
      <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {OVERVIEW.map(({ icon: Icon, title, text }) => (
          <div key={title} className="space-y-3 bg-card p-6">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-5" aria-hidden="true" /></span>
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ───────── Feature rows ─────────
function FeatureRow({ id, eyebrow, title, description, points, visual, reverse }: { id: string; eyebrow: string; title: string; description: string; points: string[]; visual: ReactNode; reverse?: boolean }) {
  return (
    <div id={id} className="grid scroll-mt-24 items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div className={cn("space-y-6", reverse && "lg:order-2")}>
        <SectionHeading align="left" eyebrow={eyebrow} title={title} description={description} />
        <ul className="grid gap-3 sm:grid-cols-2">
          {points.map(p => (
            <li key={p} className="flex gap-2.5 text-sm">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Check className="size-3" aria-hidden="true" /></span>
              <span className="text-muted-foreground">{p}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className={cn("relative", reverse && "lg:order-1")}>
        <div aria-hidden="true" className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
        {visual}
      </div>
    </div>
  );
}

export function FeatureRows() {
  return (
    <section className="border-y border-border/60 bg-muted/30">
      <div className={cn(container, "space-y-24 py-20 sm:space-y-32 sm:py-28")}>
        <FeatureRow id="tickets" eyebrow="Ticket management" title="Every request, in one queue"
          description="Requests arrive from the customer portal, email or the REST API and land in a queue your team can triage fast."
          points={["Public replies and internal notes", "Categories, priorities and custom fields", "Merge duplicates and link related tickets", "Watchers, tags, attachments and saved views"]}
          visual={<TicketConversationMock />} />
        <FeatureRow id="tasks" reverse eyebrow="Task management" title="Plan the work behind the requests"
          description="Break larger efforts into projects and tasks with owners, due dates and progress everyone can see."
          points={["Board and list views", "Checklists and task dependencies", "Milestones and project members", "Time tracking on tasks and tickets"]}
          visual={<KanbanMock />} />
        <FeatureRow id="workflows" eyebrow="Workflow automation" title="Let rules do the routing"
          description="Define triggers, conditions and actions once. Nexora applies them to every matching ticket and records what ran."
          points={["Auto-assign by category, team or priority", "Escalate and notify on conditions", "Multi-step approvals", "Execution history for every rule"]}
          visual={<WorkflowMock />} />
        <FeatureRow id="sla" reverse eyebrow="SLA management" title="Targets that respect how you work"
          description="Set first-response and resolution targets per priority. Timers follow business hours and holidays and pause while waiting on the requester."
          points={["Policies per team or category", "Warnings before a breach", "Business hours and holiday calendars", "Escalation to a person or team"]}
          visual={<SlaMock />} />
        <FeatureRow id="reporting" eyebrow="Reporting" title="See where work is getting stuck"
          description="Understand volume, backlog and SLA performance by team, category or agent, and export what you need."
          points={["Created vs. resolved trends", "Resolution and response times", "SLA attainment by priority", "CSV exports"]}
          visual={<ReportMock />} />
        <div className="grid gap-10 lg:grid-cols-2">
          <div id="knowledge" className="scroll-mt-24 space-y-6">
            <SectionHeading align="left" eyebrow="Knowledge base" title="Answers people can find" description="Write articles for your team or publish them to the customer portal, organized by category." />
            <KnowledgeMock />
          </div>
          <div id="assets" className="scroll-mt-24 space-y-6">
            <SectionHeading align="left" eyebrow="Asset management" title="Know what you own and who has it" description="Track hardware and licenses with assignment history, status and linked tickets." />
            <AssetMock />
          </div>
        </div>
      </div>
    </section>
  );
}

// ───────── Integrations ─────────
const INTEGRATIONS = [
  { icon: MessageSquare, name: "Slack", text: "Connect a workspace to post ticket and SLA notifications to channels." },
  { icon: MessagesSquare, name: "Microsoft Teams", text: "Send notifications to Teams channels your organization chooses." },
  { icon: Webhook, name: "Webhooks", text: "Signed event deliveries with automatic retries to your own endpoints." },
  { icon: Code2, name: "REST API", text: "Versioned API with scoped API keys for tickets, tasks and more." },
  { icon: Mail, name: "Email", text: "Outbound notifications and inbound email-to-ticket with threaded replies." },
  { icon: KeyRound, name: "SSO", text: "Sign in with Google or Microsoft accounts when your administrator enables it." },
];

export function Integrations() {
  return (
    <section id="integrations" className={cn(container, "scroll-mt-20 py-20 sm:py-28")}>
      <SectionHeading eyebrow="Integrations" title="Fits into the tools you already use" description="Connect chat, email and identity providers, or build your own integrations on the API and webhooks." />
      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {INTEGRATIONS.map(({ icon: Icon, name, text }) => (
          <div key={name} className="group rounded-2xl border bg-card p-6 transition-shadow hover:shadow-md">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg border bg-background"><Icon className="size-5 text-foreground" aria-hidden="true" /></span>
              <h3 className="font-semibold">{name}</h3>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">Integrations are configured per organization by an administrator. Some require credentials from the provider.</p>
    </section>
  );
}

// ───────── Security ─────────
const SECURITY = [
  { icon: FileLock2, title: "Tenant isolation", text: "Every record belongs to exactly one organization, and every query is scoped to it on the server." },
  { icon: Fingerprint, title: "Role-based access", text: "Granular permissions per role, enforced server-side for the app and the API." },
  { icon: ScrollText, title: "Audit trail", text: "Security and administrative changes are written to an append-only audit log." },
  { icon: ShieldCheck, title: "Session control", text: "Server-tracked sessions you can review and revoke; password resets sign out every device." },
  { icon: KeyRound, title: "Credential hygiene", text: "Passwords are hashed with bcrypt; email tokens are single-use and stored only as hashes." },
  { icon: Globe, title: "Protected by default", text: "Rate limiting on sign-in and sign-up, cross-site request checks and sanitized rich text." },
];

export function Security() {
  return (
    <section id="security" className="scroll-mt-20 bg-[oklch(0.17_0.04_275)] text-white">
      <div className={cn(container, "py-20 sm:py-28")}>
        <div className="mx-auto max-w-2xl space-y-3 text-center">
          <p className="text-sm font-semibold text-[oklch(0.78_0.12_275)]">Security</p>
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Built for teams that handle sensitive requests</h2>
          <p className="text-base text-white/70 sm:text-lg">HR cases, finance approvals and access requests deserve careful handling. Security is part of the foundation, not an add-on.</p>
        </div>
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SECURITY.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <Icon className="size-5 text-[oklch(0.78_0.12_275)]" aria-hidden="true" />
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-white/65">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ───────── Pricing ─────────
const PLANS = [
  {
    name: "Free", tagline: "For small teams getting organized.", cta: "Get started", href: "/register",
    features: ["Tickets, tasks and knowledge base", "Customer portal", "Default SLA policy", "Email notifications"],
  },
  {
    name: "Starter", tagline: "For growing service desks.", cta: "Start with Starter", href: "/register?plan=starter",
    features: ["Everything in Free", "Automation rules", "Multiple SLA policies and business hours", "Reporting and CSV exports"],
  },
  {
    name: "Business", tagline: "For multi-team operations.", cta: "Start with Business", href: "/register?plan=business", featured: true,
    features: ["Everything in Starter", "Approvals and asset management", "Webhooks, REST API and chat integrations", "Custom fields, forms and roles"],
  },
  {
    name: "Enterprise", tagline: "For organizations with advanced needs.", cta: "Contact sales", href: "/contact",
    features: ["Everything in Business", "Single sign-on", "Onboarding assistance", "Security and procurement review"],
  },
];

export function Pricing() {
  return (
    <section id="pricing" className={cn(container, "scroll-mt-20 py-20 sm:py-28")}>
      <SectionHeading eyebrow="Pricing" title="Start free, upgrade when you need more" description="Every workspace starts on the Free plan. Paid plans are purchased through secure checkout and can be changed at any time from billing settings." />
      <div className="mt-14 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.map(plan => (
          <div key={plan.name} className={cn("relative flex flex-col rounded-2xl border bg-card p-6", plan.featured && "border-primary/50 shadow-lg ring-1 ring-primary/30")}>
            {plan.featured ? <span className="absolute -top-3 left-6 rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">Most complete</span> : null}
            <h3 className="text-lg font-semibold">{plan.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
            <ul className="mt-6 flex-1 space-y-3">
              {plan.features.map(f => (
                <li key={f} className="flex gap-2.5 text-sm"><Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" /><span>{f}</span></li>
              ))}
            </ul>
            <Button asChild variant={plan.featured ? "default" : "outline"} className="mt-8 w-full"><Link href={plan.href}>{plan.cta}</Link></Button>
          </div>
        ))}
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">Current prices are shown in the app before you upgrade. Questions? <Link href="/contact" className="font-medium text-primary hover:underline">Talk to us</Link>.</p>
    </section>
  );
}

// ───────── FAQ ─────────
const FAQ = [
  { q: "Who is Nexora for?", a: "IT service desks, HR, finance, facilities and operations teams that receive requests and need to track the work behind them — internally or for external customers." },
  { q: "Can we use it for external customers?", a: "Yes. Customers get a separate portal where they can raise and follow their own requests and read published knowledge base articles, without seeing your internal notes or workspace." },
  { q: "Can one person belong to several organizations?", a: "Yes. A single account can be a member of multiple organizations and switch between them. Data is always isolated per organization." },
  { q: "How do SLA timers work?", a: "Each priority has first-response and resolution targets. Timers count only business hours, skip holidays and pause while a ticket waits on the requester or an approval." },
  { q: "Can requests come in by email?", a: "Yes. When inbound email is configured, messages sent to your organization's support address create tickets, and replies are threaded onto the right ticket." },
  { q: "Do you support single sign-on?", a: "Sign-in with Google and Microsoft accounts is available when enabled for your deployment. Email and password sign-in is always available." },
  { q: "How do we get started?", a: "Create a workspace, then follow the setup guide to add departments, teams, categories and SLA targets and invite your colleagues. It takes a few minutes." },
];

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 border-t border-border/60 bg-muted/30">
      <div className={cn(container, "grid gap-10 py-20 sm:py-28 lg:grid-cols-[1fr_1.4fr]")}>
        <SectionHeading align="left" eyebrow="FAQ" title="Questions, answered" description={<>Can&apos;t find what you&apos;re looking for? <Link href="/contact" className="font-medium text-primary hover:underline">Get in touch</Link>.</>} />
        <div className="divide-y rounded-2xl border bg-card">
          {FAQ.map(item => (
            <details key={item.q} className="group px-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">
                {item.q}
                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="pb-5 text-sm text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ───────── Final CTA ─────────
export function FinalCta({ signedIn }: { signedIn: boolean }) {
  return (
    <section className={cn(container, "py-20 sm:py-28")}>
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-[oklch(0.45_0.22_290)] px-6 py-14 text-center text-white sm:px-12">
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgb(255_255_255/0.18),transparent_45%)]" />
        <div className="relative mx-auto max-w-2xl space-y-5">
          <LayoutGrid className="mx-auto size-8 opacity-80" aria-hidden="true" />
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Bring your requests and work into one place</h2>
          <p className="text-white/80">Set up your workspace in minutes and invite your team when you&apos;re ready.</p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            {signedIn ? (
              <Button asChild size="lg" variant="secondary" className="bg-white text-[oklch(0.3_0.1_275)] hover:bg-white/90"><Link href="/dashboard">Open workspace</Link></Button>
            ) : (
              <>
                <Button asChild size="lg" variant="secondary" className="bg-white text-[oklch(0.3_0.1_275)] hover:bg-white/90"><Link href="/register">Get Started</Link></Button>
                <Button asChild size="lg" variant="ghost" className="text-white hover:bg-white/10 hover:text-white"><Link href="/contact">Book a Demo</Link></Button>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
