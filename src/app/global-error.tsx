"use client";

import { useEffect } from "react";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

// Replaces the root layout when it fails, so it must render <html>/<body> itself and cannot rely
// on providers (theme, query client). Uses the system color scheme via a media query.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app] global error", error.digest ?? "");
  }, [error]);

  return (
    <html lang="en" className={inter.variable}>
      <head>
        <title>Something went wrong · Nexora</title>
        <script
          dangerouslySetInnerHTML={{
            __html: "if(window.matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.classList.add('dark')",
          }}
        />
      </head>
      <body className="bg-background text-foreground min-h-dvh font-sans antialiased">
        <div className="flex min-h-dvh flex-col">
          <header className="px-6 py-5">
            <span className="inline-flex items-center gap-2">
              <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md text-xs font-bold" aria-hidden>
                D
              </span>
              <span className="text-[15px] font-semibold tracking-tight">Nexora</span>
            </span>
          </header>
          <main className="flex flex-1 items-center justify-center px-6 pb-24">
            <div className="max-w-md text-center">
              <p className="text-primary font-mono text-sm font-semibold tracking-wider">500</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Something went wrong</h1>
              <p className="text-muted-foreground mt-4 text-[15px] leading-relaxed">
                An unexpected error occurred on our side. Please try again — if the problem continues, contact your administrator.
              </p>
              {error.digest ? <p className="text-muted-foreground mt-3 font-mono text-xs">Reference: {error.digest}</p> : null}
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={reset}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring/40 inline-flex h-9 items-center rounded-md px-4 text-sm font-medium shadow-xs outline-none focus-visible:ring-[3px]"
                >
                  Try again
                </button>
                <a
                  href="/dashboard"
                  className="border-input bg-background hover:bg-accent focus-visible:ring-ring/40 inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium shadow-xs outline-none focus-visible:ring-[3px]"
                >
                  Go to dashboard
                </a>
              </div>
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
