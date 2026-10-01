import "server-only";
import { db } from "@/lib/db";
import { ticketVisibilityWhere } from "@/server/tickets/access";
import { ownTaskScope } from "@/server/work/resources";
import type { OrgContext } from "@/lib/tenancy/context";
import { SEARCH_MAX_LENGTH, SEARCH_MIN_LENGTH, type SearchGroup, type SearchHit, type SearchResponse } from "@/lib/search/types";

const TAKE = 5;
const TASK_STATUS_LABEL: Record<string, string> = {
  TODO: "To do", ASSIGNED: "Assigned", IN_PROGRESS: "In progress", REVIEW: "In review", COMPLETED: "Completed",
};

const contains = (q: string) => ({ contains: q, mode: "insensitive" as const });

/** Parses "123", "#123" or "T-123" style references into a number. */
function parseNumber(q: string): number | null {
  const m = /^(?:#|[a-z]{1,6}-)?(\d{1,9})$/i.exec(q);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isSafeInteger(n) ? n : null;
}

const empty = (): Record<SearchGroup, SearchHit[]> => ({
  tickets: [], tasks: [], projects: [], users: [], customers: [], assets: [], knowledge: [],
});

export async function globalSearch(ctx: OrgContext, rawQuery: string): Promise<SearchResponse> {
  const q = rawQuery.trim().slice(0, SEARCH_MAX_LENGTH);
  const num = parseNumber(q);
  if (q.length < SEARCH_MIN_LENGTH && num === null) return { query: q, groups: empty() };

  const orgId = ctx.organization.id;
  const none = Promise.resolve([] as SearchHit[]);
  const ticketScope = ctx.can("tickets.view") || ctx.can("tickets.view_team") || ctx.can("tickets.view_all") ? await ticketVisibilityWhere(ctx) : null;

  const tickets = ticketScope
    ? db.ticket
        .findMany({
          where: {
            AND: [
              { organizationId: orgId },
              ticketScope,
              { OR: [{ subject: contains(q) }, ...(num !== null ? [{ number: num }] : [])] },
            ],
          },
          orderBy: { updatedAt: "desc" },
          take: TAKE,
          select: { id: true, number: true, subject: true, status: { select: { name: true, color: true } } },
        })
        .then(rows =>
          rows.map<SearchHit>(t => ({
            id: t.id, group: "tickets", title: t.subject, subtitle: `#${t.number} · ${t.status.name}`,
            url: `/tickets/${t.number}`, color: t.status.color,
          })),
        )
    : none;

  const tasks = ctx.can("tasks.view")
    ? db.task
        .findMany({
          where: { AND: [{ organizationId: orgId }, ownTaskScope(ctx), { OR: [{ title: contains(q) }, ...(num !== null ? [{ number: num }] : [])] }] },
          orderBy: { updatedAt: "desc" },
          take: TAKE,
          select: { id: true, number: true, title: true, status: true },
        })
        .then(rows =>
          rows.map<SearchHit>(t => ({
            id: t.id, group: "tasks", title: t.title, subtitle: `Task ${t.number} · ${TASK_STATUS_LABEL[t.status] ?? t.status}`,
            url: `/tasks/${t.number}`,
          })),
        )
    : none;

  const projects = ctx.can("projects.view")
    ? db.project
        .findMany({
          where: { organizationId: orgId, OR: [{ name: contains(q) }, { key: contains(q) }] },
          orderBy: { updatedAt: "desc" },
          take: TAKE,
          select: { id: true, key: true, name: true },
        })
        .then(rows => rows.map<SearchHit>(p => ({ id: p.id, group: "projects", title: p.name, subtitle: p.key, url: `/projects/${p.id}` })))
    : none;

  const users = ctx.can("users.view")
    ? db.membership
        .findMany({
          where: {
            organizationId: orgId,
            status: "ACTIVE",
            user: { isActive: true, OR: [{ name: contains(q) }, { email: contains(q) }] },
          },
          take: TAKE,
          orderBy: { user: { name: "asc" } },
          select: { user: { select: { id: true, name: true, email: true } }, role: { select: { name: true } } },
        })
        .then(rows =>
          rows.map<SearchHit>(m => ({
            id: m.user.id, group: "users", title: m.user.name, subtitle: `${m.user.email} · ${m.role.name}`, url: `/users/${m.user.id}`,
          })),
        )
    : none;

  const customers = ctx.can("customers.view")
    ? db.customer
        .findMany({
          where: { organizationId: orgId, OR: [{ name: contains(q) }, { company: contains(q) }, { email: contains(q) }] },
          orderBy: { name: "asc" },
          take: TAKE,
          select: { id: true, name: true, company: true, email: true },
        })
        .then(rows =>
          rows.map<SearchHit>(c => ({
            id: c.id, group: "customers", title: c.name, subtitle: [c.company, c.email].filter(Boolean).join(" · ") || null, url: `/customers/${c.id}`,
          })),
        )
    : none;

  const assets = ctx.can("assets.view")
    ? db.asset
        .findMany({
          where: {
            organizationId: orgId,
            OR: [{ name: contains(q) }, { assetTag: contains(q) }, { serialNumber: contains(q) }],
          },
          orderBy: { updatedAt: "desc" },
          take: TAKE,
          select: { id: true, name: true, assetTag: true },
        })
        .then(rows => rows.map<SearchHit>(a => ({ id: a.id, group: "assets", title: a.name, subtitle: a.assetTag, url: `/assets/${a.id}` })))
    : none;

  const knowledge = ctx.can("knowledge.view")
    ? db.knowledgeArticle
        .findMany({
          where: {
            organizationId: orgId,
            title: contains(q),
            OR: [{ status: "PUBLISHED" }, { authorId: ctx.user.id }],
          },
          orderBy: { updatedAt: "desc" },
          take: TAKE,
          select: { id: true, title: true, slug: true, status: true },
        })
        .then(rows =>
          rows.map<SearchHit>(k => ({
            id: k.id, group: "knowledge", title: k.title, subtitle: k.status === "DRAFT" ? "Draft" : "Article", url: `/knowledge/${k.slug}`,
          })),
        )
    : none;

  const [t, ta, p, u, c, a, k] = await Promise.all([tickets, tasks, projects, users, customers, assets, knowledge]);
  return { query: q, groups: { tickets: t, tasks: ta, projects: p, users: u, customers: c, assets: a, knowledge: k } };
}
