import "server-only";
import type { SlaMetric, SlaState, SlaEventType, Prisma } from "@prisma/client";
import { db, type Tx } from "@/lib/db";
import { addBusinessMinutes, businessMinutesBetween, ALWAYS_OPEN, type BusinessCalendar } from "@/lib/sla/business-time";

// SLA model: due dates are always derived as
//   due = addBusinessMinutes(ticket.createdAt, targetMinutes + slaPausedMinutes)
// so priority changes, pauses and resumes all recompute from one formula.

type SlaTicket = {
  id: string; organizationId: string; createdAt: Date; priorityId: string; categoryId: string | null; subcategoryId: string | null; teamId: string | null;
  slaPolicyId: string | null; slaPausedAt: Date | null; slaPausedMinutes: number; firstRespondedAt: Date | null; resolvedAt: Date | null;
  firstResponseDueAt: Date | null; resolutionDueAt: Date | null; slaState: SlaState;
};

const SLA_SELECT = {
  id: true, organizationId: true, createdAt: true, priorityId: true, categoryId: true, subcategoryId: true, teamId: true, slaPolicyId: true, slaPausedAt: true,
  slaPausedMinutes: true, firstRespondedAt: true, resolvedAt: true, firstResponseDueAt: true, resolutionDueAt: true, slaState: true,
} satisfies Prisma.TicketSelect;

export async function loadCalendar(organizationId: string, businessHoursId: string | null | undefined, tx: Tx = db): Promise<BusinessCalendar> {
  const hours = businessHoursId
    ? await tx.businessHours.findFirst({ where: { id: businessHoursId, organizationId }, include: { periods: true } })
    : await tx.businessHours.findFirst({ where: { organizationId, isDefault: true }, include: { periods: true } });
  if (!hours || !hours.periods.length) {
    const org = await tx.organization.findUnique({ where: { id: organizationId }, select: { timezone: true } });
    return { ...ALWAYS_OPEN, timezone: hours?.timezone ?? org?.timezone ?? "UTC" };
  }
  const holidays = await tx.holiday.findMany({ where: { organizationId, isActive: true, OR: [{ businessHoursId: null }, { businessHoursId: hours.id }] }, select: { date: true, recurring: true } });
  return {
    timezone: hours.timezone,
    periods: hours.periods.map(p => ({ dayOfWeek: p.dayOfWeek, startMinute: p.startMinute, endMinute: p.endMinute })),
    holidays: holidays.map(h => ({ date: h.date.toISOString().slice(0, 10), recurring: h.recurring })),
  };
}

/** Policy precedence: explicit ticket policy → subcategory → category → team → org default. */
async function resolvePolicy(t: SlaTicket, tx: Tx) {
  const candidates: (string | null | undefined)[] = [t.slaPolicyId];
  const catIds = [t.subcategoryId, t.categoryId].filter(Boolean) as string[];
  if (catIds.length) {
    const cats = await tx.ticketCategory.findMany({ where: { id: { in: catIds } }, select: { id: true, slaPolicyId: true } });
    for (const id of catIds) candidates.push(cats.find(c => c.id === id)?.slaPolicyId);
  }
  if (t.teamId) candidates.push((await tx.team.findUnique({ where: { id: t.teamId }, select: { slaPolicyId: true } }))?.slaPolicyId);
  for (const id of candidates) {
    if (!id) continue;
    const p = await tx.sLAPolicy.findFirst({ where: { id, organizationId: t.organizationId, isActive: true }, include: { targets: true } });
    if (p) return p;
  }
  return tx.sLAPolicy.findFirst({ where: { organizationId: t.organizationId, isDefault: true, isActive: true }, include: { targets: true } });
}

async function event(tx: Tx, t: { id: string; organizationId: string }, type: SlaEventType, metric: SlaMetric | null, data?: Prisma.InputJsonValue, occurrence = 0) {
  // Unique (ticket, type, metric, occurrence): replays are ignored, making jobs idempotent.
  const existing = await tx.sLAEvent.findFirst({ where: { ticketId: t.id, type, metric, occurrence }, select: { id: true } });
  if (existing) return false;
  await tx.sLAEvent.create({ data: { organizationId: t.organizationId, ticketId: t.id, type, metric, occurrence, data } });
  return true;
}

