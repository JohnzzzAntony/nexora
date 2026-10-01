import "server-only";
import { Prisma } from "@prisma/client";
import type { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { AppError } from "@/lib/api/errors";
import { hashPassword } from "@/lib/auth/password";
import { consumeToken, issueToken } from "@/lib/auth/tokens";
import { sendEmail } from "@/lib/email";
import { writeAudit } from "@/lib/audit";
import { sha256 } from "@/lib/crypto";
import { CUSTOMER_ROLE_KEY } from "@/lib/permissions/catalog";
import { createOrganization } from "@/server/organizations/bootstrap";
import type { acceptInvitationNewUserSchema, registerSchema, resetPasswordSchema } from "@/server/auth/schemas";

type Meta = { ip?: string; userAgent?: string };

const GENERIC_REGISTRATION_ERROR =
  "We couldn't create an account with these details. If you already have an account, sign in or reset your password.";

export async function sendVerificationEmail(user: { id: string; name: string; email: string }) {
  const token = await issueToken(user.id, "EMAIL_VERIFICATION");
  await sendEmail({
    to: user.email,
    template: "email_verification",
    data: { name: user.name, url: `${env.appUrl}/verify-email?token=${encodeURIComponent(token)}` },
    entityType: "user",
    entityId: user.id,
  });
}

export async function registerUser(input: z.output<typeof registerSchema>, meta: Meta) {
  const existing = await db.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) throw new AppError("REGISTRATION_FAILED", GENERIC_REGISTRATION_ERROR, 409);
  const passwordHash = await hashPassword(input.password);
  let result: { user: { id: string; name: string; email: string }; organizationId: string };
  try {
    result = await db.$transaction(async tx => {
      const user = await tx.user.create({ data: { email: input.email, name: input.name, passwordHash }, select: { id: true, name: true, email: true } });
      const { organization } = await createOrganization({ name: input.organizationName, ownerId: user.id, timezone: input.timezone }, tx);
      await writeAudit({
        organizationId: organization.id, userId: user.id, action: "user.registered", entityType: "user", entityId: user.id,
        after: { organization: organization.name }, ip: meta.ip, userAgent: meta.userAgent,
      }, tx);
      return { user, organizationId: organization.id };
    }, { timeout: 30_000 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AppError("REGISTRATION_FAILED", GENERIC_REGISTRATION_ERROR, 409);
    throw error;
  }
  await sendVerificationEmail(result.user);
  await sendEmail({ to: result.user.email, template: "welcome", organizationId: result.organizationId, data: { name: result.user.name, url: `${env.appUrl}/dashboard` } });
  return result;
}

/** Resolves identically whether or not the account exists (no enumeration). */
export async function requestPasswordReset(email: string) {
  const user = await db.user.findUnique({ where: { email }, select: { id: true, name: true, email: true, isActive: true } });
  if (!user?.isActive) return;
  const token = await issueToken(user.id, "PASSWORD_RESET");
  await sendEmail({
    to: user.email,
    template: "password_reset",
    data: { name: user.name, url: `${env.appUrl}/reset-password?token=${encodeURIComponent(token)}` },
    entityType: "user",
    entityId: user.id,
  });
}

export async function resetPassword(input: z.output<typeof resetPasswordSchema>, meta: Meta) {
  const userId = await consumeToken(input.token, "PASSWORD_RESET");
  if (!userId) throw new AppError("INVALID_TOKEN", "This reset link is invalid or has expired. Request a new one.", 400);
  const passwordHash = await hashPassword(input.password);
  await db.$transaction(async tx => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { emailVerifiedAt: true } });
    // Following the emailed link proves inbox ownership.
    await tx.user.update({ where: { id: userId }, data: { passwordHash, ...(user.emailVerifiedAt ? {} : { emailVerifiedAt: new Date() }) } });
    await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await writeAudit({ userId, action: "user.password_reset", entityType: "user", entityId: userId, ip: meta.ip, userAgent: meta.userAgent }, tx);
  });
}

export async function verifyEmailToken(token: string) {
  const userId = await consumeToken(token, "EMAIL_VERIFICATION");
  if (!userId) return false;
  await db.user.updateMany({ where: { id: userId, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } });
  await writeAudit({ userId, action: "user.email_verified", entityType: "user", entityId: userId });
  return true;
}

// ───────────── Invitations ─────────────

export type InvitationState = "valid" | "invalid" | "expired" | "accepted" | "revoked";

