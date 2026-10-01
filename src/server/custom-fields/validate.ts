import "server-only";
import type { CustomFieldEntity, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError } from "@/lib/api/errors";

type FieldWithOptions = Prisma.CustomFieldGetPayload<{ include: { options: true } }>;

function coerce(field: FieldWithOptions, raw: unknown): { value: unknown; ref?: { kind: string; id: string } } | string {
  const str = typeof raw === "string" ? raw.trim() : raw;
  const v = field.validation as { min?: number; max?: number; pattern?: string } | null;
  const optionValues = field.options.map(o => o.value);
  switch (field.type) {
    case "TEXT": case "LONG_TEXT": case "PHONE": {
      if (typeof str !== "string") return "must be text";
      if (str.length > (field.type === "LONG_TEXT" ? 10000 : 500)) return "is too long";
      if (field.type === "PHONE" && !/^[+()\d\s.-]{5,30}$/.test(str)) return "must be a valid phone number";
      if (v?.pattern) { try { if (!new RegExp(v.pattern).test(str)) return "has an invalid format"; } catch { /* invalid admin pattern: ignore */ } }
      return { value: str };
    }
    case "NUMBER": case "CURRENCY": {
      const n = typeof str === "number" ? str : Number(str);
      if (!Number.isFinite(n)) return "must be a number";
      if (v?.min !== undefined && n < v.min) return `must be at least ${v.min}`;
      if (v?.max !== undefined && n > v.max) return `must be at most ${v.max}`;
      return { value: field.type === "CURRENCY" ? Math.round(n * 100) / 100 : n };
    }
    case "DATE": case "DATETIME": {
      const d = new Date(String(str));
      if (Number.isNaN(d.getTime())) return "must be a valid date";
      return { value: field.type === "DATE" ? d.toISOString().slice(0, 10) : d.toISOString() };
    }
    case "DROPDOWN": case "RADIO":
      return optionValues.includes(String(str)) ? { value: String(str) } : "must be one of the listed options";
    case "MULTI_SELECT": {
      const arr = Array.isArray(str) ? str.map(String) : [];
      return arr.every(x => optionValues.includes(x)) ? { value: [...new Set(arr)] } : "contains an invalid option";
    }
    case "CHECKBOX":
      return { value: str === true || str === "true" || str === "on" };
    case "URL":
      try { const u = new URL(String(str)); return ["http:", "https:"].includes(u.protocol) ? { value: u.toString() } : "must be an http(s) URL"; } catch { return "must be a valid URL"; }
    case "EMAIL":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(str)) ? { value: String(str).toLowerCase() } : "must be a valid email";
    case "USER": return { value: String(str), ref: { kind: "user", id: String(str) } };
    case "TEAM": return { value: String(str), ref: { kind: "team", id: String(str) } };
    case "DEPARTMENT": return { value: String(str), ref: { kind: "department", id: String(str) } };
    case "LOCATION": return { value: String(str), ref: { kind: "location", id: String(str) } };
    case "FILE": return { value: String(str), ref: { kind: "attachment", id: String(str) } };
  }
}

const isBlank = (v: unknown) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);

/**
 * Validates submitted values (keyed by field key) against the org's active fields.
 * Returns [fieldId, value] pairs; `partial` skips required checks for fields not submitted.
 */
export async function validateCustomFields(
  organizationId: string, entity: CustomFieldEntity, values: Record<string, unknown> | undefined,
  opts: { partial: boolean; agent: boolean; formFieldIds?: string[] },
) {
  const fields = await db.customField.findMany({
    where: { organizationId, entity, isActive: true, ...(opts.agent ? {} : { visibility: "ALL" }), ...(opts.formFieldIds ? { id: { in: opts.formFieldIds } } : {}) },
    include: { options: true },
    orderBy: { order: "asc" },
  });
  const input = values ?? {};
  const out: { fieldId: string; type: string; value: Prisma.InputJsonValue | null }[] = [];
  const errors: Record<string, string> = {};
  const refs: { kind: string; id: string; key: string }[] = [];
  for (const field of fields) {
    const submitted = Object.prototype.hasOwnProperty.call(input, field.key);
    const raw = submitted ? input[field.key] : opts.partial ? undefined : field.defaultValue;
    if (isBlank(raw)) {
      if (field.required && (!opts.partial || submitted)) errors[`customFields.${field.key}`] = `${field.label} is required`;
      else if (submitted) out.push({ fieldId: field.id, type: field.type, value: null });
      continue;
    }
    const result = coerce(field, raw);
    if (typeof result === "string") { errors[`customFields.${field.key}`] = `${field.label} ${result}`; continue; }
    if (result.ref) refs.push({ ...result.ref, key: field.key });
    out.push({ fieldId: field.id, type: field.type, value: result.value as Prisma.InputJsonValue });
  }
  for (const r of refs) {
    const o = { id: r.id, organizationId };
    const found = r.kind === "user" ? await db.membership.findFirst({ where: { userId: r.id, organizationId, status: "ACTIVE" } })
      : r.kind === "team" ? await db.team.findFirst({ where: o })
      : r.kind === "department" ? await db.department.findFirst({ where: o })
      : r.kind === "location" ? await db.location.findFirst({ where: o })
      : await db.attachment.findFirst({ where: o });
    if (!found) errors[`customFields.${r.key}`] = "refers to a record that does not exist";
  }
  if (Object.keys(errors).length) throw new AppError("VALIDATION_ERROR", Object.values(errors)[0], 422, errors);
  return out;
}
