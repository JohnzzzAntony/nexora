import "server-only";
import { z } from "zod";
import {
  TaskStatus,
  WorkPriority,
  ProjectStatus,
  CustomerStatus,
  AssetType,
  AssetStatus,
  ArticleStatus,
  Visibility,
  type Prisma,
} from "@prisma/client";
import { db } from "@/lib/db";
import { RESOURCES } from "@/config/resources";
import { requirePermission, type OrgContext } from "@/lib/tenancy/load";
import { AppError } from "@/lib/api/errors";
import { assertAgentMember, assertOwned } from "@/server/tickets/access";
import { nextTaskNumber } from "@/lib/automation/engine";
import { writeAudit } from "@/lib/audit";
import { sanitizeHtml } from "@/lib/sanitize";

export type WorkRecord = { id: string; [key: string]: unknown };
export function configFor(module: string) {
  const c = RESOURCES[module];
  if (!c) throw new AppError("NOT_FOUND", "Page not found", 404);
  return c;
}
export const ownTaskScope = (ctx: OrgContext): Prisma.TaskWhereInput =>
  ctx.can("tasks.edit")
    ? {}
    : { OR: [{ assigneeId: ctx.user.id }, { createdById: ctx.user.id }] };
const serialized = (rows: unknown): WorkRecord[] =>
  JSON.parse(JSON.stringify(rows));
