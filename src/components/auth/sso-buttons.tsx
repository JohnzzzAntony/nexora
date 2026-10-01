"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.66 4.1-5.5 4.1-3.3 0-6-2.74-6-6.1s2.7-6.1 6-6.1c1.88 0 3.14.8 3.86 1.49l2.63-2.54C16.8 3.4 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.54 0 9.2-3.9 9.2-9.38 0-.63-.07-1.11-.16-1.6H12z" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path fill="#F25022" d="M3 3h8.5v8.5H3z" /><path fill="#7FBA00" d="M12.5 3H21v8.5h-8.5z" />
      <path fill="#00A4EF" d="M3 12.5h8.5V21H3z" /><path fill="#FFB900" d="M12.5 12.5H21V21h-8.5z" />
    </svg>
  );
}

/** Renders only the providers the server reports as configured. */
export function SsoButtons({ sso, callbackUrl, disabled }: { sso: { google: boolean; microsoft: boolean }; callbackUrl: string; disabled?: boolean }) {
  const [pending, setPending] = useState<string | null>(null);
  if (!sso.google && !sso.microsoft) return null;
  const start = (provider: "google" | "azure-ad") => {
    setPending(provider);
    void signIn(provider, { callbackUrl });
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        {sso.google && (
          <Button type="button" variant="secondary" className="h-10 w-full border border-border bg-background text-foreground hover:bg-muted" disabled={disabled || pending !== null} onClick={() => start("google")}>
            {pending === "google" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <GoogleIcon />} Continue with Google
          </Button>
        )}
        {sso.microsoft && (
          <Button type="button" variant="secondary" className="h-10 w-full border border-border bg-background text-foreground hover:bg-muted" disabled={disabled || pending !== null} onClick={() => start("azure-ad")}>
            {pending === "azure-ad" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <MicrosoftIcon />} Continue with Microsoft
          </Button>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
