"use client"

import * as React from "react"
import { CheckCircle2, FileIcon, Loader2, RotateCw, UploadCloud, X, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type FileUploaderProps = {
  /**
   * Performs the upload. Resolve on success, reject (Error message is shown) on failure.
   * Call `onProgress(0..100)` to show determinate progress; otherwise an indeterminate bar is shown.
   */
  upload: (file: File, onProgress: (percent: number) => void) => Promise<void>
  /** `accept` attribute, e.g. "image/*,.pdf". Also validated on drop. */
  accept?: string
  /** Max size per file in MB. Default 25. */
  maxSizeMB?: number
  multiple?: boolean
  /** Max files per selection. Default 10. */
  maxFiles?: number
  disabled?: boolean
  /** Called after each successful upload. */
  onUploaded?: (file: File) => void
  /** Called after all queued uploads settle. */
  onSettled?: () => void
  /** Remove finished (successful) rows automatically after this many ms. 0 disables. Default 2500. */
  clearCompletedAfterMs?: number
  hint?: string
  className?: string
}

type Item = { key: string; file: File; status: "uploading" | "done" | "error"; progress: number | null; error?: string }

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function matchesAccept(file: File, accept?: string) {
  if (!accept) return true
  const rules = accept.split(",").map(s => s.trim().toLowerCase()).filter(Boolean)
  const name = file.name.toLowerCase()
  const type = file.type.toLowerCase()
  return rules.some(r => (r.startsWith(".") ? name.endsWith(r) : r.endsWith("/*") ? type.startsWith(r.slice(0, -1)) : type === r))
}

export function FileUploader({
  upload,
  accept,
  maxSizeMB = 25,
  multiple = true,
  maxFiles = 10,
  disabled,
  onUploaded,
  onSettled,
  clearCompletedAfterMs = 2500,
  hint,
  className,
}: FileUploaderProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [items, setItems] = React.useState<Item[]>([])
  const [dragging, setDragging] = React.useState(false)
  const [rejections, setRejections] = React.useState<string[]>([])
  const inputId = React.useId()

  const patch = (key: string, p: Partial<Item>) => setItems(list => list.map(i => (i.key === key ? { ...i, ...p } : i)))

  const run = async (item: Item) => {
    patch(item.key, { status: "uploading", progress: null, error: undefined })
    try {
      await upload(item.file, pct => patch(item.key, { progress: Math.max(0, Math.min(100, Math.round(pct))) }))
      patch(item.key, { status: "done", progress: 100 })
      onUploaded?.(item.file)
      if (clearCompletedAfterMs > 0) setTimeout(() => setItems(list => list.filter(i => i.key !== item.key)), clearCompletedAfterMs)
    } catch (e) {
      patch(item.key, { status: "error", error: e instanceof Error && e.message ? e.message : "Upload failed" })
    }
  }

  const addFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).slice(0, multiple ? maxFiles : 1)
    const rejected: string[] = []
    const accepted: Item[] = []
    for (const file of files) {
      if (!matchesAccept(file, accept)) rejected.push(`${file.name}: file type not allowed`)
      else if (file.size > maxSizeMB * 1024 * 1024) rejected.push(`${file.name}: larger than ${maxSizeMB} MB`)
      else if (file.size === 0) rejected.push(`${file.name}: file is empty`)
      else accepted.push({ key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`, file, status: "uploading", progress: null })
    }
    if (Array.from(fileList).length > files.length) rejected.push(`Only ${multiple ? maxFiles : 1} file(s) can be uploaded at once`)
    setRejections(rejected)
    if (!accepted.length) return
    setItems(list => [...list, ...accepted])
    await Promise.all(accepted.map(run))
    onSettled?.()
  }

  return (
    <div className={cn("space-y-2", className)}>
      <label
        htmlFor={inputId}
        onDragOver={e => {
          e.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault()
          setDragging(false)
          if (!disabled && e.dataTransfer.files.length) void addFiles(e.dataTransfer.files)
        }}
        onKeyDown={e => {
          if ((e.key === "Enter" || e.key === " ") && !disabled) {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        tabIndex={disabled ? -1 : 0}
        className={cn(
          "border-input hover:border-primary/50 hover:bg-accent/40 focus-visible:ring-ring/30 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition-colors outline-none focus-visible:ring-[3px]",
          dragging && "border-primary bg-primary/5",
          disabled && "pointer-events-none opacity-50"
        )}
      >
        <span className="bg-muted text-muted-foreground flex size-9 items-center justify-center rounded-lg border" aria-hidden>
          <UploadCloud className="size-4" />
        </span>
        <span className="text-sm">
          <span className="text-primary font-medium">Click to upload</span> or drag and drop
        </span>
        <span className="text-muted-foreground text-xs">{hint ?? `Up to ${maxSizeMB} MB per file`}</span>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          className="sr-only"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          tabIndex={-1}
          onChange={e => {
            if (e.target.files?.length) void addFiles(e.target.files)
            e.target.value = ""
          }}
        />
      </label>

      {rejections.length > 0 && (
        <ul className="text-destructive space-y-0.5 text-xs" role="alert">
          {rejections.map(r => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <ul className="space-y-1.5" aria-live="polite">
          {items.map(item => (
            <li key={item.key} className="bg-card flex items-center gap-3 rounded-md border px-3 py-2">
              <FileIcon className="text-muted-foreground size-4 shrink-0" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm">{item.file.name}</span>
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{formatBytes(item.file.size)}</span>
                </div>
                {item.status === "uploading" && (
                  <div
                    className="bg-muted mt-1.5 h-1 overflow-hidden rounded-full"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={item.progress ?? undefined}
                    aria-label={`Uploading ${item.file.name}`}
                  >
                    <div
                      className={cn("bg-primary h-full rounded-full transition-[width]", item.progress === null && "w-1/3 animate-pulse")}
                      style={item.progress !== null ? { width: `${item.progress}%` } : undefined}
                    />
                  </div>
                )}
                {item.status === "error" && <p className="text-destructive mt-0.5 text-xs">{item.error}</p>}
              </div>
              {item.status === "uploading" && <Loader2 className="text-muted-foreground size-4 animate-spin" aria-label="Uploading" />}
              {item.status === "done" && <CheckCircle2 className="text-success size-4" aria-label="Uploaded" />}
              {item.status === "error" && (
                <>
                  <XCircle className="text-destructive size-4" aria-hidden />
                  <Button variant="ghost" size="icon-xs" onClick={() => void run(item)} aria-label={`Retry ${item.file.name}`}>
                    <RotateCw />
                  </Button>
                </>
              )}
              {item.status !== "uploading" && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setItems(list => list.filter(i => i.key !== item.key))}
                  aria-label={`Dismiss ${item.file.name}`}
                >
                  <X />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
