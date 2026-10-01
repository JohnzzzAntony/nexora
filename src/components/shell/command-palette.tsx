"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import {
  BookOpen,
  Briefcase,
  Building2,
  ChartColumn,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  Loader2,
  LogOut,
  MonitorSmartphone,
  Plus,
  Settings,
  SunMoon,
  Ticket,
  User,
  type LucideIcon,
} from "lucide-react";
import { Command as CommandPrimitive } from "cmdk";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { CommandEmpty, CommandGroup, CommandItem, CommandList, CommandSeparator, CommandShortcut } from "@/components/ui/command";
import type { Permission } from "@/lib/permissions/catalog";
import { SEARCH_GROUPS, SEARCH_GROUP_LABELS, SEARCH_MIN_LENGTH, type SearchGroup, type SearchResponse } from "@/lib/search/types";
import { apiFetch, safeInternalUrl } from "@/components/shell/api";
import { useShell } from "@/components/shell/shell-context";
import { safeHex } from "@/lib/color";

type Cmd = { id: string; label: string; icon: LucideIcon; keywords?: string; anyOf?: Permission[]; run: () => void; shortcut?: string };

const GROUP_ICONS: Record<SearchGroup, LucideIcon> = {
  tickets: Ticket,
  tasks: ListChecks,
  projects: FolderKanban,
  users: User,
  customers: Building2,
  assets: MonitorSmartphone,
  knowledge: BookOpen,
};

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function CommandPalette() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { canAny, commandOpen: open, setCommandOpen: setOpen } = useShell();
  const [query, setQuery] = React.useState("");
  const debounced = useDebounced(query.trim(), 250);
  const searchable = debounced.length >= SEARCH_MIN_LENGTH || /^#?\d+$/.test(debounced);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const search = useQuery({
    queryKey: ["global-search", debounced],
    queryFn: async ({ signal }) => (await apiFetch<SearchResponse>(`/api/v1/search?q=${encodeURIComponent(debounced)}`, { signal })).data,
    enabled: open && searchable,
    staleTime: 30_000,
    placeholderData: prev => prev,
  });

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const allCommands: Cmd[] = [
    { id: "new-ticket", label: "Create ticket", icon: Plus, keywords: "new ticket request", anyOf: ["tickets.create"], run: () => go("/tickets/new") },
    { id: "new-task", label: "Create task", icon: Plus, keywords: "new task todo", anyOf: ["tasks.create"], run: () => go("/tasks?new=1") },
    { id: "dashboard", label: "Go to Dashboard", icon: LayoutDashboard, keywords: "home overview", run: () => go("/dashboard") },
    { id: "tickets", label: "Go to Tickets", icon: Ticket, anyOf: ["tickets.view", "tickets.view_team", "tickets.view_all"], run: () => go("/tickets") },
    { id: "my-work", label: "Go to My Work", icon: Briefcase, keywords: "assigned mine", run: () => go("/my-work") },
    { id: "reports", label: "Go to Reports", icon: ChartColumn, keywords: "analytics charts", anyOf: ["reports.view"], run: () => go("/reports") },
    { id: "settings", label: "Go to Settings", icon: Settings, keywords: "admin configuration", anyOf: ["settings.view", "settings.manage"], run: () => go("/settings") },
    {
      id: "theme",
      label: resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme",
      icon: SunMoon,
      keywords: "toggle theme dark light mode appearance",
      run: () => {
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
        setOpen(false);
      },
    },
    {
      id: "logout",
      label: "Sign out",
      icon: LogOut,
      keywords: "logout log out exit",
      run: () => {
        setOpen(false);
        void signOut({ callbackUrl: "/login" });
      },
    },
  ];
  const commands = allCommands.filter(c => canAny(c.anyOf));

  const q = query.trim().toLowerCase();
  const visibleCommands = q ? commands.filter(c => `${c.label} ${c.keywords ?? ""}`.toLowerCase().includes(q)) : commands;
  const groups = search.data && searchable ? SEARCH_GROUPS.filter(g => search.data.groups[g].length > 0) : [];
  const loading = searchable && (search.isFetching || debounced !== query.trim());
  const noResults = !loading && visibleCommands.length === 0 && groups.length === 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="top-[15%] translate-y-0 overflow-hidden p-0 sm:max-w-xl" showCloseButton={false}>
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">Search across your workspace or run a command.</DialogDescription>
        <CommandPrimitive shouldFilter={false} loop className="bg-popover text-popover-foreground flex flex-col" label="Command palette">
          <div className="flex h-12 items-center gap-2 border-b px-3">
            <CommandPrimitive.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search tickets, tasks, people… or type a command"
              className="placeholder:text-muted-foreground h-full flex-1 bg-transparent text-sm outline-none"
              autoFocus
            />
            {loading ? <Loader2 className="text-muted-foreground size-4 animate-spin" aria-label="Searching" /> : null}
            <kbd className="text-muted-foreground bg-muted hidden rounded border px-1.5 py-0.5 font-mono text-[10px] sm:inline">ESC</kbd>
          </div>
          <CommandList className="max-h-[min(60vh,420px)] p-1">
            {noResults && (
              <CommandEmpty className="text-muted-foreground py-10 text-center text-sm">
                {search.isError ? "Search failed. Please try again." : `No results for “${query.trim()}”.`}
              </CommandEmpty>
            )}
            {groups.map(g => {
              const Icon = GROUP_ICONS[g];
              return (
                <CommandGroup key={g} heading={SEARCH_GROUP_LABELS[g]}>
                  {search.data!.groups[g].map(hit => {
                    const href = safeInternalUrl(hit.url);
                    return (
                      <CommandItem key={`${g}:${hit.id}`} value={`${g}:${hit.id}`} onSelect={() => href && go(href)} className="py-2">
                        {g === "tickets" && hit.color ? (
                          <span className="flex size-4 items-center justify-center" aria-hidden>
                            <span className="size-2 rounded-full" style={{ backgroundColor: safeHex(hit.color) }} />
                          </span>
                        ) : (
                          <Icon />
                        )}
                        <span className="min-w-0 flex-1 truncate">{hit.title}</span>
                        {hit.subtitle && <span className="text-muted-foreground max-w-[45%] truncate text-xs">{hit.subtitle}</span>}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              );
            })}
            {groups.length > 0 && visibleCommands.length > 0 && <CommandSeparator className="my-1" />}
            {visibleCommands.length > 0 && (
              <CommandGroup heading="Commands">
                {visibleCommands.map(c => (
                  <CommandItem key={c.id} value={`cmd:${c.id}`} onSelect={c.run} className="py-2">
                    <c.icon />
                    <span className="flex-1">{c.label}</span>
                    {c.shortcut && <CommandShortcut>{c.shortcut}</CommandShortcut>}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
          <div className="text-muted-foreground flex items-center gap-3 border-t px-3 py-2 text-[11px]">
            <span>
              <kbd className="font-mono">↑↓</kbd> navigate
            </span>
            <span>
              <kbd className="font-mono">↵</kbd> open
            </span>
            <span className="ml-auto">
              <kbd className="font-mono">Ctrl K</kbd> toggle
            </span>
          </div>
        </CommandPrimitive>
      </DialogContent>
    </Dialog>
  );
}
