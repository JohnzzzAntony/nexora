import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError, type ZodType } from "zod";
import { AppError } from "@/lib/api/errors";
import {
  requireApiContext,
  loadContext,
  type OrgContext,
} from "@/lib/tenancy/context";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { rateLimit } from "@/lib/rate-limit";

export type ApiSuccess<T> = {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
};
export type ApiFailure = {
  success: false;
  error: { code: string; message: string; details?: unknown };
};

export const ok = <T>(
  data: T,
  init?: ResponseInit & { meta?: Record<string, unknown> },
) =>
  NextResponse.json<ApiSuccess<T>>(
    { success: true, data, ...(init?.meta ? { meta: init.meta } : {}) },
    init,
  );

export const fail = (
  code: string,
  message: string,
  status = 400,
  details?: unknown,
) =>
  NextResponse.json<ApiFailure>(
    {
      success: false,
      error: { code, message, ...(details ? { details } : {}) },
    },
    { status },
  );

export function toErrorResponse(error: unknown) {
  if (error instanceof AppError)
    return fail(error.code, error.message, error.status, error.details);
  if (error instanceof ZodError) {
    return fail(
      "VALIDATION_ERROR",
      error.issues[0]?.message ?? "Invalid input",
      422,
      error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
  }
  if (error instanceof SyntaxError)
    return fail("INVALID_JSON", "Request body is not valid JSON", 400);
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002")
      return fail("CONFLICT", "A record with these values already exists", 409);
    if (error.code === "P2025")
      return fail("NOT_FOUND", "Record not found", 404);
    if (error.code === "P2003")
      return fail(
        "REFERENCE_ERROR",
        "A referenced record does not exist or is still in use",
        409,
      );
  }
  console.error("[api] unhandled error", error);
  return fail("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
}

type RouteArgs<P> = { params: Promise<P> };

/** Wraps a route handler with consistent error responses. */
export function handle<P = Record<string, string>>(
  fn: (req: NextRequest, args: RouteArgs<P>) => Promise<Response>,
) {
  return async (req: NextRequest, args: RouteArgs<P>) => {
    try {
      return await fn(req, args);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

export async function parseBody<T>(
  req: Request,
  schema: ZodType<T>,
): Promise<T> {
  const body = await req.json();
  return schema.parse(body);
}

export function parseQuery<T>(req: NextRequest, schema: ZodType<T>): T {
  return schema.parse(Object.fromEntries(req.nextUrl.searchParams));
}

export const API_KEY_PREFIX = "dx_";

/**
 * Resolves the caller: `Authorization: Bearer dx_...` API key (scoped to the key's grants
 * intersected with its creator's role) or the browser session. Rate limited per principal.
 */
export async function getApiContext(req: NextRequest): Promise<OrgContext> {
  const auth = req.headers.get("authorization");
  if (auth && !auth.startsWith(`Bearer ${API_KEY_PREFIX}`)) {
    throw new AppError(
      "INVALID_API_KEY",
      "Unsupported or invalid authorization credentials",
      401,
    );
  }
  if (auth?.startsWith(`Bearer ${API_KEY_PREFIX}`)) {
    const raw = auth.slice(7).trim();
    const key = await db.apiKey.findUnique({ where: { keyHash: sha256(raw) } });
    if (!key || key.revokedAt || (key.expiresAt && key.expiresAt < new Date()))
      throw new AppError(
        "INVALID_API_KEY",
        "API key is invalid, expired or revoked",
        401,
      );
    const limited = await rateLimit(`api:${key.id}`, 600, 60);
    if (!limited.allowed)
      throw new AppError("RATE_LIMITED", "Rate limit exceeded", 429);
    const ctx = await loadContext(
      key.createdById,
      key.organizationId,
      "apiKey",
      key.scopes,
    );
    if (!ctx)
      throw new AppError(
        "INVALID_API_KEY",
        "API key owner no longer has access",
        401,
      );
    const [policy, owner] = await Promise.all([
      db.organizationSettings.findUnique({
        where: { organizationId: key.organizationId },
        select: { requireEmailVerification: true },
      }),
      db.user.findUnique({
        where: { id: key.createdById },
        select: { emailVerifiedAt: true },
      }),
    ]);
    if (policy?.requireEmailVerification && !owner?.emailVerifiedAt)
      throw new AppError(
        "EMAIL_NOT_VERIFIED",
        "Verify your email to access this workspace.",
        403,
      );
    if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > 60_000)
      await db.apiKey.update({
        where: { id: key.id },
        data: { lastUsedAt: new Date() },
      });
    return ctx;
  }
  const ctx = await requireApiContext();
  return ctx;
}
