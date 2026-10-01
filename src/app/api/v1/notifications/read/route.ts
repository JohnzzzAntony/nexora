import { z } from "zod";
import { AppError } from "@/lib/api/errors";
import { getApiContext, handle, ok, parseBody } from "@/lib/api/handler";
import { markAllRead, markRead } from "@/server/notifications/service";

const bodySchema = z.object({
  ids: z.array(z.string().min(1).max(64)).max(200).optional(),
  all: z.boolean().optional(),
});

/** POST /api/v1/notifications/read — body `{ ids: string[] }` or `{ all: true }`. */
export const POST = handle(async req => {
  const ctx = await getApiContext(req);
  const body = await parseBody(req, bodySchema);
  if (!body.all && !body.ids?.length) throw new AppError("VALIDATION_ERROR", "Provide `ids` or `all: true`", 422);
  const updated = body.all ? await markAllRead(ctx) : await markRead(ctx, body.ids!);
  return ok({ updated });
});
