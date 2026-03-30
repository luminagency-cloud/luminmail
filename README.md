# luminmail

Minimal webmail client prototype moving toward a real IMAP/SMTP-backed build.

## Current status

Built now:
- Supabase Auth sign-in/sign-up flow on `/`
- Supabase confirmation callback flow on `/auth/callback`
- Inline resend-confirmation flow on `/`
- Protected app shell for `/inbox`, `/accounts`, and related APIs
- App-level `public.users` records resolved from Supabase Auth users
- DB-backed mail account records stored in Supabase and owned by `public.users.id`
- Mailbox passwords encrypted server-side before database storage
- Direct Postgres path for app-user, account, message, and error-log writes
- Account switcher plus editable account names and mailbox host settings
- Account create/update validates IMAP and SMTP before saving
- Optional per-account reply signature
- Inbox message list backed by live IMAP header sync into `messages` and `threads`
- Reply/send uses the connected account's SMTP credentials
- Message delete attempts provider-side IMAP move-to-trash before removing local cache
- SMTP attempts are persisted to `public.send_log`
- Mail sync progress is tracked in `public.sync_state`
- Folder metadata is discovered from IMAP and used for trash-folder targeting
- DB-only issue reporting from the inbox UI into `public.issue_reports`

Still mocked or not done yet:
- Durable worker/queue orchestration beyond the current global cron-triggered sync
- Folder sync beyond `INBOX`
- Rich HTML body rendering and sanitization hardening
- RLS policies and hardening pass

Operational tooling now:
- DB-backed app error logging via `public.app_error_logs`

## Docs

- Schema reference: [`docs/schema.md`](D:/_work/03%20SRC/luminmail/docs/schema.md)
- Manual verification: [`docs/manual-test-plan.md`](D:/_work/03%20SRC/luminmail/docs/manual-test-plan.md)
- Build plan and handoff notes: [`plan.MD`](D:/_work/03%20SRC/luminmail/plan.MD)
- SQL migrations: [`supabase/migrations`](D:/_work/03%20SRC/luminmail/supabase/migrations)

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Fill in the mailbox credentials only in `.env.local`.
3. Run `npm install` if dependencies change later, then `npm run dev`.

When the `DEV_MAIL_ACCOUNT_*` variables are present, the app loads that mailbox as a read-only development account in the account switcher and settings page.

## Supabase setup

1. Create a Supabase project.
2. Open the SQL editor and run the latest migration in `supabase/migrations/`.
3. Copy the project URL, anon key, service role key, server-side Postgres connection string, and `MAIL_SECRET_KEY` into `.env.local`.
4. Create your first auth user from the app at `/` or in the Supabase Auth dashboard.
5. If you ran an older version of the schema already, rerun the latest migration so `public.users` and the `mail_accounts.user_id` ownership model are created.
6. In Supabase Auth URL Configuration, add your deployed app URL as the Site URL and add both your deployed `/auth/callback` URL and local `http://localhost:3000/auth/callback` as redirect URLs.
7. If email confirmation is enabled, confirm the Supabase email template uses the callback URL path and that the redirect URLs above are allowed.

Going forward, treat `supabase/migrations/*.sql` as the source of truth for DB changes and `docs/schema.md` as the readable model reference.

For backend writes and logging, prefer `SUPABASE_DB_URL` so server operations do not depend on the Supabase Data API schema cache.

`MAIL_SECRET_KEY` is a server-only encryption secret for stored mailbox passwords. Keep it identical across local and production. If you change it later without re-encrypting saved credentials, existing mailbox passwords become unreadable.

## Deployment setup

1. Create a Vercel project from this repo.
2. Add the same environment variables from `.env.local` into the Vercel project settings, including `SUPABASE_DB_URL` and `MAIL_SECRET_KEY`.
3. For production, do not use `DEV_MAIL_ACCOUNT_*`; those are for local development only.

## Sync behavior today

- Opening an inbox triggers an immediate IMAP sync for the selected account.
- While the inbox page stays open, the active account is polled again on its configured interval.
- Sync only runs for the currently open mailbox view. There is no app-wide background scheduler now.

## Future sync direction

- Add overlap protection so the same account is not synced concurrently.
- Expand sync settings beyond the current fixed interval choices if users need finer control.
- Add folder-level sync beyond `INBOX`.

## Next recommended build steps

1. Add overlap protection so the same account is not synced concurrently.
2. Surface `send_log` and `sync_state` in the UI for debugging.
3. Add folder-level sync beyond `INBOX`.
4. Add RLS policies and secret-handling hardening.
