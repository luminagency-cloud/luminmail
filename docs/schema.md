# Schema Reference

This document is the human-readable reference for the current data model.

Use this file to understand the intent of the schema.
Use the tracked SQL bootstrap or your database migration workflow to change the database.

## Ownership model

LuminMail uses an application-owned user model:

- `public.users`
  The application user record. All product data hangs off this table.

Mailbox ownership flows like this:

`public.users -> public.mail_accounts`

That keeps app data separate from any external auth provider and leaves room for future Google/OAuth sign-in.

## Tables

### `public.users`

Application-level users.

Important columns:
- `id`: primary key for app data
- `auth_user_id`: optional future link to an external auth identity
- `email`
- `display_name`
- `password_hash`
- `created_at`
- `updated_at`

Notes:
- This table is the primary user store for the app.
- `password_hash` stores the app-managed login credential for email/password auth.

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
- `signature`
- `sync_interval_minutes`
- `encrypted_secret`
- `secret_iv`
- `provider`
- `created_at`
- `updated_at`

Notes:
- This table represents mailbox connections, not app login identities.
- One app user can own many mail accounts.
- `encrypted_secret` and `secret_iv` store the encrypted mailbox password and IV used for IMAP/SMTP operations.
- `signature` is the optional plain-text footer appended to outgoing replies for that mailbox.
- `sync_interval_minutes` stores the inbox polling cadence used while that mailbox is open in the app.

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

Notes:
- Current sync writes `uid_validity`, `last_seen_uid`, and `last_synced_at` for the inbox folder.
- Sync is still limited to `INBOX`.

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

Notes:
- SMTP reply/send now writes success and failure rows here.
- This is the current durable record for outbound mail attempts.

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
- Runtime logs are still the primary source when DB logging itself is impaired.
- Expected auth failures such as bad passwords or expired confirmation links should not be written here.

### `public.issue_reports`

Tester-submitted issue reports captured from the app UI.

Important columns:
- `id`
- `user_id`
- `auth_user_id`
- `account_id`
- `reporter_email`
- `page_route`
- `description`
- `screenshot_name`
- `screenshot_content_type`
- `screenshot_bytes`
- `screenshot_size`
- `created_at`

Notes:
- This is DB-only for now. There is no email or realtime notification path attached to issue submission.
- Screenshot storage currently lives directly in Postgres as `bytea` for simplicity.

## Triggers and functions

### `public.set_updated_at()`

Shared helper trigger function used to refresh `updated_at`.

## Migration workflow

Going forward:

1. Keep this document updated with model intent and structural changes.
2. Keep bootstrap and migration SQL aligned with the actual runtime schema.
