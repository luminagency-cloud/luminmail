# LuminMail Build Plan

## Current repo state

Implemented now:
- Next.js 16 app shell with inbox and account settings UI
- App-managed email/password auth with DB-backed sessions and reset tokens
- Protected routes and APIs via `proxy.ts`
- `public.users` as the primary app user table
- `mail_accounts` schema and DB-backed account create/read/update APIs owned by `public.users.id`
- Account switcher that clearly shows active account name and email
- Dev-only `.env.local` mailbox account injection for local testing
- Encrypted mailbox password storage via `MAIL_SECRET_KEY`
- Live IMAP header sync into `messages` and `threads`
- Provider-backed delete/move-to-trash attempt over IMAP
- Live SMTP reply/send through stored mailbox credentials
- Protected sync route for cron-triggered mailbox refresh across all stored accounts
- SMTP send attempts persisted to `public.send_log`
- `sync_state` records inbox sync progress
- Folder discovery persisted to `public.mail_folders` and used for trash resolution

Not implemented yet:
- Durable queue/worker orchestration beyond the current global cron-triggered sync
- Folder sync beyond `INBOX`
- Sync overlap locking
- Robust provider-specific trash/special-folder handling
- Security hardening beyond basic route protection

## Recommended next milestone

### Milestone 1: mail pipeline hardening
1. Expand sync from `INBOX` into additional folders with explicit selection rules
2. Add per-account overlap protection so cron and request-driven sync cannot race
3. Decide whether full message bodies stay inline in `messages` or move to a separate body store
4. Add a small admin/debug surface for `send_log` and `sync_state`
5. Define how a user-configurable "check email frequency" setting maps to background sync

### Milestone 2: sync execution
1. Keep the cron route temporarily, but move sync fan-out into a worker-safe execution model
2. Add per-account locking so overlapping syncs do not race
3. Replace the single global cadence with a user/account-level sync preference
4. Add retry/backoff and clearer operational status in the UI

### Milestone 3: hardening
1. RLS policies for all app tables
2. Secret rotation path for encrypted mailbox credentials
3. HTML sanitization
4. Audit logging, rate limits, and provider-specific retry logic

### Future auth follow-up
1. Leave room for optional Google/OAuth sign-in on top of the current `public.users` model
2. Keep auth email delivery separate from mailbox SMTP delivery explicitly
3. Add account verification or invite flows only if product requirements demand them

## Handoff notes for the next session

### What to trust in the repo
- App auth plumbing is real and no longer depends on Supabase
- Account persistence is real and writes directly to Postgres under the app-user model
- The active-account UX is worth building on
- Mailbox passwords are encrypted before DB storage
- Inbox listing is live against IMAP-backed cached data
- Reply/send and delete attempt real provider operations
- `send_log` and `sync_state` are populated by the live mail paths
- The current background sync path is global, not user-scoped

### What not to trust yet
- Sync is still limited to `INBOX`
- Sync can still overlap if multiple requests hit the same account at once
- Background sync cadence is still app-wide, not a user setting
- Special-folder handling is better, but still depends on provider conventions
- Policies and hardening are still incomplete

## Practical recommendation

Build the narrow V1 first and evaluate usage before adding advanced mail-client features.

This product is feasible, but success depends more on operational reliability and security than on the basic IMAP/SMTP feature set.
