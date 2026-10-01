import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

function key() {
  if (!env.authSecret) throw new Error("AUTH_SECRET is not configured");
  return createHash("sha256").update(`duoonex:enc:${env.authSecret}`).digest();
}

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const hmacSha256 = (secret: string, payload: string) => createHmac("sha256", secret).update(payload).digest("hex");

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// AES-256-GCM for secrets we must be able to read back (webhook signing secrets, integration tokens).
export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(b => b.toString("base64url")).join(".");
}

export function decryptSecret(sealed: string) {
  const [iv, tag, data] = sealed.split(".").map(p => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
