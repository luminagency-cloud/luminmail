# Manual Test Plan

Use this after applying the latest migration and deploying the matching app build.

Latest required migrations for this plan:

- `supabase/migrations/20260329_0003_mail_account_signature.sql`
- `supabase/migrations/20260329_0004_issue_reports.sql`

## Before you start

Confirm these environment variables exist in both local and Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`
- `MAIL_SECRET_KEY`
- `MAIL_SYNC_CRON_TOKEN`

If you use Vercel Cron, `CRON_SECRET` may be used instead of `MAIL_SYNC_CRON_TOKEN`.

If you created mailbox accounts before encrypted password storage was added, re-save each account with its password or delete and recreate it before testing sync, reply, or delete.

## Auth flow

1. Open `/`.
2. Sign up with a fresh address.
3. Confirm the UI tells you whether to check email or continue signed in.
4. Use the confirmation email and confirm the link returns to `/auth/callback` and then into the app.
5. If the link is expired or missing, use `Resend confirmation` on `/` and confirm the newest email arrives.
6. Sign out.
7. Sign in with the correct password.
8. Sign in once with a wrong password and confirm the error stays inline and readable.
9. Open a fresh browser tab after signing in and confirm the session persists without forcing a new login.

## Account creation validation

1. Go to `/accounts`.
2. Create an account with valid IMAP/SMTP settings and password.
3. Confirm the account is saved and shows `password stored`.
4. Try creating one with a bad IMAP host and confirm IMAP fails while SMTP status is still shown separately.
5. Try creating one with a bad SMTP host and confirm SMTP fails separately.
6. Try creating one with a wrong password and confirm the error is explicit.

## Account editing and deletion

1. Edit only the display name and save.
2. Confirm the name changes without forcing connection revalidation.
3. Add or update the account signature and confirm it saves.
4. Edit a connection field without entering a password and confirm the UI blocks the save.
5. Edit a connection field with the password and confirm IMAP/SMTP validation runs before save.
6. Delete an account and confirm it disappears from `/accounts` and the inbox switcher.

## Inbox sync

1. Open `/inbox` for a valid account.
2. Confirm recent real inbox messages appear.
3. Refresh once and confirm duplicates are not created.
4. Open Supabase and confirm rows exist in `public.messages`, `public.threads`, and `public.mail_folders`.

## Reply and delete

1. Open a real inbox message.
2. Send a reply.
3. Confirm the recipient receives it, the local thread view shows the outgoing message, and the saved account signature is appended when configured.
4. Confirm a `public.send_log` row exists with status `sent`.
5. Delete a synced message.
6. Confirm it disappears from the app.
7. Confirm it moved to Trash in the provider mailbox, or at minimum no longer remains in Inbox if the provider does not support direct move semantics cleanly.

## Issue reporting

1. Open `/inbox`.
2. Click `Report an issue`.
3. Submit a report with text only.
4. Confirm the UI shows a saved report ID.
5. Submit a second report with a screenshot.
6. Confirm both rows appear in `public.issue_reports`.
7. Confirm the screenshot row stores `screenshot_name`, `screenshot_content_type`, and non-null `screenshot_bytes`.

## Background sync route

1. Send a `GET` or `POST` request to `/api/messages/sync` with header `Authorization: Bearer <CRON_SECRET or MAIL_SYNC_CRON_TOKEN>`.
2. Confirm the route returns `200`.
3. Confirm runtime logs show a completed sync event.
4. Confirm `public.sync_state` has `last_synced_at`, `uid_validity`, and `last_seen_uid` populated for the inbox folder.
5. Confirm a request without the token returns `401`.
6. Remember that one route call currently fans out across every stored mail account in the database, not just the current user.

## Known caveat to watch

If an older mailbox account row has no encrypted password, inbox sync, reply, and delete will fail until that account is re-saved with a password.
