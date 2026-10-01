import "server-only";
import nodemailer from "nodemailer";
import { after } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { EMAIL_TEMPLATES, htmlToText, renderString, wrapLayout, type EmailTemplateKey } from "@/lib/email/templates";

const MAX_ATTEMPTS = 5;

export type EmailRequest = {
  to: string;
  template: EmailTemplateKey;
  data: Record<string, unknown>;
  organizationId?: string | null;
  entityType?: string;
  entityId?: string;
  /** Extra headers, e.g. Message-ID / In-Reply-To for ticket threading and Reply-To for inbound routing. */
  headers?: Record<string, string>;
};

async function render(req: EmailRequest) {
  const base = EMAIL_TEMPLATES[req.template];
  const [override, org] = req.organizationId
    ? await Promise.all([
        base.editable ? db.emailTemplate.findUnique({ where: { organizationId_key: { organizationId: req.organizationId, key: req.template } } }) : null,
        db.organization.findUnique({ where: { id: req.organizationId }, select: { name: true } }),
      ])
    : [null, null];
  const subjectTpl = override?.isActive ? override.subject : base.subject;
  const bodyTpl = override?.isActive ? override.bodyHtml : base.body;
  const data = { organization: org?.name, ...req.data };
  const inner = renderString(bodyTpl, data, true);
  const html = wrapLayout(inner, org?.name);
  return { subject: renderString(subjectTpl, data, false).slice(0, 250), html, text: htmlToText(inner) };
}

/**
 * Persists the email in the outbox (EmailLog) and schedules delivery after the response.
 * Never throws for delivery problems: failures are retried by the job runner.
 */
export async function sendEmail(req: EmailRequest) {
  const { subject, html, text } = await render(req);
  const log = await db.emailLog.create({
    data: {
      organizationId: req.organizationId ?? null, to: req.to, templateKey: req.template, subject, html, text,
      headers: req.headers ?? undefined, entityType: req.entityType, entityId: req.entityId,
    },
  });
  try {
    after(() => deliver(log.id).catch(e => console.error("[email] deliver failed", e)));
  } catch {
    // Outside a request scope (jobs, scripts): deliver inline.
    await deliver(log.id).catch(e => console.error("[email] deliver failed", e));
  }
  return log.id;
}

type Outgoing = { to: string; subject: string; html: string; text: string | null; headers: Record<string, string> };

async function sendViaResend(mail: Outgoing) {
  const { "Reply-To": replyTo, ...headers } = mail.headers;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.emailFrom, to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text ?? undefined, reply_to: replyTo, headers }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(body as { message?: string }).message ?? "request failed"}`);
  return (body as { id?: string }).id ?? null;
}

let transport: nodemailer.Transporter | null = null;
async function sendViaSmtp(mail: Outgoing) {
  transport ??= nodemailer.createTransport({ host: env.smtp.host, port: env.smtp.port, secure: env.smtp.port === 465, auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.password } : undefined });
  const { "Reply-To": replyTo, ...headers } = mail.headers;
  const info = await transport.sendMail({ from: env.emailFrom, to: mail.to, subject: mail.subject, html: mail.html, text: mail.text ?? undefined, replyTo, headers });
  return info.messageId ?? null;
}

/** Attempts one delivery of an outbox row; schedules exponential-backoff retry on failure. */
export async function deliver(id: string) {
  // Claim the row so concurrent runners do not double-send.
  const claimed = await db.emailLog.updateMany({ where: { id, status: "PENDING", nextAttemptAt: { lte: new Date() } }, data: { nextAttemptAt: new Date(Date.now() + 5 * 60_000), attempts: { increment: 1 } } });
  if (!claimed.count) return;
  const log = await db.emailLog.findUniqueOrThrow({ where: { id } });
  const mail: Outgoing = { to: log.to, subject: log.subject, html: log.html, text: log.text, headers: (log.headers as Record<string, string>) ?? {} };
  const provider = env.resendKey ? "resend" : env.smtp.host ? "smtp" : env.isProduction ? null : "dev-log";
  try {
    if (!provider) throw new Error("No email provider configured (set RESEND_API_KEY or SMTP_HOST)");
    let providerId: string | null = null;
    if (provider === "resend") providerId = await sendViaResend(mail);
    else if (provider === "smtp") providerId = await sendViaSmtp(mail);
    else console.info(`[email:dev-log] to=${mail.to} subject="${mail.subject}"\n${log.text?.slice(0, 500)}`);
    await db.emailLog.update({ where: { id }, data: { status: "SENT", provider, providerId, sentAt: new Date(), error: null } });
  } catch (error) {
    const final = log.attempts >= MAX_ATTEMPTS;
    await db.emailLog.update({
      where: { id },
      data: { provider, status: final ? "FAILED" : "PENDING", error: String((error as Error).message).slice(0, 1000), nextAttemptAt: new Date(Date.now() + 2 ** log.attempts * 60_000) },
    });
  }
}

export async function processEmailOutbox(limit = 50) {
  const due = await db.emailLog.findMany({ where: { status: "PENDING", nextAttemptAt: { lte: new Date() } }, select: { id: true }, orderBy: { nextAttemptAt: "asc" }, take: limit });
  for (const row of due) await deliver(row.id);
  return due.length;
}
