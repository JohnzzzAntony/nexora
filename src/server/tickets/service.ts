import "server-only";
import type { Prisma, TicketSource } from "@prisma/client";
import { db, type Tx } from "@/lib/db";
import { env } from "@/lib/env";
import { AppError } from "@/lib/api/errors";
import { recordActivity, writeAudit } from "@/lib/audit";
import { requirePermission, type OrgContext } from "@/lib/tenancy/load";
import { sanitizeHtml, stripHtml } from "@/lib/sanitize";
import { applySla, onFirstResponse, onStatusChange } from "@/lib/sla/service";
import { runAutomations } from "@/lib/automation/engine";
import { notify, usersWithPermission } from "@/lib/notifications";
import { emitEvent } from "@/lib/webhooks";
import { createTicketSchema, updateTicketSchema, addMessageSchema, type CreateTicketInput, type UpdateTicketInput, type AddMessageInput } from "@/schemas/ticket";
import { assertAgentMember, assertMember, assertOwned, canSeeInternal, isAgent, requireTicket } from "@/server/tickets/access";
import { validateCustomFields } from "@/server/custom-fields/validate";

export const ticketUrl = (number: number) => `/tickets/${number}`;
export const ticketRef = (number: number) => `#${number}`;
const appHost = () => new URL(env.appUrl).host;

/** Email threading headers so replies route back to the ticket (see inbound email handler). */
export function ticketEmailHeaders(ticket: { id: string; number: number }, replyTo?: string | null) {
  const root = `<ticket-${ticket.id}@${appHost()}>`;
  return {
    "Message-ID": `<ticket-${ticket.id}.${Date.now().toString(36)}@${appHost()}>`,
    "In-Reply-To": root,
    References: root,
    ...(replyTo ? { "Reply-To": replyTo } : {}),
  } as Record<string, string>;
}

async function replyToAddress(organizationId: string) {
  const s = await db.organizationSettings.findUnique({ where: { organizationId }, select: { supportEmail: true } });
  return s?.supportEmail ?? null;
}

async function upsertTags(tx: Tx, organizationId: string, ticketId: string, names: string[]) {
  const unique = [...new Set(names.map(n => n.trim()).filter(Boolean))];
  await tx.ticketTag.deleteMany({ where: { ticketId, tag: { name: { notIn: unique } } } });
  for (const name of unique) {
    const tag = await tx.tag.upsert({ where: { organizationId_name: { organizationId, name } }, create: { organizationId, name }, update: {} });
    await tx.ticketTag.upsert({ where: { ticketId_tagId: { ticketId, tagId: tag.id } }, create: { ticketId, tagId: tag.id }, update: {} });
  }
}

/** Links draft uploads (owned by the uploader, not yet attached) to a ticket or message. */
async function claimAttachments(tx: Tx, ctx: OrgContext, ids: string[], target: { ticketId: string; messageId?: string }) {
  if (!ids.length) return;
  const res = await tx.attachment.updateMany({
    where: { id: { in: ids }, organizationId: ctx.organization.id, uploadedById: ctx.user.id, OR: [{ ticketId: null, taskId: null, projectId: null, articleId: null, assetId: null }, { ticketId: target.ticketId, messageId: null }] },
    data: { ticketId: target.ticketId, messageId: target.messageId ?? null },
  });
  if (res.count !== ids.length) throw new AppError("INVALID_ATTACHMENT", "One or more attachments are invalid or already used", 422);
}

async function nextTicketNumber(tx: Tx, organizationId: string) {
  const org = await tx.organization.update({ where: { id: organizationId }, data: { ticketSeq: { increment: 1 } }, select: { ticketSeq: true } });
  return org.ticketSeq;
}

// ───────────────────────────── Create ─────────────────────────────

