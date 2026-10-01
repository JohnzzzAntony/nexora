import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { AppError } from "@/lib/api/errors";
import { handle, ok } from "@/lib/api/handler";
import { rateLimit } from "@/lib/rate-limit";
import { inboundEmailSchema, processInboundEmail, type InboundEmail } from "@/server/inbound/email";

export const maxDuration = 60;

// POST /api/inbound/email?token=<organization inbound token>
// Auth: header "x-inbound-secret: $INBOUND_EMAIL_SECRET" (configure in your email provider's
// inbound webhook). Accepts the generic JSON shape or Postmark's inbound format.
function fromPostmark(body: Record<string, any>): InboundEmail {
  const header = (name: string) => (body.Headers as { Name: string; Value: string }[] | undefined)?.find(h => h.Name.toLowerCase() === name)?.Value;
  return inboundEmailSchema.parse({
    messageId: header("message-id") ?? body.MessageID,
    from: { email: body.FromFull?.Email ?? body.From, name: body.FromFull?.Name },
    to: (body.ToFull as { Email: string }[] | undefined)?.map(t => t.Email) ?? [],
    subject: body.Subject ?? "",
    text: body.TextBody, html: body.HtmlBody,
    inReplyTo: header("in-reply-to"), references: header("references"),
    attachments: ((body.Attachments ?? []) as { Name: string; ContentType: string; Content: string }[]).map(a => ({ filename: a.Name, contentType: a.ContentType, contentBase64: a.Content })),
  });
}

export const POST = handle(async (req: NextRequest) => {
  const secret = req.headers.get("x-inbound-secret") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/, "") ?? "";
  if (!env.inboundSecret || !safeEqual(secret, env.inboundSecret)) throw new AppError("UNAUTHORIZED", "Invalid inbound secret", 401);
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const settings = token ? await db.organizationSettings.findUnique({ where: { inboundEmailToken: token }, select: { organizationId: true } }) : null;
  if (!settings) throw new AppError("UNKNOWN_MAILBOX", "Unknown inbound mailbox", 404);
  if (!(await rateLimit(`inbound:${settings.organizationId}`, 300, 3600)).allowed) throw new AppError("RATE_LIMITED", "Too many inbound emails", 429);
  const body = await req.json();
  const mail = "FromFull" in body || "MessageID" in body ? fromPostmark(body) : inboundEmailSchema.parse(body);
  return ok(await processInboundEmail(settings.organizationId, mail));
});
