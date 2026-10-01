"use server";

import { withContext } from "@/lib/actions";
import { AppError } from "@/lib/api/errors";
import { getCurrentUser } from "@/lib/auth/session";
import { clearActiveOrganizationCookie, requestMeta } from "@/server/auth/request";
import { changePasswordSchema, leaveSchema, preferencesSchema, profileSchema, sessionIdSchema } from "@/server/profile/schemas";
import * as profile from "@/server/profile/service";

async function currentSessionId() {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in to continue.", 401);
  return user.sessionId;
}

export async function updateProfileAction(input: { name: string; jobTitle?: string; phone?: string; avatarUrl?: string }) {
  return withContext(ctx => profile.updateProfile(ctx, profileSchema.parse(input)));
}

export async function changePasswordAction(input: { currentPassword?: string; newPassword: string; confirmPassword: string }) {
  return withContext(async ctx => profile.changePassword(ctx, await currentSessionId(), changePasswordSchema.parse(input), await requestMeta()));
}

export async function revokeSessionAction(input: { id: string }) {
  return withContext(async ctx => profile.revokeSession(ctx, await currentSessionId(), sessionIdSchema.parse(input).id, await requestMeta()));
}

export async function revokeOtherSessionsAction() {
  return withContext(async ctx => profile.revokeOtherSessions(ctx, await currentSessionId(), await requestMeta()));
}

export async function saveNotificationPreferencesAction(input: { preferences: { eventType: string; inApp: boolean; email: boolean }[] }) {
  return withContext(ctx => profile.saveNotificationPreferences(ctx, preferencesSchema.parse(input)));
}

export async function leaveOrganizationAction(input: { organizationId: string }) {
  return withContext(async ctx => {
    const result = await profile.leaveOrganization(ctx, leaveSchema.parse(input).organizationId, await requestMeta());
    if (result.wasActiveOrganization) await clearActiveOrganizationCookie();
    return result;
  });
}
