# Production cleanup report — 2026-10-01

## Scope and safety

Inspected the Next.js frontend, API routes, server actions/services, tenant context, authentication, Prisma schema/migrations, storage, email/webhooks, jobs, configuration, dependency graph, tests and deployment setup before changing application code. Also inspected the separate Django app, websocket prototypes and historical snapshots.

Existing user changes were preserved. No database reset, schema change, data migration, role change, authentication policy change or product feature rewrite was performed. All framework/API entry points were retained. Removed files were checked through import reachability and repository references; uncertain independent projects and domain operations were preserved.

## 1. Files removed

52 files: 48 unused source files, the obsolete Tailwind v3 config, two generated development logs and the obsolete root Bun lock. npm/package-lock.json is the main app's documented and deployed install path; the independent notification service retains its own Bun lock.

## 2. Dead code removed

Removed unreferenced UI components/hooks, the unused upload-client and URL-state helpers, unused clientMeta/pageParams API helpers, CurrentUser type, isPermission helper, ACCEPT_ATTRIBUTE constant, redundant validator parameter, unused imports and obsolete config variables. Moved the still-used safeHex helper into src/lib/color.ts before deleting its otherwise-unused component. Existing domain message editing/deletion functions and automation input schema remain for review.

## 3. Dependencies removed

42 direct dependency declarations removed. Direct dependencies fell from 98 to 56. Lock entries fell from 1,188 to 714 (including platform-specific optional entries, not all physically installed packages). The switch package was restored after the final integrity scan confirmed its active use. Socket packages and scroll-area remain because preserved examples use them. No peer-dependency force override was used.

## 4. Refactoring

Formatted dense work components, services and settings/resource definitions for reviewable code. Shared reference data with resource extras, extracted the color helper, removed redundant service reads, guaranteed database disconnect on job failure, corrected the realtime documentation and expanded Docker exclusions. Enabled unused-variable and debugger checks. Added npm run audit:repository to detect broken imports, missing direct dependencies, source reachability and cycles; CI runs it after install.

## 5. Performance

Task tooling reuses the already tenant-scoped record instead of querying it again. Team extras reuse member options already loaded by the page. Resource detail pages without lookup fields skip five lookup queries. Category children are grouped in one pass instead of rescanning the array for every parent. Production CSS decreased from 207,586 to 157,801 bytes (about 24%); no UI behavior or theme rules were intentionally changed. No benchmark claim is made for live database latency.

## 6. Security

Updated vulnerable Next.js/NextAuth/Sharp and compatible transitive packages. The final lock resolves Next.js and eslint-config-next 16.3.8, NextAuth 4.24.15, Sharp 0.35.5 and matching Prisma CLI/client 6.19.3. Audit fell from 32 affected package entries (two critical) to five high entries; zero critical remain. These entries include dependency chains, not five distinct vulnerabilities.

Remaining dependency blockers:

- Nodemailer 7 and dependent NextAuth remain affected by high advisories. The patched Nodemailer major is outside NextAuth 4's declared peer range. Plan a compatible mail/auth upgrade and verify both workspace and provider sign-in; do not force an incompatible peer resolution.
- Prisma CLI -> @prisma/config -> deepmerge-ts remains affected by stack exhaustion with recursive object graphs. A fix requires a newer major of that transitive dependency or a compatible Prisma release. Do not blindly rerun audit fix: it previously chose an older Prisma CLI while leaving a newer client. Matching versions were restored.

The active application scan did not find embedded live credentials. Private .env and .data remain ignored and are excluded from the handoff. Credentials supplied in chat should be rotated before a public release.

Independent/development systems are not production certified: Django has a development secret fallback, DEBUG enabled and wildcard allowed hosts; the websocket prototype lacks room authentication/authorization and allows wildcard CORS; Caddy permits a query-selected localhost proxy port. They were preserved, excluded from the main Docker build where relevant, and require explicit ownership and deployment review.

Security review backlog: webhook DNS validation is separate from the subsequent fetch resolution and chat webhooks follow redirects; review DNS rebinding/multiple-address/IPv6 protections. Review provider email/account-linking guarantees, concurrent multi-approver decisions, custom-field regex complexity and inbound email attachment limits with dedicated tests. These findings were not used to change business policies during cleanup.

## 7. Checks

- Type generation and TypeScript: pass.
- ESLint: zero errors, five warnings. The warnings flag full page navigation after auth/organization changes. Existing reload behavior is preserved to avoid stale session/query state; no new suppression was added.
- Main unit/integration tests: 33 pass, including two new category ordering/filtering/tenant/customer regression tests. Tests use disposable local PGlite and do not migrate Neon.
- Independent Django tests: four pass; test database created and destroyed by Django.
- npm ls --depth=0: pass, no missing/invalid packages.
- Import audit: 225 files inspected, zero missing imports, undeclared imports, circular dependencies or unused source-file candidates. Independent examples count as entry points. This does not prove every exported function is unused or every dynamic call is safe to remove.
- Production acceptance: 60/60 checks pass, including staff/customer sign-in, routes, bearer/CSRF enforcement, portal isolation and temporary storage upload/download/delete.
- Browser: authenticated production dashboard rendered correctly with the existing user organization and parent-company link.
- Active src console.log/console.debug/debugger scan: no matches. Intentional operational logs and test assertions remain.
- npm audit: five high affected entries remain; this check is not clean and is a release blocker for a zero-high policy.

