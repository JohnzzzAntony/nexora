import { z } from "zod";
import { AppError } from "@/lib/api/errors";
import { getApiContext, handle, ok, parseQuery } from "@/lib/api/handler";
import { rateLimit } from "@/lib/rate-limit";
import { SEARCH_MAX_LENGTH } from "@/lib/search/types";
import { globalSearch } from "@/server/search/service";

export const dynamic = "force-dynamic";

const querySchema = z.object({ q: z.string().max(SEARCH_MAX_LENGTH * 2).default("") });

/** GET /api/v1/search?q= — permission-aware global search, max 5 hits per entity. */
export const GET = handle(async req => {
  const ctx = await getApiContext(req);
  const { q } = parseQuery(req, querySchema);
  const limited = await rateLimit(`search:${ctx.user.id}`, 120, 60);
  if (!limited.allowed) throw new AppError("RATE_LIMITED", "Too many searches. Please slow down.", 429);
  const result = await globalSearch(ctx, q);
  return ok(result, { headers: { "Cache-Control": "no-store" } });
});