export async function createTicket(ctx: OrgContext, raw: CreateTicketInput, opts: { source?: TicketSource } = {}) {
  requirePermission(ctx, "tickets.create");
  const input = createTicketSchema.parse(raw);
  const orgId = ctx.organization.id;
  const agent = isAgent(ctx);

  // Requesters (employees/customers) cannot set routing fields; those come from defaults & automation.
  if (!agent && (input.teamId || input.assigneeId || input.projectId || input.customerId || (input.requesterId && input.requesterId !== ctx.user.id))) {
    throw new AppError("FORBIDDEN", "You cannot set team, assignee, project, customer or requester on a ticket", 403);
  }
  if (input.assigneeId && !ctx.can("tickets.assign")) throw new AppError("FORBIDDEN", "You cannot assign tickets", 403);

  const template = input.templateId ? await db.ticketTemplate.findFirst({ where: { id: input.templateId, organizationId: orgId } }) : null;
  if (template) {
    input.categoryId ??= template.categoryId; input.priorityId ??= template.priorityId; input.teamId ??= agent ? template.teamId : null;
    if (agent && !input.assigneeId && template.assigneeId && ctx.can("tickets.assign")) input.assigneeId = template.assigneeId;
    input.tags = [...new Set([...input.tags, ...template.tags])];
  }
  const requesterId = input.requesterId || ctx.user.id;
  const requester = requesterId === ctx.user.id ? { customerId: ctx.membership.customerId, departmentId: ctx.membership.departmentId, locationId: ctx.membership.locationId } : await assertMember(orgId, requesterId);
  await assertOwned(orgId, { category: input.categoryId, subcategory: input.subcategoryId, priority: input.priorityId, team: input.teamId, location: input.locationId, customer: input.customerId, project: input.projectId });
  if (input.subcategoryId && !input.categoryId) throw new AppError("VALIDATION_ERROR", "Choose a category for the subcategory", 422);
  if (input.assigneeId) await assertAgentMember(orgId, input.assigneeId);
  if (input.assetIds.length && (await db.asset.count({ where: { id: { in: input.assetIds }, organizationId: orgId } })) !== input.assetIds.length) throw new AppError("INVALID_REFERENCE", "Asset not found", 422);

  const [settings, category] = await Promise.all([
    db.organizationSettings.findUnique({ where: { organizationId: orgId } }),
    input.categoryId ? db.ticketCategory.findUnique({ where: { id: input.categoryId } }) : null,
  ]);
  if (category?.requiredFields.length) {
    const missing = category.requiredFields.filter(f => ["location", "asset", "dueDate", "subcategory"].includes(f) && !(f === "location" ? input.locationId : f === "asset" ? input.assetIds.length : f === "dueDate" ? input.dueDate : input.subcategoryId));
    if (missing.length) throw new AppError("VALIDATION_ERROR", `${category.name} tickets require: ${missing.join(", ")}`, 422);
  }
  const form = input.categoryId ? await db.ticketForm.findFirst({ where: { organizationId: orgId, isActive: true, categoryId: input.categoryId }, include: { fields: true } }) : null;
  const customValues = await validateCustomFields(orgId, "TICKET", { ...((template?.customFieldValues as Record<string, unknown>) ?? {}), ...(input.customFields ?? {}) }, { partial: false, agent, formFieldIds: form?.fields.map(f => f.fieldId) });

  const statuses = await db.ticketStatus.findMany({ where: { organizationId: orgId, isActive: true }, orderBy: { order: "asc" } });
  const initial = statuses.find(s => s.id === settings?.defaultStatusId) ?? statuses.find(s => s.category === "NEW") ?? statuses[0];
  const assignedStatus = statuses.find(s => s.key === "ASSIGNED");
  const status = input.assigneeId && initial?.category === "NEW" && assignedStatus ? assignedStatus : initial;
  if (!status) throw new AppError("MISCONFIGURED", "No active ticket statuses configured", 500);
  const priorityId = input.priorityId || category?.defaultPriorityId || settings?.defaultPriorityId || (await db.ticketPriority.findFirst({ where: { organizationId: orgId }, orderBy: { order: "asc" } }))?.id;
  if (!priorityId) throw new AppError("MISCONFIGURED", "No ticket priorities configured", 500);

  const ticket = await db.$transaction(async tx => {
    const number = await nextTicketNumber(tx, orgId);
    const created = await tx.ticket.create({
      data: {
        organizationId: orgId, number, subject: input.subject, description: sanitizeHtml(input.description),
        statusId: status.id, priorityId, categoryId: input.categoryId, subcategoryId: input.subcategoryId,
        requesterId, createdById: ctx.user.id, assigneeId: input.assigneeId, teamId: input.teamId || category?.defaultTeamId || null,
        departmentId: requester.departmentId, locationId: input.locationId || requester.locationId, customerId: input.customerId || requester.customerId,
        projectId: input.projectId, dueDate: input.dueDate ?? null, source: opts.source ?? (ctx.isCustomer ? "PORTAL" : ctx.via === "apiKey" ? "API" : "WEB"),
        assets: { create: input.assetIds.map(assetId => ({ assetId })) },
        customFieldValues: { create: customValues.filter(v => v.value !== null).map(v => ({ fieldId: v.fieldId, value: v.value as Prisma.InputJsonValue })) },
        watchers: { create: [{ userId: requesterId }] },
      },
    });
    if (input.tags.length) await upsertTags(tx, orgId, created.id, input.tags);
    const fileFieldIds = customValues.filter(v => v.type === "FILE" && typeof v.value === "string").map(v => v.value as string);
    await claimAttachments(tx, ctx, [...new Set([...input.attachmentIds, ...fileFieldIds])], { ticketId: created.id });
    await applySla(created.id, tx, { initial: true });
    await recordActivity({ organizationId: orgId, entityType: "ticket", entityId: created.id, actorId: ctx.user.id, action: "ticket.created", data: { number } }, tx);
    await writeAudit({ organizationId: orgId, userId: ctx.user.id, action: "ticket.created", entityType: "ticket", entityId: created.id, after: { number, subject: created.subject, statusId: created.statusId, priorityId, assigneeId: created.assigneeId, teamId: created.teamId } }, tx);
    return created;
  }, { timeout: 30_000 });

  await afterCreate(ctx, ticket.id);
  return ticket;
}

