import "server-only";
import type { Prisma } from "@prisma/client";
import { db, type Tx } from "@/lib/db";
import { env } from "@/lib/env";
import { recordActivity } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { notify } from "@/lib/notifications";
import { applySla, onStatusChange } from "@/lib/sla/service";
import { conditionGroupSchema, actionSchema, evaluate, type AutomationAction, type AutomationTrigger, type TicketFacts } from "@/lib/automation/rules";

async function loadFacts(ticketId: string) {
  const t = await db.ticket.findUniqueOrThrow({
    where: { id: ticketId },
    include: { status: true, priority: true, requester: { select: { email: true } }, tags: { include: { tag: true } }, watchers: { select: { userId: true } }, team: { select: { members: { select: { userId: true } } } } },
  });
  const facts: TicketFacts = {
    subject: t.subject, description: t.description, status: t.status.key, priority: t.priority.key, category: t.categoryId, subcategory: t.subcategoryId,
    team: t.teamId, assignee: t.assigneeId, requesterEmail: t.requester.email, source: t.source, tags: t.tags.map(x => x.tag.name),
    customer: t.customerId, department: t.departmentId, hoursSinceCreated: Math.floor((Date.now() - t.createdAt.getTime()) / 3600_000),
  };
  return { ticket: t, facts };
}

type Loaded = Awaited<ReturnType<typeof loadFacts>>["ticket"];
type Followup = () => Promise<unknown>;

export async function nextTaskNumber(tx: Tx, organizationId: string) {
  const org = await tx.organization.update({ where: { id: organizationId }, data: { taskSeq: { increment: 1 } }, select: { taskSeq: true } });
  return org.taskSeq;
}

async function execute(tx: Tx, t: Loaded, action: AutomationAction, followups: Followup[]): Promise<string> {
  const org = t.organizationId;
  const url = `/tickets/${t.number}`;
  switch (action.type) {
    case "assign_user": {
      const m = await tx.membership.findFirst({ where: { organizationId: org, userId: action.userId, status: "ACTIVE" } });
      if (!m) throw new Error("Assignee is not an active member");
      await tx.ticket.update({ where: { id: t.id }, data: { assigneeId: action.userId } });
      followups.push(() => notify({ organizationId: org, userIds: [action.userId], event: "ticket.assigned", title: `Ticket #${t.number} assigned to you`, body: t.subject, url, entityType: "ticket", entityId: t.id, email: { template: "ticket_assigned", data: { ticket: `#${t.number}`, subject: t.subject, assignee: "you" } } }));
      return `Assigned to user ${action.userId}`;
    }
    case "assign_team": {
      const team = await tx.team.findFirst({ where: { id: action.teamId, organizationId: org } });
      if (!team) throw new Error("Team not found");
      await tx.ticket.update({ where: { id: t.id }, data: { teamId: team.id } });
      return `Assigned to team ${team.name}`;
    }
    case "set_priority": {
      const p = await tx.ticketPriority.findFirst({ where: { organizationId: org, key: action.priorityKey } });
      if (!p) throw new Error(`Priority ${action.priorityKey} not found`);
      await tx.ticket.update({ where: { id: t.id }, data: { priorityId: p.id } });
      await applySla(t.id, tx);
      return `Priority set to ${p.name}`;
    }
    case "set_status": {
      const s = await tx.ticketStatus.findFirst({ where: { organizationId: org, key: action.statusKey, isActive: true } });
      if (!s) throw new Error(`Status ${action.statusKey} not found`);
      await tx.ticket.update({ where: { id: t.id }, data: { statusId: s.id, closedAt: s.category === "CLOSED" ? new Date() : null } });
      await onStatusChange(t.id, s, tx);
      return `Status set to ${s.name}`;
    }
    case "add_tag": {
      const tag = await tx.tag.upsert({ where: { organizationId_name: { organizationId: org, name: action.tag } }, create: { organizationId: org, name: action.tag }, update: {} });
      await tx.ticketTag.upsert({ where: { ticketId_tagId: { ticketId: t.id, tagId: tag.id } }, create: { ticketId: t.id, tagId: tag.id }, update: {} });
      return `Tag "${action.tag}" added`;
    }
    case "remove_tag": {
      await tx.ticketTag.deleteMany({ where: { ticketId: t.id, tag: { name: action.tag, organizationId: org } } });
      return `Tag "${action.tag}" removed`;
    }
    case "create_task": {
      const number = await nextTaskNumber(tx, org);
      const task = await tx.task.create({ data: { organizationId: org, number, title: action.title, ticketId: t.id, assigneeId: action.assigneeId || null, status: action.assigneeId ? "ASSIGNED" : "TODO", priority: "MEDIUM" } });
      if (action.assigneeId) followups.push(() => notify({ organizationId: org, userIds: [action.assigneeId], event: "task.assigned", title: `Task #${number} assigned to you`, body: action.title, url: `/tasks/${number}`, entityType: "task", entityId: task.id, email: { template: "task_assigned", data: { task: `#${number}`, title: action.title } } }));
      return `Task #${number} created`;
    }
    case "send_email": {
      const to = action.to === "requester" ? t.requester.email : action.to === "assignee" ? (t.assigneeId ? (await tx.user.findUnique({ where: { id: t.assigneeId } }))?.email : null) : action.to;
      if (!to) throw new Error(`No recipient for ${action.to}`);
      followups.push(() => sendEmail({ to, template: "notification", organizationId: org, entityType: "ticket", entityId: t.id, data: { title: action.subject.replace("{{ticket}}", `#${t.number}`), body: action.body.replace("{{ticket}}", `#${t.number}`).replace("{{subject}}", t.subject), url: `${env.appUrl}${url}` } }));
      return `Email queued to ${to}`;
    }
    case "send_notification": {
      const users = action.to === "assignee" ? [t.assigneeId] : action.to === "requester" ? [t.requesterId] : action.to === "watchers" ? t.watchers.map(w => w.userId) : (t.team?.members.map(m => m.userId) ?? []);
      followups.push(() => notify({ organizationId: org, userIds: users, event: "ticket.updated", title: `#${t.number}: ${action.message}`, body: t.subject, url, entityType: "ticket", entityId: t.id }));
      return `Notification sent to ${action.to}`;
    }
    case "change_sla": {
      const p = await tx.sLAPolicy.findFirst({ where: { id: action.policyId, organizationId: org } });
      if (!p) throw new Error("SLA policy not found");
      await tx.ticket.update({ where: { id: t.id }, data: { slaPolicyId: p.id } });
      await applySla(t.id, tx);
      return `SLA policy set to ${p.name}`;
    }
    case "escalate": {
      const data: Prisma.TicketUncheckedUpdateInput = {};
      if (action.userId) data.assigneeId = action.userId;
      if (action.teamId) data.teamId = action.teamId;
      if (action.priorityKey) {
        const p = await tx.ticketPriority.findFirst({ where: { organizationId: org, key: action.priorityKey } });
        if (p) data.priorityId = p.id;
      }
      await tx.ticket.update({ where: { id: t.id }, data });
      if (data.priorityId) await applySla(t.id, tx);
      const teamMembers = action.teamId ? (await tx.teamMember.findMany({ where: { teamId: action.teamId }, select: { userId: true } })).map(m => m.userId) : [];
      followups.push(() => notify({ organizationId: org, userIds: [action.userId, ...teamMembers], event: "ticket.assigned", title: `Escalated: #${t.number}`, body: t.subject, url, entityType: "ticket", entityId: t.id }));
      return "Ticket escalated";
    }
    case "add_watcher": {
      await tx.ticketWatcher.upsert({ where: { ticketId_userId: { ticketId: t.id, userId: action.userId } }, create: { ticketId: t.id, userId: action.userId }, update: {} });
      return "Watcher added";
    }
  }
}

