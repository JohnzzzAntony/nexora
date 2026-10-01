import * as React from "react";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={className} aria-label="Nexora">
      <span className="inline-flex items-center gap-2">
        <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md text-xs font-bold" aria-hidden>
          D
        </span>
        <span className="text-[15px] font-semibold tracking-tight">Nexora</span>
      </span>
    </span>
  );
}

/** Full-page branded status screen (404 / 403 / 401 / 500). */
export function StatusPage({
  code,
  title,
  description,
  actions,
}: {
  code: string;
  title: string;
  description: React.ReactNode;
  actions: React.ReactNode;
}) {
  return (
    <div className="bg-background text-foreground relative flex min-h-dvh flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [background-size:48px_48px] opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]"
      />
      <header className="relative px-6 py-5">
        <BrandMark />
      </header>
      <main className="relative flex flex-1 items-center justify-center px-6 pb-24">
        <div className="max-w-md text-center">
          <p className="text-primary font-mono text-sm font-semibold tracking-wider">{code}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          <p className="text-muted-foreground mt-4 text-[15px] leading-relaxed">{description}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">{actions}</div>
        </div>
      </main>
    </div>
  );
}
