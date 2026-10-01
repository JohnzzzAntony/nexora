"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { approvalAction } from "@/server/work/approval-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Picker } from "@/components/work/ticket-forms";
export function ApprovalForm({
  members,
  id,
}: {
  members?: { id: string; name: string }[];
  id?: string;
}) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const input = Object.fromEntries(new FormData(form));
        start(async () => {
          const r = await approvalAction(input, id);
          if (!r.ok) setError(r.error.message);
          else {
            setError("");
            toast.success(id ? "Decision saved" : "Approval requested");
            form.reset();
          }
        });
      }}
    >
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {id ? (
        <>
          <label className="grid gap-1.5 text-sm">
            Decision
            <select
              name="decision"
              className="rounded-md border bg-background p-2"
            >
              <option value="APPROVED">Approve</option>
              <option value="REJECTED">Reject</option>
            </select>
          </label>
          <Input
            name="comment"
            placeholder="Reason or comment"
            aria-label="Decision comment"
          />
        </>
      ) : (
        <>
          <label className="grid gap-1.5 text-sm">
            Title
            <Input name="title" required minLength={3} />
          </label>
          <label className="grid gap-1.5 text-sm">
            Description
            <textarea
              name="description"
              className="rounded-md border bg-background p-3"
              rows={3}
            />
          </label>
          <Picker name="approverId" label="Approver" options={members ?? []} />
          <Input
            name="ticketRef"
            placeholder="Related ticket number (optional)"
            aria-label="Related ticket"
          />
        </>
      )}
      <Button disabled={pending}>
        {pending ? "Saving…" : id ? "Submit decision" : "Request approval"}
      </Button>
    </form>
  );
}
