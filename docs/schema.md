# Schema Reference

This document is the human-readable reference for the current data model.

Use this file to understand the intent of the schema.
Use `supabase/migrations/*.sql` to change the database.

## Ownership model

LuminMail uses a two-layer user model:

- `auth.users`
  Managed by Supabase Auth. This is only for authentication identity.
- `public.users`
  The application user record. All product data hangs off this layer.

Mailbox ownership flows like this:

`auth.users -> public.users -> public.mail_accounts`

That keeps app data separate from the auth provider and makes future auth changes, including Google/Gmail sign-in, much easier.

## Tables

### `public.users`

Application-level users.

Important columns:
- `id`: primary key for app data
- `auth_user_id`: unique link to `auth.users.id`
- `email`
- `display_name`
- `created_at`
- `updated_at`

Notes:
- A trigger mirrors newly created Supabase auth users into this table.
- A backfill statement also creates `public.users` rows for existing auth users.

### `public.mail_accounts`

Connected mailbox accounts owned by an app user.

Important columns:
- `id`
- `user_id`: foreign key to `public.users.id`
- `name`: display name like `Work`
- `email`: mailbox address
- `imap_host`
- `imap_port`
- `smtp_host`
- `smtp_port`
- `encrypted_secret`
- `secret_iv`
- `provider`
- `created_at`
- `updated_at`

Notes:
- This table represents mailbox connections, not app login identities.
- One app user can own many mail accounts.
- `encrypted_secret` and `secret_iv` are reserved for real credential storage and are not fully wired yet.

### `public.mail_folders`

Mailbox folders discovered for a connected account.

Important columns:
- `id`
- `mail_account_id`
- `provider_folder_id`
- `name`
- `role`

### `public.threads`

Thread grouping for synced messages.

Important columns:
- `id`
- `mail_account_id`
- `subject`
- `thread_key`
- `last_message_at`

### `public.messages`

Cached message metadata and body content.

Important columns:
- `id`
- `mail_account_id`
- `thread_id`
- `folder_id`
- `provider_message_id`
- `message_id_header`
- `in_reply_to`
- `reference_headers`
- `from_name`
- `from_email`
- `to_emails`
- `subject`
- `preview`
- `body_text`
- `body_html`
- `received_at`
- `is_unread`

### `public.sync_state`

Per-account or per-folder sync cursor state.

Important columns:
- `id`
- `mail_account_id`
- `folder_id`
- `uid_validity`
- `last_seen_uid`
- `last_synced_at`
- `status`
- `updated_at`

### `public.send_log`

Outgoing send attempts and delivery failures.

Important columns:
- `id`
- `mail_account_id`
- `thread_id`
- `to_emails`
- `subject`
- `body_text`
- `status`
- `error_message`

### `public.app_error_logs`

Simple persistent application logging for debugging.

Important columns:
- `id`
- `auth_user_id`
- `app_user_id`
- `scope`
- `level`
- `message`
- `details`
- `created_at`

Notes:
- This is intended for operational debugging while the product is still early.
- It stores structured error/event records you can inspect directly in the database.

## Triggers and functions

### `public.set_updated_at()`

Shared helper trigger function used to refresh `updated_at`.

### `public.handle_auth_user_created()`

Creates or updates the matching `public.users` row whenever a new `auth.users` record is inserted.

## Migration workflow

Going forward:

1. Do not keep extending one giant schema paste.
2. Add a new file under `supabase/migrations/`.
3. Keep this document updated with model intent and any structural changes.
4. Only treat `supabase/schema.sql` as a convenience snapshot if we keep it around.

## Current migration baseline

The current baseline schema lives in:

- `supabase/migrations/20260328_0001_initial_app_schema.sql`

Future schema changes should be incremental migration files after that.
