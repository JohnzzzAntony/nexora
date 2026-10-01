# Security

| Control | Implementation |
| --- | --- |
| Password hashing | bcrypt cost 12 (`src/lib/auth/password.ts`); policy ≥ 8 chars with letter + number |
| Sessions | Auth.js JWT carrying a server-side `Session` id; every request validates the row (revocation, expiry, deactivated user) — `src/lib/auth/session.ts`. Password reset/change revokes sessions. |
| Login protection | Postgres-backed rate limit per email+IP (10 / 15 min); generic error messages; no user enumeration on reset |
| Tokens | Verification/reset/invitation tokens are random 256-bit values; only SHA-256 hashes are stored; single use; expiring |
| Tenant isolation | Every query filters by the caller's `organizationId` from `OrgContext`; foreign ids in inputs are verified to belong to the tenant (`assertOwned`); covered by integration tests |
| RBAC | Permission keys (`src/lib/permissions/catalog.ts`) granted per role (custom roles supported); enforced in domain services via `requirePermission`; UI hiding is cosmetic only |
| Ticket visibility | `ticketVisibilityWhere()` — own/requested, watched, team/department scope, or `tickets.view_all`; customers limited to their own (optionally their company's) tickets; internal notes require `tickets.internal_notes` and are never returned to customers |
| API keys | `dx_` prefixed 256-bit secrets shown once; SHA-256 stored; scopes intersected with the creator's current role; expiry, revocation, last-used; per-key rate limit (600/min) |
| CSRF | Server Actions: Next.js origin check. Route handlers: `src/proxy.ts` rejects cookie-authenticated mutations whose `Origin` host differs from the request host. |
| XSS | Rich text sanitized server-side with an allow-list (`sanitize-html`); links forced `rel=noopener noreferrer nofollow`; React escapes everything else; emails escape template variables |
| SQL injection | Prisma parameterized queries only; no string-built SQL |
| File uploads | Allow-listed MIME + matching extension, filename validation, org-configurable size limit, zip disabled by default; private bucket; presigned PUT (10 min) and GET (5 min) URLs; download authorization follows the owning entity; `Content-Security-Policy: sandbox` on local dev downloads |
| Webhooks (outbound) | HMAC-SHA256 signature header `X-Duoonex-Signature: t=<ts>,v1=<hex>` over `${t}.${body}`; secrets encrypted at rest (AES-256-GCM); SSRF guard blocks private/loopback addresses; no redirects followed; 10 s timeout |
| Inbound email | Shared secret + per-organization token; organization never inferred from headers; idempotent by Message-ID; unknown senders rejected unless customer sign-up enabled |
| Secrets | Only in environment variables; integration/webhook secrets encrypted with a key derived from `AUTH_SECRET` |
| Headers | HSTS, `X-Frame-Options: DENY`, `nosniff`, strict referrer, permissions policy (`next.config.ts`) |
| Audit | Append-only `audit_logs` (actor, action, entity, IP, user agent, before/after); no update/delete path in the app |
| Errors | Clients receive codes and safe messages; stack traces only in server logs |

## Verifying webhook signatures (receiver side)

```ts
const [t, v1] = header.split(",").map(p => p.split("=")[1]);
const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
if (!timingSafeEqual(Buffer.from(expected), Buffer.from(v1)) || Date.now() / 1000 - Number(t) > 300) reject();
```
