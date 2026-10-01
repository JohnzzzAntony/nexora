"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { ORG_COOKIE } from "@/lib/tenancy/context";
import type { ActionResult } from "@/lib/actions";

const schema = z.string().min(1).max(64);

/** Switches the active organization after verifying an ACTIVE membership, then goes to the dashboard. */
export async function switchOrganization(organizationId: string): Promise<ActionResult<never>> {
  const parsed = schema.safeParse(organizationId);
  if (!parsed.success) return { ok: false, error: { code: "VALIDATION_ERROR", message: "Invalid organization" } };

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const membership = await db.membership.findFirst({
    where: { userId: user.id, organizationId: parsed.data, status: "ACTIVE" },
    select: { id: true },
  });
  if (!membership) return { ok: false, error: { code: "FORBIDDEN", message: "You are not an active member of that organization." } };

  (await cookies()).set(ORG_COOKIE, parsed.data, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/dashboard");
}
