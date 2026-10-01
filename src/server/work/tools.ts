import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission, type OrgContext } from "@/lib/tenancy/load";
import { AppError } from "@/lib/api/errors";
import { listResources } from "@/server/work/resources";
import { assertAgentMember } from "@/server/tickets/access";
import { writeAudit } from "@/lib/audit";
import { TaskStatus } from "@prisma/client";
export async function workTool(
  ctx: OrgContext,
  module: string,
  id: string,
  raw: Record<string, unknown>,
) {
  const action = z
    .enum([
      "status",
      "checklist",
      "toggle",
      "time",
      "comment",
      "member",
      "remove-member",
    ])
    .parse(raw.action);
  const record = (await listResources(ctx, module, "", id))[0];
  if (!record) throw new AppError("NOT_FOUND", "Record not found", 404);
  if (module === "teams") {
    requirePermission(ctx, "teams.manage");
    const userId = z.string().min(1).parse(raw.userId);
    await assertAgentMember(ctx.organization.id, userId);
    if (action === "member")
      await db.teamMember.upsert({
        where: { teamId_userId: { teamId: id, userId } },
        create: { teamId: id, userId },
        update: {},
      });
    else if (action === "remove-member")
      await db.teamMember.deleteMany({ where: { teamId: id, userId } });
    else throw new AppError("VALIDATION_ERROR", "Invalid team action", 422);
  } else if (module === "tasks") {
    if (record.assigneeId !== ctx.user.id && !ctx.can("tasks.edit"))
      throw new AppError(
        "FORBIDDEN",
        "Only the assignee or an authorized manager can update this task",
        403,
      );
    switch (action) {
      case "status": {
        const status = z.nativeEnum(TaskStatus).parse(raw.status);
        if (
          status === "COMPLETED" &&
          (await db.taskDependency.count({
            where: { taskId: id, dependsOn: { status: { not: "COMPLETED" } } },
          }))
        )
          throw new AppError(
            "DEPENDENCY_INCOMPLETE",
            "Complete dependencies first",
            422,
          );
        await db.task.update({
          where: { id },
          data: {
            status,
            completedAt: status === "COMPLETED" ? new Date() : null,
          },
        });
        break;
      }
      case "checklist":
        requirePermission(ctx, "tasks.edit");
        await db.taskChecklistItem.create({
          data: {
            taskId: id,
            title: z.string().trim().min(1).max(200).parse(raw.title),
          },
        });
        break;
      case "toggle": {
        const itemId = z.string().min(1).parse(raw.itemId);
        const item = await db.taskChecklistItem.findFirst({
          where: { id: itemId, taskId: id },
        });
        if (!item)
          throw new AppError("NOT_FOUND", "Checklist item not found", 404);
        await db.taskChecklistItem.update({
          where: { id: itemId },
          data: { done: !item.done },
        });
        break;
      }
      case "time":
        await db.timeEntry.create({
          data: {
            taskId: id,
            userId: ctx.user.id,
            minutes: z.coerce
              .number()
              .int()
              .min(1)
              .max(1440)
              .parse(raw.minutes),
            note: z
              .string()
              .max(1000)
              .parse(raw.note || ""),
            startedAt: new Date(),
          },
        });
        break;
      case "comment": {
        const text = z.string().trim().min(1).max(10000).parse(raw.comment);
        const html = text
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;");
        await db.taskComment.create({
          data: {
            taskId: id,
            authorId: ctx.user.id,
            bodyHtml: `<p>${html}</p>`,
          },
        });
        break;
      }
      default:
        throw new AppError("VALIDATION_ERROR", "Invalid task action", 422);
    }
  } else throw new AppError("VALIDATION_ERROR", "Invalid action", 422);
  await writeAudit({
    organizationId: ctx.organization.id,
    userId: ctx.user.id,
    action: `${module}.${action}`,
    entityType: module,
    entityId: id,
  });
  return true;
}
