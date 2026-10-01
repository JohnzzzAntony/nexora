"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { CircleUser, LifeBuoy, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useShell } from "@/components/shell/shell-context";

export function UserMenu() {
  const { user, role, organization } = useShell();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="focus-visible:ring-ring/40 rounded-full outline-none focus-visible:ring-[3px]"
        aria-label={`Account menu for ${user.name}`}
      >
        <UserAvatar name={user.name} src={user.avatarUrl} size="md" title="" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60" sideOffset={8}>
        <DropdownMenuLabel className="flex items-center gap-2.5 py-2 font-normal">
          <UserAvatar name={user.name} src={user.avatarUrl} size="md" title="" />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{user.name}</div>
            <div className="text-muted-foreground truncate text-xs">{user.email}</div>
          </div>
        </DropdownMenuLabel>
        <div className="text-muted-foreground px-2 pb-1.5 text-xs">
          {role} · {organization.name}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <CircleUser /> Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/help">
            <LifeBuoy /> Help
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut({ callbackUrl: "/login" })}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
