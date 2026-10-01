# Deploy Nexora

## Environment

Deploy this server application on Vercel or a Node/Docker host. GitHub Pages can host the DuooNex parent website, but cannot run Nexora's database and authentication backend.

Create a private deployment environment from `.env.example`. Supply `DATABASE_URL` (pooled Neon host) and `DIRECT_URL` (direct Neon host) with TLS enabled; never place them in `NEXT_PUBLIC_*` variables. Configure `AUTH_SECRET` and the matching `NEXTAUTH_SECRET`, `CRON_SECRET`, and set `APP_URL`, `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL` to the same public HTTPS application origin. Keep secrets stable across releases because encrypted integration secrets and sessions depend on them.

Object storage accepts `AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET`, or the equivalent `S3_*` fields. The supplied Neon project uses bucket `media` in `ap-southeast-1`. Keep the bucket private. Browser uploads use signed PUT URLs; authorize your deployed origin in the storage CORS settings if it is not already accepted. Local development uploads were tested against this bucket. Production requires object storage; local disk fallback is development-only.

Optional Neon sign-in uses `NEON_AUTH_URL` and `NEON_AUTH_JWKS_URL`; ensure your deployed origin is trusted by Neon Auth. Optional Google/Microsoft SSO need their own credentials and callback origins. Configure Resend or SMTP and a verified sender for email. Configure the separate inbound secret before enabling email-to-ticket.

## Release steps

1. Set private environment variables on the host.
2. Run `npm ci`, `npm run verify`, `npm run db:deploy`, then `npm run build`.
3. Start with `npm run start` or deploy on Vercel. Vercel's configured region is `sin1`, near the supplied Neon project.
4. Check `/api/health`, sign-in, a ticket workflow and attachment upload/download using the real deployed origin.
5. Schedule `/api/cron` with `Authorization: Bearer <CRON_SECRET>` for email retries, SLA processing and pending jobs. The included Vercel schedule is daily; use a more frequent external scheduler or appropriate plan for timely SLA processing.
6. Put the application URL into the parent website link described in `PARENT-WEBSITE.md`.

Docker uses a standalone Next.js build and runs committed Prisma migrations before startup. Pass the private `.env` at runtime; it is excluded from the build context. Docker was reviewed but has not been executed on this workstation.

Do not run schema reset or `prisma db push` as a release step. Use Neon recovery/backup facilities and review migration changes before applying them to existing production data. Demo seed is for controlled testing only.
