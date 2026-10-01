"use client";
import { signOut } from "next-auth/react";
export function PortalSignOut() {
  return (
    <button
      className="text-muted-foreground hover:text-foreground"
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      Sign out
    </button>
  );
}
