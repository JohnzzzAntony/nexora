"use server";
import { revalidatePath } from "next/cache";
import { withContext } from "@/lib/actions";
import { createTicket, updateTicket, addMessage } from "@/server/tickets/service";
import type { CreateTicketInput, UpdateTicketInput, AddMessageInput } from "@/schemas/ticket";
export async function createTicketAction(input: CreateTicketInput) {
  return withContext(async ctx => { const t = await createTicket(ctx, input, { source: ctx.isCustomer ? "PORTAL" : "WEB" }); revalidatePath("/tickets"); revalidatePath("/dashboard"); return { number: t.number }; });
}
export async function updateTicketAction(ref: string, input: UpdateTicketInput) {
  return withContext(async ctx => { await updateTicket(ctx, ref, input); revalidatePath("/tickets"); revalidatePath(`/tickets/${ref}`); revalidatePath(`/portal/tickets/${ref}`); return true; });
}
export async function replyAction(ref: string, input: AddMessageInput) {
  return withContext(async ctx => { await addMessage(ctx, ref, input); revalidatePath(`/tickets/${ref}`); revalidatePath(`/portal/tickets/${ref}`); return true; });
}
