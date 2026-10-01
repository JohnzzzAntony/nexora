import { getApiContext, handle, ok } from "@/lib/api/handler";
import { getLookups } from "@/server/lookups/service";

export const GET = handle(async req => ok(await getLookups(await getApiContext(req))));
