"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

export type ConfirmDialogProps = {
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** "destructive" renders a red confirm button. */
  variant?: "default" | "destructive"
  /**
   * Called on confirm. The dialog shows a pending state until the promise settles and
   * closes on success. Return `false` (or throw) to keep it open.
   */
  onConfirm: () => Promise<unknown> | unknown
  /** Uncontrolled usage: element that opens the dialog. */
  trigger?: React.ReactNode
  /** Controlled usage. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  trigger,
  open: openProp,
  onOpenChange,
  children,
}: ConfirmDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const open = openProp ?? internalOpen

  const setOpen = (next: boolean) => {
    if (pending) return
    if (openProp === undefined) setInternalOpen(next)
    onOpenChange?.(next)
  }

  const handleConfirm = async () => {
    setPending(true)
    try {
      const result = await onConfirm()
      setPending(false)
      if (result !== false) {
        if (openProp === undefined) setInternalOpen(false)
        onOpenChange?.(false)
      }
    } catch {
      setPending(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <Button variant={variant === "destructive" ? "destructive" : "default"} onClick={handleConfirm} disabled={pending} autoFocus>
            {pending && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
