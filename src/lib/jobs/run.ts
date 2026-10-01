import "server-only";
import { db } from "@/lib/db";
import { processEmailOutbox } from "@/lib/email";
import { processWebhookQueue, emitEvent } from "@/lib/webhooks";
import { monitorSla } from "@/lib/sla/service";
import { notify } from "@/lib/notifications";
import { runAutomations } from "@/lib/automation/engine";
import { cleanupOrphanUploads } from "@/server/files/service";
import { webhookPayload } from "@/server/tickets/service";

async function slaAlerts() {
  const alerts = await monitorSla();
  for (const a of alerts) {
    const t = await db.ticket.findUnique({ where: { id: a.ticketId }, select: { id: true, number: true, subject: true, assigneeId: true, team: { select: { leaderId: true } }, resolutionDueAt: true, firstResponseDueAt: true } });
    if (!t) continue;
    const url = `/tickets/${t.number}`;
    const metric = a.metric === "RESPONSE" ? "first response" : "resolution";
    const due = a.metric === "RESPONSE" ? t.firstResponseDueAt : t.resolutionDueAt;
    const escalationTeam = a.escalateToTeamId ? (await db.teamMember.findMany({ where: { teamId: a.escalateToTeamId }, select: { userId: true } })).map(m => m.userId) : [];
    const recipients = a.type === "BREACHED" ? [t.assigneeId, t.team?.leaderId, a.escalateToUserId, ...escalationTeam] : [t.assigneeId ?? t.team?.leaderId];
    await notify({
      organizationId: a.organizationId, userIds: recipients, event: a.type === "BREACHED" ? "sla.breached" : "sla.warning",
      title: `${a.type === "BREACHED" ? "SLA breached" : "SLA warning"}: #${t.number}`, body: `${metric} target — ${t.subject}`, url, entityType: "ticket", entityId: t.id,
      email: a.type === "BREACHED"
        ? { template: "sla_breach", data: { ticket: `#${t.number}`, subject: t.subject, metric } }
        : { template: "sla_warning", data: { ticket: `#${t.number}`, subject: t.subject, metric, due: due?.toISOString().replace("T", " ").slice(0, 16) + " UTC" } },
    });
    if (a.type === "BREACHED") {
      await runAutomations(a.organizationId, "sla.breached", t.id);
      await emitEvent(a.organizationId, "sla.breached", { ...(await webhookPayload(t.id)), metric: a.metric }, { title: `SLA breached (${metric}) on #${t.number}: ${t.subject}`, url });
    }
  }
  return alerts.length;
}

async function overdueTasks() {
  const tasks = await db.task.findMany({ where: { dueDate: { lt: new Date() }, status: { not: "COMPLETED" }, overdueNotifiedAt: null, assigneeId: { not: null } }, take: 200 });
  for (const task of tasks) {
    const claimed = await db.task.updateMany({ where: { id: task.id, overdueNotifiedAt: null }, data: { overdueNotifiedAt: new Date() } });
    if (!claimed.count) continue;
    await notify({ organizationId: task.organizationId, userIds: [task.assigneeId], event: "task.overdue", title: `Task #${task.number} is overdue`, body: task.title, url: `/tasks/${task.number}`, entityType: "task", entityId: task.id, email: { template: "task_overdue", data: { task: `#${task.number}`, title: task.title } } });
  }
  return tasks.length;
}

async function housekeeping() {
  const now = Date.now();
  const [limits, sessions, tokens] = await Promise.all([
    db.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(now - 24 * 3600_000) } } }),
    db.session.deleteMany({ where: { expiresAt: { lt: new Date(now - 30 * 24 * 3600_000) } } }),
    db.verificationToken.deleteMany({ where: { expiresAt: { lt: new Date(now - 7 * 24 * 3600_000) } } }),
  ]);
  return { rateLimits: limits.count, sessions: sessions.count, tokens: tokens.count, orphanUploads: await cleanupOrphanUploads() };
}

/** Runs every scheduled job once; each step is idempotent and isolated from the others. */
export async function runJobs() {
  const results: Record<string, unknown> = {};
  const steps: [string, () => Promise<unknown>][] = [
    ["sla", slaAlerts], ["tasks", overdueTasks], ["emails", () => processEmailOutbox()], ["webhooks", () => processWebhookQueue()], ["housekeeping", housekeeping],
  ];
  for (const [name, step] of steps) {
    const started = Date.now();
    try { results[name] = { ok: true, result: await step(), ms: Date.now() - started }; }
    catch (e) { console.error(`[jobs] ${name} failed`, e); results[name] = { ok: false, error: (e as Error).message }; }
  }
  return results;
}
