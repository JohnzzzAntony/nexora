import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { AppError } from "@/lib/api/errors";
import { hmacSha256, safeEqual } from "@/lib/crypto";
import { requirePermission, type OrgContext } from "@/lib/tenancy/load";
import { downloadUrl, headObject, presignUpload, storageKey, deleteObject } from "@/lib/storage";
import { validateUpload } from "@/lib/storage/policy";
import { canSeeInternal, requireTicket } from "@/server/tickets/access";

export const uploadTargetSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("draft") }),
  z.object({ type: z.literal("ticket"), id: z.string().min(1) }),
  z.object({ type: z.literal("task"), id: z.string().min(1) }),
  z.object({ type: z.literal("project"), id: z.string().min(1) }),
  z.object({ type: z.literal("article"), id: z.string().min(1) }),
  z.object({ type: z.literal("asset"), id: z.string().min(1) }),
]);
export type UploadTarget = z.infer<typeof uploadTargetSchema>;

export const requestUploadSchema = z.object({
  filename: z.string().min(1).max(200),
  mimeType: z.string().min(1).max(120),
  size: z.number().int().positive(),
  target: uploadTargetSchema,
});

async function assertTargetWritable(ctx: OrgContext, target: UploadTarget) {
  const org = ctx.organization.id;
  switch (target.type) {
    case "draft": return {};
    case "ticket": { const t = await requireTicket(ctx, target.id); return { ticketId: t.id }; }
    case "task": {
      requirePermission(ctx, "tasks.edit", "tasks.create");
      const t = await db.task.findFirst({ where: { id: target.id, organizationId: org }, select: { id: true } });
      if (!t) throw new AppError("TASK_NOT_FOUND", "Task not found", 404);
      return { taskId: t.id };
    }
    case "project": {
      requirePermission(ctx, "projects.manage", "tasks.edit");
      const p = await db.project.findFirst({ where: { id: target.id, organizationId: org }, select: { id: true } });
      if (!p) throw new AppError("PROJECT_NOT_FOUND", "Project not found", 404);
      return { projectId: p.id };
    }
    case "article": {
      requirePermission(ctx, "knowledge.manage");
      const a = await db.knowledgeArticle.findFirst({ where: { id: target.id, organizationId: org }, select: { id: true } });
      if (!a) throw new AppError("ARTICLE_NOT_FOUND", "Article not found", 404);
      return { articleId: a.id };
    }
    case "asset": {
      requirePermission(ctx, "assets.manage");
      const a = await db.asset.findFirst({ where: { id: target.id, organizationId: org }, select: { id: true } });
      if (!a) throw new AppError("ASSET_NOT_FOUND", "Asset not found", 404);
      return { assetId: a.id };
    }
  }
}

type Claim = { k: string; n: string; m: string; s: number; o: string; u: string; t: Record<string, string>; exp: number };
const sign = (c: Claim) => { const p = Buffer.from(JSON.stringify(c)).toString("base64url"); return `${p}.${hmacSha256(env.authSecret, `upload:${p}`)}`; };
function verify(token: string): Claim {
  const [p, sig] = token.split(".");
  if (!p || !sig || !safeEqual(sig, hmacSha256(env.authSecret, `upload:${p}`))) throw new AppError("INVALID_UPLOAD", "Upload token is invalid", 400);
  const c = JSON.parse(Buffer.from(p, "base64url").toString()) as Claim;
  if (c.exp < Date.now()) throw new AppError("INVALID_UPLOAD", "Upload expired. Please try again.", 400);
  return c;
}

/** Step 1: validate and return a presigned upload URL plus a completion token. */
export async function requestUpload(ctx: OrgContext, raw: z.input<typeof requestUploadSchema>) {
  const input = requestUploadSchema.parse(raw);
  const settings = await db.organizationSettings.findUnique({ where: { organizationId: ctx.organization.id }, select: { maxUploadMb: true, allowZipUploads: true } });
  const problem = validateUpload(input, { maxMb: settings?.maxUploadMb ?? 10, allowZip: settings?.allowZipUploads ?? false });
  if (problem) throw new AppError("INVALID_FILE", problem, 422);
  const owner = await assertTargetWritable(ctx, input.target);
  const key = storageKey(ctx.organization.id, input.filename);
  const upload = await presignUpload(key, input.mimeType, input.size);
  const token = sign({ k: key, n: input.filename, m: input.mimeType, s: input.size, o: ctx.organization.id, u: ctx.user.id, t: owner as Record<string, string>, exp: Date.now() + 15 * 60_000 });
  return { upload, token };
}

