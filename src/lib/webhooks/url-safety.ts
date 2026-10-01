import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { env } from "@/lib/env";

// SSRF protection for outbound calls to user-configured URLs.
function isPrivate(ip: string) {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return isPrivate(v.slice(7));
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

export async function assertPublicUrl(raw: string) {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("Invalid URL"); }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && !env.isProduction)) throw new Error("URL must use https");
  if (!env.isProduction) return url;
  const { address } = await lookup(url.hostname);
  if (isPrivate(address)) throw new Error("URL resolves to a private network address");
  return url;
}