/**
 * Runs active rules for a trigger against a ticket. Rules never re-trigger automations.
 * Every matched rule produces an AutomationExecution row (SUCCESS or FAILED).
 */
export async function runAutomations(organizationId: string, trigger: AutomationTrigger, ticketId: string) {
  const rules = await db.automationRule.findMany({ where: { organizationId, trigger, isActive: true }, orderBy: [{ order: "asc" }, { createdAt: "asc" }] });
  for (const rule of rules) {
    const { ticket, facts } = await loadFacts(ticketId);
    const conditions = conditionGroupSchema.safeParse(rule.conditions);
    const actions = actionSchema.array().safeParse(rule.actions);
    if (!conditions.success || !actions.success) {
      await db.automationExecution.create({ data: { organizationId, ruleId: rule.id, entityType: "ticket", entityId: ticketId, trigger, status: "FAILED", error: "Rule definition is invalid" } });
      continue;
    }
    if (!evaluate(conditions.data, facts)) continue;
    const followups: Followup[] = [];
    try {
      const log = await db.$transaction(async tx => {
        const results: string[] = [];
        for (const action of actions.data) results.push(await execute(tx, ticket, action, followups));
        await recordActivity({ organizationId, entityType: "ticket", entityId: ticketId, actorId: null, action: "automation.applied", data: { rule: rule.name, results } }, tx);
        return results;
      }, { timeout: 20_000 });
      await db.automationExecution.create({ data: { organizationId, ruleId: rule.id, entityType: "ticket", entityId: ticketId, trigger, status: "SUCCESS", actionsRun: log } });
      for (const f of followups) await f().catch(e => console.error("[automation] follow-up failed", e));
    } catch (error) {
      await db.automationExecution.create({ data: { organizationId, ruleId: rule.id, entityType: "ticket", entityId: ticketId, trigger, status: "FAILED", error: (error as Error).message.slice(0, 1000) } });
    }
    if (rule.stopProcessing) break;
  }
}

