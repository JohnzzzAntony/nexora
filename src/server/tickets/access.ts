import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError } from "@/lib/api/errors";
import type { OrgContext } from "@/lib/tenancy/context";

/** Prisma filter of tickets the caller may see. Always includes the tenant boundary. */
export async function ticketVisibilityWhere(ctx: OrgContext): Promise<Prisma.TicketWhereInput> {
  if (!["tickets.view", "tickets.view_team", "tickets.view_all"].some(p => ctx.permissions.has(p as "tickets.view"))) {
    return { organizationId: ctx.organization.id, id: { in: [] } };
  }
  const base: Prisma.TicketWhereInput = { organizationId: ctx.organization.id, mergedIntoId: null };
  if (ctx.isCustomer) {
    const settings = await db.organizationSettings.findUnique({ where: { organizationId: ctx.organization.id }, select: { customerSeesOrgTickets: true } });
    const OR: Prisma.TicketWhereInput[] = [{ requesterId: ctx.user.id }];
    if (settings?.customerSeesOrgTickets && ctx.membership.customerId) OR.push({ customerId: ctx.membership.customerId });
    return { ...base, OR };
  }
  if (ctx.can("tickets.view_all")) return base;
  const OR: Prisma.TicketWhereInput[] = [{ requesterId: ctx.user.id }, { assigneeId: ctx.user.id }, { watchers: { some: { userId: ctx.user.id } } }];
  if (ctx.can("tickets.view_team")) {
    if (ctx.teamIds.length) OR.push({ teamId: { in: ctx.teamIds } });
    if (ctx.membership.departmentId) OR.push({ departmentId: ctx.membership.departmentId });
  }
  return { ...base, OR };
}

export const canSeeInternal = (ctx: OrgContext) => !ctx.isCustomer && ctx.can("tickets.internal_notes");
/** Agents are members who work tickets (as opposed to requesters). */
export const isAgent = (ctx: OrgContext) => !ctx.isCustomer && (ctx.can("tickets.edit") || ctx.can("tickets.internal_notes"));

/** Loads a visible ticket by number ("10452", "#10452") or id; 404 otherwise (no existence leak). */
export async function requireTicket(ctx: OrgContext, ref: string | number) {
  const raw = String(ref).replace(/^#/, "");
  const where = await ticketVisibilityWhere(ctx);
  const ticket = await db.ticket.findFirst({
    where: { AND: [where, /^\d+$/.test(raw) ? { number: Number(raw) } : { id: raw }] },
    include: { status: true, priority: true },
  });
  if (!ticket) throw new AppError("TICKET_NOT_FOUND", "Ticket not found", 404);
  return ticket;
}

/** Ensures `userId` is an active non-customer member (valid assignee/watcher). */
export async function assertAgentMember(organizationId: string, userId: string) {
  const m = await db.membership.findFirst({ where: { organizationId, userId, status: "ACTIVE", role: { key: { not: "customer" } } }, select: { id: true } });
  if (!m) throw new AppError("INVALID_ASSIGNEE", "Selected user is not an active agent in this organization", 422);
}

export async function assertMember(organizationId: string, userId: string) {
  const m = await db.membership.findFirst({ where: { organizationId, userId, status: "ACTIVE" }, select: { id: true, customerId: true, departmentId: true, locationId: true } });
  if (!m) throw new AppError("INVALID_USER", "Selected user is not an active member of this organization", 422);
  return m;
}

/** Verifies that referenced records belong to the tenant (prevents cross-tenant id injection). */
export async function assertOwned(organizationId: string, refs: Partial<Record<"category" | "subcategory" | "priority" | "status" | "team" | "location" | "customer" | "project" | "department", string | null | undefined>>) {
  const checks: Promise<unknown>[] = [];
  const need = (label: string, p: Promise<unknown>) => checks.push(p.then(r => { if (!r) throw new AppError("INVALID_REFERENCE", `${label} not found`, 422); }));
  const o = { organizationId };
  if (refs.category) need("Category", db.ticketCategory.findFirst({ where: { id: refs.category, ...o, parentId: null }, select: { id: true } }));
  if (refs.subcategory) need("Subcategory", db.ticketCategory.findFirst({ where: { id: refs.subcategory, ...o, ...(refs.category ? { parentId: refs.category } : { NOT: { parentId: null } }) }, select: { id: true } }));
  if (refs.priority) need("Priority", db.ticketPriority.findFirst({ where: { id: refs.priority, ...o }, select: { id: true } }));
  if (refs.status) need("Status", db.ticketStatus.findFirst({ where: { id: refs.status, ...o, isActive: true }, select: { id: true } }));
  if (refs.team) need("Team", db.team.findFirst({ where: { id: refs.team, ...o }, select: { id: true } }));
  if (refs.location) need("Location", db.location.findFirst({ where: { id: refs.location, ...o }, select: { id: true } }));
  if (refs.customer) need("Customer", db.customer.findFirst({ where: { id: refs.customer, ...o }, select: { id: true } }));
  if (refs.project) need("Project", db.project.findFirst({ where: { id: refs.project, ...o }, select: { id: true } }));
  if (refs.department) need("Department", db.department.findFirst({ where: { id: refs.department, ...o }, select: { id: true } }));
  await Promise.all(checks);
}
