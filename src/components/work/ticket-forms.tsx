"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { FileUploader } from "@/components/ui/file-uploader";
import { apiFetch } from "@/components/shell/api";
import {
  createTicketAction,
  replyAction,
  updateTicketAction,
} from "@/server/tickets/actions";
import type { Lookups } from "@/server/lookups/service";

type Option = { id: string; name: string };
export const selectClass =
  "h-10 w-full rounded-md border bg-background px-3 text-sm";
export function Picker({
  name,
  label,
  options,
  value,
  empty = "Choose…",
}: {
  name: string;
  label: string;
  options: Option[];
  value?: string | null;
  empty?: string;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      <select name={name} defaultValue={value ?? ""} className={selectClass}>
        <option value="">{empty}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
function DraftFiles({
  onComplete,
  onBusy,
  maxMb = 10,
}: {
  onComplete: (id: string) => void;
  onBusy: (busy: boolean) => void;
  maxMb?: number;
}) {
  const [active, setActive] = useState(0);
  return (
    <FileUploader
      maxSizeMB={maxMb}
      accept="image/png,image/jpeg,image/webp,.pdf,.txt,.csv,.docx,.xlsx"
      upload={async (file) => {
        setActive((n) => n + 1);
        onBusy(true);
        try {
          const { data: r } = await apiFetch<{
            upload: {
              url: string;
              method: string;
              headers: Record<string, string>;
            };
            token: string;
          }>("/api/v1/files/presign", {
            method: "POST",
            body: JSON.stringify({
              filename: file.name,
              mimeType: file.type || "text/plain",
              size: file.size,
              target: { type: "draft" },
            }),
          });
          const uploaded = await fetch(r.upload.url, {
            method: r.upload.method,
            headers: r.upload.headers,
            body: file,
          });
          if (!uploaded.ok)
            throw new Error("File upload failed. Please retry.");
          const { data: completed } = await apiFetch<{ id: string }>(
            "/api/v1/files/complete",
            { method: "POST", body: JSON.stringify({ token: r.token }) },
          );
          onComplete(completed.id);
        } finally {
          setActive((n) => {
            if (n <= 1) onBusy(false);
            return n - 1;
          });
        }
      }}
      hint={
        active
          ? "Uploading files…"
          : `Attach screenshots or documents (up to ${maxMb} MB each).`
      }
    />
  );
}
export function NewTicketForm({
  lookups,
  members,
  agent,
  portal = false,
}: {
  lookups: Lookups;
  members: Option[];
  agent: boolean;
  portal?: boolean;
}) {
  const [description, setDescription] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form
      className="max-w-3xl space-y-5 rounded-xl border bg-card p-5 sm:p-7"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        setError("");
        const customFields = Object.fromEntries(
          lookups.customFields.map((f) => [
            f.key,
            f.type === "CHECKBOX"
              ? form.has(`custom:${f.key}`)
              : f.type === "MULTI_SELECT"
                ? form.getAll(`custom:${f.key}`)
                : String(form.get(`custom:${f.key}`) || ""),
          ]),
        );
        start(async () => {
          const result = await createTicketAction({
            subject: String(form.get("subject") || ""),
            description,
            templateId: templateId || undefined,
            customFields,
            categoryId: String(form.get("categoryId") || "") || undefined,
            priorityId: String(form.get("priorityId") || "") || undefined,
            locationId: String(form.get("locationId") || "") || undefined,
            dueDate: String(form.get("dueDate") || "") || undefined,
            ...(agent
              ? {
                  teamId: String(form.get("teamId") || "") || undefined,
                  assigneeId: String(form.get("assigneeId") || "") || undefined,
                }
              : {}),
            attachmentIds: files,
          });
          if (!result.ok) {
            setError(result.error.message);
            return;
          }
          toast.success("Ticket created");
          router.push(
            `${portal ? "/portal" : ""}/tickets/${result.data.number}`,
          );
          router.refresh();
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
      {!!lookups.templates.length && (
        <label className="grid gap-1.5 text-sm font-medium">
          Start from a template
          <select
            className={selectClass}
            value={templateId}
            onChange={(e) => {
              setTemplateId(e.target.value);
              const t = lookups.templates.find((x) => x.id === e.target.value);
              if (t) {
                setSubject(t.subject);
                setDescription(t.description);
              }
            }}
          >
            <option value="">Blank ticket</option>
            {lookups.templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="grid gap-1.5 text-sm font-medium">
        Subject
        <Input
          name="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          minLength={3}
          maxLength={200}
          placeholder="What do you need help with?"
        />
      </label>
      <div className="space-y-1.5">
        <p className="text-sm font-medium">Description</p>
        <RichTextEditor
          value={description}
          onChange={setDescription}
          aria-label="Ticket description"
          placeholder="Describe the issue, impact and any steps already tried."
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Picker
          name="categoryId"
          label="Category"
          options={lookups.categories}
        />
        <Picker
          name="priorityId"
          label="Priority"
          options={lookups.priorities}
          empty="Default priority"
        />
        <Picker
          name="locationId"
          label="Location"
          options={lookups.locations}
        />
        <label className="grid gap-1.5 text-sm font-medium">
          Requested due date
          <Input name="dueDate" type="date" />
        </label>
        {agent && (
          <>
            <Picker name="teamId" label="Team" options={lookups.teams} />
            <Picker
              name="assigneeId"
              label="Assign to"
              options={members}
              empty="Unassigned"
            />
          </>
        )}
      </div>
      {lookups.customFields.map((f) => (
        <label className="grid gap-1.5 text-sm font-medium" key={f.key}>
          {f.label}
          {f.required && " *"}
          {f.options.length ? (
            <select
              name={`custom:${f.key}`}
              required={f.required}
              multiple={f.type === "MULTI_SELECT"}
              className={selectClass}
            >
              <option value="">Choose…</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : f.type === "CHECKBOX" ? (
            <input
              type="checkbox"
              name={`custom:${f.key}`}
              className="size-4"
            />
          ) : (
            <Input
              name={`custom:${f.key}`}
              required={f.required}
              type={
                f.type === "DATE"
                  ? "date"
                  : f.type === "DATETIME"
                    ? "datetime-local"
                    : ["NUMBER", "CURRENCY"].includes(f.type)
                      ? "number"
                      : f.type === "EMAIL"
                        ? "email"
                        : "text"
              }
            />
          )}
          {f.helpText && (
            <span className="text-xs font-normal text-muted-foreground">
              {f.helpText}
            </span>
          )}
        </label>
      ))}
      <DraftFiles
        onComplete={(id) => setFiles((f) => [...f, id])}
        onBusy={setUploading}
        maxMb={lookups.maxUploadMb}
      />
      <div className="flex gap-3">
        <Button disabled={pending || uploading}>
          {pending ? "Creating…" : "Create ticket"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
export function ReplyForm({
  refNumber,
  internal,
}: {
  refNumber: string;
  internal: boolean;
}) {
  const [body, setBody] = useState("");
  const [type, setType] = useState<"PUBLIC" | "INTERNAL">("PUBLIC");
  const [files, setFiles] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <form
      className="space-y-4 rounded-xl border bg-card p-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        start(async () => {
          const result = await replyAction(refNumber, {
            bodyHtml: body,
            type,
            attachmentIds: files,
          });
          if (!result.ok) {
            setError(result.error.message);
            return;
          }
          setBody("");
          setFiles([]);
          toast.success(
            type === "INTERNAL" ? "Internal note added" : "Reply sent",
          );
        });
      }}
    >
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Add a reply</h2>
        {internal && (
          <select
            aria-label="Reply visibility"
            className="rounded-md border bg-background p-2 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
          >
            <option value="PUBLIC">Public reply</option>
            <option value="INTERNAL">Internal note</option>
          </select>
        )}
      </div>
      {type === "INTERNAL" && (
        <p className="text-sm text-amber-600">
          Visible only to authorized service agents.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <RichTextEditor
        value={body}
        onChange={setBody}
        aria-label="Reply message"
      />
      <DraftFiles
        onComplete={(id) => setFiles((f) => [...f, id])}
        onBusy={setUploading}
      />
      <Button
        disabled={pending || uploading || !body.replace(/<[^>]*>/g, "").trim()}
      >
        {pending ? "Sending…" : type === "INTERNAL" ? "Add note" : "Send reply"}
      </Button>
    </form>
  );
}
export function TicketProperties({
  refNumber,
  version,
  statusId,
  priorityId,
  assigneeId,
  teamId,
  lookups,
  members,
  edit,
  assign,
}: {
  refNumber: string;
  version: number;
  statusId: string;
  priorityId: string;
  assigneeId: string | null;
  teamId: string | null;
  lookups: Lookups;
  members: Option[];
  edit: boolean;
  assign: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <form
      key={version}
      className="space-y-4 rounded-xl border bg-card p-5"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        start(async () => {
          const r = await updateTicketAction(refNumber, {
            version,
            ...(edit
              ? {
                  statusId: String(f.get("statusId")),
                  priorityId: String(f.get("priorityId")),
                  teamId: String(f.get("teamId") || ""),
                }
              : {}),
            ...(assign
              ? { assigneeId: String(f.get("assigneeId") || "") }
              : {}),
          });
          if (!r.ok) setError(r.error.message);
          else {
            setError("");
            toast.success("Ticket updated");
          }
        });
      }}
    >
      <h2 className="font-semibold">Ticket properties</h2>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {edit && (
        <>
          <Picker
            name="statusId"
            label="Status"
            options={lookups.statuses}
            value={statusId}
          />
          <Picker
            name="priorityId"
            label="Priority"
            options={lookups.priorities}
            value={priorityId}
          />
          <Picker
            name="teamId"
            label="Team"
            options={lookups.teams}
            value={teamId}
            empty="No team"
          />
        </>
      )}
      {assign && (
        <Picker
          name="assigneeId"
          label="Assignee"
          options={members}
          value={assigneeId}
          empty="Unassigned"
        />
      )}
      <Button disabled={pending} className="w-full">
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
