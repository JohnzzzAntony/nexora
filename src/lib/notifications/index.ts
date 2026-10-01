import "server-only";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import type { EmailTemplateKey } from "@/lib/email/templates";

export const NOTIFICATION_EVENTS = {
  "ticket.created": "Ticket created",
  "ticket.assigned": "Ticket assigned to me",
  "ticket.updated": "Ticket updated",
  "ticket.replied": "Reply received",
  mention: "Mentioned",
  "task.assigned": "Task assigned to me",
  "task.overdue": "Task overdue",
  "sla.warning": "SLA warning",
  "sla.breached": "SLA breached",
  "approval.requested": "Approval requested",
  "approval.decided": "Approval decided",
  "user.invited": "Invitation",
} as const;
export type NotificationEvent = keyof typeof NOTIFICATION_EVENTS;

export type NotifyInput = {
  organizationId: string;
  userIds: (string | null | undefined)[];
  event: NotificationEvent;
  title: string;
  body?: string;
  /** Path inside the app, e.g. /tickets/10452 */
  url?: string;
  entityType?: string;
  entityId?: string;
  /** The acting user never notifies themselves. */
  actorId?: string | null;
  email?: { template: EmailTemplateKey; data: Record<string, unknown>; headers?: Record<string, string> };
};

/** Persists in-app notifications and queues emails, honoring each user's preferences. */
export async function notify(input: NotifyInput) {
  const ids = [...new Set(input.userIds.filter((id): id is string => !!id && id !== input.actorId))];
  if (!ids.length) return;
  const recipients = await db.user.findMany({
    where: { id: { in: ids }, isActive: true, memberships: { some: { organizationId: input.organizationId, status: "ACTIVE" } } },
    select: { id: true, email: true, notificationPrefs: { where: { organizationId: input.organizationId, eventType: input.event } } },
  });
  const inApp = recipients.filter(r => r.notificationPrefs[0]?.inApp ?? true);
  if (inApp.length) {
    await db.notification.createMany({
      data: inApp.map(r => ({
        organizationId: input.organizationId, userId: r.id, type: input.event, title: input.title.slice(0, 250),
        body: input.body?.slice(0, 1000), url: input.url, entityType: input.entityType, entityId: input.entityId,
      })),
    });
  }
  if (input.email) {
    for (const r of recipients.filter(r => r.notificationPrefs[0]?.email ?? true)) {
      await sendEmail({
        to: r.email, template: input.email.template, organizationId: input.organizationId,
        data: { url: input.url ? `${env.appUrl}${input.url}` : env.appUrl, ...input.email.data },
        headers: input.email.headers, entityType: input.entityType, entityId: input.entityId,
      });
    }
  }
}

/** Active member user ids holding a role with the given permission (e.g. approvers, admins). */
export async function usersWithPermission(organizationId: string, permission: string) {
  const rows = await db.membership.findMany({
    where: { organizationId, status: "ACTIVE", role: { permissions: { some: { permission } } } },
    select: { userId: true },
  });
  return rows.map(r => r.userId);
}
