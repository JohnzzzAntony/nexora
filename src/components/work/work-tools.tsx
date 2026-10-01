"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toolAction } from "@/server/work/tool-actions";
export function WorkToolForm({
  module,
  id,
  action,
  options,
  itemId,
  label,
  value,
}: {
  module: string;
  id: string;
  action: string;
  options?: { id: string; name: string }[];
  itemId?: string;
  label?: string;
  value?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const input = {
          ...Object.fromEntries(new FormData(form)),
          action,
          itemId,
        };
        start(async () => {
          const r = await toolAction(module, id, input);
          if (!r.ok) setError(r.error.message);
          else {
            setError("");
            toast.success("Saved");
            if (action !== "status") form.reset();
          }
        });
      }}
    >
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {options && (
        <select
          defaultValue={value}
          aria-label={action === "status" ? "Task status" : "Team member"}
          name={action === "status" ? "status" : "userId"}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      )}
      {action === "checklist" && (
        <Input
          name="title"
          required
          placeholder="New checklist item"
          aria-label="Checklist item title"
        />
      )}
      {action === "time" && (
        <>
          <Input
            name="minutes"
            type="number"
            min={1}
            max={1440}
            required
            placeholder="Minutes worked"
            aria-label="Minutes worked"
          />
          <Input
            name="note"
            placeholder="What did you work on?"
            aria-label="Work note"
          />
        </>
      )}
      {action === "comment" && (
        <textarea
          name="comment"
          rows={3}
          required
          placeholder="Add a comment…"
          aria-label="Task comment"
          className="w-full rounded-md border bg-background p-3 text-sm"
        />
      )}
      <Button
        disabled={pending}
        size="sm"
        variant={action === "toggle" ? "outline" : "default"}
      >
        {pending ? "Saving…" : label || "Save"}
      </Button>
    </form>
  );
}
