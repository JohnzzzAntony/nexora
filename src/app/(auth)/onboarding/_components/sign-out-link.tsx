"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SignOutLink() {
  const [pending, setPending] = useState(false);
  return (
    <Button variant="ghost" size="sm" disabled={pending} onClick={() => { setPending(true); void signOut({ callbackUrl: "/login" }); }}>
      <LogOut aria-hidden="true" /> Sign out
    </Button>
  );
}
