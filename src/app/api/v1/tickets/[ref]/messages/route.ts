import { getApiContext, handle, ok, parseBody } from "@/lib/api/handler";
import { addMessage } from "@/server/tickets/service";
import { addMessageSchema } from "@/schemas/ticket";
export const POST = handle<{ ref: string }>(async (req, { params }) => ok(await addMessage(await getApiContext(req), (await params).ref, await parseBody(req, addMessageSchema)), { status: 201 }));
