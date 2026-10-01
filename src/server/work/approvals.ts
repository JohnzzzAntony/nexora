import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/api/errors";
import { requirePermission, type OrgContext } from "@/lib/tenancy/load";
import { assertMember, requireTicket } from "@/server/tickets/access";
import { notify } from "@/lib/notifications";
import { writeAudit } from "@/lib/audit";
export async function requestApproval(ctx: OrgContext, raw: unknown) {
  requirePermission(ctx, "approvals.manage");
  const input = z
    .object({
      title: z.string().trim().min(3).max(200),
      description: z.string().max(10000).default(""),
      approverId: z.string().min(1),
      ticketRef: z.string().optional(),
    })
    .parse(raw);
  if (input.approverId === ctx.user.id)
    throw new AppError(
      "INVALID_APPROVER",
      "Choose another person to review this request",
      422,
    );
  await assertMember(ctx.organization.id, input.approverId);
  const ticket = input.ticketRef
    ? await requireTicket(ctx, input.ticketRef)
    : null;
  const result = await db.approval.create({
    data: {
      organizationId: ctx.organization.id,
      title: input.title,
      description: input.description,
      requesterId: ctx.user.id,
      ticketId: ticket?.id,
      steps: { create: { level: 1, approverId: input.approverId } },
    },
  });
  await notify({
    organizationId: ctx.organization.id,
    userIds: [input.approverId],
    actorId: ctx.user.id,
    event: "approval.requested",
    title: "Approval requested",
    body: input.title,
    url: "/approvals",
    entityType: "approval",
    entityId: result.id,
  });
  return result;
}
export async function decideApproval(
  ctx: OrgContext,
  id: string,
  raw: unknown,
) {
  const input = z
    .object({
      decision: z.enum(["APPROVED", "REJECTED"]),
      comment: z.string().max(2000).default(""),
    })
    .parse(raw);
  const result = await db.$transaction(async (tx) => {
    const a = await tx.approval.findFirst({
      where: { id, organizationId: ctx.organization.id },
      include: { steps: true },
    });
    if (!a || a.status !== "PENDING")
      throw new AppError("NOT_FOUND", "Pending approval not found", 404);
    const step = a.steps.find(
      (s) =>
        s.level === a.currentLevel &&
        s.approverId === ctx.user.id &&
        s.status === "PENDING",
    );
    if (!step)
      throw new AppError(
        "FORBIDDEN",
        "Only the assigned approver can decide this request",
        403,
      );
    const claimed = await tx.approvalStep.updateMany({
      where: { id: step.id, status: "PENDING" },
      data: {
        status: input.decision,
        comment: input.comment,
        decidedAt: new Date(),
      },
    });
    if (!claimed.count)
      throw new AppError("CONFLICT", "This approval was already decided", 409);
    const pendingAtLevel = a.steps.some(
      (s) =>
        s.id !== step.id &&
        s.level === a.currentLevel &&
        s.status === "PENDING",
    );
    const nextLevel = Math.min(
      ...a.steps
        .filter((s) => s.level > a.currentLevel && s.status === "PENDING")
        .map((s) => s.level),
    );
    const final =
      input.decision === "REJECTED" ||
      (!pendingAtLevel && !Number.isFinite(nextLevel));
    await tx.approval.update({
      where: { id },
      data: final
        ? { status: input.decision, decidedAt: new Date() }
        : pendingAtLevel
          ? {}
          : { currentLevel: nextLevel },
    });
    await writeAudit(
      {
        organizationId: ctx.organization.id,
        userId: ctx.user.id,
        action: `approval.${input.decision.toLowerCase()}`,
        entityType: "approval",
        entityId: id,
        after: { comment: input.comment },
      },
      tx,
    );
    return { a, final };
  });
  await notify({
    organizationId: ctx.organization.id,
    userIds: [result.a.requesterId],
    actorId: ctx.user.id,
    event: "approval.decided",
    title: `Approval ${input.decision.toLowerCase()}`,
    body: result.a.title,
    url: "/approvals",
    entityType: "approval",
    entityId: id,
  });
  return true;
}
