import { z } from "zod";
import { passwordSchema } from "@/lib/auth/password";
import { personNameSchema } from "@/server/auth/schemas";
import { NOTIFICATION_EVENT_KEYS } from "@/server/profile/events";

const optional = (schema: z.ZodString) => schema.optional().transform(v => (v ? v : null));

export const profileSchema = z.object({
  name: personNameSchema,
  jobTitle: optional(z.string().trim().max(100, "Use at most 100 characters")),
  phone: optional(z.string().trim().max(32, "Use at most 32 characters").regex(/^[+()\d\s.-]*$/, "Use digits, spaces and + ( ) - only")),
  avatarUrl: optional(z.string().trim().max(2048, "URL is too long").refine(v => !v || /^https:\/\/[^\s]+$/i.test(v), "Use an https:// image URL")),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().max(128).optional().default(""),
  newPassword: passwordSchema,
  confirmPassword: z.string(),
}).refine(v => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

export const sessionIdSchema = z.object({ id: z.string().trim().min(1).max(64) });

export const preferencesSchema = z.object({
  preferences: z.array(z.object({ eventType: z.enum(NOTIFICATION_EVENT_KEYS), inApp: z.boolean(), email: z.boolean() })).max(NOTIFICATION_EVENT_KEYS.length),
});

export const leaveSchema = z.object({ organizationId: z.string().trim().min(1).max(64) });
