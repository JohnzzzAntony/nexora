import "server-only";
import { cache } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";

// Validates the JWT against the server-side session row on every request, so revoked
// sessions and deactivated users lose access immediately.
export const getCurrentUser = cache(async () => {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const sessionId = session?.sessionId;
  if (!userId || !sessionId) return null;
  const row = await db.session.findUnique({
    where: { id: sessionId },
    select: { userId: true, revokedAt: true, expiresAt: true, createdAt: true, lastSeenAt: true, user: { select: { id: true, email: true, name: true, avatarUrl: true, isActive: true, isSuperAdmin: true, emailVerifiedAt: true } } },
  });
  if (!row || row.userId !== userId || row.revokedAt || row.expiresAt < new Date() || !row.user.isActive) return null;
  const policies = await db.organizationSettings.findMany({ where: { organization: { memberships: { some: { userId, status: "ACTIVE" } } } }, select: { sessionTimeoutHours: true } });
  const maxHours = Math.min(168, ...policies.map(p => Math.max(1, p.sessionTimeoutHours)));
  if (Date.now() > row.createdAt.getTime() + maxHours * 3600000) return null;
  if (Date.now() - row.lastSeenAt.getTime() > 5 * 60_000) {
    await db.$transaction([
      db.session.update({ where: { id: sessionId }, data: { lastSeenAt: new Date() } }),
      db.user.update({ where: { id: userId }, data: { lastActiveAt: new Date() } }),
    ]);
  }
  return { ...row.user, sessionId };
});

