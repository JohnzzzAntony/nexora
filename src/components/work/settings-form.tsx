"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { SETTINGS } from "@/config/settings";
import { PERMISSION_GROUPS } from "@/lib/permissions/catalog";
import { settingAction } from "@/server/work/setting-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WorkRecord } from "@/server/work/resources";
export function SettingsForm({
  section,
  record,
  lookups,
  permissions,
}: {
  section: string;
  record?: WorkRecord;
  lookups: Record<string, { id: string; name: string }[]>;
  permissions: string[];
}) {
  const config = SETTINGS[section];
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [revealed, setRevealed] = useState("");
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = new FormData(form);
        const input: Record<string, unknown> = Object.fromEntries(data);
        for (const f of config.fields)
          if (f.type === "checkbox") input[f.key] = data.has(f.key);
        if (["roles", "api"].includes(section))
          input.permissions = data.getAll("permissions");
        setError("");
        start(async () => {
          const result = await settingAction(section, input, record?.id);
          if (!result.ok) {
            setError(result.error.message);
            return;
          }
          toast.success(
            section === "users" ? "Invitation created" : "Settings saved",
          );
          setRevealed(result.data.secret || result.data.invitation || "");
          if (!record) form.reset();
        });
      }}
    >
      {error && (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {revealed && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-4">
          <p className="mb-2 text-sm font-medium">
            {section === "users"
              ? "Copy invitation link"
              : "Copy this secret now. It will not be shown again."}
          </p>
          <textarea
            readOnly
            value={revealed}
            aria-label="Generated credential or invitation"
            className="w-full break-all rounded border bg-background p-2 font-mono text-xs"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={async () => {
              await navigator.clipboard.writeText(revealed);
              toast.success("Copied");
            }}
          >
            Copy
          </Button>
        </div>
      )}
      {config.fields.map((f) => {
        const options = f.options || (f.lookup ? lookups[f.lookup] : undefined);
        const value =
          record?.[f.key] ??
          (f.key === "timezone"
            ? "Asia/Dubai"
            : f.key === "color"
              ? "#64748b"
              : f.type === "number"
                ? 0
                : "");
        return f.type === "checkbox" ? (
          <label key={f.key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name={f.key}
              defaultChecked={
                value === true || (!record && f.key === "isActive")
              }
              className="size-4"
            />
            {f.label}
          </label>
        ) : (
          <label key={f.key} className="grid gap-1.5 text-sm font-medium">
            {f.label}
            {options ? (
              <select
                name={f.key}
                required={f.required}
                defaultValue={String(value)}
                className="h-10 rounded-md border bg-background px-3"
              >
                <option value="">Choose…</option>
                {options.map((o) => (
                  <option value={o.id} key={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            ) : f.type === "textarea" ? (
              <textarea
                name={f.key}
                defaultValue={String(value)}
                rows={4}
                className="rounded-md border bg-background p-3"
                required={f.required}
              />
            ) : (
              <Input
                name={f.key}
                defaultValue={
                  f.type === "date"
                    ? String(value).slice(0, 10)
                    : Array.isArray(value)
                      ? value.join(", ")
                      : String(value)
                }
                type={f.type || "text"}
                required={f.required}
              />
            )}
          </label>
        );
      })}
      {["roles", "api"].includes(section) && (
        <fieldset className="space-y-4">
          <legend className="mb-2 font-medium">Permissions</legend>
          {Object.entries(PERMISSION_GROUPS).map(([group, grants]) => (
            <div key={group}>
              <h3 className="mb-2 text-sm font-semibold">{group}</h3>
              {Object.entries(grants)
                .filter(([key]) => permissions.includes(key))
                .map(([key, label]) => (
                  <label
                    className="mb-2 flex items-center gap-2 text-xs"
                    key={key}
                  >
                    <input name="permissions" value={key} type="checkbox" />
                    {label}
                  </label>
                ))}
            </div>
          ))}
        </fieldset>
      )}
      <Button disabled={pending}>
        {pending
          ? "Saving…"
          : section === "users"
            ? "Create invitation"
            : record
              ? "Save changes"
              : "Create"}
      </Button>
    </form>
  );
}
