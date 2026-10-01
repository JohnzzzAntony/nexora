import { z } from "zod";
import { getApiContext, handle, ok, parseQuery } from "@/lib/api/handler";
import { AppError } from "@/lib/api/errors";
import { searchMembers } from "@/server/lookups/service";

// GET /api/v1/users?q=&agents=1&ids=a,b  — member search for pickers and API clients.
export const GET = handle(async req => {
  const ctx = await getApiContext(req);
  if (ctx.isCustomer) throw new AppError("FORBIDDEN", "Not allowed", 403);
  const query = parseQuery(req, z.object({ q: z.string().max(100).optional(), agents: z.string().optional(), ids: z.string().max(2000).optional(), take: z.coerce.number().int().min(1).max(50).optional() }));
  return ok(await searchMembers(ctx, { q: query.q, agents: query.agents === "1", ids: query.ids?.split(",").filter(Boolean), take: query.take }));
});
