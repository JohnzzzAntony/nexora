import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { textToHtml, sanitizeHtml, stripHtml } from "@/lib/sanitize";
import { loadContext } from "@/lib/tenancy/load";
import { putObject, storageKey } from "@/lib/storage";
import { validateUpload } from "@/lib/storage/policy";
import { features } from "@/lib/env";
import { hashPassword } from "@/lib/auth/password";
import { randomToken } from "@/lib/crypto";
import { addMessage, createTicket } from "@/server/tickets/service";

// Provider-neutral inbound payload. Adapters (Resend inbound, Postmark, SendGrid Parse, Mailgun)
// map their webhook body into this shape in the route handler.
export const inboundEmailSchema = z.object({
  messageId: z.string().min(3).max(500),
  from: z.object({ email: z.email(), name: z.string().max(200).optional() }),
  to: z.array(z.string()).default([]),
  subject: z.string().max(500).default("(no subject)"),
  text: z.string().max(200_000).optional(),
  html: z.string().max(500_000).optional(),
  inReplyTo: z.string().max(1000).optional(),
  references: z.string().max(5000).optional(),
  attachments: z.array(z.object({ filename: z.string(), contentType: z.string(), contentBase64: z.string() })).max(10).default([]),
});
export type InboundEmail = z.infer<typeof inboundEmailSchema>;

const TICKET_ID_IN_HEADER = /ticket-([a-z0-9]{20,40})[.@]/i;
const TICKET_NUMBER_IN_SUBJECT = /\[#(\d{1,10})\]/;

/** Strips quoted history so replies append only the new text. */
function newContent(mail: InboundEmail) {
  const text = mail.text ?? stripHtml(mail.html ?? "");
  const cut = text.search(/^(On .+ wrote:|-{2,}\s*Original Message|From: .+)$/m);
  const body = (cut > 0 ? text.slice(0, cut) : text).replace(/^>.*$/gm, "").trim();
  return body ? textToHtml(body) : mail.html ? sanitizeHtml(mail.html) : "<p>(empty message)</p>";
}

/**
 * Creates a ticket or appends a reply. Organization comes from the verified inbound token (never
 * from message headers); sender must be an active member or known customer contact unless the
 * organization allows customer signup. Idempotent per (organization, Message-ID).
 */
export async function processInboundEmail(organizationId: string, mail: InboundEmail) {
  const existing = await db.inboundEmail.findUnique({ where: { organizationId_messageId: { organizationId, messageId: mail.messageId } } });
  if (existing) return { status: "duplicate" as const, ticketId: existing.ticketId };
  const log = await db.inboundEmail.create({ data: { organizationId, messageId: mail.messageId, fromEmail: mail.from.email.toLowerCase(), subject: mail.subject.slice(0, 500), status: "processing" } });
  const finish = (status: string, ticketId?: string, error?: string) => db.inboundEmail.update({ where: { id: log.id }, data: { status, ticketId, error } });
  try {
    const email = mail.from.email.toLowerCase();
    const settings = await db.organizationSettings.findUnique({ where: { organizationId } });
    let user = await db.user.findUnique({ where: { email } });
    let membership = user ? await db.membership.findUnique({ where: { organizationId_userId: { organizationId, userId: user.id } } }) : null;
    if (!membership || membership.status !== "ACTIVE") {
      const contact = await db.customerContact.findFirst({ where: { email, customer: { organizationId } }, select: { customerId: true } });
      if (!contact && !settings?.allowCustomerSignup) { await finish("rejected", undefined, "Unknown sender"); return { status: "rejected" as const }; }
      if (membership && membership.status !== "ACTIVE") { await finish("rejected", undefined, "Sender membership is deactivated"); return { status: "rejected" as const }; }
      const role = await db.role.findUniqueOrThrow({ where: { organizationId_key: { organizationId, key: "customer" } } });
      user ??= await db.user.create({ data: { email, name: mail.from.name?.slice(0, 120) || email.split("@")[0], passwordHash: await hashPassword(randomToken()) } });
      membership = await db.membership.create({ data: { organizationId, userId: user.id, roleId: role.id, customerId: contact?.customerId ?? null } });
    }
    const ctx = await loadContext(user!.id, organizationId);
    if (!ctx) { await finish("rejected", undefined, "Sender has no access"); return { status: "rejected" as const }; }

    // Thread detection: our Message-ID in In-Reply-To/References, else "[#number]" in subject.
    const headerMatch = `${mail.inReplyTo ?? ""} ${mail.references ?? ""}`.match(TICKET_ID_IN_HEADER);
    const subjectMatch = mail.subject.match(TICKET_NUMBER_IN_SUBJECT);
    const thread = headerMatch
      ? await db.ticket.findFirst({ where: { id: headerMatch[1], organizationId } })
      : subjectMatch ? await db.ticket.findFirst({ where: { number: Number(subjectMatch[1]), organizationId } }) : null;

    const attachmentIds: string[] = [];
    if (features.storage) {
      for (const f of mail.attachments) {
        const buf = Buffer.from(f.contentBase64, "base64");
        if (validateUpload({ filename: f.filename, mimeType: f.contentType, size: buf.length }, { maxMb: settings?.maxUploadMb ?? 10, allowZip: settings?.allowZipUploads ?? false })) continue;
        const key = storageKey(organizationId, f.filename);
        await putObject(key, buf, f.contentType);
        attachmentIds.push((await db.attachment.create({ data: { organizationId, storageKey: key, filename: f.filename, mimeType: f.contentType, size: buf.length, uploadedById: user!.id } })).id);
      }
    }

    if (thread) {
      try {
        await addMessage(ctx, thread.id, { type: "PUBLIC", bodyHtml: newContent(mail), attachmentIds });
        await finish("replied", thread.id);
        return { status: "replied" as const, ticketId: thread.id };
      } catch {
        // Not visible to this sender or closed: fall through and open a new ticket.
      }
    }
    const cleanSubject = mail.subject.replace(TICKET_NUMBER_IN_SUBJECT, "").trim().slice(0, 200);
    const ticket = await createTicket(ctx, { subject: cleanSubject.length >= 3 ? cleanSubject : `Email: ${cleanSubject || "(no subject)"}`, description: newContent(mail), attachmentIds }, { source: "EMAIL" });
    await db.ticket.update({ where: { id: ticket.id }, data: { emailThreadKey: mail.messageId } });
    await finish("created", ticket.id);
    return { status: "created" as const, ticketId: ticket.id };
  } catch (error) {
    await finish("failed", undefined, (error as Error).message.slice(0, 500));
    throw error;
  }
}
