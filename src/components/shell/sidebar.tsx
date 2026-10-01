"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen, ExternalLink } from "lucide-react";
import { BRAND } from "@/config/brand";
import { MAIN_NAV, SECONDARY_NAV, type NavItem } from "@/config/navigation";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NavIcon } from "@/components/shell/icons";
import { OrgSwitcher } from "@/components/shell/org-switcher";
import { useShell } from "@/components/shell/shell-context";
import { useUnreadCount } from "@/components/shell/use-notifications";
import { SIDEBAR_COOKIE } from "@/components/shell/types";
import { cn } from "@/lib/utils";

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, collapsed, onNavigate, badge }: { item: NavItem; collapsed?: boolean; onNavigate?: () => void; badge?: number }) {
  const pathname = usePathname();
  const active = isActivePath(pathname, item.href);

  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group focus-visible:ring-sidebar-ring/40 relative flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] font-medium outline-none transition-colors focus-visible:ring-[3px]",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
        collapsed && "justify-center px-0"
      )}
    >
      {active && <span className="bg-sidebar-primary absolute top-1.5 bottom-1.5 -left-2 w-0.5 rounded-r" aria-hidden />}
      <NavIcon name={item.icon} className={cn("size-4 shrink-0", active ? "text-sidebar-primary" : "text-muted-foreground group-hover:text-sidebar-accent-foreground")} aria-hidden />
      {!collapsed && <span className="flex-1 truncate">{item.title}</span>}
      {!!badge && badge > 0 && (
        <span
          className={cn(
            "bg-primary text-primary-foreground flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums",
            collapsed && "absolute top-0.5 right-0.5 h-3.5 min-w-3.5 text-[9px]"
          )}
          aria-label={`${badge} unread`}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.title}</TooltipContent>
    </Tooltip>
  );
}

/** Sidebar body (shared by the desktop rail and the mobile drawer). */
export function SidebarContent({ collapsed, onNavigate, onToggleCollapsed }: { collapsed?: boolean; onNavigate?: () => void; onToggleCollapsed?: () => void }) {
  const { canAny } = useShell();
  const { data: unread } = useUnreadCount();
  const main = MAIN_NAV.filter(i => canAny(i.anyOf));
  const secondary = SECONDARY_NAV.filter(i => canAny(i.anyOf));

  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-14 shrink-0 items-center border-b border-sidebar-border px-2", collapsed && "justify-center")}>
        <OrgSwitcher collapsed={collapsed} />
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Main">
        <ul className="space-y-0.5">
          {main.map(item => (
            <li key={item.href}>
              <NavLink item={item} collapsed={collapsed} onNavigate={onNavigate} badge={item.href === "/notifications" ? unread : undefined} />
            </li>
          ))}
        </ul>
      </nav>
      <div className="border-sidebar-border space-y-0.5 border-t px-3 py-3">
        <a href={BRAND.parentUrl} target="_blank" rel="noopener noreferrer" aria-label="DuooNex parent company (opens in new tab)" className={cn("flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] text-muted-foreground hover:bg-sidebar-accent", collapsed && "justify-center px-0")}>
          <ExternalLink className="size-4 shrink-0" aria-hidden="true" />
          {!collapsed && <span>DuooNex company</span>}
        </a>
        <ul className="space-y-0.5" aria-label="Secondary">
          {secondary.map(item => (
            <li key={item.href}>
              <NavLink item={item} collapsed={collapsed} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            className={cn(
              "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-ring/40 mt-1 flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-[13px] font-medium outline-none focus-visible:ring-[3px]",
              collapsed && "justify-center px-0"
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        )}
      </div>
    </div>
  );
}



export function DesktopSidebar() {
  const { sidebarCollapsed } = useShell();
  const [collapsed, setCollapsed] = React.useState(sidebarCollapsed);

  const toggle = () => {
    setCollapsed(c => {
      const next = !c;
      document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  };

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b" && !(e.target as HTMLElement)?.closest?.("input,textarea,[contenteditable=true]")) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <aside
      className={cn(
        "bg-sidebar text-sidebar-foreground border-sidebar-border hidden shrink-0 border-r transition-[width] duration-200 md:block",
        collapsed ? "w-[60px]" : "w-60"
      )}
      aria-label="Sidebar"
    >
      <SidebarContent collapsed={collapsed} onToggleCollapsed={toggle} />
    </aside>
  );
}
