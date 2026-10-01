import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-7", className)}>
      <defs>
        <linearGradient id="dx-logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="oklch(0.62 0.22 272)" />
          <stop offset="1" stopColor="oklch(0.48 0.25 290)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#dx-logo-g)" />
      <path d="M10 9h6.5a7 7 0 0 1 0 14H10z" fill="none" stroke="white" strokeWidth="2.6" strokeLinejoin="round" />
      <circle cx="21.5" cy="16" r="2.2" fill="white" />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 rounded-md font-semibold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}>
      <LogoMark />
      <span className="text-[17px]">Nexora</span>
    </Link>
  );
}
