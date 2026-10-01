import { z } from "zod";
import { getApiContext, handle, ok, parseQuery } from "@/lib/api/handler";
import { listNotifications } from "@/server/notifications/service";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  unread: z.enum(["1", "0", "true", "false"]).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

/** GET /api/v1/notifications?unread=1&cursor=...&limit=20 — current user's notifications in the active org. */
export const GET = handle(async req => {
  const ctx = await getApiContext(req);
  const q = parseQuery(req, querySchema);
  const page = await listNotifications(ctx, {
    unreadOnly: q.unread === "1" || q.unread === "true",
    cursor: q.cursor || null,
    limit: q.limit,
  });
  return ok(page.items, { meta: { nextCursor: page.nextCursor } });
});
