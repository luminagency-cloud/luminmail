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

Still mocked or not done yet:
- SMTP sending
- Mailbox delete/move synced back to provider
- Real reply/send over SMTP
- RLS policies and hardening pass

Operational tooling now:
- DB-backed app error logging via `public.app_error_logs`

## Docs

- Schema reference: [`docs/schema.md`](D:/_work/03%20SRC/luminmail/docs/schema.md)
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
4. Create your first auth user from the app at `/login` or in the Supabase Auth dashboard.
5. If you ran an older version of the schema already, rerun the latest migration so `public.users` and the `mail_accounts.user_id` ownership model are created.

Going forward, treat `supabase/migrations/*.sql` as the source of truth for DB changes and `docs/schema.md` as the readable model reference.

For backend writes and logging, prefer `SUPABASE_DB_URL` so server operations do not depend on the Supabase Data API schema cache.

## Vercel setup

1. Create a Vercel project from this repo.
2. Add the same environment variables from `.env.local` into the Vercel project settings, including `SUPABASE_DB_URL` and `MAIL_SECRET_KEY`.
3. For production, do not use `DEV_MAIL_ACCOUNT_*`; those are for local development only.

## Next recommended build steps

1. Implement real SMTP send/reply using stored encrypted mailbox credentials.
2. Sync delete/move-to-trash back to IMAP instead of only deleting local cache.
3. Add periodic sync workers instead of syncing headers on request.
4. Add RLS policies and secret-handling hardening.
