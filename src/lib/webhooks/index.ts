import "server-only";
import { randomUUID } from "node:crypto";
import { after } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { decryptSecret, hmacSha256 } from "@/lib/crypto";
import { assertPublicUrl } from "@/lib/webhooks/url-safety";

export const WEBHOOK_EVENTS = [
  "ticket.created", "ticket.updated", "ticket.assigned", "ticket.closed",
  "task.created", "task.completed", "user.created", "sla.breached",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

const BACKOFF_MINUTES = [1, 5, 30, 120, 720, 1440];

function schedule(task: () => Promise<unknown>) {
  try {
    after(() => task().catch(e => console.error("[webhooks] async task failed", e)));
  } catch {
    void task().catch(e => console.error("[webhooks] task failed", e));
  }
}

/**
 * Records one delivery per subscribed webhook (idempotent per event id) and forwards a
 * human-readable message to connected chat integrations. Delivery happens after the response.
 */
export async function emitEvent(organizationId: string, event: WebhookEvent, data: Record<string, unknown>, summary?: { title: string; url?: string }) {
  const eventId = randomUUID();
  const payload = { id: eventId, event, organizationId, createdAt: new Date().toISOString(), data } as Prisma.InputJsonValue;
  const hooks = await db.webhook.findMany({ where: { organizationId, isActive: true, events: { has: event } }, select: { id: true } });
  if (hooks.length) {
    await db.webhookDelivery.createMany({ data: hooks.map(h => ({ webhookId: h.id, eventId, event, payload })), skipDuplicates: true });
    const rows = await db.webhookDelivery.findMany({ where: { eventId }, select: { id: true } });
    schedule(async () => { for (const r of rows) await deliverWebhook(r.id); });
  }
  if (summary) schedule(() => postToChatIntegrations(organizationId, event, summary));
}

export function signPayload(secret: string, timestamp: number, body: string) {
  return `t=${timestamp},v1=${hmacSha256(secret, `${timestamp}.${body}`)}`;
}

export async function deliverWebhook(deliveryId: string) {
  const claimed = await db.webhookDelivery.updateMany({
    where: { id: deliveryId, status: "PENDING", nextAttemptAt: { lte: new Date() } },
    data: { attempts: { increment: 1 }, nextAttemptAt: new Date(Date.now() + 10 * 60_000) },
  });
  if (!claimed.count) return;
  const d = await db.webhookDelivery.findUniqueOrThrow({ where: { id: deliveryId }, include: { webhook: true } });
  const body = JSON.stringify(d.payload);
  const timestamp = Math.floor(Date.now() / 1000);
  let status: number | null = null;
  let responseBody: string | null = null;
  let error: string | null = null;
  try {
    await assertPublicUrl(d.webhook.url);
    const res = await fetch(d.webhook.url, {
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Duoonex-Webhooks/1.0",
        "X-Duoonex-Event": d.event,
        "X-Duoonex-Delivery": d.id,
        "X-Duoonex-Signature": signPayload(decryptSecret(d.webhook.secretEnc), timestamp, body),
      },
      body,
    });
    status = res.status;
    responseBody = (await res.text().catch(() => "")).slice(0, 2000);
    if (!res.ok) error = `HTTP ${res.status}`;
  } catch (e) {
    error = (e as Error).message.slice(0, 500);
  }
  const final = d.attempts >= Math.min(d.webhook.maxRetries + 1, BACKOFF_MINUTES.length + 1);
  await db.webhookDelivery.update({
    where: { id: d.id },
    data: error
      ? { status: final ? "FAILED" : "PENDING", responseStatus: status, responseBody, error, nextAttemptAt: new Date(Date.now() + BACKOFF_MINUTES[Math.min(d.attempts - 1, BACKOFF_MINUTES.length - 1)] * 60_000) }
      : { status: "SENT", responseStatus: status, responseBody, error: null, deliveredAt: new Date() },
  });
}

export async function processWebhookQueue(limit = 50) {
  const due = await db.webhookDelivery.findMany({ where: { status: "PENDING", nextAttemptAt: { lte: new Date() } }, select: { id: true }, orderBy: { nextAttemptAt: "asc" }, take: limit });
  for (const row of due) await deliverWebhook(row.id);
  return due.length;
}

/** Slack / Microsoft Teams incoming-webhook integrations. */
export async function postChatMessage(type: "SLACK" | "MICROSOFT_TEAMS", webhookUrl: string, text: string, link?: string) {
  await assertPublicUrl(webhookUrl);
  const full = link ? `${text}\n${link}` : text;
  const body = type === "SLACK" ? { text: link ? `${text}\n<${link}|Open in Duoonex>` : text } : { text: full };
  const res = await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`${type} responded ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
}

async function postToChatIntegrations(organizationId: string, event: string, summary: { title: string; url?: string }) {
  const integrations = await db.integration.findMany({ where: { organizationId, isActive: true, type: { in: ["SLACK", "MICROSOFT_TEAMS"] } } });
  for (const integration of integrations) {
    const events = ((integration.config as { events?: string[] }).events ?? []) as string[];
    if (!events.includes(event) || !integration.secretEnc) continue;
    try {
      await postChatMessage(integration.type as "SLACK" | "MICROSOFT_TEAMS", decryptSecret(integration.secretEnc), summary.title, summary.url ? `${env.appUrl}${summary.url}` : undefined);
      await db.integrationLog.create({ data: { integrationId: integration.id, action: event, success: true } });
    } catch (e) {
      const message = (e as Error).message.slice(0, 500);
      await db.$transaction([
        db.integrationLog.create({ data: { integrationId: integration.id, action: event, success: false, message } }),
        db.integration.update({ where: { id: integration.id }, data: { lastError: message } }),
      ]);
    }
  }
}
