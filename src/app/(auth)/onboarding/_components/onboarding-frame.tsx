import type { ReactNode } from "react";
import { Logo } from "@/components/marketing/logo";
import { SignOutLink } from "./sign-out-link";

export function OnboardingFrame({ children, userEmail, organizationName }: { children: ReactNode; userEmail: string; organizationName?: string }) {
  return (
    <div className="min-h-dvh bg-muted/30">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Logo href="/onboarding" />
            {organizationName ? <span className="hidden truncate border-l pl-3 text-sm text-muted-foreground sm:inline">{organizationName}</span> : null}
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden truncate text-muted-foreground md:inline">{userEmail}</span>
            <SignOutLink />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">{children}</main>
    </div>
  );
}
