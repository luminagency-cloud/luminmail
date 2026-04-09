# luminmail

Minimal webmail client prototype using app-managed auth, Postgres-backed state, IMAP sync, and SMTP send/reply.

## Current status

Built now:
- Email/password auth on `/`
- Password reset request flow on `/`
- Password update flow on `/reset-password`
- Protected app shell for `/inbox`, `/accounts`, and related APIs
- App-level users stored in `public.users`
- DB-backed mail account records owned by `public.users.id`
- Mailbox passwords encrypted server-side before database storage
- Account switcher plus editable account names and mailbox host settings
- Account creation validates IMAP and SMTP before saving
- Account server settings can be edited without re-entering the mailbox password
- Account update revalidates IMAP and SMTP when a new mailbox password is supplied
- Optional per-account reply signature
- Inbox message list backed by live IMAP header sync into `messages` and `threads`
- Reply/send uses the connected account's SMTP credentials
- Message delete attempts provider-side IMAP move-to-trash before removing local cache
- SMTP attempts are persisted to `public.send_log`
- Mail sync progress is tracked in `public.sync_state`
- Folder metadata is discovered from IMAP and used for trash-folder targeting
- DB-only issue reporting from the inbox UI into `public.issue_reports`
- DB-backed app error logging via `public.app_error_logs`

Still not done:
- Durable worker/queue orchestration beyond the current global cron-triggered sync
- Folder sync beyond `INBOX`
- Rich HTML body rendering and sanitization hardening
- RLS policies and hardening pass

## Docs

- Schema reference: [`docs/schema.md`](D:/_work/luminmail/docs/schema.md)
- Manual verification: [`docs/manual-test-plan.md`](D:/_work/luminmail/docs/manual-test-plan.md)
- Build plan and handoff notes: [`plan.MD`](D:/_work/luminmail/plan.MD)

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Set `DATABASE_URL` to your Postgres database.
3. Set `MAIL_SECRET_KEY`.
4. Run `npm install` if needed, then `npm run dev`.

When the `DEV_MAIL_ACCOUNT_*` variables are present, the app loads that mailbox as a read-only development account in the account switcher and settings page.

`MAIL_SECRET_KEY` is a server-only encryption secret for stored mailbox passwords. Keep it identical across local and production. If you change it later without re-encrypting saved credentials, existing mailbox passwords become unreadable.

If you want password reset emails sent by the app, set:
- `APP_SMTP_HOST`
- `APP_SMTP_PORT`
- `APP_SMTP_USER`
- `APP_SMTP_PASSWORD`
- `APP_SMTP_FROM`

Without app SMTP configured, password reset URLs are logged server-side for development use.

## Deployment setup

1. Create a Vercel project from this repo.
2. Add the same environment variables from `.env.local` into the Vercel project settings, including `DATABASE_URL` and `MAIL_SECRET_KEY`.
3. For production, do not use `DEV_MAIL_ACCOUNT_*`; those are for local development only.

## Sync behavior today

- Opening an inbox triggers an immediate IMAP sync for the selected account.
- While the inbox page stays open, the active account is polled again on its configured interval.
- Sync only runs for the currently open mailbox view. There is no app-wide background scheduler now.

## Future sync direction

- Add overlap protection so the same account is not synced concurrently.
- Expand sync settings beyond the current fixed interval choices if users need finer control.
- Add folder-level sync beyond `INBOX`.
