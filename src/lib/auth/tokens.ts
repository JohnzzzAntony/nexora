import "server-only";
import type { TokenType } from "@prisma/client";
import { db } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/crypto";

const TTL_MINUTES: Record<TokenType, number> = { EMAIL_VERIFICATION: 60 * 24, PASSWORD_RESET: 60 };

// Only the hash is stored; the raw token travels once by email.
export async function issueToken(userId: string, type: TokenType) {
  const token = randomToken();
  await db.$transaction([
    db.verificationToken.updateMany({ where: { userId, type, consumedAt: null }, data: { consumedAt: new Date() } }),
    db.verificationToken.create({ data: { userId, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + TTL_MINUTES[type] * 60_000) } }),
  ]);
  return token;
}

export async function consumeToken(token: string, type: TokenType) {
  const row = await db.verificationToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.type !== type || row.consumedAt || row.expiresAt < new Date()) return null;
  const claimed = await db.verificationToken.updateMany({ where: { id: row.id, consumedAt: null }, data: { consumedAt: new Date() } });
  return claimed.count === 1 ? row.userId : null;
}
