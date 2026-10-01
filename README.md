# Nexora

**Connect. Assign. Achieve.** A DuooNex product.

Nexora is a tenant-aware help desk and work management app using Next.js 16, React 19, TypeScript, Prisma, PostgreSQL and NextAuth. The current workspace is configured privately for your Neon database, Neon S3-compatible storage (`media` bucket) and optional Neon Auth sign-in. Credentials are excluded from Git and the handoff archive.

## Test the configured workspace

Open http://localhost:3000/login. Choose **Workspace account** and use the demo accounts in `.data/demo-credentials.json`. Start with `owner@demo.duoonex.test`, then test agent, employee and customer access. See [tester guide](docs/TESTING.md).

```sh
npm run build
npm run start
```

## Install a fresh copy

Use Node.js 24 and npm (matching CI and Docker). Copy `.env.example` to `.env`, supply your private database/storage credentials, generate a strong random `AUTH_SECRET` and use the same value for `NEXTAUTH_SECRET`. Set all three application URLs to your public HTTPS origin when deployed.

```sh
npm ci
npm run db:deploy
npm run db:seed
npm run dev
```

`db:deploy` applies committed PostgreSQL migrations; it does not reset data. `db:seed` creates an idempotent demonstration workspace and writes its generated password to `.data/demo-credentials.json`. Do not seed demonstration users into an unattended public production workspace. Existing legacy files remain available locally; the new application does not read the old SQLite databases.

## Working flows

- Workspace sign-in, registration, invitations, password recovery, profile and tracked/revocable sessions.
- Tenant-scoped ticket creation, templates, custom fields, assignment, allowed status transitions, public replies, internal notes, private attachments, SLA display and activity.
- Tasks with assignees, projects, checklist, status, comments and time tracking; project task lists and team membership.
- Customers, assets and history, knowledge articles, departments and locations.
- Assigned approval requests, notifications, dashboards, basic reports and customer portal.
- Organization/security/branding settings; categories, priorities, statuses, templates and text custom fields; simple forms/assignment automations; SLA calendars/holidays; roles, invitations, scoped API keys and webhooks.

Advanced editors (calendar periods, arbitrary automation trees, custom field types, email overrides), bulk exports, live collaboration and billing checkout are not completed interfaces. Settings display existing complex records without flattening them. Optional integrations need their own configuration.

## Verification

```sh
npm run audit:repository
npm run verify
npm run build
# With a local server running and demo credentials present:
npm run test:acceptance
```

Unit/integration tests create a separate disposable PostgreSQL-compatible database in memory. They never use your configured Neon database. Acceptance checks intentionally use the local app and its configured backend; they sign in as demonstration users, read routes and upload/delete a temporary attachment.

See [review](docs/REVIEW.md), [architecture](docs/ARCHITECTURE.md), [deployment](docs/DEPLOYMENT.md) and [parent website integration](docs/PARENT-WEBSITE.md).

## Cleanup and release review

See [cleanup report](docs/CLEANUP.md) for the removed-file/dependency manifest, validation results and remaining release blockers. The production build passes; dependency security review still has five high affected package entries. Resolve the listed mail/auth and Prisma advisories before claiming a clean production security audit.
