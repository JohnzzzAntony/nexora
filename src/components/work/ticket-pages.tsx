import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { OrgContext } from "@/lib/tenancy/context";
import {
  ticketVisibilityWhere,
  requireTicket,
  canSeeInternal,
  isAgent,
} from "@/server/tickets/access";
import { getLookups, searchMembers } from "@/server/lookups/service";
import { sanitizeHtml } from "@/lib/sanitize";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { ReplyForm, TicketProperties } from "@/components/work/ticket-forms";

export const badgeClass =
  "inline-flex rounded-md bg-muted px-2 py-1 text-xs font-medium";
export async function TicketList({
  ctx,
  query,
  portal = false,
  mine = false,
}: {
  ctx: OrgContext;
  query: Record<string, string | undefined>;
  portal?: boolean;
  mine?: boolean;
}) {
  const q = query.q?.slice(0, 200);
  const scope = await ticketVisibilityWhere(ctx);
  const page = Math.max(1, Math.min(10000, Number(query.page) || 1));
  const where = {
    AND: [
      scope,
      ...(q
        ? [{ subject: { contains: q, mode: "insensitive" as const } }]
        : []),
      ...(query.status ? [{ statusId: query.status }] : []),
      ...(mine
        ? [{ OR: [{ requesterId: ctx.user.id }, { assigneeId: ctx.user.id }] }]
        : []),
    ],
  };
  const [tickets, total, statuses] = await Promise.all([
    db.ticket.findMany({
      where,
      include: {
        status: true,
        priority: true,
        assignee: { select: { name: true } },
        requester: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * 25,
      take: 25,
    }),
    db.ticket.count({ where }),
    db.ticketStatus.findMany({
      where: { organizationId: ctx.organization.id },
      orderBy: { order: "asc" },
    }),
  ]);
  const prefix = portal ? "/portal/tickets" : "/tickets";
  return (
    <>
      <PageHeader
        title={mine ? "My work" : "Tickets"}
        description={`${total} requests · Track progress and keep conversations together.`}
        actions={
          ctx.can("tickets.create") && (
            <Button asChild>
              <Link href={`${prefix}/new`}>New ticket</Link>
            </Button>
          )
        }
      />
      <form className="mb-5 flex flex-wrap gap-3">
        <input
          name="q"
          defaultValue={q}
          aria-label="Search tickets"
          placeholder="Search tickets…"
          className="h-10 min-w-48 flex-1 rounded-md border bg-background px-3 text-sm"
        />
        <select
          name="status"
          defaultValue={query.status}
          aria-label="Filter status"
          className="rounded-md border bg-background px-3 text-sm"
        >
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <Button variant="outline">Filter</Button>
        <Button asChild variant="ghost">
          <Link href={mine ? "/my-work" : prefix}>Clear</Link>
        </Button>
      </form>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              {["Ticket", "Status", "Priority", "Assigned to", "Updated"].map(
                (h) => (
                  <th className="p-4 font-medium" key={h}>
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr className="border-t hover:bg-muted/30" key={t.id}>
                <td className="p-4">
                  <Link
                    href={`${prefix}/${t.number}`}
                    className="font-medium text-primary hover:underline"
                  >
                    <span className="mr-2 text-muted-foreground">
                      #{t.number}
                    </span>
                    {t.subject}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.requester.name}
                  </p>
                </td>
                <td className="p-4">
                  <span className={badgeClass}>{t.status.name}</span>
                </td>
                <td className="p-4">{t.priority.name}</td>
                <td className="p-4">{t.assignee?.name ?? "Unassigned"}</td>
                <td className="whitespace-nowrap p-4 text-muted-foreground">
                  {t.updatedAt.toLocaleDateString("en-GB", {
                    timeZone: ctx.organization.timezone,
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!tickets.length && (
          <div className="p-12 text-center">
            <h2 className="font-semibold">No tickets found</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Create a request or adjust your filters.
            </p>
          </div>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Page {page} of {Math.max(1, Math.ceil(total / 25))}
        </span>
        <div className="flex gap-3">
          {page > 1 && (
            <Link
              href={`?${new URLSearchParams({ ...query, page: String(page - 1) } as Record<string, string>)}`}
              className="text-primary"
            >
              Previous
            </Link>
          )}
          {page * 25 < total && (
            <Link
              href={`?${new URLSearchParams({ ...query, page: String(page + 1) } as Record<string, string>)}`}
              className="text-primary"
            >
              Next
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
export async function TicketDetail({
  ctx,
  refNumber,
  portal = false,
}: {
  ctx: OrgContext;
  refNumber: string;
  portal?: boolean;
}) {
  let ticket;
  try {
    ticket = await requireTicket(ctx, refNumber);
  } catch (e) {
    if ((e as { code?: string }).code === "TICKET_NOT_FOUND") notFound();
    throw e;
  }
  const [
    messages,
    attachments,
    requester,
    assignee,
    lookups,
    members,
    activity,
  ] = await Promise.all([
    db.ticketMessage.findMany({
      where: {
        ticketId: ticket.id,
        ...(canSeeInternal(ctx) ? {} : { type: "PUBLIC" }),
      },
      include: { author: { select: { name: true } }, attachments: true },
      orderBy: { createdAt: "asc" },
    }),
    db.attachment.findMany({ where: { ticketId: ticket.id, messageId: null } }),
    db.user.findUnique({
      where: { id: ticket.requesterId },
      select: { name: true },
    }),
    ticket.assigneeId
      ? db.user.findUnique({
          where: { id: ticket.assigneeId },
          select: { name: true },
        })
      : null,
    getLookups(ctx),
    isAgent(ctx) ? searchMembers(ctx, { agents: true, take: 50 }) : [],
    db.activity.findMany({
      where: { organizationId: ctx.organization.id, entityId: ticket.id },
      take: 20,
      orderBy: { createdAt: "desc" },
      select: { id: true, action: true, createdAt: true },
    }),
  ]);
  const allowedStatuses = lookups.statuses.filter(
    (s) =>
      s.id === ticket.statusId ||
      !ticket.status.allowedTransitions.length ||
      ticket.status.allowedTransitions.includes(s.key),
  );
  const editableLookups = { ...lookups, statuses: allowedStatuses };
  const date = (d: Date) =>
    d.toLocaleString("en-GB", {
      timeZone: ctx.organization.timezone,
      dateStyle: "medium",
      timeStyle: "short",
    });
  return (
    <>
      <PageHeader
        title={ticket.subject}
        breadcrumbs={[
          { label: "Tickets", href: portal ? "/portal/tickets" : "/tickets" },
          { label: `#${ticket.number}` },
        ]}
        meta={<span className={badgeClass}>{ticket.status.name}</span>}
        description={`Requested by ${requester?.name} · Created ${date(ticket.createdAt)}`}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          <section className="rounded-xl border bg-card p-5">
            <h2 className="mb-3 font-semibold">Description</h2>
            <div
              className="prose prose-sm max-w-none break-words dark:prose-invert"
              dangerouslySetInnerHTML={{
                __html: sanitizeHtml(
                  ticket.description || "<p>No description provided.</p>",
                ),
              }}
            />
            {attachments.map((a) => (
              <a
                key={a.id}
                href={`/api/files/${a.id}`}
                className="mt-3 block text-sm text-primary hover:underline"
              >
                ↓ {a.filename}
              </a>
            ))}
          </section>
          <h2 className="font-semibold">Conversation</h2>
          {messages.map((m) => (
            <article
              className={`rounded-xl border p-5 ${m.type === "INTERNAL" ? "border-amber-300/50 bg-amber-50/40 dark:bg-amber-950/20" : "bg-card"}`}
              key={m.id}
            >
              <div className="mb-3 flex flex-wrap justify-between gap-2 text-sm">
                <strong>
                  {m.author?.name ?? "System"}
                  {m.type === "INTERNAL" && " · Internal note"}
                </strong>
                <time className="text-xs text-muted-foreground">
                  {date(m.createdAt)}
                </time>
              </div>
              <div
                className="prose prose-sm max-w-none break-words dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(m.bodyHtml) }}
              />
              {m.attachments.map((a) => (
                <a
                  key={a.id}
                  href={`/api/files/${a.id}`}
                  className="mt-3 block text-sm text-primary hover:underline"
                >
                  ↓ {a.filename}
                </a>
              ))}
            </article>
          ))}
          <ReplyForm refNumber={refNumber} internal={canSeeInternal(ctx)} />
        </div>
        <aside className="space-y-5">
          {(ctx.can("tickets.edit") || ctx.can("tickets.assign")) && (
            <TicketProperties
              refNumber={refNumber}
              version={ticket.version}
              statusId={ticket.statusId}
              priorityId={ticket.priorityId}
              assigneeId={ticket.assigneeId}
              teamId={ticket.teamId}
              lookups={editableLookups}
              members={members}
              edit={ctx.can("tickets.edit")}
              assign={ctx.can("tickets.assign")}
            />
          )}
          <section className="space-y-3 rounded-xl border bg-card p-5">
            <h2 className="font-semibold">Service targets</h2>
            <p className="text-sm">
              Assignee: {assignee?.name ?? "Unassigned"}
            </p>
            <p className="text-sm">
              SLA: {ticket.slaState.replaceAll("_", " ")}
            </p>
            {ticket.firstResponseDueAt && (
              <p className="text-sm text-muted-foreground">
                First response: {date(ticket.firstResponseDueAt)}
              </p>
            )}
            {ticket.resolutionDueAt && (
              <p className="text-sm text-muted-foreground">
                Resolution: {date(ticket.resolutionDueAt)}
              </p>
            )}
          </section>
          <section className="rounded-xl border bg-card p-5">
            <h2 className="mb-3 font-semibold">Activity</h2>
            <ul className="space-y-3">
              {activity.map((a) => (
                <li className="text-xs" key={a.id}>
                  <p>{a.action.replaceAll(".", " ").replaceAll("_", " ")}</p>
                  <time className="text-muted-foreground">
                    {date(a.createdAt)}
                  </time>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}
