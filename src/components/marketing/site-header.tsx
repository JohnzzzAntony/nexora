import Link from "next/link";
import { ArrowRight, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/marketing/logo";

export const NAV_LINKS = [
  { href: "/#product", label: "Product" },
  { href: "/#workflows", label: "Workflows" },
  { href: "/#integrations", label: "Integrations" },
  { href: "/#security", label: "Security" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
];

/** Server-rendered header; the mobile menu is a native <details> element (no client JS). */
export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/75 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow">Skip to content</a>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Logo />
        <nav aria-label="Main" className="hidden flex-1 items-center gap-1 md:flex">
          {NAV_LINKS.map(link => (
            <Link key={link.href} href={link.href} className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground">{link.label}</Link>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-2 md:flex">
          {signedIn ? (
            <Button asChild size="sm"><Link href="/dashboard">Open workspace <ArrowRight aria-hidden="true" /></Link></Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm"><Link href="/login">Sign in</Link></Button>
              <Button asChild size="sm"><Link href="/register">Get started</Link></Button>
            </>
          )}
        </div>
        <details className="group relative ml-auto md:hidden">
          <summary className="flex size-10 cursor-pointer list-none items-center justify-center rounded-md border border-border/70 text-foreground [&::-webkit-details-marker]:hidden" aria-label="Open menu">
            <Menu className="size-5" aria-hidden="true" />
          </summary>
          <div className="absolute right-0 top-12 w-[min(20rem,calc(100vw-2rem))] rounded-xl border bg-popover p-2 text-popover-foreground shadow-xl">
            <nav aria-label="Mobile" className="flex flex-col">
              {NAV_LINKS.map(link => (
                <Link key={link.href} href={link.href} className="rounded-md px-3 py-2.5 text-sm hover:bg-muted">{link.label}</Link>
              ))}
            </nav>
            <div className="mt-2 grid gap-2 border-t pt-3">
              {signedIn ? (
                <Button asChild><Link href="/dashboard">Open workspace</Link></Button>
              ) : (
                <>
                  <Button asChild variant="ghost"><Link href="/login">Sign in</Link></Button>
                  <Button asChild><Link href="/register">Get started</Link></Button>
                </>
              )}
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
