# Tester handoff

## Start here

In the configured workspace, run `npm run build` followed by `npm run start`, then open http://localhost:3000/login. Use **Workspace account**. Read the generated password in the private `.data/demo-credentials.json` file; it is deliberately absent from the archive.

| Account | What to test |
| --- | --- |
| owner@demo.duoonex.test | All management screens and organization settings |
| admin@demo.duoonex.test | Administration without owner-only billing privileges |
| manager@demo.duoonex.test | Team work and approvals |
| agent@demo.duoonex.test | Ticket handling |
| employee@demo.duoonex.test | Own requests and assigned tasks |
| customer@demo.duoonex.test | Customer portal and public responses |

Use a separate browser profile or sign out between roles. In **Profile**, you can view/revoke active sessions. Demo accounts have verified emails so testing does not depend on a mail provider.

## Test checklist

1. Sign in as owner. Check Dashboard and every sidebar page on desktop and mobile.
2. Create a ticket using a template; choose category, priority, team and assignee. Add an allowed attachment. Submit and open its detail page.
3. Add a public reply and an internal note. Change status using an allowed transition. Refresh and confirm the data persisted.
4. Sign in as customer. Open the customer portal and verify only authorized requests and public messages are visible. Create a request.
5. Create a project and an assigned task. Open the task, add checklist items, record time and leave a comment. Sign in as its assignee and update progress.
6. Create an approval for another reviewer. Sign in as that reviewer and approve/reject once.
7. Add/edit a category or ticket template. Verify another organization cannot access its records.
8. Inspect notifications, asset history, knowledge and audit logs. Follow the DuooNex parent company link.

On Windows, `./Start-Testing.ps1` builds and starts the configured project. Add `-SkipBuild` only when a current production build already exists. The script does not migrate or seed the database automatically.

## Automated checks

`npm run verify` checks types, lint and isolated unit/integration tests. With the local server running, `npm run test:acceptance` checks authentication, main routes, API denials, origin protection and real Neon attachment upload/download/cleanup. It records a redacted result in `.data/acceptance-report.json`; a verified copy is supplied in `docs/acceptance-report.json`.

## Testing limits

- SMTP/Resend is not configured. Invitations return a copyable invitation link; external verification/reset and notification email delivery need a provider.
- Neon Auth is an optional login choice for already verified Neon accounts. The endpoint and invalid-login handling were checked; a successful verified Neon account login needs an actual account in that service. Local workspace login is fully tested. The JWKS URL is configured, but API authentication currently uses tracked NextAuth sessions and Nexora API keys, not Neon JWT bearer tokens.
- Complex settings can be inspected; some editors currently offer simple creation rather than complete editing. New SLA policies remain optional until you choose **Make default**; existing targets are preserved.
- Testing writes real demonstration data to the supplied Neon project. Use a separate Neon branch before destructive or load testing.
- This is a local handoff. No public application deployment or parent website publication has been performed.
