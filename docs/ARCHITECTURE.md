# Architecture

The current app uses `src/app` App Router routes, React Server Components for authorized data reads, client forms for interaction, Server Actions for workspace mutations and route handlers for the ticket/file APIs. `src/proxy.ts` is the request gate beside `src/app`.

`src/lib/tenancy` builds the current organization context from active membership and role permissions. Domain services in `src/server/tickets`, `src/server/work` and related modules enforce permissions and tenant references independently of UI visibility. Customer portal routes use scoped ticket reads and omit internal notes.

Prisma's PostgreSQL schema and committed migrations live in `prisma`. Runtime uses the pooled database URL; migrations use the direct connection URL. Organization-scoped number counters provide ticket/task references. Legacy SQLite files and legacy source are preserved locally as historical material and are not used by this application.

NextAuth credentials and optional OAuth providers issue JWTs tied to server-side session records. Optional Neon Auth verifies a password at the configured HTTPS endpoint and maps verified identities to local users; authorization and organization membership remain in Nexora. Unsupported bearer tokens are rejected rather than falling back to a browser session. API keys store hashes and intersect their scopes with the creator's current permissions.

Neon S3-compatible storage provides private signed upload/download URLs. Signed upload grants are authenticated, bounded and tenant-linked; completion creates an attachment record after validating the object. The email outbox, automation rules, audit trail, notifications and cron runner support ticket side effects. External mail, OAuth, billing and observability are independently configured options.

Brand constants in `src/config/brand.ts` define Nexora, its tagline and the DuooNex parent site. The parent site is an external link; Nexora runs on its own application host.
