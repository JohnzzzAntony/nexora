// Pure helpers shared by server pages and client forms (no server-only imports).

/** Accepts only same-origin relative paths ("/x"), never protocol-relative ("//x") or backslash tricks. */
export function safeNextPath(value: string | string[] | undefined | null, fallback = "/dashboard") {
  const next = Array.isArray(value) ? value[0] : value;
  if (!next || typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\") || next.includes("\\")) return fallback;
  if (/[\u0000-\u001f]/.test(next)) return fallback;
  return next.slice(0, 1024);
}
