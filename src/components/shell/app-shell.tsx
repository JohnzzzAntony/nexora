"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { CommandPalette } from "@/components/shell/command-palette";
import { CreateMenu } from "@/components/shell/create-menu";
import { NotificationBell } from "@/components/shell/notification-bell";
import { ShellProvider, useShell } from "@/components/shell/shell-context";
import { DesktopSidebar, SidebarContent } from "@/components/shell/sidebar";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { UserMenu } from "@/components/shell/user-menu";
import type { ShellData } from "@/components/shell/types";

function SearchButton() {
  const { setCommandOpen } = useShell();
  return (
    <>
      <button
        type="button"
        onClick={() => setCommandOpen(true)}
        className="border-input bg-background dark:bg-input/20 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring/40 hidden h-8 w-full max-w-sm items-center gap-2 rounded-md border px-2.5 text-[13px] shadow-xs outline-none focus-visible:ring-[3px] sm:flex"
        aria-label="Search (Ctrl K)"
      >
        <Search className="size-4" aria-hidden />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="bg-muted rounded border px-1.5 py-px font-mono text-[10px] font-medium">Ctrl K</kbd>
      </button>
      <Button variant="ghost" size="icon-sm" className="sm:hidden" onClick={() => setCommandOpen(true)} aria-label="Search">
        <Search />
      </Button>
    </>
  );
}

function MobileNav() {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  React.useEffect(() => setOpen(false), [pathname]);
  return (
    <>
      <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={() => setOpen(true)} aria-label="Open navigation">
        <Menu />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="bg-sidebar text-sidebar-foreground w-72 p-0 sm:max-w-72 [&>button]:hidden">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Main application navigation</SheetDescription>
          <SidebarContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}

function Topbar() {
  return (
    <header className="bg-background/85 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b px-3 backdrop-blur sm:px-4">
      <MobileNav />
      <div className="flex flex-1 items-center">
        <SearchButton />
      </div>
      <div className="flex items-center gap-1.5">
        <CreateMenu />
        <NotificationBell />
        <ThemeToggle />
        <div className="ml-1">
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

export function AppShell({ data, children }: { data: ShellData; children: React.ReactNode }) {
  return (
    <ShellProvider data={data}>
      <a
        href="#main-content"
        className="bg-primary text-primary-foreground sr-only z-50 rounded-md px-3 py-2 text-sm focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <div className="flex h-dvh overflow-hidden">
        <DesktopSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto outline-none">
            <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">{children}</div>
          </main>
        </div>
      </div>
      <CommandPalette />
    </ShellProvider>
  );
}
