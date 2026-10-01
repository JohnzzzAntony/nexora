import "server-only";
import { z } from "zod";
import { env } from "@/lib/env";
import { db } from "@/lib/db";

const neonUser = z.object({ id: z.string().min(1), email: z.email(), name: z.string().optional(), emailVerified: z.boolean() });
/** Authenticate against the configured, trusted Neon Auth backend. Passwords and tokens are never persisted. */
export async function authenticateNeon(email: string, password: string) {
  if (!env.neonAuth.url) return null;
  const url = new URL(`${env.neonAuth.url.replace(/\/$/, "")}/sign-in/email`);
  if (url.protocol !== "https:") throw new Error("Neon Auth requires HTTPS.");
  const response = await fetch(url, {
    method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/json", Origin: env.appUrl },
    body: JSON.stringify({ email, password }),
  });
  if (response.status === 401 || response.status === 400) return null;
  if (!response.ok) throw new Error("Neon sign-in is unavailable. Check the trusted origins in Neon Auth.");
  const payload = z.object({ user: neonUser }).safeParse(await response.json());
  if (!payload.success || !payload.data.user.emailVerified) throw new Error("Verify your Neon account email before signing in.");
  const external = payload.data.user; const normalized = external.email.toLowerCase();
  return db.$transaction(async tx => {
    const account = await tx.account.findUnique({ where: { provider_providerAccountId: { provider: "neon", providerAccountId: external.id } }, include: { user: true } });
    if (account) return account.user.isActive ? account.user : null;
    const existing = await tx.user.findUnique({ where: { email: normalized } });
    if (existing && (!existing.isActive || !existing.emailVerifiedAt)) throw new Error("Sign in with your workspace account and verify its email before linking Neon Auth.");
    const user = existing ?? await tx.user.create({ data: { email: normalized, name: external.name || normalized.split("@")[0], emailVerifiedAt: new Date() } });
    await tx.account.create({ data: { userId: user.id, provider: "neon", providerAccountId: external.id } });
    return user;
  });
}
