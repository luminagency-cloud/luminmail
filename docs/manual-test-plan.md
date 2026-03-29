# Manual Test Plan

Use this after applying the latest migration and deploying the matching app build.

## Before you start

Confirm these environment variables exist in both local and Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`
- `MAIL_SECRET_KEY`
- `MAIL_SYNC_CRON_TOKEN`

If you created mailbox accounts before encrypted password storage was added, re-save each account with its password or delete and recreate it before testing sync, reply, or delete.

## Auth flow

1. Open `/`.
2. Sign up with a fresh address.
3. Confirm the UI tells you whether to check email or continue signed in.
4. Sign out.
5. Sign in with the correct password.
6. Sign in once with a wrong password and confirm the error stays inline and readable.

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
3. Edit a connection field without entering a password and confirm the UI blocks the save.
4. Edit a connection field with the password and confirm IMAP/SMTP validation runs before save.
5. Delete an account and confirm it disappears from `/accounts` and the inbox switcher.

## Inbox sync

1. Open `/inbox` for a valid account.
2. Confirm recent real inbox messages appear.
3. Refresh once and confirm duplicates are not created.
4. Open Supabase and confirm rows exist in `public.messages`, `public.threads`, and `public.mail_folders`.

## Reply and delete

1. Open a real inbox message.
2. Send a reply.
3. Confirm the recipient receives it and the local thread view shows the outgoing message.
4. Delete a synced message.
5. Confirm it disappears from the app.
6. Confirm it moved to Trash in the provider mailbox, or at minimum no longer remains in Inbox if the provider does not support direct move semantics cleanly.

## Background sync route

1. Send a `POST` request to `/api/messages/sync` with header `Authorization: Bearer <MAIL_SYNC_CRON_TOKEN>`.
2. Confirm the route returns `200`.
3. Confirm runtime logs show a completed sync event.
4. Confirm a request without the token returns `401`.

## Known caveat to watch

If an older mailbox account row has no encrypted password, inbox sync, reply, and delete will fail until that account is re-saved with a password.