async function afterCreate(ctx: OrgContext | null, ticketId: string) {
  const t0 = await db.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { organizationId: true } });
  await runAutomations(t0.organizationId, "ticket.created", ticketId);
  const t = await db.ticket.findUniqueOrThrow({ where: { id: ticketId }, include: { requester: { select: { id: true, email: true, name: true } }, assignee: { select: { name: true } }, team: { select: { members: { select: { userId: true } } } } } });
  const orgId = t.organizationId;
  const url = ticketUrl(t.number);
  const actorId = ctx?.user.id ?? null;
  const replyTo = await replyToAddress(orgId);
  // Requester confirmation (email), even when they created it themselves.
  await notify({
    organizationId: orgId, userIds: [t.requesterId], event: "ticket.created", title: `Ticket ${ticketRef(t.number)} received`, body: t.subject, url, entityType: "ticket", entityId: t.id,
    email: { template: "ticket_created", data: { ticket: ticketRef(t.number), subject: t.subject, requester: t.requester.name }, headers: ticketEmailHeaders(t, replyTo) },
  });
  if (t.assigneeId) {
    await notify({ organizationId: orgId, userIds: [t.assigneeId], actorId, event: "ticket.assigned", title: `Ticket ${ticketRef(t.number)} assigned to you`, body: t.subject, url, entityType: "ticket", entityId: t.id, email: { template: "ticket_assigned", data: { ticket: ticketRef(t.number), subject: t.subject, assignee: t.assignee?.name ?? "you" } } });
  } else {
    const teamUsers = t.team?.members.map(m => m.userId) ?? [];
    const recipients = teamUsers.length ? teamUsers : await usersWithPermission(orgId, "tickets.view_all");
    await notify({ organizationId: orgId, userIds: recipients.filter(id => id !== t.requesterId), actorId, event: "ticket.created", title: `New ticket ${ticketRef(t.number)}`, body: t.subject, url, entityType: "ticket", entityId: t.id });
  }
  const payload = await webhookPayload(t.id);
  await emitEvent(orgId, "ticket.created", payload, { title: `New ticket ${ticketRef(t.number)}: ${t.subject}`, url });
  if (t.assigneeId) await emitEvent(orgId, "ticket.assigned", payload);
}

export async function webhookPayload(ticketId: string) {
  const t = await db.ticket.findUniqueOrThrow({
    where: { id: ticketId },
    include: { status: { select: { key: true, name: true } }, priority: { select: { key: true, name: true } }, requester: { select: { id: true, name: true, email: true } }, assignee: { select: { id: true, name: true, email: true } }, team: { select: { id: true, name: true } }, category: { select: { id: true, name: true } } },
  });
  return {
    id: t.id, number: t.number, subject: t.subject, status: t.status, priority: t.priority, category: t.category, team: t.team,
    requester: t.requester, assignee: t.assignee, source: t.source, slaState: t.slaState, dueDate: t.dueDate, createdAt: t.createdAt, updatedAt: t.updatedAt,
    url: `${env.appUrl}${ticketUrl(t.number)}`,
  };
}

