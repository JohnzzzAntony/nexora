"use client";

import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FieldProps = ComponentProps<typeof Input> & {
  label: string;
  error?: string;
  hint?: ReactNode;
  labelAction?: ReactNode;
};

/** Labelled input with inline, screen-reader-announced error text. */
export function FormField({ label, error, hint, labelAction, id, className, ...props }: FieldProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const describedBy = [error ? `${inputId}-error` : null, hint ? `${inputId}-hint` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={inputId}>{label}</Label>
        {labelAction}
      </div>
      <Input id={inputId} aria-invalid={error ? true : undefined} aria-describedby={describedBy} className={cn("h-10", className)} {...props} />
      {hint && !error ? <p id={`${inputId}-hint`} className="text-xs text-muted-foreground">{hint}</p> : null}
      <FieldError id={`${inputId}-error`} message={error} />
    </div>
  );
}

export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="flex items-center gap-1 text-xs font-medium text-destructive">
      <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

export function PasswordField(props: Omit<FieldProps, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <FormField {...props} type={visible ? "text" : "password"} className={cn("pr-10", props.className)} />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        className="absolute right-1 top-[1.875rem] inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

/** Form-level error banner (e.g. invalid credentials). */
export function FormAlert({ message, tone = "error" }: { message?: string | null; tone?: "error" | "success" | "info" }) {
  if (!message) return null;
  const styles = {
    error: "border-destructive/30 bg-destructive/5 text-destructive",
    success: "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400",
    info: "border-border bg-muted/50 text-foreground",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-lg border px-3 py-2.5 text-sm", styles)}>
      {message}
    </div>
  );
}
