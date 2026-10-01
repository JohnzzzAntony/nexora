"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getInitials } from "@/components/ui/user-avatar";
import { switchOrganization } from "@/components/shell/actions";
import { useShell } from "@/components/shell/shell-context";
import { cn } from "@/lib/utils";

function OrgMark({ name, logoUrl, className }: { name: string; logoUrl?: string | null; className?: string }) {
  return logoUrl ? (
    <img src={logoUrl} alt="" className={cn("size-7 shrink-0 rounded-md border object-cover", className)} />
  ) : (
    <span
      className={cn("bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold", className)}
      aria-hidden
    >
      {getInitials(name)}
    </span>
  );
}

export function OrgSwitcher({ collapsed }: { collapsed?: boolean }) {
  const { organization, organizations, role } = useShell();
  const [pending, startTransition] = React.useTransition();
  const [target, setTarget] = React.useState<string | null>(null);

  const onSelect = (id: string) => {
    if (id === organization.id) return;
    setTarget(id);
    startTransition(async () => {
      const res = await switchOrganization(id);
      // Success redirects; we only get here on failure.
      if (res && !res.ok) toast.error(res.error.message);
      setTarget(null);
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "hover:bg-sidebar-accent focus-visible:ring-sidebar-ring/40 flex w-full items-center gap-2.5 rounded-md p-1.5 text-left outline-none focus-visible:ring-[3px]",
          collapsed && "justify-center"
        )}
        aria-label={`Organization: ${organization.name}. Switch organization`}
      >
        <OrgMark name={organization.name} logoUrl={organization.logoUrl} />
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="text-sidebar-accent-foreground block truncate text-sm font-semibold">{organization.name}</span>
              <span className="text-muted-foreground block truncate text-xs">{role}</span>
            </span>
            {pending ? <Loader2 className="size-4 animate-spin opacity-60" /> : <ChevronsUpDown className="size-4 opacity-50" aria-hidden />}
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64" sideOffset={6}>
        <DropdownMenuLabel className="text-muted-foreground text-xs font-medium">Organizations</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {organizations.map(org => (
          <DropdownMenuItem key={org.id} onSelect={() => onSelect(org.id)} disabled={pending} className="gap-2.5">
            <OrgMark name={org.name} className="size-6 text-[10px]" />
            <span className="flex-1 truncate">{org.name}</span>
            {org.id === organization.id && <Check className="size-4" aria-label="Current" />}
            {pending && target === org.id && <Loader2 className="size-4 animate-spin" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
