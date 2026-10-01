import "server-only";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import AzureADProvider from "next-auth/providers/azure-ad";
import { db } from "@/lib/db";
import { env, features } from "@/lib/env";
import { verifyPassword } from "@/lib/auth/password";
import { rateLimit } from "@/lib/rate-limit";
import { writeAudit } from "@/lib/audit";
import { authenticateNeon } from "@/lib/auth/neon";

const SESSION_HOURS = 24 * 7;
// Next bundles CommonJS providers; standalone Node/tsx scripts expose a nested default.
const credentialsProvider = typeof CredentialsProvider === "function" ? CredentialsProvider : (CredentialsProvider as unknown as { default: typeof CredentialsProvider }).default;
const googleProvider = typeof GoogleProvider === "function" ? GoogleProvider : (GoogleProvider as unknown as { default: typeof GoogleProvider }).default;
const microsoftProvider = typeof AzureADProvider === "function" ? AzureADProvider : (AzureADProvider as unknown as { default: typeof AzureADProvider }).default;

function header(req: { headers?: Record<string, unknown> } | undefined, name: string) {
  const value = req?.headers?.[name];
  return typeof value === "string" ? value : undefined;
}

async function openSession(userId: string, ip?: string, userAgent?: string) {
  const policies = await db.organizationSettings.findMany({ where: { organization: { memberships: { some: { userId, status: "ACTIVE" } } } }, select: { sessionTimeoutHours: true } });
  const lifetime = Math.min(SESSION_HOURS, ...policies.map(p => Math.max(1, p.sessionTimeoutHours)));
  const session = await db.session.create({
    data: { userId, ip: ip?.split(",")[0]?.trim().slice(0, 64), userAgent: userAgent?.slice(0, 255), expiresAt: new Date(Date.now() + lifetime * 3600_000) },
  });
  await db.user.update({ where: { id: userId }, data: { lastActiveAt: new Date() } });
  await writeAudit({ userId, action: "auth.login", entityType: "user", entityId: userId, ip, userAgent });
  return session.id;
}

const providers: NextAuthOptions["providers"] = [
  credentialsProvider({
    name: "Email",
    credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
    async authorize(credentials, req) {
      const email = credentials?.email?.trim().toLowerCase();
      const password = credentials?.password;
      if (!email || !password) return null;
      const ip = header(req, "x-forwarded-for") ?? "local";
      const limited = await rateLimit(`login:${email}:${ip}`, 10, 15 * 60);
      if (!limited.allowed) throw new Error("Too many sign-in attempts. Try again in a few minutes.");
      const user = await db.user.findUnique({ where: { email } });
      if (!user?.passwordHash || !user.isActive) return null;
      if (!(await verifyPassword(password, user.passwordHash))) return null;
      const sessionId = await openSession(user.id, ip, header(req, "user-agent"));
      return { id: user.id, email: user.email, name: user.name, sessionId };
    },
  }),
];

if (features.neonAuth) providers.push(credentialsProvider({
  id: "neon", name: "Neon Auth", credentials: { email: { type: "email" }, password: { type: "password" } },
  async authorize(credentials, req) {
    const email = credentials?.email?.trim().toLowerCase(), password = credentials?.password;
    if (!email || !password) return null;
    const ip = header(req, "x-forwarded-for") ?? "local";
    if (!(await rateLimit(`neon-login:${email}:${ip}`, 10, 900)).allowed) throw new Error("Too many sign-in attempts. Try again in a few minutes.");
    const user = await authenticateNeon(email, password); if (!user) return null;
    return { id: user.id, email: user.email, name: user.name, sessionId: await openSession(user.id, ip, header(req, "user-agent")) };
  },
}));

if (features.googleSso) providers.push(googleProvider({ clientId: env.google.id, clientSecret: env.google.secret }));
if (features.microsoftSso) providers.push(microsoftProvider({ clientId: env.microsoft.id, clientSecret: env.microsoft.secret, tenantId: env.microsoft.tenant }));

export const authOptions: NextAuthOptions = {
  providers,
  secret: env.authSecret || undefined,
  session: { strategy: "jwt", maxAge: SESSION_HOURS * 3600 },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    // OAuth: only link to an existing active account with the same verified email, or create a
    // new user without organization (they go through onboarding). Never auto-join an org.
    async signIn({ user, account, profile }) {
      if (!account || ["credentials", "neon"].includes(account.provider)) return true;
      const email = (user.email || "").toLowerCase();
      const verified = account.provider === "google" ? (profile as { email_verified?: boolean })?.email_verified === true : Boolean(email);
      if (!email || !verified) return "/login?error=OAuthEmail";
      const existing = await db.user.findUnique({ where: { email } });
      if (existing && !existing.isActive) return false;
      const dbUser = existing ?? await db.user.create({ data: { email, name: user.name || email.split("@")[0], avatarUrl: user.image, emailVerifiedAt: new Date() } });
      await db.account.upsert({
        where: { provider_providerAccountId: { provider: account.provider, providerAccountId: account.providerAccountId } },
        create: { userId: dbUser.id, provider: account.provider, providerAccountId: account.providerAccountId },
        update: {},
      });
      (user as { dbId?: string }).dbId = dbUser.id;
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        if (account && !["credentials", "neon"].includes(account.provider)) {
          const id = (user as { dbId?: string }).dbId!;
          token.userId = id;
          token.sessionId = await openSession(id);
        } else {
          token.userId = user.id;
          token.sessionId = (user as { sessionId?: string }).sessionId;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        session.sessionId = token.sessionId as string;
      }
      return session;
    },
  },
  events: {
    async signOut({ token }) {
      if (token?.sessionId) await db.session.updateMany({ where: { id: token.sessionId as string, revokedAt: null }, data: { revokedAt: new Date() } });
    },
  },
};
