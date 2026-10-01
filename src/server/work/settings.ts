import "server-only";
import { z } from "zod";
import { StatusCategory } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { AppError } from "@/lib/api/errors";
import { SETTINGS } from "@/config/settings";
import { ALL_PERMISSIONS } from "@/lib/permissions/catalog";
import { requirePermission, type OrgContext } from "@/lib/tenancy/load";
import { assertOwned } from "@/server/tickets/access";
import { randomToken, sha256, encryptSecret } from "@/lib/crypto";
import { writeAudit } from "@/lib/audit";
import { assertPublicUrl } from "@/lib/webhooks/url-safety";
import { WEBHOOK_EVENTS } from "@/lib/webhooks";
import { sendEmail } from "@/lib/email";
import { sanitizeHtml } from "@/lib/sanitize";
import type { WorkRecord } from "@/server/work/resources";

export async function settingsRecords(
  ctx: OrgContext,
  section: string,
): Promise<WorkRecord[]> {
  const where = { organizationId: ctx.organization.id };
  let rows: unknown[];
  switch (section) {
    case "organization":
    case "branding":
    case "security": {
      const [org, settings] = await Promise.all([
        db.organization.findUniqueOrThrow({
          where: { id: where.organizationId },
          select: { id: true, name: true, timezone: true, logoUrl: true },
        }),
        db.organizationSettings.findUniqueOrThrow({ where }),
      ]);
      rows = [{ ...settings, ...org }];
      break;
    }
    case "categories":
      rows = await db.ticketCategory.findMany({
        where,
        orderBy: { name: "asc" },
      });
      break;
    case "priorities":
      rows = await db.ticketPriority.findMany({
        where,
        orderBy: { order: "asc" },
      });
      break;
    case "statuses":
      rows = await db.ticketStatus.findMany({
        where,
        orderBy: { order: "asc" },
      });
      break;
    case "templates":
      rows = await db.ticketTemplate.findMany({ where });
      break;
    case "custom-fields":
      rows = await db.customField.findMany({ where });
      break;
    case "forms":
      rows = await db.ticketForm.findMany({ where, include: { fields: true } });
      break;
    case "automations":
      rows = await db.automationRule.findMany({ where });
      break;
    case "sla":
      rows = await db.sLAPolicy.findMany({ where, include: { targets: true } });
      break;
    case "business-hours":
      rows = await db.businessHours.findMany({
        where,
        include: { periods: true },
      });
      break;
    case "holidays":
      rows = await db.holiday.findMany({ where, orderBy: { date: "asc" } });
      break;
    case "roles":
      rows = await db.role.findMany({
        where,
        include: { permissions: true },
        orderBy: { name: "asc" },
      });
      break;
    case "users":
      rows = (
        await db.membership.findMany({
          where,
          include: {
            user: { select: { id: true, name: true, email: true } },
            role: { select: { name: true } },
          },
        })
      ).map((m) => ({
        id: m.id,
        name: m.user.name,
        email: m.user.email,
        roleId: m.roleId,
        role: m.role.name,
        status: m.status,
      }));
      break;
    case "api":
      rows = await db.apiKey.findMany({
        where,
        select: {
          id: true,
          name: true,
          prefix: true,
          scopes: true,
          revokedAt: true,
          lastUsedAt: true,
          expiresAt: true,
        },
      });
      break;
    case "webhooks":
      rows = await db.webhook.findMany({
        where,
        select: {
          id: true,
          name: true,
          url: true,
          events: true,
          isActive: true,
        },
      });
      break;
    case "audit-logs":
      rows = await db.auditLog.findMany({
        where,
        select: {
          id: true,
          action: true,
          createdAt: true,
          entityType: true,
          user: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      break;
    case "email-templates":
      rows = await db.emailTemplate.findMany({
        where,
        select: {
          id: true,
          key: true,
          subject: true,
          bodyHtml: true,
          isActive: true,
        },
      });
      break;
    case "integrations":
      rows = await db.integration.findMany({
        where,
        select: {
          id: true,
          type: true,
          name: true,
          isActive: true,
          lastTestedAt: true,
          lastError: true,
        },
      });
      break;
    default:
      rows = [];
  }
  return JSON.parse(
    JSON.stringify(rows, (key, value) =>
      key === "inboundEmailToken" ? undefined : value,
    ),
  );
}
export async function settingsLookups(ctx: OrgContext) {
  const organizationId = ctx.organization.id;
  const [teams, categories, roles, businessHours, customFields] =
    await Promise.all([
      db.team.findMany({
        where: { organizationId },
        select: { id: true, name: true },
      }),
      db.ticketCategory.findMany({
        where: { organizationId },
        select: { id: true, name: true },
      }),
      db.role.findMany({
        where: { organizationId },
        select: {
          id: true,
          name: true,
          key: true,
          permissions: { select: { permission: true } },
        },
      }),
      db.businessHours.findMany({
        where: { organizationId },
        select: { id: true, name: true },
      }),
      db.customField.findMany({
        where: { organizationId, isActive: true },
        select: { id: true, label: true },
      }),
    ]);
  return {
    teams,
    categories,
    roles: roles
      .filter(
        (r) =>
          r.key !== "owner" &&
          r.permissions.every((p) =>
            ctx.permissions.has(
              p.permission as (typeof ALL_PERMISSIONS)[number],
            ),
          ),
      )
      .map((r) => ({ id: r.id, name: r.name })),
    businessHours,
    customFields: customFields.map((f) => ({ id: f.id, name: f.label })),
  };
}
export async function saveSettings(
  ctx: OrgContext,
  section: string,
  raw: Record<string, unknown>,
  id?: string,
) {
  const config = SETTINGS[section];
  if (!config) throw new AppError("NOT_FOUND", "Setting not found", 404);
  requirePermission(ctx, config.permission);
  const shape: Record<string, z.ZodType> = {};
  for (const f of config.fields)
    shape[f.key] =
      f.type === "checkbox"
        ? z.boolean()
        : f.type === "number"
          ? z.coerce.number().int().min(0).max(525600)
          : z
              .string()
              .trim()
              .max(f.type === "textarea" ? 100000 : 500)
              .min(f.required ? 1 : 0)
              .optional()
              .default("");
  const d = z.object(shape).parse(raw) as Record<
    string,
    string | number | boolean
  >;
  const s = (k: string) => String(d[k] ?? "");
  const bool = (k: string) => Boolean(d[k]);
  const n = (k: string) => Number(d[k]);
  const o = ctx.organization.id;
  if (s("color") && !/^#[0-9a-f]{6}$/i.test(s("color")))
    throw new AppError("VALIDATION_ERROR", "Use a six-digit hex color", 422);
  if (s("primaryColor") && !/^#[0-9a-f]{6}$/i.test(s("primaryColor")))
    throw new AppError("VALIDATION_ERROR", "Use a six-digit hex color", 422);
  if (s("timezone"))
    try {
      new Intl.DateTimeFormat("en", { timeZone: s("timezone") }).format();
    } catch {
      throw new AppError(
        "VALIDATION_ERROR",
        "Use a valid timezone such as Asia/Dubai",
        422,
      );
    }
  if (s("supportEmail") && !z.email().safeParse(s("supportEmail")).success)
    throw new AppError("VALIDATION_ERROR", "Enter a valid support email", 422);
  if (
    s("logoUrl") &&
    !z.url({ protocol: /^https$/ }).safeParse(s("logoUrl")).success
  )
    throw new AppError("VALIDATION_ERROR", "Use an HTTPS logo URL", 422);
  await assertOwned(o, {
    team: s("defaultTeamId") || s("teamId") || null,
    category: s("categoryId") || null,
  });
  if (
    id &&
    !config.singleton &&
    !(await settingsRecords(ctx, section)).some((r) => r.id === id)
  )
    throw new AppError("NOT_FOUND", "Record not found", 404);
  let result: { id: string };
  let secret: string | undefined;
  let invitation: string | undefined;
  switch (section) {
    case "organization":
      await db.organization.update({
        where: { id: o },
        data: { name: s("name"), timezone: s("timezone") },
      });
      result = await db.organizationSettings.update({
        where: { organizationId: o },
        data: {
          supportEmail: s("supportEmail") || null,
          portalEnabled: bool("portalEnabled"),
        },
      });
      break;
    case "branding":
      await db.organization.update({
        where: { id: o },
        data: { logoUrl: s("logoUrl") || null },
      });
      result = await db.organizationSettings.update({
        where: { organizationId: o },
        data: {
          primaryColor: s("primaryColor") || null,
          loginMessage: s("loginMessage") || null,
        },
      });
      break;
    case "security":
      if (
        n("sessionTimeoutHours") < 1 ||
        n("sessionTimeoutHours") > 168 ||
        n("maxUploadMb") < 1 ||
        n("maxUploadMb") > 100
      )
        throw new AppError(
          "VALIDATION_ERROR",
          "Session lifetime: 1–168 hours. Upload limit: 1–100 MB.",
          422,
        );
      result = await db.organizationSettings.update({
        where: { organizationId: o },
        data: {
          requireEmailVerification: bool("requireEmailVerification"),
          sessionTimeoutHours: n("sessionTimeoutHours"),
          maxUploadMb: n("maxUploadMb"),
          allowZipUploads: bool("allowZipUploads"),
          customerSeesOrgTickets: bool("customerSeesOrgTickets"),
        },
      });
      break;
    case "categories": {
      const data = {
        name: s("name"),
        description: s("description"),
        defaultTeamId: s("defaultTeamId") || null,
        isActive: bool("isActive"),
      };
      result = id
        ? await db.ticketCategory.update({
            where: { id, organizationId: o },
            data,
          })
        : await db.ticketCategory.create({
            data: { ...data, organizationId: o, requiredFields: [] },
          });
      break;
    }
    case "priorities": {
      const data = {
        name: s("name"),
        key: s("key").toUpperCase(),
        color: s("color") || "#64748b",
        order: n("order"),
      };
      result = id
        ? await db.ticketPriority.update({
            where: { id, organizationId: o },
            data,
          })
        : await db.ticketPriority.create({
            data: { ...data, organizationId: o },
          });
      break;
    }
    case "statuses": {
      const category = z.nativeEnum(StatusCategory).parse(s("category"));
      const data = {
        name: s("name"),
        key: s("key").toUpperCase(),
        category,
        color: s("color") || "#64748b",
        pausesSla: bool("pausesSla"),
        isActive: bool("isActive"),
        allowedTransitions: s("allowedTransitions")
          .split(",")
          .map((x) => x.trim().toUpperCase())
          .filter(Boolean),
      };
      result = id
        ? await db.ticketStatus.update({
            where: { id, organizationId: o },
            data,
          })
        : await db.ticketStatus.create({
            data: { ...data, organizationId: o },
          });
      break;
    }
    case "templates": {
      const data = {
        name: s("name"),
        subject: s("subject"),
        description: sanitizeHtml(s("description")),
      };
      result = id
        ? await db.ticketTemplate.update({
            where: { id, organizationId: o },
            data,
          })
        : await db.ticketTemplate.create({
            data: { ...data, organizationId: o, tags: [] },
          });
      break;
    }
    case "custom-fields": {
      const data = {
        label: s("label"),
        key: s("key"),
        helpText: s("helpText"),
        required: bool("required"),
        isActive: bool("isActive"),
      };
      result = id
        ? await db.customField.update({
            where: { id, organizationId: o },
            data,
          })
        : await db.customField.create({
            data: { ...data, organizationId: o, type: "TEXT" },
          });
      break;
    }
    case "forms": {
      const fieldId = s("fieldIds");
      if (
        fieldId &&
        !(await db.customField.findFirst({
          where: { id: fieldId, organizationId: o },
        }))
      )
        throw new AppError("INVALID_REFERENCE", "Custom field not found", 422);
      const data = {
        name: s("name"),
        description: s("description"),
        categoryId: s("categoryId") || null,
        isActive: bool("isActive"),
      };
      result = await db.$transaction(async (tx) => {
        const form = id
          ? await tx.ticketForm.update({
              where: { id, organizationId: o },
              data,
            })
          : await tx.ticketForm.create({
              data: { ...data, organizationId: o },
            });
        if (fieldId)
          await tx.ticketFormField.upsert({
            where: { formId_fieldId: { formId: form.id, fieldId } },
            create: { formId: form.id, fieldId },
            update: {},
          });
        return form;
      });
      break;
    }
    case "automations": {
      const trigger = z
        .enum([
          "ticket.created",
          "ticket.updated",
          "ticket.replied",
          "sla.breached",
        ])
        .parse(s("trigger"));
      const data = {
        name: s("name"),
        trigger,
        isActive: bool("isActive"),
        conditions: {
          operator: "AND",
          conditions: s("contains")
            ? [{ field: "subject", op: "contains", value: s("contains") }]
            : [],
        },
        actions: [{ type: "assign_team", teamId: s("teamId") }],
      };
      result = id
        ? await db.automationRule.update({
            where: { id, organizationId: o },
            data,
          })
        : await db.automationRule.create({
            data: { ...data, organizationId: o },
          });
      break;
    }
    case "sla": {
      if (n("firstResponseMinutes") < 1 || n("resolutionMinutes") < 1)
        throw new AppError("VALIDATION_ERROR", "Targets must be positive", 422);
      const businessHoursId = s("businessHoursId") || null;
      if (
        businessHoursId &&
        !(await db.businessHours.findFirst({
          where: { id: businessHoursId, organizationId: o },
        }))
      )
        throw new AppError(
          "INVALID_REFERENCE",
          "Business hours not found",
          422,
        );
      result = await db.$transaction(async (tx) => {
        const p = await tx.sLAPolicy.create({
          data: {
            organizationId: o,
            name: s("name"),
            businessHoursId,
            isActive: bool("isActive"),
          },
        });
        const priorities = await tx.ticketPriority.findMany({
          where: { organizationId: o },
        });
        await tx.sLATarget.createMany({
          data: priorities.map((x) => ({
            policyId: p.id,
            priorityId: x.id,
            firstResponseMinutes: n("firstResponseMinutes"),
            resolutionMinutes: n("resolutionMinutes"),
          })),
        });
        return p;
      });
      break;
    }
    case "business-hours": {
      const time = (value: string) => {
        if (!/^\d{2}:\d{2}$/.test(value))
          throw new AppError(
            "VALIDATION_ERROR",
            "Enter valid opening and closing times",
            422,
          );
        const [h, m] = value.split(":").map(Number);
        if (h > 23 || m > 59)
          throw new AppError("VALIDATION_ERROR", "Invalid time", 422);
        return h * 60 + m;
      };
      const startMinute = time(s("start")),
        endMinute = time(s("end"));
      if (endMinute <= startMinute)
        throw new AppError(
          "VALIDATION_ERROR",
          "Closing time must follow opening time",
          422,
        );
      result = await db.businessHours.create({
        data: {
          organizationId: o,
          name: s("name"),
          timezone: s("timezone"),
          periods: {
            create: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
              dayOfWeek,
              startMinute,
              endMinute,
            })),
          },
        },
      });
      break;
    }
    case "holidays": {
      const date = z.coerce.date().parse(s("date"));
      result = await db.holiday.create({
        data: {
          organizationId: o,
          name: s("name"),
          date,
          recurring: bool("recurring"),
        },
      });
      break;
    }
    case "roles": {
      const requested = z
        .array(
          z.enum(
            ALL_PERMISSIONS as [
              (typeof ALL_PERMISSIONS)[number],
              ...(typeof ALL_PERMISSIONS)[number][],
            ],
          ),
        )
        .max(100)
        .parse(raw.permissions ?? []);
      if (requested.some((p) => !ctx.can(p)))
        throw new AppError(
          "FORBIDDEN",
          "Cannot grant permissions you do not hold",
          403,
        );
      if (
        ["owner", "admin", "manager", "agent", "employee", "customer"].includes(
          s("key"),
        )
      )
        throw new AppError("VALIDATION_ERROR", "Choose a new role code", 422);
      result = await db.role.create({
        data: {
          organizationId: o,
          name: s("name"),
          key: s("key"),
          permissions: {
            create: requested.map((permission) => ({ permission })),
          },
        },
      });
      break;
    }
    case "users": {
      const email = z.email().parse(s("email").toLowerCase());
      const role = await db.role.findFirst({
        where: { id: s("roleId"), organizationId: o },
        include: { permissions: true },
      });
      if (
        !role ||
        role.key === "owner" ||
        role.permissions.some(
          (p) =>
            !ctx.permissions.has(
              p.permission as (typeof ALL_PERMISSIONS)[number],
            ),
        )
      )
        throw new AppError(
          "FORBIDDEN",
          "Cannot invite someone with greater privileges",
          403,
        );
      const token = randomToken();
      result = await db.invitation.create({
        data: {
          organizationId: o,
          email,
          roleId: role.id,
          invitedById: ctx.user.id,
          tokenHash: sha256(token),
          expiresAt: new Date(Date.now() + 7 * 86400000),
        },
      });
      invitation = `${env.appUrl}/invite/${token}`;
      await sendEmail({
        to: email,
        template: "invitation",
        organizationId: o,
        data: {
          organization: ctx.organization.name,
          inviter: ctx.user.name,
          role: role.name,
          url: invitation,
        },
      });
      break;
    }
    case "api": {
      const scopes = z
        .array(
          z.enum(
            ALL_PERMISSIONS as [
              (typeof ALL_PERMISSIONS)[number],
              ...(typeof ALL_PERMISSIONS)[number][],
            ],
          ),
        )
        .min(1)
        .parse(raw.permissions);
      if (scopes.some((p) => !ctx.can(p)))
        throw new AppError(
          "FORBIDDEN",
          "Cannot grant permissions you do not hold",
          403,
        );
      secret = `dx_${randomToken()}`;
      result = await db.apiKey.create({
        data: {
          organizationId: o,
          name: s("name"),
          prefix: secret.slice(0, 12),
          keyHash: sha256(secret),
          scopes,
          createdById: ctx.user.id,
        },
      });
      break;
    }
    case "webhooks":
      await assertPublicUrl(s("url"));
      secret = randomToken();
      result = await db.webhook.create({
        data: {
          organizationId: o,
          name: s("name"),
          url: s("url"),
          secretEnc: encryptSecret(secret),
          events: [...WEBHOOK_EVENTS],
        },
      });
      break;
    default:
      throw new AppError("NOT_FOUND", "Setting not found", 404);
  }
  await writeAudit({
    organizationId: o,
    userId: ctx.user.id,
    action: `settings.${section}.saved`,
    entityType: section,
    entityId: result.id,
  });
  return { id: result.id, secret, invitation };
}

/** Narrow record controls preserve complex policy/rule configuration. */
export async function controlSetting(
  ctx: OrgContext,
  section: string,
  id: string,
  command: string,
) {
  const config = SETTINGS[section];
  if (!config) throw new AppError("NOT_FOUND", "Setting not found", 404);
  requirePermission(ctx, config.permission);
  const record = (await settingsRecords(ctx, section)).find((r) => r.id === id);
  if (!record) throw new AppError("NOT_FOUND", "Record not found", 404);
  const where = { id, organizationId: ctx.organization.id };
  if (command === "revoke" && section === "api")
    await db.apiKey.update({ where, data: { revokedAt: new Date() } });
  else if (
    command === "toggle" &&
    ["automations", "webhooks", "sla"].includes(section)
  ) {
    const data = { isActive: !record.isActive };
    if (section === "automations")
      await db.automationRule.update({ where, data });
    if (section === "webhooks") await db.webhook.update({ where, data });
    if (section === "sla") {
      if (record.isDefault && record.isActive)
        throw new AppError(
          "VALIDATION_ERROR",
          "Choose another default policy before disabling this one",
          422,
        );
      await db.sLAPolicy.update({ where, data });
    }
  } else if (command === "default" && section === "sla") {
    if (!record.isActive)
      throw new AppError(
        "VALIDATION_ERROR",
        "Enable the policy before making it default",
        422,
      );
    await db.$transaction(async (tx) => {
      // Serialize default changes within the tenant without changing policy targets.
      await tx.organization.update({
        where: { id: ctx.organization.id },
        data: { updatedAt: new Date() },
      });
      await tx.sLAPolicy.updateMany({
        where: { organizationId: ctx.organization.id, isDefault: true },
        data: { isDefault: false },
      });
      await tx.sLAPolicy.update({ where, data: { isDefault: true } });
    });
  } else
    throw new AppError("VALIDATION_ERROR", "Unsupported setting action", 422);
  await writeAudit({
    organizationId: ctx.organization.id,
    userId: ctx.user.id,
    action: `settings.${section}.${command}`,
    entityType: section,
    entityId: id,
  });
  return true;
}
