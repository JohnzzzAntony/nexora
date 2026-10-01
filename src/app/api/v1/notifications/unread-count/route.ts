import { getApiContext, handle, ok } from "@/lib/api/handler";
import { unreadCount } from "@/server/notifications/service";

export const dynamic = "force-dynamic";

/** GET /api/v1/notifications/unread-count — lightweight endpoint polled by the notification bell. */
export const GET = handle(async req => {
  const ctx = await getApiContext(req);
  return ok({ count: await unreadCount(ctx) }, { headers: { "Cache-Control": "no-store" } });
});