export async function listResources(
  ctx: OrgContext,
  module: string,
  q = "",
  ref?: string,
) {
  const config = configFor(module);
  requirePermission(ctx, config.view);
  if (ctx.isCustomer)
    throw new AppError("FORBIDDEN", "Use the customer portal", 403);
  const organizationId = ctx.organization.id;
  const take = ref ? 1 : 100;
  const text = { contains: q.slice(0, 200), mode: "insensitive" as const };
  const id = ref ? { id: ref } : {};
  const base = { organizationId, ...id };
  const orderBy = { updatedAt: "desc" as const };
  switch (module) {
    case "tasks":
      return serialized(
        await db.task.findMany({
          where: {
            AND: [
              { organizationId },
              ownTaskScope(ctx),
              ...(ref
                ? [/^\d+$/.test(ref) ? { number: Number(ref) } : { id: ref }]
                : [{ title: text }]),
            ],
          },
          include: {
            assignee: { select: { name: true } },
            project: { select: { name: true } },
          },
          orderBy,
          take,
        }),
      );
    case "projects":
      return serialized(
        await db.project.findMany({
          where: { ...base, name: text },
          include: {
            manager: { select: { name: true } },
            _count: { select: { tasks: true } },
          },
          orderBy,
          take,
        }),
      );
    case "teams":
      return serialized(
        await db.team.findMany({
          where: { ...base, name: text },
          include: {
            leader: { select: { name: true } },
            department: { select: { name: true } },
            members: {
              select: { userId: true, user: { select: { name: true } } },
            },
          },
          orderBy,
          take,
        }),
      );
    case "customers":
      return serialized(
        await db.customer.findMany({
          where: { ...base, name: text },
          orderBy,
          take,
        }),
      );
    case "assets":
      return serialized(
        await db.asset.findMany({
          where: { ...base, name: text },
          include: { assignedTo: { select: { name: true } } },
          orderBy,
          take,
        }),
      );
    case "knowledge":
      return serialized(
        await db.knowledgeArticle.findMany({
          where: {
            AND: [
              { organizationId },
              ...(ref
                ? [{ OR: [{ id: ref }, { slug: ref }] }]
                : [{ title: text }]),
              ...(ctx.can("knowledge.manage")
                ? []
                : [{ status: "PUBLISHED" as const }]),
            ],
          },
          orderBy,
          take,
        }),
      );
    case "departments":
      return serialized(
        await db.department.findMany({
          where: { ...base, name: text },
          orderBy,
          take,
        }),
      );
    case "locations":
      return serialized(
        await db.location.findMany({
          where: { ...base, name: text },
          orderBy,
          take,
        }),
      );
    default:
      return [];
  }
}
export async function resourceLookups(ctx: OrgContext) {
  const organizationId = ctx.organization.id;
  const [members, teams, departments, locations, projects] = await Promise.all([
    db.membership.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
        user: { isActive: true },
        role: { key: { not: "customer" } },
      },
      select: { user: { select: { id: true, name: true } } },
      take: 200,
    }),
    db.team.findMany({
      where: { organizationId },
      select: { id: true, name: true },
    }),
    db.department.findMany({
      where: { organizationId },
      select: { id: true, name: true },
    }),
    db.location.findMany({
      where: { organizationId },
      select: { id: true, name: true },
    }),
    db.project.findMany({
      where: { organizationId },
      select: { id: true, name: true },
    }),
  ]);
  return {
    members: members.map((m) => m.user),
    teams,
    departments,
    locations,
    projects,
  };
}
export async function saveResource(
  ctx: OrgContext,
  module: string,
  raw: Record<string, unknown>,
  id?: string,
) {
  const config = configFor(module);
  const permission = module === "tasks" && id ? "tasks.edit" : config.manage;
  requirePermission(ctx, permission);
  if (ctx.isCustomer)
    throw new AppError("FORBIDDEN", "Use the customer portal", 403);
  const shape: Record<string, z.ZodType> = {};
  for (const field of config.fields) {
    if (field.options)
      shape[field.key] = z.enum(field.options as [string, ...string[]]);
    else if (field.required)
      shape[field.key] = z
        .string()
        .trim()
        .min(2, `${field.label} must contain at least 2 characters`)
        .max(field.kind === "textarea" ? 100000 : 200);
    else
      shape[field.key] = z
        .string()
        .max(field.kind === "textarea" ? 100000 : 500)
        .optional()
        .default("");
  }
  const data = z.object(shape).parse(raw) as Record<string, string>;
  if (data.email && !z.email().safeParse(data.email).success)
    throw new AppError("VALIDATION_ERROR", "Enter a valid email", 422);
  const date = (key: string) => {
    if (!data[key]) return null;
    const d = new Date(data[key]);
    if (!Number.isFinite(d.getTime()))
      throw new AppError("VALIDATION_ERROR", "Enter a valid date", 422);
    return d;
  };
  if (data.startDate && data.endDate && date("endDate")! < date("startDate")!)
    throw new AppError(
      "VALIDATION_ERROR",
      "End date must follow start date",
      422,
    );
  const o = ctx.organization.id;
  const nil = (key: string) => data[key] || null;
  await assertOwned(o, {
    team: nil("teamId"),
    department: nil("departmentId"),
    location: nil("locationId"),
    project: nil("projectId"),
  });
  for (const key of ["assigneeId", "managerId", "leaderId", "assignedToId"])
    if (data[key]) await assertAgentMember(o, data[key]);
  if (module === "tasks" && data.assigneeId && !ctx.can("tasks.assign"))
    throw new AppError("FORBIDDEN", "You cannot assign tasks", 403);
  if (id && !(await listResources(ctx, module, "", id)).length)
    throw new AppError("NOT_FOUND", "Record not found", 404);
  return db.$transaction(
    async (tx) => {
      let result: { id: string };
      switch (module) {
        case "tasks": {
          const values = {
            title: data.title,
            description: sanitizeHtml(data.description),
            status: data.status as TaskStatus,
            priority: data.priority as WorkPriority,
            assigneeId: nil("assigneeId"),
            projectId: nil("projectId"),
            teamId: nil("teamId"),
            dueDate: date("dueDate"),
            completedAt: data.status === "COMPLETED" ? new Date() : null,
          };
          if (
            data.status === "COMPLETED" &&
            id &&
            (await tx.taskDependency.count({
              where: {
                taskId: id,
                dependsOn: { status: { not: "COMPLETED" } },
              },
            }))
          )
            throw new AppError(
              "DEPENDENCY_INCOMPLETE",
              "Complete dependencies first",
              422,
            );
          result = id
            ? await tx.task.update({
                where: { id, organizationId: o },
                data: values,
              })
            : await tx.task.create({
                data: {
                  ...values,
                  organizationId: o,
                  createdById: ctx.user.id,
                  number: await nextTaskNumber(tx, o),
                },
              });
          break;
        }
        case "projects": {
          const values = {
            name: data.name,
            key: data.key.toUpperCase(),
            description: data.description,
            status: data.status as ProjectStatus,
            priority: data.priority as WorkPriority,
            managerId: nil("managerId"),
            startDate: date("startDate"),
            endDate: date("endDate"),
          };
          result = id
            ? await tx.project.update({
                where: { id, organizationId: o },
                data: values,
              })
            : await tx.project.create({
                data: { ...values, organizationId: o },
              });
          break;
        }
        case "teams": {
          const values = {
            name: data.name,
            description: data.description,
            leaderId: nil("leaderId"),
            departmentId: nil("departmentId"),
          };
          result = id
            ? await tx.team.update({
                where: { id, organizationId: o },
                data: values,
              })
            : await tx.team.create({
                data: { ...values, organizationId: o, skills: [] },
              });
          break;
        }
        case "customers": {
          const values = {
            name: data.name,
            company: nil("company"),
            email: nil("email"),
            phone: nil("phone"),
            notes: nil("notes"),
            status: data.status as CustomerStatus,
          };
          result = id
            ? await tx.customer.update({
                where: { id, organizationId: o },
                data: values,
              })
            : await tx.customer.create({
                data: { ...values, organizationId: o, tags: [] },
              });
          break;
        }
        case "assets": {
          const values = {
            name: data.name,
            assetTag: data.assetTag,
            type: data.type as AssetType,
            status: data.status as AssetStatus,
            serialNumber: nil("serialNumber"),
            assignedToId: nil("assignedToId"),
            locationId: nil("locationId"),
            notes: nil("notes"),
          };
          result = id
            ? await tx.asset.update({
                where: { id, organizationId: o },
                data: values,
              })
            : await tx.asset.create({ data: { ...values, organizationId: o } });
          await tx.assetHistory.create({
            data: {
              assetId: result.id,
              type: id ? "updated" : "created",
              summary: `${data.name}: ${data.status}`,
              actorId: ctx.user.id,
            },
          });
          break;
        }
        case "knowledge": {
          if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug))
            throw new AppError(
              "VALIDATION_ERROR",
              "Use lowercase words separated by hyphens for the article address",
              422,
            );
          const values = {
            title: data.title,
            slug: data.slug,
            contentHtml: sanitizeHtml(data.contentHtml),
            status: data.status as ArticleStatus,
            visibility: data.visibility as Visibility,
            publishedAt: data.status === "PUBLISHED" ? new Date() : null,
          };
          result = id
            ? await tx.knowledgeArticle.update({
                where: { id, organizationId: o },
                data: values,
              })
            : await tx.knowledgeArticle.create({
                data: {
                  ...values,
                  organizationId: o,
                  authorId: ctx.user.id,
                  tags: [],
                },
              });
          break;
        }
        case "departments": {
          const values = {
            name: data.name,
            code: nil("code"),
            description: data.description,
            managerId: nil("managerId"),
          };
          result = id
            ? await tx.department.update({
                where: { id, organizationId: o },
                data: values,
              })
            : await tx.department.create({
                data: { ...values, organizationId: o },
              });
          break;
        }
        case "locations": {
          const values = {
            name: data.name,
            type: nil("type"),
            address: nil("address"),
          };
          result = id
            ? await tx.location.update({
                where: { id, organizationId: o },
                data: values,
              })
            : await tx.location.create({
                data: { ...values, organizationId: o },
              });
          break;
        }
        default:
          throw new AppError("NOT_FOUND", "Record not found", 404);
      }
      await writeAudit(
        {
          organizationId: o,
          userId: ctx.user.id,
          action: `${module}.${id ? "updated" : "created"}`,
          entityType: module,
          entityId: result.id,
        },
        tx,
      );
      return result;
    },
    { timeout: 30000 },
  );
}
