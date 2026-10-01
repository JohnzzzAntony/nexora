"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

const SIZES = {
  xs: "size-5 text-[9px]",
  sm: "size-6 text-[10px]",
  md: "size-8 text-xs",
  lg: "size-10 text-sm",
  xl: "size-14 text-base",
} as const

export type UserAvatarSize = keyof typeof SIZES

const PALETTE = [
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300",
  "bg-slate-200 text-slate-700 dark:bg-slate-500/25 dark:text-slate-200",
]

export function getInitials(name: string | null | undefined) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return "?"
  const first = parts[0][0] ?? ""
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : ""
  return (first + last).toUpperCase()
}

function colorFor(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

export type UserAvatarProps = {
  name: string | null | undefined
  src?: string | null
  size?: UserAvatarSize
  className?: string
  /** Shown as native tooltip; defaults to name. */
  title?: string
}

export function UserAvatar({ name, src, size = "md", className, title }: UserAvatarProps) {
  const label = name?.trim() || "Unknown user"
  return (
    <Avatar className={cn(SIZES[size], "ring-background", className)} title={title ?? label}>
      {src ? <AvatarImage src={src} alt={label} className="object-cover" /> : null}
      <AvatarFallback className={cn("font-semibold", colorFor(label))} aria-label={label}>
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  )
}
