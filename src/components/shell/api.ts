"use client";

/** Client helper for `/api/v1` endpoints: unwraps `{ success, data, meta }` and throws on failure. */
export async function apiFetch<T>(
  input: string,
  init?: RequestInit & { json?: unknown },
): Promise<{ data: T; meta?: Record<string, unknown> }> {
  const { json, headers, ...rest } = init ?? {};
  const res = await fetch(input, {
    ...rest,
    credentials: "same-origin",
    headers: { Accept: "application/json", ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  let payload: { success?: boolean; data?: T; meta?: Record<string, unknown>; error?: { message?: string } } | null = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }
  if (!res.ok || !payload?.success) {
    throw new Error(payload?.error?.message || `Request failed (${res.status})`);
  }
  return { data: payload.data as T, meta: payload.meta };
}

/** Only allow in-app relative URLs for navigation targets that come from data. */
export function safeInternalUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("/") && !url.startsWith("//") && !url.startsWith("/\\")) return url;
  return null;
}
