import { getApiContext, handle, ok, parseBody } from "@/lib/api/handler";
import { requireTicket, canSeeInternal } from "@/server/tickets/access";
import { updateTicket } from "@/server/tickets/service";
import { updateTicketSchema } from "@/schemas/ticket";
import { db } from "@/lib/db";
export const GET = handle<{ ref: string }>(async (req, { params }) => { const ctx = await getApiContext(req); const t = await requireTicket(ctx, (await params).ref); const messages = await db.ticketMessage.findMany({ where: { ticketId: t.id, ...(canSeeInternal(ctx) ? {} : { type: "PUBLIC" }) }, orderBy: { createdAt: "asc" } }); return ok({ ...t, messages }); });
export const PATCH = handle<{ ref: string }>(async (req, { params }) => ok(await updateTicket(await getApiContext(req), (await params).ref, await parseBody(req, updateTicketSchema))));
