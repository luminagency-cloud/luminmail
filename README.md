# luminmail

Minimal webmail client prototype moving toward a real IMAP/SMTP-backed build.

## Current status

Built now:
- Supabase Auth sign-in/sign-up flow on `/`
- Protected app shell for `/inbox`, `/accounts`, and related APIs
- App-level `public.users` records resolved from Supabase Auth users
- DB-backed mail account records stored in Supabase and owned by `public.users.id`
- Mailbox passwords encrypted server-side before database storage
- Direct Postgres path for app-user, account, message, and error-log writes
- Account switcher plus editable account names and mailbox host settings
- Account create/update validates IMAP and SMTP before saving
- Inbox message list backed by live IMAP header sync into `messages` and `threads`
- Reply/send uses the connected account's SMTP credentials
- Message delete attempts provider-side IMAP move-to-trash before removing local cache
- Background mailbox sync route exists for cron-driven refreshes

Still mocked or not done yet:
- Durable worker/queue orchestration beyond cron-triggered sync
- Folder discovery beyond `INBOX`
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
3. Copy the project URL, anon key, service role key, server-side Postgres connection string, `MAIL_SECRET_KEY`, and `MAIL_SYNC_CRON_TOKEN` into `.env.local`.
4. Create your first auth user from the app at `/` or in the Supabase Auth dashboard.
5. If you ran an older version of the schema already, rerun the latest migration so `public.users` and the `mail_accounts.user_id` ownership model are created.

Going forward, treat `supabase/migrations/*.sql` as the source of truth for DB changes and `docs/schema.md` as the readable model reference.

For backend writes and logging, prefer `SUPABASE_DB_URL` so server operations do not depend on the Supabase Data API schema cache.

`MAIL_SECRET_KEY` is a server-only encryption secret for stored mailbox passwords. Keep it identical across local and production. If you change it later without re-encrypting saved credentials, existing mailbox passwords become unreadable.

## Vercel setup

1. Create a Vercel project from this repo.
2. Add the same environment variables from `.env.local` into the Vercel project settings, including `SUPABASE_DB_URL`, `MAIL_SECRET_KEY`, and `MAIL_SYNC_CRON_TOKEN`.
3. For production, do not use `DEV_MAIL_ACCOUNT_*`; those are for local development only.

## Next recommended build steps

1. Persist outgoing SMTP attempts and failures into `send_log`.
2. Add per-account sync cursors in `sync_state` instead of rescanning recent inbox mail on every sync.
3. Expand provider folder support beyond `INBOX` and make trash-folder targeting more robust.
4. Add RLS policies and secret-handling hardening.
