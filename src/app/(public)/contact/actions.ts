"use server";

import { z } from "zod";
import { safeAction, type ActionResult } from "@/lib/actions";
import { AppError } from "@/lib/api/errors";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { requestMeta } from "@/server/auth/request";
import { emailSchema, personNameSchema } from "@/server/auth/schemas";
import { contactRecipient, isContactConfigured } from "./config";

const TEAM_SIZES = ["1-10", "11-50", "51-200", "201-1000", "1000+"] as const;

const contactSchema = z.object({
  name: personNameSchema,
  email: emailSchema,
  company: z.string().trim().min(1, "Enter your company name").max(120, "Use at most 120 characters"),
  teamSize: z.enum(TEAM_SIZES, { error: "Select a team size" }),
  message: z.string().trim().max(2000, "Use at most 2000 characters").optional().default(""),
  // Honeypot: real users never fill this hidden field.
  website: z.string().max(0).optional().default(""),
});

export async function submitDemoRequestAction(input: Record<string, string>): Promise<ActionResult<{ sent: true }>> {
  return safeAction(async () => {
    const to = contactRecipient();
    if (!to || !isContactConfigured()) throw new AppError("NOT_CONFIGURED", "The contact form is not configured.", 503);
    const { ip } = await requestMeta();
    const limited = await rateLimit(`contact:${ip}`, 5, 3600);
    if (!limited.allowed) throw new AppError("RATE_LIMITED", "You've sent several requests recently. Please try again later.", 429);
    const data = contactSchema.parse(input);
    const body = [
      `Name: ${data.name}`,
      `Email: ${data.email}`,
      `Company: ${data.company}`,
      `Team size: ${data.teamSize}`,
      data.message ? `Message: ${data.message}` : null,
    ].filter(Boolean).join(" · ");
    await sendEmail({
      to,
      template: "notification",
      data: { title: `Demo request from ${data.company}`, body, url: env.appUrl },
      headers: { "Reply-To": data.email },
      entityType: "demo_request",
    });
    return { sent: true as const };
  });
}
