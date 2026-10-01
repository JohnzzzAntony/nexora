import { getApiContext, handle, ok, parseBody } from "@/lib/api/handler";
import { createTicket } from "@/server/tickets/service";
import { ticketVisibilityWhere } from "@/server/tickets/access";
import { createTicketSchema } from "@/schemas/ticket";
import { db } from "@/lib/db";
export const GET = handle(async req => { const ctx = await getApiContext(req); const page = Math.max(1, Math.min(10000, Number(req.nextUrl.searchParams.get("page")) || 1)); const where = await ticketVisibilityWhere(ctx); const [items, total] = await Promise.all([db.ticket.findMany({ where, include: { status: true, priority: true }, orderBy: { updatedAt: "desc" }, take: 25, skip: (page - 1) * 25 }), db.ticket.count({ where })]); return ok({ items, total, page }); });
export const POST = handle(async req => ok(await createTicket(await getApiContext(req), await parseBody(req, createTicketSchema), { source: "API" }), { status: 201 }));
