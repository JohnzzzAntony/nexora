# Nexora — implementation audit and release record

## Baseline audit (2026-10-01)

The deployed application is Next.js 16 / React 19 / TypeScript, Tailwind 4 and Radix UI, React Query and Zustand, Prisma 6 with PostgreSQL, NextAuth credentials/JWT and bcrypt. The Dockerfile and latest commit target PostgreSQL. Django/SQLite, templates and static assets are a separate older implementation; retain them and their database. Existing uncommitted CSS/component changes and two modified SQLite databases belong to the user and must be preserved.

Routes: `/` is a client-side application shell, with dashboard, ticket list/board/detail, knowledge base, profile, notification center and administration views. API domains: auth, tickets (assignment, comments, internal notes, attachments), departments, categories, users, custom fields, approvals, SLA, dashboard, CSV export, audit logs, knowledge base, health and OpenAPI. Models correspond to those domains; existing SQL migration initializes PostgreSQL. Email uses Nodemailer; optional Socket.IO service is inconsistent with its environment configuration.

Reuse: existing components, query patterns, authentication provider, entity IDs, domain services, administration, knowledge base, notification polling, deployment architecture. Do not replace the stack or copy SQLite records into PostgreSQL implicitly.

Findings:
- `.env` and `.env.example` use SQLite although the schema and deployment require PostgreSQL. Docker is installed but its daemon is stopped. No local PostgreSQL listener detected.
- Unrestricted ticket PATCH accepts Prisma update fields. Several comment/attachment routes lack ticket visibility checks. Requester ticket details expose internal notes.
- Authentication bootstraps a known default administrator password; JWT roles do not reflect account disablement. Secret has an insecure fallback.
- Uploads use public predictable paths and lack type/size validation. Export permits spreadsheet formulas and unbounded results.
- Dashboard cache mixes users; employee summaries are department-wide. Mutation invalidation does not invalidate that cache.
- Assignment, replies and approvals have duplicated divergent implementations. Approval endpoint does not advance workflow.
- Tests include placeholder assertions unrelated to production code. Typecheck passes; lint has one pre-existing font warning. Four Django tests pass. Initial Node tests are blocked by sandbox worker spawning; rerun outside sandbox.
- Missing: work logs, subtasks, team/company hierarchy, expanded configurable permissions/statuses, business calendars, full reporting and employee workspace.
- Brand assets: only a generic existing SVG and a screenshot found; no verified DuooNex logo. Do not invent the supplied logo.

## Incremental implementation plan

1. Establish safe local PostgreSQL testing and document baseline; preserve all existing databases.
2. Centralize live-account permission and ticket-scope checks; restrict mutation payloads, notes, comments, downloads and exports. Fix bootstrap and logout.
3. Add additive migrations for work logs/subtasks and scheduling metadata; keep existing statuses/IDs compatible.
4. Extend existing ticket detail and request screens with useful work management, attach/download, audited changes and approvals.
5. Add Nexora branding, My Work and My Requests navigation, scoped dashboard/reporting and clear admin access.
6. Run actual policy/validation tests, integration workflow checks, production build and desktop/mobile browser QA. Record unverified features and remaining scope explicitly.

## Database safeguards

No resets, destructive seeds or schema pushes against the user's existing databases. Apply additive migrations to an isolated development PostgreSQL database first. Back up production and validate migration history before release. Never mark this scope production-ready until all requested role/workflow/security checks have passed.
