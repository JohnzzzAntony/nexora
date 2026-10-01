"use server";

import { safeAction, type ActionResult } from "@/lib/actions";
import { AppError } from "@/lib/api/errors";
import { rateLimit } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { requestMeta, setActiveOrganizationCookie } from "@/server/auth/request";
import {
  acceptInvitationNewUserSchema, acceptInvitationSchema, forgotPasswordSchema, registerSchema, resetPasswordSchema,
  type RegisterInput,
} from "@/server/auth/schemas";
import {
  acceptInvitationAsUser, acceptInvitationWithNewAccount, destinationForRole, registerUser, requestPasswordReset, resetPassword, sendVerificationEmail,
} from "@/server/auth/service";

async function limit(key: string, max: number, windowSeconds: number, message = "Too many attempts. Please wait a while and try again.") {
  const result = await rateLimit(key, max, windowSeconds);
  if (!result.allowed) throw new AppError("RATE_LIMITED", message, 429);
}

/** Creates the user and their organization. The client then signs in with the same credentials. */
export async function registerAction(input: RegisterInput): Promise<ActionResult<{ email: string }>> {
  return safeAction(async () => {
    const meta = await requestMeta();
    await limit(`register:${meta.ip}`, 5, 3600, "Too many sign-up attempts from this network. Please try again later.");
    const data = registerSchema.parse(input);
    const { user, organizationId } = await registerUser(data, meta);
    await setActiveOrganizationCookie(organizationId);
    return { email: user.email };
  });
}

export async function requestPasswordResetAction(input: { email: string }): Promise<ActionResult<{ sent: true }>> {
  return safeAction(async () => {
    const meta = await requestMeta();
    await limit(`pwreset:ip:${meta.ip}`, 10, 3600);
    const { email } = forgotPasswordSchema.parse(input);
    // Per-address limit is silent so responses stay identical for existing and unknown emails.
    const perEmail = await rateLimit(`pwreset:email:${email}`, 3, 3600);
    if (perEmail.allowed) await requestPasswordReset(email);
    return { sent: true as const };
  });
}

export async function resetPasswordAction(input: { token: string; password: string; confirmPassword: string }): Promise<ActionResult<{ reset: true }>> {
  return safeAction(async () => {
    const meta = await requestMeta();
    await limit(`pwreset-confirm:${meta.ip}`, 10, 3600);
    const data = resetPasswordSchema.parse(input);
    await resetPassword(data, meta);
    return { reset: true as const };
  });
}

/** Re-sends the verification email to the signed-in, unverified user. */
export async function resendVerificationAction(): Promise<ActionResult<{ sent: boolean }>> {
  return safeAction(async () => {
    const user = await getCurrentUser();
    if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in to continue.", 401);
    if (user.emailVerifiedAt) return { sent: false };
    await limit(`verify-resend:${user.id}`, 3, 3600, "You've requested several emails recently. Please wait before trying again.");
    await sendVerificationEmail(user);
    return { sent: true };
  });
}

/** Signed-in user accepts an invitation sent to their email. */
export async function acceptInvitationAction(input: { token: string }): Promise<ActionResult<{ redirectTo: string }>> {
  return safeAction(async () => {
    const user = await getCurrentUser();
    if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in to accept this invitation.", 401);
    const meta = await requestMeta();
    await limit(`invite-accept:${meta.ip}`, 20, 3600);
    const { token } = acceptInvitationSchema.parse(input);
    const result = await acceptInvitationAsUser(token, user, meta);
    await setActiveOrganizationCookie(result.organizationId);
    return { redirectTo: result.redirectTo };
  });
}

/** Invited person without an account creates one and joins the organization. */
export async function acceptInvitationWithAccountAction(input: { token: string; name: string; password: string }): Promise<ActionResult<{ email: string; redirectTo: string }>> {
  return safeAction(async () => {
    const meta = await requestMeta();
    await limit(`invite-signup:${meta.ip}`, 10, 3600);
    const data = acceptInvitationNewUserSchema.parse(input);
    const result = await acceptInvitationWithNewAccount(data, meta);
    await setActiveOrganizationCookie(result.organizationId);
    return { email: result.email, redirectTo: result.redirectTo };
  });
}

/** Switches the active organization to one the user is an active member of (used after joining). */
export async function openOrganizationAction(input: { organizationId: string }): Promise<ActionResult<{ redirectTo: string }>> {
  return safeAction(async () => {
    const user = await getCurrentUser();
    if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in to continue.", 401);
    const organizationId = String(input?.organizationId ?? "").slice(0, 64);
    const membership = await db.membership.findFirst({ where: { userId: user.id, organizationId, status: "ACTIVE" }, select: { role: { select: { key: true } } } });
    if (!membership) throw new AppError("FORBIDDEN", "You are not an active member of this organization.", 403);
    await setActiveOrganizationCookie(organizationId);
    return { redirectTo: destinationForRole(membership.role.key) };
  });
}
