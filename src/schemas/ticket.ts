import { z } from "zod";

const id = z.string().min(1).max(40);
const optionalId = id.nullish().or(z.literal("")).transform(v => (v === undefined ? undefined : v || null));
const dateish = z.union([z.coerce.date(), z.literal(""), z.null()]).optional().transform(v => (v instanceof Date && !Number.isNaN(v.getTime()) ? v : v === undefined ? undefined : null));

export const customFieldValuesSchema = z.record(z.string(), z.unknown()).optional();

export const createTicketSchema = z.object({
  subject: z.string().trim().min(3, "Subject must be at least 3 characters").max(200),
  description: z.string().max(100_000).default(""),
  requesterId: optionalId.optional(),
  categoryId: optionalId.optional(),
  subcategoryId: optionalId.optional(),
  priorityId: optionalId.optional(),
  teamId: optionalId.optional(),
  assigneeId: optionalId.optional(),
  locationId: optionalId.optional(),
  customerId: optionalId.optional(),
  projectId: optionalId.optional(),
  assetIds: z.array(id).max(20).default([]),
  dueDate: dateish,
  tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  attachmentIds: z.array(id).max(20).default([]),
  customFields: customFieldValuesSchema,
  templateId: optionalId.optional(),
});
export type CreateTicketInput = z.input<typeof createTicketSchema>;

export const updateTicketSchema = z.object({
  version: z.number().int().optional(),
  subject: z.string().trim().min(3).max(200).optional(),
  description: z.string().max(100_000).optional(),
  statusId: id.optional(),
  priorityId: id.optional(),
  categoryId: optionalId.optional(),
  subcategoryId: optionalId.optional(),
  teamId: optionalId.optional(),
  assigneeId: optionalId.optional(),
  requesterId: id.optional(),
  locationId: optionalId.optional(),
  customerId: optionalId.optional(),
  projectId: optionalId.optional(),
  dueDate: dateish,
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  customFields: customFieldValuesSchema,
});
export type UpdateTicketInput = z.input<typeof updateTicketSchema>;

export const addMessageSchema = z.object({
  type: z.enum(["PUBLIC", "INTERNAL"]).default("PUBLIC"),
  bodyHtml: z.string().min(1, "Message cannot be empty").max(100_000),
  attachmentIds: z.array(id).max(20).default([]),
  mentionedUserIds: z.array(id).max(50).default([]),
});
export type AddMessageInput = z.input<typeof addMessageSchema>;
