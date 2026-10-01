"use client"

import * as React from "react"
import { AlertTriangle, RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type ErrorStateProps = {
  title?: string
  description?: React.ReactNode
  /** When provided a "Try again" button is shown. */
  onRetry?: () => void
  retrying?: boolean
  /** Extra actions (e.g. link back to dashboard). */
  action?: React.ReactNode
  className?: string
  size?: "default" | "sm"
}

export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this content. Please try again.",
  onRetry,
  retrying,
  action,
  className,
  size = "default",
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center text-center",
        size === "sm" ? "gap-2 px-4 py-8" : "gap-3 rounded-lg border border-dashed px-6 py-14",
        className
      )}
    >
      <div className="bg-destructive/10 text-destructive flex size-11 items-center justify-center rounded-lg" aria-hidden>
        <AlertTriangle className="size-5" />
      </div>
      <div className="max-w-sm space-y-1">
        <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
        {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
      </div>
      {(onRetry || action) && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
              <RotateCw className={cn(retrying && "animate-spin")} />
              Try again
            </Button>
          )}
          {action}
        </div>
      )}
    </div>
  )
}
