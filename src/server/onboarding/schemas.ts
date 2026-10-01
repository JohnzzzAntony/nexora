import { z } from "zod";
import { LAST_STEP } from "@/server/onboarding/steps";
import { emailSchema, organizationNameSchema, personNameSchema, timezoneSchema } from "@/server/auth/schemas";


const id = z.string().trim().min(1).max(64);
const optionalText = (max: number) => z.string().trim().max(max).optional().transform(v => (v ? v : null));

export const createOrganizationSchema = z.object({ name: organizationNameSchema, timezone: timezoneSchema });

export const companySchema = z.object({
  name: organizationNameSchema,
  timezone: timezoneSchema,
  supportEmail: z.union([z.literal(""), emailSchema]).optional().transform(v => (v ? v : null)),
});

export const adminSchema = z.object({
  name: personNameSchema,
  jobTitle: optionalText(100),
  phone: z.string().trim().max(32).regex(/^[+()\d\s.-]*$/, "Use digits, spaces and + ( ) - only").optional().transform(v => (v ? v : null)),
});

export const nameSchema = z.object({ name: z.string().trim().min(1, "Enter a name").max(80, "Use at most 80 characters") });
export const idSchema = z.object({ id });
export const teamSchema = z.object({ name: z.string().trim().min(1, "Enter a team name").max(80, "Use at most 80 characters"), departmentId: z.string().trim().max(64).optional().transform(v => (v ? v : null)) });
export const renameSchema = z.object({ id, name: z.string().trim().min(1, "Enter a name").max(80, "Use at most 80 characters") });
export const inviteSchema = z.object({ email: emailSchema, roleId: id });
export const stepSchema = z.object({ step: z.number().int().min(1).max(LAST_STEP) });

const minutes = z.number({ error: "Enter a number" }).int("Use whole minutes").min(1, "Must be at least 1 minute").max(60 * 24 * 90, "Must be at most 90 days");
export const slaSchema = z.object({
  targets: z.array(z.object({ id, firstResponseMinutes: minutes, resolutionMinutes: minutes }))
    .min(1).max(50)
    .refine(list => list.every(t => t.resolutionMinutes >= t.firstResponseMinutes), "Resolution time must be at least the first-response time"),
});
