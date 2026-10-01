import "server-only";
import { db } from "@/lib/db";
import type { OrgContext } from "@/lib/tenancy/context";

/** Reference data for forms and filters (tenant-scoped). Customers only get what they may use. */
export async function getLookups(ctx: OrgContext) {
  const org = ctx.organization.id;
  const [
    statuses,
    priorities,
    categories,
    teams,
    departments,
    locations,
    customFields,
    templates,
    settings,
  ] = await Promise.all([
    db.ticketStatus.findMany({
      where: { organizationId: org, isActive: true },
      orderBy: { order: "asc" },
      select: {
        id: true,
        key: true,
        name: true,
        color: true,
        category: true,
        allowedTransitions: true,
        pausesSla: true,
      },
    }),
    db.ticketPriority.findMany({
      where: { organizationId: org },
      orderBy: { order: "asc" },
      select: { id: true, key: true, name: true, color: true },
    }),
    db.ticketCategory.findMany({
      where: { organizationId: org, isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        parentId: true,
        icon: true,
        color: true,
        requiredFields: true,
      },
    }),
    ctx.isCustomer
      ? []
      : db.team.findMany({
          where: { organizationId: org },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
    ctx.isCustomer
      ? []
      : db.department.findMany({
          where: { organizationId: org },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
    db.location.findMany({
      where: { organizationId: org },
      orderBy: { name: "asc" },
      select: { id: true, name: true, parentId: true },
    }),
    db.customField.findMany({
      where: {
        organizationId: org,
        entity: "TICKET",
        isActive: true,
        ...(ctx.can("tickets.edit") ? {} : { visibility: "ALL" }),
      },
      select: {
        key: true,
        label: true,
        type: true,
        required: true,
        helpText: true,
        options: { select: { value: true, label: true } },
      },
      orderBy: { order: "asc" },
    }),
    db.ticketTemplate.findMany({
      where: { organizationId: org },
      select: { id: true, name: true, subject: true, description: true },
    }),
    db.organizationSettings.findUnique({
      where: { organizationId: org },
      select: { maxUploadMb: true },
    }),
  ]);
  const childrenByParent = new Map<string, typeof categories>();
  for (const category of categories) {
    if (!category.parentId) continue;
    const children = childrenByParent.get(category.parentId) ?? [];
    children.push(category);
    childrenByParent.set(category.parentId, children);
  }
  return {
    statuses,
    priorities,
    teams,
    departments,
    locations,
    customFields,
    templates,
    maxUploadMb: settings?.maxUploadMb ?? 10,
    categories: categories
      .filter((c) => !c.parentId)
      .map((c) => ({ ...c, children: childrenByParent.get(c.id) ?? [] })),
  };
}
export type Lookups = Awaited<ReturnType<typeof getLookups>>;

/** Member search for pickers. `agents` limits to non-customer members. */
export async function searchMembers(
  ctx: OrgContext,
  opts: { q?: string; agents?: boolean; ids?: string[]; take?: number },
) {
  const q = opts.q?.trim();
  const members = await db.membership.findMany({
    where: {
      organizationId: ctx.organization.id,
      status: "ACTIVE",
      ...(opts.agents ? { role: { key: { not: "customer" } } } : {}),
      ...(opts.ids?.length ? { userId: { in: opts.ids } } : {}),
      ...(q
        ? {
            user: {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    },
    select: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      role: { select: { name: true, key: true } },
    },
    orderBy: { user: { name: "asc" } },
    take: Math.min(opts.take ?? 20, 50),
  });
  return members.map((m) => ({
    ...m.user,
    role: m.role.name,
    isCustomer: m.role.key === "customer",
  }));
}
