import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusPage } from "@/components/shell/status-page";

export const metadata: Metadata = { title: "Sign in required" };

export default function Unauthorized() {
  return (
    <StatusPage
      code="401"
      title="Please sign in"
      description="Your session has expired or you're not signed in. Sign in to continue where you left off."
      actions={
        <>
          <Button asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">Home</Link>
          </Button>
        </>
      }
    />
  );
}
