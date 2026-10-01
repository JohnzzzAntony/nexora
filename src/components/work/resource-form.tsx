"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RESOURCES } from "@/config/resources";
import { saveResourceAction } from "@/server/work/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { selectClass } from "@/components/work/ticket-forms";
import type { WorkRecord, resourceLookups } from "@/server/work/resources";
export function ResourceForm({
  module,
  record,
  lookups,
}: {
  module: string;
  record?: WorkRecord;
  lookups: Awaited<ReturnType<typeof resourceLookups>>;
}) {
  const config = RESOURCES[module];
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const [html, setHtml] = useState(String(record?.contentHtml || ""));
  return (
    <form
      className="max-w-3xl space-y-5 rounded-xl border bg-card p-6"
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        const input = Object.fromEntries(new FormData(e.currentTarget));
        if (module === "knowledge") input.contentHtml = html;
        start(async () => {
          const r = await saveResourceAction(module, input, record?.id);
          if (!r.ok) setError(r.error.message);
          else {
            toast.success(`${config.singular} saved`);
            router.push(`/${module}/${r.data.id}`);
            router.refresh();
          }
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
      <div className="grid gap-5 sm:grid-cols-2">
        {config.fields.map((field) => {
          const value = String(
            record?.[field.key] ?? (field.key === "priority" ? "MEDIUM" : ""),
          );
          const options = field.lookup
            ? lookups[field.lookup]
            : field.options?.map((s) => ({
                id: s,
                name: s.replaceAll("_", " "),
              }));
          return (
            <label
              key={field.key}
              className={`grid gap-1.5 text-sm font-medium ${field.kind === "textarea" ? "sm:col-span-2" : ""}`}
            >
              {field.label}
              {field.required && " *"}
              {field.key === "contentHtml" ? (
                <RichTextEditor
                  value={html}
                  onChange={setHtml}
                  aria-label="Article content"
                />
              ) : options ? (
                <select
                  name={field.key}
                  defaultValue={value || field.options?.[0] || ""}
                  className={selectClass}
                >
                  {field.lookup && <option value="">None</option>}
                  {options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              ) : field.kind === "textarea" ? (
                <textarea
                  name={field.key}
                  defaultValue={value}
                  rows={5}
                  required={field.required}
                  className="rounded-md border bg-background p-3 font-normal"
                />
              ) : (
                <Input
                  name={field.key}
                  type={field.kind ?? "text"}
                  defaultValue={
                    field.kind === "date" ? value.slice(0, 10) : value
                  }
                  required={field.required}
                  maxLength={500}
                />
              )}
            </label>
          );
        })}
      </div>
      <div className="flex gap-3">
        <Button disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
