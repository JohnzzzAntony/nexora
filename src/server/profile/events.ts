// Client-safe list of user-configurable notification events (NotificationPreference.eventType).
export const NOTIFICATION_EVENTS = [
  { key: "ticket.created", label: "New ticket", description: "A ticket is created in a queue you work" },
  { key: "ticket.assigned", label: "Ticket assigned", description: "A ticket is assigned to you or your team" },
  { key: "ticket.updated", label: "Ticket updated", description: "Status, priority or fields change on a ticket you follow" },
  { key: "ticket.replied", label: "Ticket reply", description: "Someone replies on a ticket you follow" },
  { key: "mention", label: "Mentions", description: "Someone @mentions you" },
  { key: "task.assigned", label: "Task assigned", description: "A task is assigned to you" },
  { key: "task.overdue", label: "Task overdue", description: "A task assigned to you passes its due date" },
  { key: "sla.warning", label: "SLA warning", description: "A ticket is approaching its SLA target" },
  { key: "sla.breached", label: "SLA breached", description: "A ticket missed its SLA target" },
  { key: "approval.requested", label: "Approval requested", description: "Your approval is needed" },
  { key: "approval.decided", label: "Approval decided", description: "A request you raised is approved or rejected" },
] as const;

export type NotificationEventKey = (typeof NOTIFICATION_EVENTS)[number]["key"];
export const NOTIFICATION_EVENT_KEYS = NOTIFICATION_EVENTS.map(e => e.key) as [NotificationEventKey, ...NotificationEventKey[]];
