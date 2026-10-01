import Link from "next/link";
import { db } from "@/lib/db";
import type { OrgContext } from "@/lib/tenancy/load";
import { ownTaskScope } from "@/server/work/resources";
import { WorkToolForm } from "@/components/work/work-tools";
import { sanitizeHtml } from "@/lib/sanitize";
export async function ResourceExtras({
  ctx,
  module,
  id,
  memberOptions,
}: {
  ctx: OrgContext;
  module: string;
  id: string;
  memberOptions: { id: string; name: string }[];
}) {
  if (module === "tasks") {
    const t = await db.task.findFirstOrThrow({
      where: { id, organizationId: ctx.organization.id },
      include: {
        checklist: true,
        comments: {
          include: { author: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
        },
        timeEntries: true,
      },
    });
    const canEdit = t.assigneeId === ctx.user.id || ctx.can("tasks.edit");
    return (
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="space-y-4 rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Progress & checklist</h2>
          {canEdit && (
            <WorkToolForm
              module={module}
              id={id}
              action="status"
              value={t.status}
              label="Update progress"
              options={[
                "TODO",
                "ASSIGNED",
                "IN_PROGRESS",
                "REVIEW",
                "COMPLETED",
              ].map((s) => ({ id: s, name: s.replaceAll("_", " ") }))}
            />
          )}
          {t.checklist.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-3 border-t pt-3"
            >
              <p
                className={`text-sm ${c.done ? "text-muted-foreground line-through" : ""}`}
              >
                {c.title}
              </p>
              {canEdit && (
                <WorkToolForm
                  module={module}
                  id={id}
                  action="toggle"
                  itemId={c.id}
                  label={c.done ? "Undo" : "Complete"}
                />
              )}
            </div>
          ))}
          {ctx.can("tasks.edit") && (
            <WorkToolForm
              module={module}
              id={id}
              action="checklist"
              label="Add item"
            />
          )}
          <h2 className="border-t pt-4 font-semibold">Time tracking</h2>
          <p className="text-sm text-muted-foreground">
            {t.timeEntries.reduce((n, e) => n + e.minutes, 0)} minutes logged
          </p>
          {canEdit && (
            <WorkToolForm
              module={module}
              id={id}
              action="time"
              label="Log time"
            />
          )}
        </section>
        <section className="space-y-4 rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Comments</h2>
          {t.comments.map((c) => (
            <article key={c.id} className="border-b pb-3">
              <p className="mb-2 text-sm font-medium">
                {c.author?.name ?? "Team member"}
              </p>
              <div
                className="text-sm"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(c.bodyHtml) }}
              />
            </article>
          ))}
          {canEdit && (
            <WorkToolForm
              module={module}
              id={id}
              action="comment"
              label="Add comment"
            />
          )}
        </section>
      </div>
    );
  }
  if (module === "teams") {
    const team = await db.team.findFirstOrThrow({
      where: { id, organizationId: ctx.organization.id },
      include: { members: { include: { user: { select: { name: true } } } } },
    });
    return (
      <section className="mt-6 max-w-3xl space-y-4 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Team members</h2>
        {team.members.map((m) => (
          <p className="text-sm" key={m.userId}>
            {m.user.name}
          </p>
        ))}
        {ctx.can("teams.manage") && (
          <WorkToolForm
            module={module}
            id={id}
            action="member"
            label="Add member"
            options={memberOptions}
          />
        )}
      </section>
    );
  }
  if (module === "projects") {
    const tasks = ctx.can("tasks.view")
      ? await db.task.findMany({
          where: {
            organizationId: ctx.organization.id,
            projectId: id,
            ...ownTaskScope(ctx),
          },
          take: 100,
        })
      : [];
    return (
      <section className="mt-6 max-w-3xl space-y-4 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Project tasks</h2>
        {tasks.map((t) => (
          <Link
            href={`/tasks/${t.id}`}
            className="block text-sm text-primary"
            key={t.id}
          >
            {t.title} · {t.status.replaceAll("_", " ")}
          </Link>
        ))}
        {!tasks.length && (
          <p className="text-sm text-muted-foreground">
            No visible tasks linked to this project.
          </p>
        )}
        {ctx.can("tasks.create") && (
          <Link href="/tasks/new" className="block text-sm text-primary">
            Create a task →
          </Link>
        )}
      </section>
    );
  }
  if (module === "assets") {
    const history = await db.assetHistory.findMany({
      where: { assetId: id, asset: { organizationId: ctx.organization.id } },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    return (
      <section className="mt-6 max-w-3xl space-y-3 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Asset history</h2>
        {history.map((h) => (
          <p key={h.id} className="text-sm text-muted-foreground">
            {h.summary} · {h.createdAt.toLocaleDateString("en-GB")}
          </p>
        ))}
      </section>
    );
  }
  return null;
}
