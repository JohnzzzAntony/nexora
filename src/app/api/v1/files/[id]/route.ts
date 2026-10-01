import { getApiContext, handle, ok } from "@/lib/api/handler";
import { deleteAttachment } from "@/server/files/service";

export const DELETE = handle<{ id: string }>(async (req, { params }) => {
  const ctx = await getApiContext(req);
  await deleteAttachment(ctx, (await params).id);
  return ok({ deleted: true });
});
