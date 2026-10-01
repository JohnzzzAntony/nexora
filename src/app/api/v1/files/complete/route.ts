import { z } from "zod";
import { getApiContext, handle, ok, parseBody } from "@/lib/api/handler";
import { completeUpload } from "@/server/files/service";

export const POST = handle(async req => {
  const ctx = await getApiContext(req);
  const { token } = await parseBody(req, z.object({ token: z.string().min(10) }));
  const a = await completeUpload(ctx, token);
  return ok({ id: a.id, filename: a.filename, mimeType: a.mimeType, size: a.size, url: `/api/files/${a.id}` }, { status: 201 });
});