// ───────────────────────────── Update ─────────────────────────────

const TRACKED = ["subject", "statusId", "priorityId", "categoryId", "subcategoryId", "teamId", "assigneeId", "requesterId", "locationId", "customerId", "projectId", "dueDate"] as const;

export async function updateTicket(ctx: OrgContext, ref: string | number, raw: UpdateTicketInput) {
  const input = updateTicketSchema.parse(raw);
  const ticket = await requireTicket(ctx, ref);
  const orgId = ctx.organization.id;
  const { version, tags, customFields, ...fields } = input;
  const changes = Object.fromEntries(Object.entries(fields).filter(([k, v]) => v !== undefined && (k === "description" || (ticket as Record<string, unknown>)[k]?.toString() !== v?.toString()))) as Partial<typeof fields>;
  if (fields.dueDate !== undefined && (ticket.dueDate?.getTime() ?? null) === (fields.dueDate?.getTime() ?? null)) delete changes.dueDate;
  if (changes.description !== undefined && sanitizeHtml(changes.description) === ticket.description) delete changes.description;

  if (version !== undefined && version !== ticket.version) throw new AppError("CONFLICT", "This ticket was changed by someone else. Reload to see the latest version.", 409);

  // Field-level authorization.
  const generalEdits = Object.keys(changes).filter(k => !["statusId", "assigneeId"].includes(k));
  if ((generalEdits.length || tags !== undefined || customFields !== undefined) && !(ctx.can("tickets.edit") && !ctx.isCustomer)) throw new AppError("FORBIDDEN", "You cannot edit this ticket", 403);
  if ("assigneeId" in changes) {
    const reassigning = ticket.assigneeId && ticket.assigneeId !== ctx.user.id;
    if (!ctx.can("tickets.assign") || (reassigning && !ctx.can("tickets.reassign"))) throw new AppError("FORBIDDEN", reassigning ? "You cannot reassign tickets owned by others" : "You cannot assign tickets", 403);
    if (changes.assigneeId) await assertAgentMember(orgId, changes.assigneeId);
  }
  let newStatus = null as Awaited<ReturnType<typeof db.ticketStatus.findFirst>>;
  if (changes.statusId) {
    newStatus = await db.ticketStatus.findFirst({ where: { id: changes.statusId, organizationId: orgId, isActive: true } });
    if (!newStatus) throw new AppError("INVALID_REFERENCE", "Status not found", 422);
    const closing = ["RESOLVED", "CLOSED"].includes(newStatus.category) || ["RESOLVED", "CLOSED"].includes(ticket.status.category);
    if (closing ? !ctx.can("tickets.close") : !ctx.can("tickets.edit")) throw new AppError("FORBIDDEN", "You cannot change this ticket's status", 403);
    if (ticket.status.allowedTransitions.length && !ticket.status.allowedTransitions.includes(newStatus.key)) throw new AppError("INVALID_TRANSITION", `Cannot move from ${ticket.status.name} to ${newStatus.name}`, 422);
  }
  if (changes.requesterId) await assertMember(orgId, changes.requesterId);
  await assertOwned(orgId, { category: changes.categoryId, subcategory: changes.subcategoryId ? changes.subcategoryId : undefined, priority: changes.priorityId, team: changes.teamId, location: changes.locationId, customer: changes.customerId, project: changes.projectId });
  if (changes.subcategoryId) {
    const sub = await db.ticketCategory.findFirst({ where: { id: changes.subcategoryId, organizationId: orgId } });
    if (sub?.parentId !== (changes.categoryId !== undefined ? changes.categoryId : ticket.categoryId)) throw new AppError("VALIDATION_ERROR", "Subcategory does not belong to the category", 422);
  }
  const customValues = customFields !== undefined ? await validateCustomFields(orgId, "TICKET", customFields, { partial: true, agent: true }) : [];
  if (!Object.keys(changes).length && tags === undefined && !customValues.length) return ticket;

  // Auto-advance NEW → ASSIGNED when an assignee is set without an explicit status change.
  if (changes.assigneeId && !changes.statusId && ticket.status.category === "NEW") {
    const assigned = await db.ticketStatus.findFirst({ where: { organizationId: orgId, key: "ASSIGNED", isActive: true } });
    if (assigned) { changes.statusId = assigned.id; newStatus = assigned; }
  }

  const before = Object.fromEntries(TRACKED.filter(k => k in changes).map(k => [k, (ticket as Record<string, unknown>)[k]]));
  const updated = await db.$transaction(async tx => {
    const res = await tx.ticket.updateMany({
      where: { id: ticket.id, version: ticket.version },
      data: {
        ...changes,
        ...(changes.description !== undefined ? { description: sanitizeHtml(changes.description) } : {}),
        ...(newStatus ? { closedAt: newStatus.category === "CLOSED" ? new Date() : null } : {}),
        version: { increment: 1 },
      },
    });
    if (!res.count) throw new AppError("CONFLICT", "This ticket was changed by someone else. Reload to see the latest version.", 409);
    if (tags !== undefined) await upsertTags(tx, orgId, ticket.id, tags);
    for (const cv of customValues) {
      if (cv.value === null) await tx.ticketCustomFieldValue.deleteMany({ where: { ticketId: ticket.id, fieldId: cv.fieldId } });
      else await tx.ticketCustomFieldValue.upsert({ where: { ticketId_fieldId: { ticketId: ticket.id, fieldId: cv.fieldId } }, create: { ticketId: ticket.id, fieldId: cv.fieldId, value: cv.value }, update: { value: cv.value } });
    }
    if (newStatus) await onStatusChange(ticket.id, newStatus, tx);
    if (changes.priorityId || changes.categoryId !== undefined || changes.subcategoryId !== undefined || changes.teamId !== undefined) await applySla(ticket.id, tx);
    const after = Object.fromEntries(TRACKED.filter(k => k in changes).map(k => [k, (changes as Record<string, unknown>)[k]]));
    await recordActivity({ organizationId: orgId, entityType: "ticket", entityId: ticket.id, actorId: ctx.user.id, action: "ticket.updated", data: { before, after, tags, customFields: customValues.length ? Object.keys(customFields ?? {}) : undefined, description: changes.description !== undefined || undefined } }, tx);
    await writeAudit({ organizationId: orgId, userId: ctx.user.id, action: newStatus ? "ticket.status_changed" : "assigneeId" in changes ? "ticket.assigned" : "ticket.updated", entityType: "ticket", entityId: ticket.id, before, after }, tx);
    return tx.ticket.findUniqueOrThrow({ where: { id: ticket.id }, include: { status: true, priority: true } });
  }, { timeout: 30_000 });

  await afterUpdate(ctx, ticket, updated, changes);
  return updated;
}

