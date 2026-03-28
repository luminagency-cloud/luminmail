# LuminMail Build Plan

## Current repo state as of 2026-03-28

Implemented now:
- Next.js 16 app shell with inbox and account settings UI
- Supabase Auth login/signup flow at `/login`
- Protected routes and APIs via `proxy.ts`
- Supabase server/browser/admin client helpers
- `mail_accounts` schema and DB-backed account create/read/update APIs
- Account switcher that clearly shows active account name + email
- Dev-only `.env.local` mailbox account injection for local testing
- Mock message APIs for read, delete, and reply UI iteration

Not implemented yet:
- IMAP connectivity and background sync
- SMTP delivery
- Credential encryption/persistence
- Real message/thread/folder persistence wiring
- Connection testing endpoint
- Security hardening beyond basic route protection

## Recommended next milestone

### Milestone 1: live account connectivity
1. Add encrypted credential storage for manual accounts
2. Add `POST /api/accounts/test` for IMAP + SMTP connection verification
3. Surface connection status in account settings
4. Keep the env-backed mailbox as the initial live test target

### Milestone 2: live inbox sync
1. Add IMAP folder discovery and mailbox mapping
2. Sync inbox headers into `messages` and `threads`
3. Replace mock `/api/messages` list with Supabase-backed data
4. Keep full message body fetch on demand at first

### Milestone 3: send pipeline
1. Add SMTP send endpoint
2. Persist `send_log`
3. Set `In-Reply-To` and `References`
4. Surface retry/error states in the UI

### Milestone 4: hardening
1. RLS policies for all app tables
2. Credential encryption at rest
3. HTML sanitization
4. Audit logging, rate limits, and provider-specific retry logic

## Handoff notes for the next session

### What to trust in the repo
- Auth plumbing is real and uses Supabase
- Account persistence is real and writes to Supabase
- The active-account UX is worth building on

### What not to trust yet
- Message APIs are still mock-only
- Account passwords are not actually stored securely yet
- `passwordStored` is currently only a UI flag, not proof of encrypted persistence
- The current schema exists, but policies and secret-handling are still incomplete

## Original feasibility notes

## Short answer
This is very buildable as a small-to-medium project if you intentionally keep scope tight.

A modern, minimal web app with:
- Sign in
- Inbox/sent listing
- Read message
- Delete message
- Reply
- Basic threading

…is mostly standard CRUD + account connectivity + secure auth/session management.

## Scope recommendation
Keep V1 intentionally narrow:

### V1 features
1. **Auth**
   - App account sign-in (email/password or magic link)
   - Session management + logout
2. **Account connection**
   - Add one IMAP + SMTP account per user
   - Store credentials securely (encrypted at rest)
3. **Mailbox list + sync**
   - Fetch inbox headers (subject, from, date, unread)
   - Pagination / “load more”
4. **Read + thread view**
   - Open message
   - Group by `Message-ID` / `In-Reply-To` references where possible
5. **Compose/reply**
   - Plain text or basic HTML composer
   - Send via SMTP
6. **Delete**
   - Move to trash (recommended) instead of hard delete

### Explicitly skip for V1
- Multi-account per user
- Rich editor, attachments, inline images (or keep very basic)
- Rules, labels, snooze, filters, search indexing
- Offline mode, push notifications, calendar/contacts

## Technical shape (Node + TypeScript)

### Suggested stack
- **Frontend**: Next.js (App Router) + React + Tailwind (or your preferred UI kit)
- **Backend**: Next.js route handlers or a small Node API service
- **IMAP**: `imapflow` for mailbox and message operations
- **SMTP**: `nodemailer` for send/reply
- **DB**: Postgres (users, account config, sync cursors, cached metadata)
- **Queue/worker**: BullMQ or hosted queue for background sync jobs
- **Auth**: Clerk, Auth.js, or Supabase Auth
- **Secrets**: encrypted account credentials (KMS/managed secrets preferred)

### Core architecture
1. **Web app API layer** receives user actions.
2. **Background worker** does IMAP sync to avoid request timeouts.
3. **DB cache** stores message metadata for fast mailbox rendering.
4. **On-demand fetch** loads full message body when a message is opened.
5. **SMTP send pipeline** handles compose/reply and audit logging.

This hybrid model (cache metadata, fetch body lazily) is simpler than full mail replication and keeps infra reasonable.

## Biggest complexities (where projects drift)
1. **Provider quirks**
   - Gmail, Outlook, Fastmail, custom domains can behave differently.
2. **Threading consistency**
   - Real-world email headers are messy; thread logic is “mostly correct,” not perfect.
