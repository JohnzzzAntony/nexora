import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusPage } from "@/components/shell/status-page";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <StatusPage
      code="404"
      title="Page not found"
      description="The page you're looking for doesn't exist, was moved, or you may not have access to it."
      actions={
        <>
          <Button asChild>
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">Home</Link>
          </Button>
        </>
      }
    />
  );
}