async function afterUpdate(
  ctx: OrgContext,
  before: { id: string; assigneeId: string | null; number: number; requesterId: string },
  after: { id: string; organizationId: string; number: number; subject: string; assigneeId: string | null; requesterId: string; status: { category: string; name: string } },
  changes: Record<string, unknown>,
) {
  const orgId = after.organizationId;
  const url = ticketUrl(after.number);
  await runAutomations(orgId, "ticket.updated", after.id);
  const payload = await webhookPayload(after.id);
  const replyTo = await replyToAddress(orgId);
  if ("assigneeId" in changes && after.assigneeId) {
    await notify({ organizationId: orgId, userIds: [after.assigneeId], actorId: ctx.user.id, event: "ticket.assigned", title: `${before.assigneeId ? "Reassigned" : "Assigned"}: ${ticketRef(after.number)}`, body: after.subject, url, entityType: "ticket", entityId: after.id, email: { template: "ticket_assigned", data: { ticket: ticketRef(after.number), subject: after.subject, assignee: "you" } } });
    await emitEvent(orgId, "ticket.assigned", payload, { title: `${ticketRef(after.number)} assigned`, url });
  }
  if ("statusId" in changes) {
    const cat = after.status.category;
    const template = cat === "RESOLVED" ? "ticket_resolved" : cat === "CLOSED" ? "ticket_closed" : null;
    await notify({
      organizationId: orgId, userIds: [after.requesterId], actorId: ctx.user.id, event: "ticket.updated", title: `${ticketRef(after.number)} is now ${after.status.name}`, body: after.subject, url, entityType: "ticket", entityId: after.id,
      ...(template ? { email: { template, data: { ticket: ticketRef(after.number), subject: after.subject }, headers: ticketEmailHeaders(after, replyTo) } } : {}),
    });
    if (cat === "CLOSED") await emitEvent(orgId, "ticket.closed", payload, { title: `${ticketRef(after.number)} closed`, url });
  }
  const watchers = await db.ticketWatcher.findMany({ where: { ticketId: after.id }, select: { userId: true } });
  const summary = Object.keys(changes).map(k => k.replace(/Id$/, "")).join(", ");
  await notify({ organizationId: orgId, userIds: [...watchers.map(w => w.userId), after.assigneeId].filter(id => id !== after.requesterId && !("assigneeId" in changes && id === after.assigneeId)), actorId: ctx.user.id, event: "ticket.updated", title: `${ticketRef(after.number)} updated`, body: `Changed: ${summary}`, url, entityType: "ticket", entityId: after.id });
  await emitEvent(orgId, "ticket.updated", { ...payload, changed: Object.keys(changes) });
}

