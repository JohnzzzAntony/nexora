"use server";
import { revalidatePath } from "next/cache";
import { withContext } from "@/lib/actions";
import { saveSettings, controlSetting } from "@/server/work/settings";
export async function settingAction(
  section: string,
  input: Record<string, unknown>,
  id?: string,
) {
  return withContext(async (ctx) => {
    const result = await saveSettings(ctx, section, input, id);
    revalidatePath("/settings");
    revalidatePath(`/settings/${section}`);
    return result;
  });
}

export async function settingControlAction(
  section: string,
  id: string,
  command: string,
) {
  return withContext(async (ctx) => {
    await controlSetting(ctx, section, id, command);
    revalidatePath(`/settings/${section}`);
    return true;
  });
}
