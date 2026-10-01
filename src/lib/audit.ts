import "server-only";
import type { Prisma } from "@prisma/client";
import { db, type Tx } from "@/lib/db";

export type AuditInput = {
  organizationId?: string | null;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
};

const json = (v: unknown) => (v === undefined ? undefined : (JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue));

// Append-only: nothing in the application updates or deletes audit rows.
export async function writeAudit(input: AuditInput, tx: Tx = db) {
  await tx.auditLog.create({
    data: {
      organizationId: input.organizationId ?? null,
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      before: json(input.before),
      after: json(input.after),
      ip: input.ip?.slice(0, 64) ?? null,
      userAgent: input.userAgent?.slice(0, 255) ?? null,
    },
  });
}

export async function recordActivity(
  input: { organizationId: string; entityType: string; entityId: string; actorId?: string | null; action: string; data?: unknown },
  tx: Tx = db,
) {
  await tx.activity.create({ data: { ...input, actorId: input.actorId ?? null, data: json(input.data) } });
}