// ───────────────────────────── Messages ─────────────────────────────

export async function addMessage(ctx: OrgContext, ref: string | number, raw: AddMessageInput) {
  const input = addMessageSchema.parse(raw);
  const ticket = await requireTicket(ctx, ref);
  const orgId = ctx.organization.id;
  if (input.type === "INTERNAL" && !canSeeInternal(ctx)) throw new AppError("FORBIDDEN", "You cannot add internal notes", 403);
  const bodyHtml = sanitizeHtml(input.bodyHtml);
  if (!stripHtml(bodyHtml) && !input.attachmentIds.length) throw new AppError("VALIDATION_ERROR", "Message cannot be empty", 422);
  const agent = isAgent(ctx);
  const isRequester = ticket.requesterId === ctx.user.id;

  // Mentions: only active members who can see this kind of message.
  const mentioned = input.mentionedUserIds.length
    ? (await db.membership.findMany({ where: { organizationId: orgId, userId: { in: input.mentionedUserIds }, status: "ACTIVE", ...(input.type === "INTERNAL" ? { role: { key: { not: "customer" } } } : {}) }, select: { userId: true } })).map(m => m.userId)
    : [];

  // Requester replies bring pending/resolved tickets back into work.
  let reopenTo: { id: string; pausesSla: boolean; category: string } | null = null;
  if (input.type === "PUBLIC" && isRequester && !agent && ["PENDING", "RESOLVED"].includes(ticket.status.category)) {
    reopenTo = await db.ticketStatus.findFirst({ where: { organizationId: orgId, isActive: true, category: "OPEN", key: ticket.assigneeId ? "IN_PROGRESS" : "ASSIGNED" } })
      ?? await db.ticketStatus.findFirst({ where: { organizationId: orgId, isActive: true, category: "OPEN" }, orderBy: { order: "asc" } });
  }
  if (ticket.status.category === "CLOSED" && !agent) throw new AppError("TICKET_CLOSED", "This ticket is closed. Please create a new ticket.", 422);

  const message = await db.$transaction(async tx => {
    const m = await tx.ticketMessage.create({ data: { organizationId: orgId, ticketId: ticket.id, authorId: ctx.user.id, type: input.type, bodyHtml, mentionedUserIds: mentioned } });
    await claimAttachments(tx, ctx, input.attachmentIds, { ticketId: ticket.id, messageId: m.id });
    await tx.ticket.update({ where: { id: ticket.id }, data: { updatedAt: new Date(), ...(reopenTo ? { statusId: reopenTo.id, closedAt: null } : {}) } });
    if (reopenTo) await onStatusChange(ticket.id, reopenTo, tx);
    if (input.type === "PUBLIC" && agent && !isRequester) await onFirstResponse(ticket.id, tx);
    await recordActivity({ organizationId: orgId, entityType: "ticket", entityId: ticket.id, actorId: ctx.user.id, action: input.type === "INTERNAL" ? "ticket.note_added" : "ticket.replied", data: { messageId: m.id, reopened: Boolean(reopenTo) } }, tx);
    return m;
  }, { timeout: 30_000 });

  const url = ticketUrl(ticket.number);
  const excerpt = stripHtml(bodyHtml).slice(0, 200);
  const author = ctx.user.name;
  if (mentioned.length) await notify({ organizationId: orgId, userIds: mentioned, actorId: ctx.user.id, event: "mention", title: `${author} mentioned you on ${ticketRef(ticket.number)}`, body: excerpt, url, entityType: "ticket", entityId: ticket.id, email: { template: "mention", data: { author, context: `ticket ${ticketRef(ticket.number)}` } } });
  if (input.type === "PUBLIC") {
    const watchers = (await db.ticketWatcher.findMany({ where: { ticketId: ticket.id }, select: { userId: true } })).map(w => w.userId);
    const replyTo = await replyToAddress(orgId);
    if (!isRequester) {
      await notify({ organizationId: orgId, userIds: [ticket.requesterId], actorId: ctx.user.id, event: "ticket.replied", title: `New reply on ${ticketRef(ticket.number)}`, body: excerpt, url, entityType: "ticket", entityId: ticket.id, email: { template: "ticket_replied", data: { ticket: ticketRef(ticket.number), subject: ticket.subject, author, message: bodyHtml }, headers: ticketEmailHeaders(ticket, replyTo) } });
    }
    await notify({ organizationId: orgId, userIds: [ticket.assigneeId, ...watchers].filter(id => id !== ticket.requesterId && !mentioned.includes(id!)), actorId: ctx.user.id, event: "ticket.replied", title: `${author} replied on ${ticketRef(ticket.number)}`, body: excerpt, url, entityType: "ticket", entityId: ticket.id });
    if (isRequester && !agent) await runAutomations(orgId, "ticket.replied", ticket.id);
  } else if (ticket.assigneeId && !mentioned.includes(ticket.assigneeId)) {
    await notify({ organizationId: orgId, userIds: [ticket.assigneeId], actorId: ctx.user.id, event: "ticket.updated", title: `Internal note on ${ticketRef(ticket.number)}`, body: excerpt, url, entityType: "ticket", entityId: ticket.id });
  }
  await emitEvent(orgId, "ticket.updated", { ...(await webhookPayload(ticket.id)), changed: ["messages"], message: { id: message.id, type: message.type } });
  return message;
}

