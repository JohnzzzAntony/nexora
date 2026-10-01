import * as React from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export type BreadcrumbEntry = { label: string; href?: string }

export type PageHeaderProps = {
  title: React.ReactNode
  description?: React.ReactNode
  breadcrumbs?: BreadcrumbEntry[]
  /** Right-aligned actions (buttons, menus). */
  actions?: React.ReactNode
  /** Content rendered next to the title (e.g. a status badge). */
  meta?: React.ReactNode
  className?: string
}

export function PageHeader({ title, description, breadcrumbs, actions, meta, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-3 pb-5", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb">
          <ol className="text-muted-foreground flex flex-wrap items-center gap-1 text-[13px]">
            {breadcrumbs.map((b, i) => {
              const last = i === breadcrumbs.length - 1
              return (
                <li key={`${b.label}-${i}`} className="flex items-center gap-1">
                  {b.href && !last ? (
                    <Link href={b.href} className="hover:text-foreground rounded-sm transition-colors">
                      {b.label}
                    </Link>
                  ) : (
                    <span aria-current={last ? "page" : undefined} className={cn(last && "text-foreground font-medium")}>
                      {b.label}
                    </span>
                  )}
                  {!last && <ChevronRight className="size-3.5 opacity-60" aria-hidden />}
                </li>
              )
            })}
          </ol>
        </nav>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-semibold tracking-tight sm:text-[22px]">{title}</h1>
            {meta}
          </div>
          {description ? <p className="text-muted-foreground max-w-3xl text-sm">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  )
}
