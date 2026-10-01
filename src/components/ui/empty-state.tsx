import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { Inbox } from "lucide-react"
import { cn } from "@/lib/utils"

export type EmptyStateProps = {
  title: string
  description?: React.ReactNode
  icon?: LucideIcon
  /** Buttons / links rendered below the description. */
  action?: React.ReactNode
  className?: string
  /** Compact variant for use inside cards and popovers. */
  size?: "default" | "sm"
}

export function EmptyState({ title, description, icon: Icon = Inbox, action, className, size = "default" }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        size === "sm" ? "gap-2 px-4 py-8" : "gap-3 rounded-lg border border-dashed px-6 py-14",
        className
      )}
    >
      <div
        className={cn(
          "bg-muted text-muted-foreground flex items-center justify-center rounded-lg border",
          size === "sm" ? "size-9" : "size-11"
        )}
        aria-hidden
      >
        <Icon className={size === "sm" ? "size-4" : "size-5"} />
      </div>
      <div className="max-w-sm space-y-1">
        <h3 className={cn("font-semibold tracking-tight", size === "sm" ? "text-sm" : "text-[15px]")}>{title}</h3>
        {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
      </div>
      {action ? <div className="mt-1 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
    </div>
  )
}