export function deriveState(t: Pick<SlaTicket, "slaPausedAt" | "firstRespondedAt" | "resolvedAt" | "firstResponseDueAt" | "resolutionDueAt">, now: Date, warningAt?: { response?: Date | null; resolution?: Date | null }): SlaState {
  if (!t.firstResponseDueAt && !t.resolutionDueAt) return "NONE";
  if (t.resolvedAt) return (t.resolutionDueAt && t.resolvedAt > t.resolutionDueAt) || (t.firstResponseDueAt && t.firstRespondedAt && t.firstRespondedAt > t.firstResponseDueAt) ? "BREACHED" : "MET";
  const responseOpen = !t.firstRespondedAt && t.firstResponseDueAt;
  const responseLate = t.firstRespondedAt && t.firstResponseDueAt && t.firstRespondedAt > t.firstResponseDueAt;
  if (responseLate) return "BREACHED";
  if (t.slaPausedAt) return "PAUSED";
  if ((responseOpen && t.firstResponseDueAt! <= now) || (t.resolutionDueAt && t.resolutionDueAt <= now)) return "BREACHED";
  if ((responseOpen && warningAt?.response && warningAt.response <= now) || (warningAt?.resolution && warningAt.resolution <= now)) return "WARNING";
  return "OK";
}

/** (Re)computes due dates from the ticket's policy and priority. Safe to call after any change. */
export async function applySla(ticketId: string, tx: Tx = db, opts: { initial?: boolean } = {}) {
  const t = await tx.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: SLA_SELECT });
  const policy = await resolvePolicy(t, tx);
  const target = policy?.targets.find(x => x.priorityId === t.priorityId);
  if (!policy || !target) {
    await tx.ticket.update({ where: { id: t.id }, data: { slaState: "NONE", firstResponseDueAt: null, resolutionDueAt: null, slaPolicyId: t.slaPolicyId } });
    return;
  }
  const cal = await loadCalendar(t.organizationId, policy.businessHoursId, tx);
  const firstResponseDueAt = addBusinessMinutes(t.createdAt, target.firstResponseMinutes + t.slaPausedMinutes, cal);
  const resolutionDueAt = addBusinessMinutes(t.createdAt, target.resolutionMinutes + t.slaPausedMinutes, cal);
  const next = { ...t, firstResponseDueAt, resolutionDueAt };
  await tx.ticket.update({ where: { id: t.id }, data: { firstResponseDueAt, resolutionDueAt, slaState: deriveState(next, new Date()) } });
  if (opts.initial) await event(tx, t, "APPLIED", null, { policyId: policy.id, policy: policy.name, firstResponseDueAt: firstResponseDueAt.toISOString(), resolutionDueAt: resolutionDueAt.toISOString() });
}

/** Handles pause/resume and resolution bookkeeping when a ticket's status changes. */
export async function onStatusChange(ticketId: string, status: { pausesSla: boolean; category: string }, tx: Tx = db) {
  const t = await tx.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: SLA_SELECT });
  const now = new Date();
  const resolved = status.category === "RESOLVED" || status.category === "CLOSED";
  const data: Prisma.TicketUpdateInput = {};
  if (resolved && !t.resolvedAt) data.resolvedAt = now;
  if (!resolved && t.resolvedAt) data.resolvedAt = null;
  const pausedNow = status.pausesSla && !resolved;
  let recompute = false;
  if (pausedNow && !t.slaPausedAt) {
    data.slaPausedAt = now;
    await event(tx, t, "PAUSED", null, undefined, await tx.sLAEvent.count({ where: { ticketId, type: "PAUSED" } }));
  } else if (!pausedNow && t.slaPausedAt) {
    const policy = await resolvePolicy(t, tx);
    const cal = await loadCalendar(t.organizationId, policy?.businessHoursId, tx);
    data.slaPausedAt = null;
    data.slaPausedMinutes = t.slaPausedMinutes + businessMinutesBetween(t.slaPausedAt, now, cal);
    recompute = true;
    await event(tx, t, "RESUMED", null, undefined, await tx.sLAEvent.count({ where: { ticketId, type: "RESUMED" } }));
  }
  await tx.ticket.update({ where: { id: ticketId }, data });
  if (recompute) await applySla(ticketId, tx);
  const fresh = await tx.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: SLA_SELECT });
  if (resolved && fresh.resolutionDueAt && fresh.resolvedAt && fresh.resolvedAt <= fresh.resolutionDueAt) await event(tx, fresh, "MET", "RESOLUTION");
  await tx.ticket.update({ where: { id: ticketId }, data: { slaState: deriveState(fresh, now) } });
}

