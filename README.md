# luminmail

Minimal webmail client prototype moving toward a real IMAP/SMTP-backed build.

## Current status

Built now:
- Supabase Auth sign-in/sign-up flow at `/login`
- Protected app shell for `/inbox`, `/accounts`, and related APIs
- DB-backed mail account records stored in Supabase
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

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Fill in the mailbox credentials only in `.env.local`.
3. Run `npm install` if dependencies change later, then `npm run dev`.

When the `DEV_MAIL_ACCOUNT_*` variables are present, the app loads that mailbox as a read-only development account in the account switcher and settings page.

## Supabase setup

1. Create a Supabase project.
2. Open the SQL editor and run `supabase/schema.sql`.
3. Copy the project URL, anon key, and service role key into `.env.local`.
4. Create your first auth user from the app at `/login` or in the Supabase Auth dashboard.

## Vercel setup

1. Create a Vercel project from this repo.
2. Add the same environment variables from `.env.local` into the Vercel project settings.
3. For production, do not use `DEV_MAIL_ACCOUNT_*`; those are for local development only.

## Next recommended build steps

1. Add encrypted credential storage for manual mailbox accounts.
2. Add `POST /api/accounts/test` to verify IMAP and SMTP connectivity.
3. Replace mock inbox listing with IMAP header sync into `messages`, `threads`, and `sync_state`.
4. Add SMTP send pipeline and send log persistence.
