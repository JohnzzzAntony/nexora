import "server-only";
import { cookies, headers } from "next/headers";
import { env } from "@/lib/env";
import { ORG_COOKIE } from "@/lib/tenancy/context";

/** Client IP and user agent of the current request (first hop of x-forwarded-for). */
export async function requestMeta() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "local";
  return { ip: ip.slice(0, 64), userAgent: h.get("user-agent")?.slice(0, 255) ?? undefined };
}

/** Makes `organizationId` the active organization for this browser. */
export async function setActiveOrganizationCookie(organizationId: string) {
  (await cookies()).set(ORG_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function clearActiveOrganizationCookie() {
  (await cookies()).delete(ORG_COOKIE);
}
