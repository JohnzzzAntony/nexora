"use server";
import { withContext } from "@/lib/actions";
import { workTool } from "@/server/work/tools";
import { revalidatePath } from "next/cache";
export async function toolAction(
  module: string,
  id: string,
  input: Record<string, unknown>,
) {
  return withContext(async (ctx) => {
    await workTool(ctx, module, id, input);
    revalidatePath(`/${module}`);
    revalidatePath(`/${module}/${id}`);
    return true;
  });
}
