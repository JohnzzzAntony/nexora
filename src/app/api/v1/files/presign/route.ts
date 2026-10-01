import { getApiContext, handle, ok, parseBody } from "@/lib/api/handler";
import { requestUpload, requestUploadSchema } from "@/server/files/service";

export const POST = handle(async req => {
  const ctx = await getApiContext(req);
  return ok(await requestUpload(ctx, await parseBody(req, requestUploadSchema)));
});
