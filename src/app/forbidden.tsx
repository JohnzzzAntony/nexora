import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusPage } from "@/components/shell/status-page";

export const metadata: Metadata = { title: "Access denied" };

export default function Forbidden() {
  return (
    <StatusPage
      code="403"
      title="You don't have access"
      description="Your role doesn't include permission to view this page. If you think this is a mistake, ask an administrator of your organization to update your role."
      actions={
        <>
          <Button asChild>
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/help">Get help</Link>
          </Button>
        </>
      }
    />
  );
}