## 8. Build

npm run build passed with Next.js 16.3.8. The production server runs at http://localhost:3000. A local static-directory warning comes from preserved Django assets; those assets are excluded from the main Docker context. Docker itself was not executed on this workstation.

## 9. Remaining technical debt

The repository still contains independent Django/prototype apps, historical snapshots, old databases and uncertain scratch helpers. The main app's existing advanced-feature/editor limitations described in README are unchanged. Existing broad ESLint relaxations and explicit-any patterns remain; expanding them needs a dedicated behavior-preserving pass. Acceptance covers HTTP flows and a dashboard visual check, not exhaustive browser interactions or load testing.

## 10. Manual review before release

Resolve the mail/auth and Prisma dependency advisories. Decide which independent applications, databases, historical migrations and scratch tools should be archived; do not delete them without confirming ownership. Review webhook networking and account-linking/concurrency policies. Configure production mail and optional provider credentials, trusted origins, storage CORS and job scheduling. Run Docker and deployment-origin smoke tests. Rotate supplied credentials. No public deployment, push or commit was performed.

## Removed file manifest

- `src/components/ui/accordion.tsx`
- `src/components/ui/alert.tsx`
- `src/components/ui/aspect-ratio.tsx`
- `src/components/ui/avatar-group.tsx`
- `src/components/ui/breadcrumb.tsx`
- `src/components/ui/calendar-view.tsx`
- `src/components/ui/calendar.tsx`
- `src/components/ui/carousel.tsx`
- `src/components/ui/chart.tsx`
- `src/components/ui/checkbox.tsx`
- `src/components/ui/collapsible.tsx`
- `src/components/ui/combobox.tsx`
- `src/components/ui/context-menu.tsx`
- `src/components/ui/data-table.tsx`
- `src/components/ui/date-picker.tsx`
- `src/components/ui/date-range-picker.tsx`
- `src/components/ui/drawer.tsx`
- `src/components/ui/form.tsx`
- `src/components/ui/hover-card.tsx`
- `src/components/ui/input-otp.tsx`
- `src/components/ui/kanban.tsx`
- `src/components/ui/menubar.tsx`
- `src/components/ui/multi-select.tsx`
- `src/components/ui/navigation-menu.tsx`
- `src/components/ui/pagination-bar.tsx`
- `src/components/ui/pagination.tsx`
- `src/components/ui/priority-badge.tsx`
- `src/components/ui/progress.tsx`
- `src/components/ui/radio-group.tsx`
- `src/components/ui/resizable.tsx`
- `src/components/ui/rich-text-content.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/separator.tsx`
- `src/components/ui/sidebar.tsx`
- `src/components/ui/slider.tsx`
- `src/components/ui/stat-card.tsx`
- `src/components/ui/table.tsx`
- `src/components/ui/timeline.tsx`
- `src/components/ui/toast.tsx`
- `src/components/ui/toaster.tsx`
- `src/components/ui/toggle-group.tsx`
- `src/components/ui/toggle.tsx`
- `src/components/ui/toolbar.tsx`
- `src/hooks/use-mobile.ts`
- `src/hooks/use-toast.ts`
- `src/lib/upload-client.ts`
- `src/lib/url-state.ts`
- `src/components/ui/status-badge.tsx`
- `tailwind.config.ts`
- `install_log.txt`
- `server_output.txt`
- `bun.lock`

## Removed dependency manifest

- `@dnd-kit/core`
- `@dnd-kit/sortable`
- `@dnd-kit/utilities`
- `@hookform/resolvers`
- `@mdxeditor/editor`
- `@radix-ui/react-accordion`
- `@radix-ui/react-aspect-ratio`
- `@radix-ui/react-checkbox`
- `@radix-ui/react-collapsible`
- `@radix-ui/react-context-menu`
- `@radix-ui/react-hover-card`
- `@radix-ui/react-menubar`
- `@radix-ui/react-navigation-menu`
- `@radix-ui/react-progress`
- `@radix-ui/react-radio-group`
- `@radix-ui/react-select`
- `@radix-ui/react-separator`
- `@radix-ui/react-slider`
- `@radix-ui/react-toast`
- `@radix-ui/react-toggle`
- `@radix-ui/react-toggle-group`
- `@reactuses/core`
- `@tanstack/react-table`
- `exceljs`
- `framer-motion`
- `input-otp`
- `lodash`
- `next-intl`
- `pdf-lib`
- `react-day-picker`
- `react-hook-form`
- `react-markdown`
- `react-resizable-panels`
- `react-syntax-highlighter`
- `recharts`
- `tailwindcss-animate`
- `uuid`
- `vaul`
- `z-ai-web-dev-sdk`
- `zustand`
- `bun-types`
- `embla-carousel-react`