/** Step 2: verify the object landed with the declared size, then persist the attachment. */
export async function completeUpload(ctx: OrgContext, token: string) {
  const c = verify(token);
  if (c.o !== ctx.organization.id || c.u !== ctx.user.id) throw new AppError("INVALID_UPLOAD", "Upload token is invalid", 400);
  const head = await headObject(c.k);
  if (!head) throw new AppError("UPLOAD_MISSING", "The file was not uploaded", 400);
  if (head.size !== c.s) { await deleteObject(c.k); throw new AppError("UPLOAD_MISMATCH", "Uploaded file does not match the declared size", 400); }
  const existing = await db.attachment.findUnique({ where: { storageKey: c.k } });
  if (existing) return existing;
  return db.attachment.create({ data: { organizationId: c.o, storageKey: c.k, filename: c.n, mimeType: c.m, size: c.s, uploadedById: c.u, ...c.t } });
}

/** Authorization for reading a file follows the owning entity's visibility rules. */
export async function authorizeDownload(ctx: OrgContext, id: string) {
  const a = await db.attachment.findFirst({ where: { id, organizationId: ctx.organization.id }, include: { message: { select: { type: true } }, article: { select: { status: true, visibility: true, authorId: true } } } });
  if (!a) throw new AppError("FILE_NOT_FOUND", "File not found", 404);
  const deny = () => { throw new AppError("FILE_NOT_FOUND", "File not found", 404); };
  if (a.ticketId) {
    await requireTicket(ctx, a.ticketId);
    if (a.message?.type === "INTERNAL" && !canSeeInternal(ctx)) deny();
  } else if (a.taskId) { if (!ctx.can("tasks.view") || ctx.isCustomer) deny(); }
  else if (a.projectId) { if (!ctx.can("projects.view") || ctx.isCustomer) deny(); }
  else if (a.assetId) { if (!ctx.can("assets.view") || ctx.isCustomer) deny(); }
  else if (a.article) {
    const publicOk = a.article.status === "PUBLISHED" && a.article.visibility === "PUBLIC";
    const internalOk = !ctx.isCustomer && ctx.can("knowledge.view") && (a.article.status === "PUBLISHED" || ctx.can("knowledge.manage"));
    if (!publicOk && !internalOk) deny();
  } else if (a.uploadedById !== ctx.user.id) deny();
  return a;
}

export async function getDownloadUrl(ctx: OrgContext, id: string, inline = false) {
  const a = await authorizeDownload(ctx, id);
  const safeInline = inline && (a.mimeType.startsWith("image/") || a.mimeType === "application/pdf");
  return downloadUrl(a.storageKey, a.filename, a.mimeType, safeInline);
}

export async function deleteAttachment(ctx: OrgContext, id: string) {
  const a = await authorizeDownload(ctx, id);
  if (a.uploadedById !== ctx.user.id && !ctx.can("tickets.delete") && !ctx.can("settings.manage")) throw new AppError("FORBIDDEN", "You cannot delete this file", 403);
  await db.attachment.delete({ where: { id: a.id } });
  await deleteObject(a.storageKey);
}

/** Job: remove draft uploads never attached to anything (older than 24h). */
export async function cleanupOrphanUploads() {
  const cutoff = new Date(Date.now() - 24 * 3600_000);
  const orphans = await db.attachment.findMany({ where: { createdAt: { lt: cutoff }, ticketId: null, taskId: null, projectId: null, articleId: null, assetId: null }, take: 200 });
  for (const a of orphans) { await deleteObject(a.storageKey); await db.attachment.delete({ where: { id: a.id } }).catch(() => undefined); }
  return orphans.length;
}