const EDIT_WINDOW_MS = 30 * 60_000;

export async function editMessage(ctx: OrgContext, messageId: string, bodyHtml: string) {
  const m = await db.ticketMessage.findFirst({ where: { id: messageId, organizationId: ctx.organization.id, deletedAt: null } });
  if (!m) throw new AppError("MESSAGE_NOT_FOUND", "Message not found", 404);
  await requireTicket(ctx, m.ticketId);
  if (m.authorId !== ctx.user.id || m.type === "SYSTEM" || Date.now() - m.createdAt.getTime() > EDIT_WINDOW_MS) throw new AppError("FORBIDDEN", "Messages can only be edited by their author within 30 minutes", 403);
  const clean = sanitizeHtml(bodyHtml);
  if (!stripHtml(clean)) throw new AppError("VALIDATION_ERROR", "Message cannot be empty", 422);
  await db.$transaction(async tx => {
    await tx.ticketMessage.update({ where: { id: m.id }, data: { bodyHtml: clean, editedAt: new Date() } });
    await recordActivity({ organizationId: m.organizationId, entityType: "ticket", entityId: m.ticketId, actorId: ctx.user.id, action: "ticket.message_edited", data: { messageId: m.id } }, tx);
  });
}

export async function deleteMessage(ctx: OrgContext, messageId: string) {
  const m = await db.ticketMessage.findFirst({ where: { id: messageId, organizationId: ctx.organization.id, deletedAt: null } });
  if (!m) throw new AppError("MESSAGE_NOT_FOUND", "Message not found", 404);
  await requireTicket(ctx, m.ticketId);
  const own = m.authorId === ctx.user.id && Date.now() - m.createdAt.getTime() <= EDIT_WINDOW_MS;
  if (!(own || ctx.can("tickets.delete")) || m.type === "SYSTEM") throw new AppError("FORBIDDEN", "You cannot delete this message", 403);
  await db.$transaction(async tx => {
    await tx.ticketMessage.update({ where: { id: m.id }, data: { deletedAt: new Date(), bodyHtml: "" } });
    await recordActivity({ organizationId: m.organizationId, entityType: "ticket", entityId: m.ticketId, actorId: ctx.user.id, action: "ticket.message_deleted", data: { messageId: m.id } }, tx);
    await writeAudit({ organizationId: m.organizationId, userId: ctx.user.id, action: "ticket.message_deleted", entityType: "ticket_message", entityId: m.id, before: { bodyHtml: m.bodyHtml } }, tx);
  });
}

export { afterCreate as _afterCreateForInbound };
