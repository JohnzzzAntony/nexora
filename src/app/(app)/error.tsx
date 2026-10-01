"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app] route error", error.digest ?? "");
  }, [error]);

  return (
    <div className="py-10">
      <ErrorState
        title="This page couldn't be loaded"
        description={
          <>
            An unexpected error occurred. Try again, or head back to your dashboard.
            {error.digest ? <span className="mt-2 block font-mono text-xs opacity-70">Reference: {error.digest}</span> : null}
          </>
        }
        onRetry={reset}
        action={
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        }
      />
    </div>
  );
}
