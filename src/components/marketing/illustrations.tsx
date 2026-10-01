import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Product illustrations built from markup. Content is illustrative UI, not customer data.

export function WindowFrame({ children, className, title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <div aria-hidden="true" className={cn("overflow-hidden rounded-xl border border-border/70 bg-card shadow-[0_24px_80px_-24px_rgb(30_27_75/0.35)] dark:shadow-[0_24px_80px_-24px_rgb(0_0_0/0.8)]", className)}>
      <div className="flex h-9 items-center gap-1.5 border-b border-border/60 bg-muted/40 px-3">
        <span className="size-2.5 rounded-full bg-[#ff5f57]" /><span className="size-2.5 rounded-full bg-[#febc2e]" /><span className="size-2.5 rounded-full bg-[#28c840]" />
        {title ? <span className="mx-auto truncate text-[11px] text-muted-foreground">{title}</span> : null}
      </div>
      {children}
    </div>
  );
}

const Dot = ({ className }: { className: string }) => <span className={cn("inline-block size-2 shrink-0 rounded-full", className)} />;
const Bar = ({ className }: { className?: string }) => <span className={cn("block h-2 rounded-full bg-muted", className)} />;

const STATUS = {
  new: { label: "New", cls: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300" },
  progress: { label: "In progress", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  waiting: { label: "Waiting", cls: "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300" },
  resolved: { label: "Resolved", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
} as const;

const Pill = ({ status }: { status: keyof typeof STATUS }) => (
  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", STATUS[status].cls)}>{STATUS[status].label}</span>
);

const TICKETS: { id: string; title: string; status: keyof typeof STATUS; priority: string; sla: number; who: string }[] = [
  { id: "10482", title: "VPN disconnects on hotel Wi-Fi", status: "progress", priority: "bg-amber-500", sla: 62, who: "AM" },
  { id: "10481", title: "New starter: laptop and accounts", status: "new", priority: "bg-sky-500", sla: 18, who: "JL" },
  { id: "10479", title: "Payroll export missing overtime", status: "waiting", priority: "bg-red-500", sla: 84, who: "RK" },
  { id: "10476", title: "Meeting room display offline", status: "progress", priority: "bg-sky-500", sla: 40, who: "SD" },
  { id: "10471", title: "Access to finance shared drive", status: "resolved", priority: "bg-slate-400", sla: 100, who: "AM" },
];

export function HeroProductMock() {
  return (
    <WindowFrame title="Nexora / Tickets">
      <div className="grid grid-cols-[132px_minmax(0,1fr)] text-[11px] sm:grid-cols-[150px_minmax(0,1fr)_200px]">
        <div className="hidden space-y-1 border-r border-border/60 bg-muted/20 p-3 min-[420px]:block">
          {["Dashboard", "Tickets", "My work", "Tasks", "Projects", "Assets", "Knowledge", "Reports"].map((item, i) => (
            <div key={item} className={cn("flex items-center gap-2 rounded-md px-2 py-1.5", i === 1 ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground")}>
              <span className={cn("size-3 rounded-[3px]", i === 1 ? "bg-primary/70" : "bg-muted-foreground/25")} />{item}
            </div>
          ))}
        </div>
        <div className="col-span-2 min-w-0 min-[420px]:col-span-1">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5">
            <span className="text-xs font-semibold">Open tickets</span>
            <div className="flex gap-1.5"><span className="rounded-md border px-2 py-0.5 text-muted-foreground">Filter</span><span className="rounded-md bg-primary px-2 py-0.5 text-primary-foreground">New ticket</span></div>
          </div>
          <ul className="divide-y divide-border/60">
            {TICKETS.map((t, i) => (
              <li key={t.id} className={cn("flex items-center gap-2.5 px-3 py-2.5", i === 0 && "bg-primary/[0.04]")}>
                <Dot className={t.priority} />
                <span className="w-10 shrink-0 font-mono text-muted-foreground">#{t.id}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{t.title}</span>
                <span className="hidden sm:inline"><Pill status={t.status} /></span>
                <span className="hidden w-14 shrink-0 md:block"><span className="block h-1.5 overflow-hidden rounded-full bg-muted"><span className={cn("block h-full rounded-full", t.sla > 80 ? "bg-red-500" : t.sla > 60 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${t.sla}%` }} /></span></span>
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground">{t.who}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="hidden space-y-3 border-l border-border/60 p-3 sm:block">
          <p className="text-xs font-semibold">#10482</p>
          <div className="space-y-1.5">
            {[["Status", <Pill key="s" status="progress" />], ["Priority", <span key="p" className="flex items-center gap-1"><Dot className="bg-amber-500" />High</span>], ["Team", "Service Desk"], ["Category", "Network › VPN"]].map(([k, v]) => (
              <div key={String(k)} className="flex items-center justify-between gap-2"><span className="text-muted-foreground">{k}</span><span className="truncate">{v}</span></div>
            ))}
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2">
            <p className="font-medium text-amber-700 dark:text-amber-300">Resolution due in 1h 20m</p>
            <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-amber-500/15"><span className="block h-full w-[62%] rounded-full bg-amber-500" /></span>
          </div>
          <div className="space-y-1.5 rounded-lg bg-muted/50 p-2"><Bar className="w-11/12" /><Bar className="w-8/12" /><Bar className="w-10/12" /></div>
        </div>
      </div>
    </WindowFrame>
  );
}

export function TicketConversationMock() {
  return (
    <WindowFrame title="#10482 · VPN disconnects on hotel Wi-Fi">
      <div className="space-y-3 p-4 text-[11px]">
        <div className="flex gap-2.5">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-[9px] font-semibold text-sky-700 dark:text-sky-300">JL</span>
          <div className="flex-1 rounded-lg border bg-background p-2.5"><p className="mb-1 font-medium">Requester · via email</p><div className="space-y-1.5"><Bar className="w-full" /><Bar className="w-9/12" /></div></div>
        </div>
        <div className="flex gap-2.5">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-[9px] font-semibold text-amber-700 dark:text-amber-300">AM</span>
          <div className="flex-1 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5"><p className="mb-1 font-medium text-amber-700 dark:text-amber-300">Internal note · visible to agents only</p><div className="space-y-1.5"><Bar className="w-10/12 bg-amber-500/15" /><Bar className="w-6/12 bg-amber-500/15" /></div></div>
        </div>
        <div className="flex gap-2.5">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[9px] font-semibold text-primary">AM</span>
          <div className="flex-1 rounded-lg border bg-primary/[0.04] p-2.5"><p className="mb-1 font-medium">Public reply</p><div className="space-y-1.5"><Bar className="w-11/12" /><Bar className="w-7/12" /></div></div>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-background p-2"><Bar className="flex-1" /><span className="rounded-md bg-primary px-2 py-1 text-[10px] text-primary-foreground">Send reply</span></div>
      </div>
    </WindowFrame>
  );
}

export function KanbanMock() {
  const cols = [
    { title: "To do", cards: [["Renew SSL certificates", "bg-sky-500"], ["Update onboarding checklist", "bg-slate-400"]] },
    { title: "In progress", cards: [["Migrate file shares", "bg-amber-500"], ["Quarterly access review", "bg-red-500"]] },
    { title: "Done", cards: [["Replace office printers", "bg-emerald-500"]] },
  ];
  return (
    <WindowFrame title="Projects · Office move">
      <div className="grid grid-cols-3 gap-2.5 p-3 text-[11px]">
        {cols.map(col => (
          <div key={col.title} className="space-y-2 rounded-lg bg-muted/40 p-2">
            <p className="flex items-center justify-between font-semibold">{col.title}<span className="text-muted-foreground">{col.cards.length}</span></p>
            {col.cards.map(([title, color]) => (
              <div key={title} className="space-y-2 rounded-md border bg-card p-2 shadow-xs">
                <p className="font-medium leading-snug">{title}</p>
                <div className="flex items-center justify-between"><Dot className={color} /><span className="size-4 rounded-full bg-muted" /></div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </WindowFrame>
  );
}

function FlowNode({ tag, title, tone }: { tag: string; title: string; tone: string }) {
  return (
    <div className="w-full rounded-lg border bg-card p-2.5 shadow-xs">
      <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide", tone)}>{tag}</span>
      <p className="mt-1.5 font-medium">{title}</p>
    </div>
  );
}

function FlowLine() {
  return <span className="mx-auto block h-4 w-px bg-border" />;
}

export function WorkflowMock() {
  return (
    <WindowFrame title="Automation · Route VPN issues">
      <div className="mx-auto max-w-xs p-4 text-[11px]">
        <FlowNode tag="When" title="A ticket is created" tone="bg-indigo-500/10 text-indigo-600 dark:text-indigo-300" />
        <FlowLine />
        <FlowNode tag="If" title="Category is Network › VPN and priority is High" tone="bg-amber-500/10 text-amber-700 dark:text-amber-300" />
        <FlowLine />
        <div className="grid grid-cols-2 gap-2">
          <FlowNode tag="Then" title="Assign to Network team" tone="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" />
          <FlowNode tag="Then" title="Notify team lead" tone="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" />
        </div>
      </div>
    </WindowFrame>
  );
}

export function SlaMock() {
  const rows = [
    { p: "Critical", c: "bg-red-500", target: "Respond in 15m", v: 35 },
    { p: "High", c: "bg-amber-500", target: "Resolve in 4h", v: 72 },
    { p: "Medium", c: "bg-sky-500", target: "Resolve in 8h", v: 48 },
    { p: "Low", c: "bg-slate-400", target: "Resolve in 24h", v: 20 },
  ];
  return (
    <WindowFrame title="SLA policy · Default">
      <div className="space-y-3 p-4 text-[11px]">
        {rows.map(r => (
          <div key={r.p} className="space-y-1.5">
            <div className="flex items-center justify-between"><span className="flex items-center gap-1.5 font-medium"><Dot className={r.c} />{r.p}</span><span className="text-muted-foreground">{r.target}</span></div>
            <span className="block h-1.5 overflow-hidden rounded-full bg-muted"><span className={cn("block h-full rounded-full", r.v > 70 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${r.v}%` }} /></span>
          </div>
        ))}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {["Mon–Fri 09:00–17:00", "Holidays excluded", "Paused while waiting on customer"].map(t => <span key={t} className="rounded-full border px-2 py-0.5 text-muted-foreground">{t}</span>)}
        </div>
      </div>
    </WindowFrame>
  );
}

export function ReportMock() {
  const bars = [38, 52, 44, 61, 57, 70, 64, 76, 69, 82, 74, 88];
  const line = bars.map((b, i) => `${i * 26 + 13},${110 - (b - 12) * 1.05}`).join(" ");
  return (
    <WindowFrame title="Reports · Ticket volume">
      <div className="p-4">
        <div className="mb-3 flex gap-1.5 text-[10px]">
          {["Created", "Resolved", "SLA met"].map((t, i) => <span key={t} className={cn("rounded-full px-2 py-0.5", i === 0 ? "bg-primary/10 text-primary" : "border text-muted-foreground")}>{t}</span>)}
        </div>
        <svg viewBox="0 0 312 120" className="h-auto w-full">
          {[30, 60, 90].map(y => <line key={y} x1="0" x2="312" y1={y} y2={y} className="stroke-border" strokeDasharray="3 4" />)}
          {bars.map((b, i) => <rect key={i} x={i * 26 + 5} y={118 - b} width="16" height={b} rx="3" className="fill-primary/20" />)}
          <polyline points={line} fill="none" className="stroke-primary" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      </div>
    </WindowFrame>
  );
}

export function KnowledgeMock() {
  return (
    <WindowFrame title="Knowledge base">
      <div className="space-y-3 p-4 text-[11px]">
        <div className="flex items-center gap-2 rounded-lg border bg-background px-2.5 py-2 text-muted-foreground"><span className="size-3 rounded-full border-2 border-muted-foreground/40" />How do I connect to the VPN?</div>
        {[["Connecting to the VPN from home", "Network"], ["Resetting your password", "Access"], ["Requesting new hardware", "Hardware"]].map(([t, c]) => (
          <div key={t} className="flex items-center justify-between gap-2 rounded-lg border p-2.5">
            <div className="min-w-0"><p className="truncate font-medium">{t}</p><p className="text-muted-foreground">{c}</p></div>
            <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-300">Published</span>
          </div>
        ))}
      </div>
    </WindowFrame>
  );
}

export function AssetMock() {
  const rows = [["AST-0142", "Laptop · 14\"", "Assigned", "bg-sky-500"], ["AST-0138", "Monitor · 27\"", "In stock", "bg-emerald-500"], ["AST-0121", "Phone", "In repair", "bg-amber-500"], ["AST-0097", "Desk printer", "Retired", "bg-slate-400"]];
  return (
    <WindowFrame title="Assets">
      <div className="p-3 text-[11px]">
        <div className="grid grid-cols-[70px_1fr_auto] gap-x-3 border-b px-2 pb-2 font-medium text-muted-foreground"><span>Tag</span><span>Asset</span><span>Status</span></div>
        {rows.map(([tag, name, status, c]) => (
          <div key={tag} className="grid grid-cols-[70px_1fr_auto] items-center gap-x-3 border-b border-border/50 px-2 py-2 last:border-0">
            <span className="font-mono text-muted-foreground">{tag}</span><span className="truncate font-medium">{name}</span>
            <span className="flex items-center gap-1.5"><Dot className={c} />{status}</span>
          </div>
        ))}
      </div>
    </WindowFrame>
  );
}