3. **Long-running sync reliability**
   - Reconnect logic, idempotency, retries, and lock handling matter.
4. **Security/compliance**
   - Password handling, encryption, audit trails, rate limiting, abuse prevention.
5. **HTML email rendering safety**
   - Sanitization to prevent XSS is mandatory.

## Rough effort (single experienced full-stack engineer)
- **Prototype (local/demo quality):** ~1–2 weeks
- **Solid V1 (production-ish for limited users):** ~4–8 weeks
- **Hardened product (monitoring, edge cases, reliability):** ~2–4 additional months

With 2 engineers, calendar time can drop, but integration/testing overhead still exists.

## Data model sketch
- `users`
- `mail_accounts` (encrypted IMAP/SMTP config)
- `mail_folders`
- `messages` (metadata cache)
- `message_bodies` (optional separate table/storage)
- `threads`
- `sync_state` (UIDVALIDITY, last UID, timestamps)
- `send_log` / `event_log`

## Security baseline checklist
- Encrypt account credentials at rest (envelope encryption ideal)
- Don’t log credentials or full sensitive message content
- Session expiry + refresh + secure cookies
- CSRF protection for mutating actions
- Input validation + output encoding
- HTML sanitization for rendered emails
- Rate limiting on auth and send endpoints
- Audit trail for account connection/deletion/send events

## Delivery plan

### Milestone 1: foundations (week 1)
- Auth + user model
- Account connection flow
- Basic inbox list from live IMAP

### Milestone 2: core UX (week 2-3)
- Read message
- Reply + SMTP send
- Delete to trash
- Basic thread grouping

### Milestone 3: production readiness (week 4+)
- Background sync worker
- Retry/reconnect behavior
- Observability (logs, metrics, alerts)
- Security hardening

## Practical recommendation
Build the narrow V1 first and evaluate usage before adding advanced mail-client features.

This product is absolutely feasible, but success depends less on “can Node do SMTP/IMAP?” and more on operational reliability and security once real user mailboxes are connected.


## How to start building (first 10 working sessions)

### Session 1: bootstrap project + auth
- Create a new Next.js + TypeScript app (or a dedicated workspace package)
- Add auth (Clerk/Auth.js/Supabase Auth)
- Create protected routes: `/inbox`, `/thread/[id]`, `/compose`
- Add a minimal DB schema for users and mail accounts

### Session 2: account connection flow
- Build “Connect mailbox” form for IMAP/SMTP host, port, username, password
- Encrypt credentials before storing
- Add “Test connection” endpoint that verifies both IMAP and SMTP

### Session 3: inbox listing
- Add `GET /api/mail/messages?folder=INBOX&cursor=...`
- Fetch top message headers from IMAP and cache metadata in DB
- Render sender, subject, preview, date, unread status

### Session 4: read message
- Add `GET /api/mail/messages/:id`
- Fetch/sanitize body and display safely
- Mark read/unread support

### Session 5: reply + send
- Add `POST /api/mail/send` for compose/reply
- Set `In-Reply-To` and `References` headers for threading
- Save send log + surface delivery errors clearly

### Session 6: delete flow
- Add `POST /api/mail/messages/:id/delete`
- Prefer move-to-trash behavior
- Confirm UX (undo toast optional)

### Session 7: basic threading
- Add thread key derivation from `Message-ID`, `In-Reply-To`, `References`
- Group thread view server-side; show newest-first or oldest-first consistently

### Session 8: background sync worker
- Add periodic sync job per connected account
- Persist sync cursor and idempotent retry logic

### Session 9: reliability pass
- Structured logs, error taxonomy, retry/backoff
- Provider-specific handling for Gmail/Outlook quirks

### Session 10: security + launch checklist
- Secret rotation path
- Rate limiting and abuse controls
- Audit logging and incident playbook

## Minimal API contract (V1)
- `POST /api/mail/accounts` — add/update mailbox credentials
- `POST /api/mail/accounts/test` — test IMAP + SMTP auth
- `GET /api/mail/messages` — list headers for folder
- `GET /api/mail/messages/:id` — read one message
- `POST /api/mail/send` — send new message or reply
- `POST /api/mail/messages/:id/delete` — move to trash
- `POST /api/mail/messages/:id/read` — mark read/unread

## “Start this week” checklist
1. Choose auth provider and DB.
2. Implement mailbox connection + credential encryption.
3. Ship inbox listing and read message.
4. Add reply/send and delete.
5. Add basic threading and a background sync loop.
6. Pilot with 2–5 real accounts before adding features.
