import "server-only";

// Central access to optional integrations; features that need them check these flags
// and are hidden or return a clear configuration error when absent.
export const env = {
  appUrl: (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, ""),
  authSecret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "",
  cronSecret: process.env.CRON_SECRET || "",
  emailFrom: process.env.EMAIL_FROM || process.env.SMTP_FROM || "Nexora <no-reply@localhost>",
  resendKey: process.env.RESEND_API_KEY || "",
  smtp: { host: process.env.SMTP_HOST || "", port: Number(process.env.SMTP_PORT || 587), user: process.env.SMTP_USER || "", password: process.env.SMTP_PASSWORD || "" },
  inboundSecret: process.env.INBOUND_EMAIL_SECRET || "",
  neonAuth: { url: process.env.NEON_AUTH_URL || "", jwksUrl: process.env.NEON_AUTH_JWKS_URL || "" },
  s3: {
    endpoint: process.env.S3_ENDPOINT || process.env.AWS_ENDPOINT_URL_S3 || "",
    region: process.env.S3_REGION || process.env.AWS_REGION || "auto",
    accessKey: process.env.S3_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID || "",
    secretKey: process.env.S3_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY || "",
    bucket: process.env.S3_BUCKET || process.env.AWS_S3_BUCKET || "",
  },
  google: { id: process.env.GOOGLE_CLIENT_ID || "", secret: process.env.GOOGLE_CLIENT_SECRET || "" },
  microsoft: { id: process.env.MICROSOFT_CLIENT_ID || "", secret: process.env.MICROSOFT_CLIENT_SECRET || "", tenant: process.env.MICROSOFT_TENANT_ID || "common" },
  stripe: { secret: process.env.STRIPE_SECRET_KEY || "", webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "", prices: { STARTER: process.env.STRIPE_PRICE_STARTER || "", BUSINESS: process.env.STRIPE_PRICE_BUSINESS || "" } },
  isProduction: process.env.NODE_ENV === "production",
};

export const features = {
  get email() { return Boolean(env.resendKey || env.smtp.host); },
  get objectStorage() { return Boolean(env.s3.bucket && env.s3.accessKey && env.s3.secretKey); },
  // Local disk storage is a development convenience only.
  get storage() { return features.objectStorage || !env.isProduction; },
  get googleSso() { return Boolean(env.google.id && env.google.secret); },
  get microsoftSso() { return Boolean(env.microsoft.id && env.microsoft.secret); },
  get billing() { return Boolean(env.stripe.secret && env.stripe.prices.STARTER); },
  get inboundEmail() { return Boolean(env.inboundSecret); },
  get neonAuth() { return Boolean(env.neonAuth.url); },
};
