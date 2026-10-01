"use server";
import { revalidatePath } from "next/cache";
import { withContext } from "@/lib/actions";
import { saveResource } from "@/server/work/resources";
export async function saveResourceAction(
  module: string,
  input: Record<string, unknown>,
  id?: string,
) {
  return withContext(async (ctx) => {
    const r = await saveResource(ctx, module, input, id);
    revalidatePath(`/${module}`);
    revalidatePath(`/settings/${module}`);
    revalidatePath("/dashboard");
    return r;
  });
}
