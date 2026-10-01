import "server-only";
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { env, features } from "@/lib/env";
import { hmacSha256, safeEqual } from "@/lib/crypto";
import { AppError } from "@/lib/api/errors";

// Object storage with two drivers:
//  - S3-compatible (Cloudflare R2 / AWS S3 / MinIO): browser uploads directly via presigned PUT.
//  - local disk (development only): same flow through signed /api/files/local/<token> URLs.

const LOCAL_ROOT = resolve(process.cwd(), ".data", "uploads");
let client: S3Client | null = null;
const s3 = () => (client ??= new S3Client({
  region: env.s3.region, endpoint: env.s3.endpoint || undefined, forcePathStyle: Boolean(env.s3.endpoint),
  // Neon supports SigV4; optional AWS checksum query parameters break presigned requests.
  requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED",
  credentials: { accessKeyId: env.s3.accessKey, secretAccessKey: env.s3.secretKey },
}));

export function assertStorageConfigured() {
  if (!features.storage) throw new AppError("STORAGE_NOT_CONFIGURED", "File storage is not configured. Set the S3_* environment variables.", 503);
}

type LocalGrant = { k: string; op: "put" | "get"; exp: number; mime: string; size?: number; name?: string };

export function signLocal(grant: LocalGrant) {
  const payload = Buffer.from(JSON.stringify(grant)).toString("base64url");
  return `${payload}.${hmacSha256(env.authSecret, payload)}`;
}

export function verifyLocal(token: string): LocalGrant | null {
  const [payload, sig, extra] = token.split(".");
  if (extra !== undefined) return null;
  if (!payload || !sig || !safeEqual(sig, hmacSha256(env.authSecret, payload))) return null;
  try {
    const grant = JSON.parse(Buffer.from(payload, "base64url").toString()) as LocalGrant;
    return typeof grant.k === "string" && typeof grant.mime === "string" &&
      (grant.op === "put" || grant.op === "get") && Number.isFinite(grant.exp) &&
      grant.exp > Date.now() ? grant : null;
  } catch {
    return null;
  }
}

const localPath = (key: string) => {
  const p = resolve(LOCAL_ROOT, key);
  if (!p.startsWith(`${LOCAL_ROOT}${sep}`)) throw new Error("Invalid storage key");
  return p;
};

export async function presignUpload(key: string, mimeType: string, size: number) {
  assertStorageConfigured();
  if (features.objectStorage) {
    const url = await getSignedUrl(s3(), new PutObjectCommand({ Bucket: env.s3.bucket, Key: key, ContentType: mimeType, ContentLength: size }), { expiresIn: 600 });
    return { url, method: "PUT" as const, headers: { "Content-Type": mimeType } };
  }
  return { url: `/api/files/local/${signLocal({ k: key, op: "put", exp: Date.now() + 600_000, mime: mimeType, size })}`, method: "PUT" as const, headers: { "Content-Type": mimeType } };
}

export async function headObject(key: string): Promise<{ size: number; contentType: string | null } | null> {
  if (features.objectStorage) {
    try {
      const r = await s3().send(new HeadObjectCommand({ Bucket: env.s3.bucket, Key: key }));
      return { size: r.ContentLength ?? 0, contentType: r.ContentType ?? null };
    } catch {
      return null;
    }
  }
  try {
    const s = await stat(localPath(key));
    return { size: s.size, contentType: null };
  } catch {
    return null;
  }
}

export async function downloadUrl(key: string, filename: string, mimeType: string, inline = false) {
  assertStorageConfigured();
  const disposition = `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(filename)}`;
  if (features.objectStorage) {
    return getSignedUrl(s3(), new GetObjectCommand({ Bucket: env.s3.bucket, Key: key, ResponseContentDisposition: disposition, ResponseContentType: mimeType }), { expiresIn: 300 });
  }
  return `/api/files/local/${signLocal({ k: key, op: "get", exp: Date.now() + 300_000, mime: mimeType, name: filename })}`;
}

export async function putObject(key: string, body: Buffer, mimeType: string) {
  assertStorageConfigured();
  if (features.objectStorage) {
    await s3().send(new PutObjectCommand({ Bucket: env.s3.bucket, Key: key, Body: body, ContentType: mimeType }));
    return;
  }
  const p = localPath(key);
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, body);
}

export async function readLocalObject(key: string) {
  return readFile(localPath(key));
}

export async function writeLocalObject(key: string, body: Buffer) {
  const p = localPath(key);
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, body);
}

export async function deleteObject(key: string) {
  if (features.objectStorage) await s3().send(new DeleteObjectCommand({ Bucket: env.s3.bucket, Key: key })).catch(() => undefined);
  else await unlink(localPath(key)).catch(() => undefined);
}

export const storageKey = (organizationId: string, filename: string) =>
  join(organizationId, new Date().toISOString().slice(0, 7), `${crypto.randomUUID()}-${filename.replace(/[^\w.\-]+/g, "_").slice(-100)}`).replace(/\\/g, "/");
