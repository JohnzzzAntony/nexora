import "server-only";
import { ZodError } from "zod";
import { AppError } from "@/lib/api/errors";
import { requireApiContext, type OrgContext } from "@/lib/tenancy/context";
import { isRedirectError } from "next/dist/client/components/redirect-error";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; fieldErrors?: Record<string, string> } };

function toActionError(error: unknown): ActionResult<never> {
  if (error instanceof AppError) {
    const fieldErrors = error.details && typeof error.details === "object" && !Array.isArray(error.details) ? (error.details as Record<string, string>) : undefined;
    return { ok: false, error: { code: error.code, message: error.message, ...(fieldErrors ? { fieldErrors } : {}) } };
  }
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
    return { ok: false, error: { code: "VALIDATION_ERROR", message: error.issues[0]?.message ?? "Invalid input", fieldErrors } };
  }
  console.error("[action] unhandled error", error);
  return { ok: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } };
}

/** Server-action wrapper: resolves tenant context, maps errors to a serializable result. */
export async function withContext<T>(fn: (ctx: OrgContext) => Promise<T>): Promise<ActionResult<T>> {
  try {
    const ctx = await requireApiContext();
    return { ok: true, data: await fn(ctx) };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return toActionError(error);
  }
}

/** Server-action wrapper for unauthenticated flows (login, register, reset). */
export async function safeAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return toActionError(error);
  }
}
