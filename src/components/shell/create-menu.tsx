"use client";

import Link from "next/link";
import { ListChecks, Plus, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useShell } from "@/components/shell/shell-context";

export function CreateMenu() {
  const { can } = useShell();
  const items = [
    can("tickets.create") && { href: "/tickets/new", label: "New ticket", icon: Ticket },
    can("tasks.create") && { href: "/tasks?new=1", label: "New task", icon: ListChecks },
  ].filter(Boolean) as { href: string; label: string; icon: typeof Ticket }[];

  if (items.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" aria-label="Create">
          <Plus />
          <span className="hidden sm:inline">Create</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {items.map(({ href, label, icon: Icon }) => (
          <DropdownMenuItem key={href} asChild>
            <Link href={href}>
              <Icon /> {label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