/** Records the first public agent response. */
export async function onFirstResponse(ticketId: string, tx: Tx = db) {
  const t = await tx.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: SLA_SELECT });
  if (t.firstRespondedAt) return;
  const now = new Date();
  await tx.ticket.update({ where: { id: ticketId }, data: { firstRespondedAt: now, slaState: deriveState({ ...t, firstRespondedAt: now }, now) } });
  if (t.firstResponseDueAt && now <= t.firstResponseDueAt) await event(tx, t, "MET", "RESPONSE");
}

export type SlaAlert = { ticketId: string; organizationId: string; type: "WARNING" | "BREACHED"; metric: SlaMetric; escalateToUserId: string | null; escalateToTeamId: string | null };

/**
 * Scheduled monitor: detects approaching and breached targets for all tenants.
 * Idempotent — each (ticket, type, metric) alert is recorded once in SLAEvent.
 */
export async function monitorSla(now = new Date(), batch = 500): Promise<SlaAlert[]> {
  const horizon = new Date(now.getTime() + 7 * 24 * 3600_000);
  const tickets = await db.ticket.findMany({
    where: {
      slaState: { in: ["OK", "WARNING", "BREACHED"] }, slaPausedAt: null, resolvedAt: null, mergedIntoId: null,
      slaEvents: { none: { type: "BREACHED", metric: "RESOLUTION" } },
      OR: [{ firstRespondedAt: null, firstResponseDueAt: { lte: horizon } }, { resolutionDueAt: { lte: horizon } }],
    },
    select: SLA_SELECT,
    take: batch,
    orderBy: { resolutionDueAt: "asc" },
  });
  const alerts: SlaAlert[] = [];
  for (const t of tickets) {
    const policy = await resolvePolicy(t, db);
    const target = policy?.targets.find(x => x.priorityId === t.priorityId);
    if (!policy || !target) continue;
    const cal = await loadCalendar(t.organizationId, policy.businessHoursId, db);
    const warnMinutes = (m: number) => Math.floor((m * target.warningPercent) / 100) + t.slaPausedMinutes;
    const warningAt = {
      response: addBusinessMinutes(t.createdAt, warnMinutes(target.firstResponseMinutes), cal),
      resolution: addBusinessMinutes(t.createdAt, warnMinutes(target.resolutionMinutes), cal),
    };
    const checks: [SlaMetric, Date | null, Date, boolean][] = [
      ["RESPONSE", t.firstResponseDueAt, warningAt.response, !t.firstRespondedAt],
      ["RESOLUTION", t.resolutionDueAt, warningAt.resolution, true],
    ];
    for (const [metric, due, warnAt, active] of checks) {
      if (!active || !due) continue;
      const type: "WARNING" | "BREACHED" | null = due <= now ? "BREACHED" : warnAt <= now ? "WARNING" : null;
      if (!type) continue;
      const created = await db.$transaction(async tx => {
        const isNew = await event(tx, t, type, metric, { due: due.toISOString() });
        if (isNew && type === "BREACHED" && (policy.escalateToUserId || policy.escalateToTeamId)) await event(tx, t, "ESCALATED", metric, { userId: policy.escalateToUserId, teamId: policy.escalateToTeamId });
        return isNew;
      });
      if (created) alerts.push({ ticketId: t.id, organizationId: t.organizationId, type, metric, escalateToUserId: policy.escalateToUserId, escalateToTeamId: policy.escalateToTeamId });
    }
    const state = deriveState(t, now, warningAt);
    if (state !== t.slaState) await db.ticket.update({ where: { id: t.id }, data: { slaState: state } });
  }
  return alerts;
}
