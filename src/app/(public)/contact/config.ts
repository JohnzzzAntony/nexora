import "server-only";
import { env, features } from "@/lib/env";

/** Sales inbox for demo requests; the form is disabled when this is not set. */
export function contactRecipient() {
  const value = process.env.SALES_EMAIL?.trim();
  return value && /^\S+@\S+\.\S+$/.test(value) ? value : null;
}

/** In production an email provider is also required, otherwise requests would never be delivered. */
export function isContactConfigured() {
  return Boolean(contactRecipient()) && (features.email || !env.isProduction);
}
