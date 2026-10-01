import "server-only";
import { db } from "@/lib/db";

// Fixed-window counter in Postgres so limits hold across serverless instances.
export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  const row = await db.rateLimit.upsert({
    where: { key_windowStart: { key, windowStart } },
    create: { key, windowStart },
    update: { count: { increment: 1 } },
    select: { count: true },
  });
  return { allowed: row.count <= limit, remaining: Math.max(0, limit - row.count), resetAt: new Date(windowStart.getTime() + windowMs) };
}