export async function findInvitation(token: string) {
  const invitation = await db.invitation.findUnique({
    where: { tokenHash: sha256(token) },
    include: {
      organization: { select: { id: true, name: true } },
      role: { select: { id: true, key: true, name: true } },
      invitedBy: { select: { name: true } },
    },
  });
  if (!invitation) return { state: "invalid" as InvitationState, invitation: null };
  const state: InvitationState = invitation.revokedAt ? "revoked"
    : invitation.acceptedAt ? "accepted"
    : invitation.expiresAt < new Date() ? "expired" : "valid";
  return { state, invitation };
}

export function invitationStateMessage(state: InvitationState) {
  switch (state) {
    case "expired": return "This invitation has expired. Ask an administrator to send a new one.";
    case "accepted": return "This invitation has already been used.";
    case "revoked": return "This invitation was revoked by an administrator.";
    case "invalid": return "This invitation link is invalid.";
    default: return "";
  }
}

async function requireValidInvitation(token: string) {
  const { state, invitation } = await findInvitation(token);
  if (state !== "valid" || !invitation) throw new AppError("INVALID_INVITATION", invitationStateMessage(state), 400);
  return invitation;
}

export const destinationForRole = (roleKey: string) => (roleKey === CUSTOMER_ROLE_KEY ? "/portal" : "/dashboard");

/** Claims the invitation atomically so it can be used only once. */
async function claimInvitation(tx: Prisma.TransactionClient, id: string) {
  const claimed = await tx.invitation.updateMany({
    where: { id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    data: { acceptedAt: new Date() },
  });
  if (claimed.count !== 1) throw new AppError("INVALID_INVITATION", "This invitation is no longer valid.", 400);
}

/** Existing, signed-in user accepts an invitation addressed to their email. */
export async function acceptInvitationAsUser(token: string, user: { id: string; email: string }, meta: Meta) {
  const invitation = await requireValidInvitation(token);
  if (invitation.email.trim().toLowerCase() !== user.email.toLowerCase()) {
    throw new AppError("INVITATION_EMAIL_MISMATCH", "This invitation was sent to a different email address.", 403);
  }
  const existing = await db.membership.findUnique({
    where: { organizationId_userId: { organizationId: invitation.organizationId, userId: user.id } },
    select: { id: true, status: true },
  });
  if (existing?.status === "DEACTIVATED") {
    throw new AppError("MEMBERSHIP_DEACTIVATED", "Your access to this organization has been deactivated. Ask an administrator to reactivate your account.", 403);
  }
  await db.$transaction(async tx => {
    await claimInvitation(tx, invitation.id);
    if (!existing) await tx.membership.create({ data: { organizationId: invitation.organizationId, userId: user.id, roleId: invitation.roleId } });
    await writeAudit({
      organizationId: invitation.organizationId, userId: user.id, action: "invitation.accepted", entityType: "invitation", entityId: invitation.id,
      after: { role: invitation.role.key, alreadyMember: Boolean(existing) }, ip: meta.ip, userAgent: meta.userAgent,
    }, tx);
  });
  return { organizationId: invitation.organizationId, redirectTo: destinationForRole(invitation.role.key) };
}

/** New user accepts an invitation: account and membership are created together. */
export async function acceptInvitationWithNewAccount(input: z.output<typeof acceptInvitationNewUserSchema>, meta: Meta) {
  const invitation = await requireValidInvitation(input.token);
  const email = invitation.email.trim().toLowerCase();
  const accountExists = new AppError("ACCOUNT_EXISTS", "An account already exists for this email. Sign in to accept the invitation.", 409);
  if (await db.user.findUnique({ where: { email }, select: { id: true } })) throw accountExists;
  const passwordHash = await hashPassword(input.password);
  try {
    await db.$transaction(async tx => {
      await claimInvitation(tx, invitation.id);
      // Receiving the invitation link proves inbox ownership.
      const user = await tx.user.create({ data: { email, name: input.name, passwordHash, emailVerifiedAt: new Date() }, select: { id: true } });
      await tx.membership.create({ data: { organizationId: invitation.organizationId, userId: user.id, roleId: invitation.roleId } });
      await writeAudit({ organizationId: invitation.organizationId, userId: user.id, action: "user.registered", entityType: "user", entityId: user.id, after: { via: "invitation" }, ip: meta.ip, userAgent: meta.userAgent }, tx);
      await writeAudit({ organizationId: invitation.organizationId, userId: user.id, action: "invitation.accepted", entityType: "invitation", entityId: invitation.id, after: { role: invitation.role.key }, ip: meta.ip, userAgent: meta.userAgent }, tx);
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw accountExists;
    throw error;
  }
  return { email, organizationId: invitation.organizationId, redirectTo: destinationForRole(invitation.role.key) };
}
