# Email

## Outbound

`sendEmail()` (`src/lib/email`) renders a template (organization override from **Settings → Email
Templates**, else the built-in template in `src/lib/email/templates.ts`), stores it in `email_logs`
(the outbox) and delivers after the HTTP response via `after()`.

- Provider order: `RESEND_API_KEY` → `SMTP_HOST` → (development only) console log.
- Failures: status stays `PENDING` with exponential backoff (2^attempt minutes); after 5 attempts the row is
  `FAILED` with the last error. The cron job retries due rows. Ticket creation never waits on email.
- Every row records provider, recipient, template, status, attempts, sent date, error and related entity.
- Ticket emails carry `Message-ID`/`In-Reply-To`/`References` headers (`<ticket-{id}@host>`), the subject tag
  `[#number]`, and `Reply-To` = the organization's support address, so replies thread back.

## Inbound (email-to-ticket)

`POST /api/inbound/email?token=<organization inbound token>` with header `x-inbound-secret: $INBOUND_EMAIL_SECRET`.
Accepts the generic JSON shape (see `src/server/inbound/email.ts`) or Postmark's inbound webhook format.

Flow: verify secret → organization from token (never from headers) → idempotency by `Message-ID` →
sender must be an active member or a known customer contact (or the org allows customer sign-up) →
thread by our `Message-ID` in `In-Reply-To/References`, else `[#number]` in the subject → append reply
(quoted history stripped) or create ticket (source `EMAIL`) → attachments validated and stored → normal
notifications/automation run.

Setup with Postmark (free developer tier): create an inbound stream, set the webhook URL to
`https://<app>/api/inbound/email?token=<token from Settings → Email>` and add the custom header
`x-inbound-secret`. Forward `support@yourdomain.com` to the Postmark inbound address.
