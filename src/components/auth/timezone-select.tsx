"use client";

import { useEffect, useId } from "react";
import { ChevronDown } from "lucide-react";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/auth/form-field";
import { cn } from "@/lib/utils";

/** Native select (fast with ~400 options, fully accessible). Defaults to the browser's zone when `detect` is set. */
export function TimezoneSelect({ timezones, value, onChange, error, label = "Time zone", detect = false, name = "timezone" }: {
  timezones: string[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
  label?: string;
  detect?: boolean;
  name?: string;
}) {
  const id = useId();
  useEffect(() => {
    if (!detect) return;
    try {
      const browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (browser) onChange(browser);
    } catch {}
  }, [detect]);
  const options = value && !timezones.includes(value) ? [value, ...timezones] : timezones;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <select
          id={id}
          name={name}
          value={value}
          onChange={e => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            "h-10 w-full appearance-none rounded-md border border-input bg-transparent px-3 pr-9 text-sm shadow-xs outline-none transition-[color,box-shadow]",
            "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30",
          )}
        >
          {options.map(tz => <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      </div>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}
