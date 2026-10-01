# Deployment Guide

## Environments

- Development: local SQLite database and `npm run dev`.
- Staging: production build with staging secrets and a staging database.
- Production: production build, HTTPS, monitored logs, and managed backups.

## Required Secrets

- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- SMTP settings when email delivery is enabled.

## Release Checklist

1. Run `npm run verify`.
2. Run `npm run build`.
3. Apply database migrations or `prisma db push` for controlled SQLite installs.
4. Confirm `/api/health` returns `status: ok`.
5. Confirm login, ticket creation, assignment, reply, resolution, and admin user management.

## Observability

Application errors are logged server-side. In production, forward stdout/stderr to the hosting provider log drain and connect an error tracker such as Sentry.
