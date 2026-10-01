"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function ProfileError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto w-full max-w-4xl py-10">
      <ErrorState title="Couldn't load your profile" description="Something went wrong while loading this page. Please try again." onRetry={reset} />
    </div>
  );
}
