import Link from "next/link";
import { Logo } from "@/components/marketing/logo";
import { BRAND } from "@/config/brand";

const COLUMNS = [
  { title: "Product", links: [
    { href: "/#product", label: "Overview" },
    { href: "/#tickets", label: "Ticket management" },
    { href: "/#tasks", label: "Task management" },
    { href: "/#workflows", label: "Automation" },
    { href: "/#pricing", label: "Pricing" },
  ] },
  { title: "Platform", links: [
    { href: "/#integrations", label: "Integrations" },
    { href: "/#security", label: "Security" },
    { href: "/#faq", label: "FAQ" },
  ] },
  { title: "Get started", links: [
    { href: "/register", label: "Create a workspace" },
    { href: "/login", label: "Sign in" },
    { href: "/contact", label: "Book a demo" },
  ] },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-muted/30">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)] lg:px-8">
        <div className="space-y-4">
          <Logo />
          <p className="text-sm text-muted-foreground">Connect. Assign. Achieve.</p>
          <a href={BRAND.parentUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-sm font-medium text-primary hover:underline">A product by {BRAND.parentName} ↗</a>
          <p className="max-w-xs text-sm text-muted-foreground">Connect. Assign. Achieve. One workspace for tickets, tasks, teams and everyday operations.</p>
        </div>
        {COLUMNS.map(col => (
          <nav key={col.title} aria-label={col.title} className="space-y-3">
            <h2 className="text-sm font-semibold">{col.title}</h2>
            <ul className="space-y-2">
              {col.links.map(l => (
                <li key={l.href}><Link href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">{l.label}</Link></li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-border/60">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>&copy; {new Date().getFullYear()} Nexora. All rights reserved.</p>
          <p>Built for service teams, IT, HR, facilities and operations.</p>
        </div>
      </div>
    </footer>
  );
}
