# luminmail

Minimal webmail client prototype moving toward a real IMAP/SMTP-backed build.

## Current status

Built now:
- Supabase Auth sign-in/sign-up flow at `/login`
- Protected app shell for `/inbox`, `/accounts`, and related APIs
- App-level `public.users` records resolved from Supabase Auth users
- DB-backed mail account records stored in Supabase and owned by `public.users.id`
- Account switcher plus editable account names and mailbox host settings
- Dev-only env-backed mailbox account loaded from `.env.local`
- Mock message read/delete/reply flow still available for UI iteration

Still mocked or not done yet:
- IMAP sync
- SMTP sending
- Credential encryption and persistence
- Thread persistence in DB
- Real message storage and folder sync
- RLS policies and hardening pass

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
3. Copy the project URL, anon key, and service role key into `.env.local`.
4. Create your first auth user from the app at `/login` or in the Supabase Auth dashboard.
5. If you ran an older version of the schema already, rerun the latest migration so `public.users` and the `mail_accounts.user_id` ownership model are created.

Going forward, treat `supabase/migrations/*.sql` as the source of truth for DB changes and `docs/schema.md` as the readable model reference.

## Vercel setup

1. Create a Vercel project from this repo.
2. Add the same environment variables from `.env.local` into the Vercel project settings.
3. For production, do not use `DEV_MAIL_ACCOUNT_*`; those are for local development only.

## Next recommended build steps

1. Add encrypted credential storage for manual mailbox accounts.
2. Add `POST /api/accounts/test` to verify IMAP and SMTP connectivity.
3. Replace mock inbox listing with IMAP header sync into `messages`, `threads`, and `sync_state`.
4. Add SMTP send pipeline and send log persistence.
