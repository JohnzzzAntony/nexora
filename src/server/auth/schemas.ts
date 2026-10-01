import { z } from "zod";
import { passwordSchema } from "@/lib/auth/password";
import { normalizeTimezone } from "@/server/auth/timezone";

export const emailSchema = z.string().trim().toLowerCase().max(254, "Email is too long").pipe(z.email("Enter a valid email address"));
export const personNameSchema = z.string().trim().min(1, "Enter your name").max(100, "Name is too long");
export const organizationNameSchema = z.string().trim().min(2, "Use at least 2 characters").max(100, "Name is too long");
export const timezoneSchema = z.string().trim()
  .refine(tz => normalizeTimezone(tz) !== null, "Select a valid time zone")
  .transform(tz => normalizeTimezone(tz)!);
export const tokenSchema = z.string().trim().min(16, "This link is invalid").max(256, "This link is invalid");

export const registerSchema = z.object({
  name: personNameSchema,
  email: emailSchema,
  password: passwordSchema,
  organizationName: organizationNameSchema,
  timezone: timezoneSchema,
});
export type RegisterInput = z.input<typeof registerSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: tokenSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine(v => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

export const acceptInvitationSchema = z.object({ token: tokenSchema });

export const acceptInvitationNewUserSchema = z.object({
  token: tokenSchema,
  name: personNameSchema,
  password: passwordSchema,
});
