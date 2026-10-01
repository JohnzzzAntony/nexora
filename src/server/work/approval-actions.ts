"use server";
import { revalidatePath } from "next/cache";
import { withContext } from "@/lib/actions";
import { requestApproval, decideApproval } from "@/server/work/approvals";
export async function approvalAction(
  input: Record<string, unknown>,
  id?: string,
) {
  return withContext(async (ctx) => {
    if (id) await decideApproval(ctx, id, input);
    else await requestApproval(ctx, input);
    revalidatePath("/approvals");
    return true;
  });
}
