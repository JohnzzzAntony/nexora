import "server-only";
import type { StatusCategory } from "@prisma/client";
import { db, type Tx } from "@/lib/db";
import { SYSTEM_ROLES, OWNER_ROLE_KEY } from "@/lib/permissions/catalog";

export const DEFAULT_STATUSES: { key: string; name: string; color: string; category: StatusCategory; pausesSla?: boolean; transitions: string[] }[] = [
  { key: "NEW", name: "New", color: "#6366f1", category: "NEW", transitions: ["ASSIGNED", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "WAITING_FOR_APPROVAL", "RESOLVED", "CLOSED"] },
  { key: "ASSIGNED", name: "Assigned", color: "#0ea5e9", category: "OPEN", transitions: ["NEW", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "WAITING_FOR_APPROVAL", "RESOLVED", "CLOSED"] },
  { key: "IN_PROGRESS", name: "In Progress", color: "#f59e0b", category: "OPEN", transitions: ["ASSIGNED", "WAITING_FOR_CUSTOMER", "WAITING_FOR_APPROVAL", "RESOLVED", "CLOSED"] },
  { key: "WAITING_FOR_CUSTOMER", name: "Waiting for Customer", color: "#a855f7", category: "PENDING", pausesSla: true, transitions: ["IN_PROGRESS", "ASSIGNED", "RESOLVED", "CLOSED"] },
  { key: "WAITING_FOR_APPROVAL", name: "Waiting for Approval", color: "#ec4899", category: "PENDING", pausesSla: true, transitions: ["IN_PROGRESS", "ASSIGNED", "RESOLVED", "CLOSED"] },
  { key: "RESOLVED", name: "Resolved", color: "#10b981", category: "RESOLVED", transitions: ["CLOSED", "IN_PROGRESS", "ASSIGNED"] },
  { key: "CLOSED", name: "Closed", color: "#64748b", category: "CLOSED", transitions: ["IN_PROGRESS", "ASSIGNED"] },
];

export const DEFAULT_PRIORITIES = [
  { key: "LOW", name: "Low", color: "#64748b", response: 8 * 60, resolution: 24 * 60 },
  { key: "MEDIUM", name: "Medium", color: "#0ea5e9", response: 2 * 60, resolution: 8 * 60 },
  { key: "HIGH", name: "High", color: "#f59e0b", response: 30, resolution: 4 * 60 },
  { key: "CRITICAL", name: "Critical", color: "#ef4444", response: 15, resolution: 2 * 60 },
];

export const DEFAULT_CATEGORIES: { name: string; icon: string; children: string[] }[] = [
  { name: "Hardware", icon: "monitor", children: ["Laptop", "Desktop", "Printer"] },
  { name: "Software", icon: "app-window", children: ["Microsoft 365", "ERP"] },
  { name: "Network", icon: "wifi", children: ["Wi-Fi", "VPN", "Internet"] },
  { name: "Access", icon: "key-round", children: ["Password", "Account", "Permissions"] },
  { name: "HR", icon: "users", children: [] },
  { name: "Finance", icon: "banknote", children: [] },
  { name: "General", icon: "circle-help", children: [] },
];

export function slugify(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "org";
}

async function uniqueSlug(tx: Tx, name: string) {
  const base = slugify(name);
  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    if (!(await tx.organization.findUnique({ where: { slug }, select: { id: true } }))) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** Creates an organization with default roles, workflow, SLA and categories, owned by `ownerId`. */
export async function createOrganization(input: { name: string; ownerId: string; timezone?: string; withDefaultCategories?: boolean }, tx?: Tx) {
  const run = async (t: Tx) => {
    const org = await t.organization.create({
      data: { name: input.name.trim(), slug: await uniqueSlug(t, input.name), timezone: input.timezone || "UTC", onboardingStep: 3 },
    });
    const roles: Record<string, string> = {};
    for (const role of SYSTEM_ROLES) {
      const created = await t.role.create({
        data: { organizationId: org.id, key: role.key, name: role.name, description: role.description, isSystem: true, permissions: { create: role.permissions.map(permission => ({ permission })) } },
      });
      roles[role.key] = created.id;
    }
    const statuses = await Promise.all(DEFAULT_STATUSES.map((s, order) => t.ticketStatus.create({
      data: { organizationId: org.id, key: s.key, name: s.name, color: s.color, category: s.category, pausesSla: s.pausesSla ?? false, allowedTransitions: s.transitions, order },
    })));
    const priorities = await Promise.all(DEFAULT_PRIORITIES.map((p, order) => t.ticketPriority.create({ data: { organizationId: org.id, key: p.key, name: p.name, color: p.color, order } })));
    const hours = await t.businessHours.create({
      data: {
        organizationId: org.id, name: "Standard hours", timezone: org.timezone, isDefault: true,
        periods: { create: [1, 2, 3, 4, 5].map(dayOfWeek => ({ dayOfWeek, startMinute: 9 * 60, endMinute: 17 * 60 })) },
      },
    });
    await t.sLAPolicy.create({
      data: {
        organizationId: org.id, name: "Default SLA", isDefault: true, businessHoursId: hours.id,
        targets: { create: DEFAULT_PRIORITIES.map((p, i) => ({ priorityId: priorities[i].id, firstResponseMinutes: p.response, resolutionMinutes: p.resolution })) },
      },
    });
    await t.organizationSettings.create({
      data: { organizationId: org.id, defaultStatusId: statuses[0].id, defaultPriorityId: priorities[1].id, defaultBusinessHoursId: hours.id },
    });
    if (input.withDefaultCategories !== false) {
      for (const c of DEFAULT_CATEGORIES) {
        await t.ticketCategory.create({
          data: { organizationId: org.id, name: c.name, icon: c.icon, children: { create: c.children.map(name => ({ organizationId: org.id, name })) } },
        });
      }
    }
    await t.knowledgeCategory.create({ data: { organizationId: org.id, name: "General", slug: "general" } });
    await t.membership.create({ data: { organizationId: org.id, userId: input.ownerId, roleId: roles[OWNER_ROLE_KEY] } });
    return { organization: org, roles };
  };
  return tx ? run(tx) : db.$transaction(run, { timeout: 30_000 });
}
