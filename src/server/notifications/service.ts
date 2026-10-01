import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError } from "@/lib/api/errors";
import type { OrgContext } from "@/lib/tenancy/context";

export type NotificationDTO = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  url: string | null;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationPage = { items: NotificationDTO[]; nextCursor: string | null };

const MAX_LIMIT = 50;

/** Opaque keyset cursor: base64url("<createdAt ISO>|<id>"). */
function encodeCursor(createdAt: Date, id: string) {
  return Buffer.from(`${createdAt.toISOString()}|${id}`).toString("base64url");
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } {
  try {
    const [iso, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
    const createdAt = new Date(iso);
    if (!id || Number.isNaN(createdAt.getTime())) throw new Error("bad cursor");
    return { createdAt, id };
  } catch {
    throw new AppError("INVALID_CURSOR", "Pagination cursor is invalid", 400);
  }
}

const scope = (ctx: OrgContext): Prisma.NotificationWhereInput => ({ userId: ctx.user.id, organizationId: ctx.organization.id });

function toDTO(n: {
  id: string; type: string; title: string; body: string | null; url: string | null;
  entityType: string | null; entityId: string | null; readAt: Date | null; createdAt: Date;
}): NotificationDTO {
  return { ...n, readAt: n.readAt?.toISOString() ?? null, createdAt: n.createdAt.toISOString() };
}

export async function listNotifications(
  ctx: OrgContext,
  input: { unreadOnly?: boolean; cursor?: string | null; limit?: number } = {},
): Promise<NotificationPage> {
  const limit = Math.min(Math.max(1, input.limit ?? 20), MAX_LIMIT);
  const where: Prisma.NotificationWhereInput = { ...scope(ctx), ...(input.unreadOnly ? { readAt: null } : {}) };
  if (input.cursor) {
    const c = decodeCursor(input.cursor);
    where.OR = [{ createdAt: { lt: c.createdAt } }, { createdAt: c.createdAt, id: { lt: c.id } }];
  }
  const rows = await db.notification.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: { id: true, type: true, title: true, body: true, url: true, entityType: true, entityId: true, readAt: true, createdAt: true },
  });
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  return { items: page.map(toDTO), nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null };
}

export async function unreadCount(ctx: OrgContext): Promise<number> {
  return db.notification.count({ where: { ...scope(ctx), readAt: null } });
}

export async function markRead(ctx: OrgContext, ids: string[]): Promise<number> {
  const unique = [...new Set(ids)].slice(0, 200);
  if (!unique.length) return 0;
  const res = await db.notification.updateMany({
    where: { ...scope(ctx), id: { in: unique }, readAt: null },
    data: { readAt: new Date() },
  });
  return res.count;
}

export async function markAllRead(ctx: OrgContext): Promise<number> {
  const res = await db.notification.updateMany({ where: { ...scope(ctx), readAt: null }, data: { readAt: new Date() } });
  return res.count;
}
