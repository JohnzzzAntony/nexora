# Validation evidence

Checked 1 October 2026 against the configured Neon project.

- `npm run verify`: TypeScript and ESLint passed; **31/31** unit/integration tests passed in a separate in-memory database.
- `npm run build`: successful Next.js production build, including the request proxy.
- `npm run typecheck`: route type generation and TypeScript passed.
- `npm run test:acceptance`: **60/60** HTTP checks passed against the production server. See `acceptance-report.json`.
- Browser: workspace sign-in, ticket creation, assignment, public reply and status update verified. Dashboard/task controls inspected at desktop and mobile sizes. Production browser console contained no errors during final inspection.
- Neon storage: signed PUT, attachment persistence, authorized GET and temporary attachment removal all passed.
- Customer: sign-in and portal pages passed; staff settings redirected, employee ticket denied, customer API returned public messages only.

Production server is served locally for handoff. Docker and a public deployment were not executed. Successful Neon managed-account login needs a verified account to validate; external email needs SMTP/Resend credentials.
