import { simpleParser, type ParsedMail } from "mailparser";
import { ImapFlow } from "imapflow";
import type { MailMessage } from "@/lib/types/mail";
import { dbQuery, hasDatabaseUrl } from "@/lib/db/server";
import { decryptMailboxPassword } from "@/lib/server/mail-secrets";
import { getAccount } from "@/lib/server/account-store";

type AccountSecretRow = {
  id: string;
  email: string;
  imap_host: string;
  imap_port: number;
  encrypted_secret: Buffer | null;
  secret_iv: Buffer | null;
};

type MessageRow = {
  id: string;
  account_id: string;
  thread_id: string | null;
  subject: string;
  preview: string | null;
  body_text: string | null;
  received_at: string;
  is_unread: boolean;
  from_name: string | null;
  from_email: string | null;
  to_emails: string[] | null;
};

function mapMessageRow(row: MessageRow): MailMessage {
  const from = row.from_name ? `${row.from_name} <${row.from_email ?? ""}>` : row.from_email ?? "Unknown sender";
  const to = row.to_emails?.join(", ") ?? "";

  return {
    id: row.id,
    accountId: row.account_id,
    threadId: row.thread_id ?? "",
    from,
    to,
    subject: row.subject,
    preview: row.preview ?? "",
    bodyText: row.body_text ?? "",
    receivedAt: row.received_at,
    unread: row.is_unread
  };
}

async function getAccountSecret(accountId: string) {
  const result = await dbQuery<AccountSecretRow>(
    `
      select id, email, imap_host, imap_port, encrypted_secret, secret_iv
      from public.mail_accounts
      where id = $1::uuid
      limit 1
    `,
    [accountId]
  );

  return result.rows[0] ?? null;
}

function toPreview(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 160);
}

function deriveThreadKey(messageId: string | null, inReplyTo: string | null, references: string[] | null, subject: string) {
  return inReplyTo || references?.[0] || messageId || `subject:${subject.trim().toLowerCase()}`;
}

function toIsoString(value: string | Date | null | undefined) {
  if (!value) return new Date().toISOString();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

async function ensureFolder(accountId: string, name: string) {
  const result = await dbQuery<{ id: string }>(
    `
      insert into public.mail_folders (mail_account_id, name, role)
      values ($1::uuid, $2::text, $3::text)
      on conflict do nothing
      returning id
    `,
    [accountId, name, name.toLowerCase()]
  );

  if (result.rows[0]) {
    return result.rows[0].id;
  }

  const existing = await dbQuery<{ id: string }>(
    `select id from public.mail_folders where mail_account_id = $1::uuid and name = $2::text limit 1`,
    [accountId, name]
  );

  return existing.rows[0]?.id ?? null;
}

async function ensureThread(accountId: string, threadKey: string, subject: string, receivedAt: string) {
  const result = await dbQuery<{ id: string }>(
    `
      insert into public.threads (mail_account_id, thread_key, subject, last_message_at)
      values ($1::uuid, $2::text, $3::text, $4::timestamptz)
      on conflict (mail_account_id, thread_key) do update
        set subject = excluded.subject,
            last_message_at = greatest(coalesce(public.threads.last_message_at, excluded.last_message_at), excluded.last_message_at)
      returning id
    `,
    [accountId, threadKey, subject, receivedAt]
  );

  return result.rows[0].id;
}

export async function syncInboxHeaders(userId: string, accountId: string) {
  if (!hasDatabaseUrl()) {
    return;
  }

  const account = await getAccount(userId, accountId);
  if (!account || account.source === "env") {
    return;
  }

  const secretRow = await getAccountSecret(account.id);
  if (!secretRow?.encrypted_secret || !secretRow.secret_iv) {
    throw new Error("Mailbox password is not stored for this account. Re-save the account with a password.");
  }

  const password = decryptMailboxPassword(secretRow.encrypted_secret, secretRow.secret_iv);
  const client = new ImapFlow({
    host: account.imapHost,
    port: account.imapPort,
    secure: account.imapPort === 993,
    auth: {
      user: account.email,
      pass: password
    },
    logger: false
  });

  try {
    await client.connect();
    const mailbox = await client.mailboxOpen("INBOX");
    const start = Math.max(1, mailbox.exists - 24);
    const folderId = await ensureFolder(account.id, "INBOX");

    for await (const message of client.fetch(`${start}:${mailbox.exists || 1}`, {
      uid: true,
      envelope: true,
      flags: true,
      internalDate: true,
      source: true
    })) {
      if (!message.source) {
        continue;
      }

      const parsed = (await simpleParser(message.source, {})) as ParsedMail;
      const bodyText = (parsed.text || parsed.html || "").toString().trim();
      const preview = toPreview(bodyText);
      const messageId = parsed.messageId ?? null;
      const inReplyTo = typeof parsed.inReplyTo === "string" ? parsed.inReplyTo : null;
      const references =
        Array.isArray(parsed.references) ? parsed.references.filter((value: unknown): value is string => typeof value === "string") : null;
      const subject = message.envelope?.subject || parsed.subject || "(no subject)";
      const threadKey = deriveThreadKey(messageId, inReplyTo, references, subject);
      const threadId = await ensureThread(account.id, threadKey, subject, toIsoString(message.internalDate));
      const fromAddress = message.envelope?.from?.[0];
      const toAddresses = (message.envelope?.to || []).map((entry) => entry.address || "").filter(Boolean);

      await dbQuery(
        `
          insert into public.messages (
            mail_account_id, thread_id, folder_id, provider_message_id, message_id_header, in_reply_to,
            reference_headers, from_name, from_email, to_emails, subject, preview, body_text, received_at, is_unread
          )
          values (
            $1::uuid, $2::uuid, $3::uuid, $4::text, $5::text, $6::text,
            $7::text[], $8::text, $9::text, $10::text[], $11::text, $12::text, $13::text, $14::timestamptz, $15::boolean
          )
          on conflict (mail_account_id, provider_message_id) do update
            set thread_id = excluded.thread_id,
                folder_id = excluded.folder_id,
                message_id_header = excluded.message_id_header,
                in_reply_to = excluded.in_reply_to,
                reference_headers = excluded.reference_headers,
                from_name = excluded.from_name,
                from_email = excluded.from_email,
                to_emails = excluded.to_emails,
                subject = excluded.subject,
                preview = excluded.preview,
                body_text = excluded.body_text,
                received_at = excluded.received_at,
                is_unread = excluded.is_unread
        `,
        [
          account.id,
          threadId,
          folderId,
          `INBOX:${message.uid}`,
          messageId,
          inReplyTo,
          references,
          fromAddress?.name || null,
          fromAddress?.address || null,
          toAddresses,
          subject,
          preview,
          bodyText.slice(0, 12000),
          toIsoString(message.internalDate),
          !message.flags?.has("\\Seen")
        ]
      );
    }
  } finally {
    try {
      await client.logout();
    } catch {}
  }
}

export async function listMessages(userId: string, accountId?: string): Promise<MailMessage[]> {
  if (!hasDatabaseUrl() || !accountId) {
    return [];
  }

  await syncInboxHeaders(userId, accountId);

  const result = await dbQuery<MessageRow>(
    `
      select
        m.id,
        m.mail_account_id as account_id,
        m.thread_id,
        m.subject,
        m.preview,
        m.body_text,
        m.received_at,
        m.is_unread,
        m.from_name,
        m.from_email,
        m.to_emails
      from public.messages m
      join public.mail_accounts a on a.id = m.mail_account_id
      where a.user_id = $1::uuid
        and m.mail_account_id = $2::uuid
      order by m.received_at desc
      limit 50
    `,
    [userId, accountId]
  );

  return result.rows.map(mapMessageRow);
}

export async function markMessageRead(userId: string, id: string): Promise<MailMessage | undefined> {
  if (!hasDatabaseUrl()) return undefined;

  const result = await dbQuery<MessageRow>(
    `
      update public.messages m
      set is_unread = false
      from public.mail_accounts a
      where m.mail_account_id = a.id
        and a.user_id = $1::uuid
        and m.id = $2::uuid
      returning m.id, m.mail_account_id as account_id, m.thread_id, m.subject, m.preview, m.body_text, m.received_at, m.is_unread, m.from_name, m.from_email, m.to_emails
    `,
    [userId, id]
  );

  return result.rows[0] ? mapMessageRow(result.rows[0]) : undefined;
}

export async function deleteMessage(userId: string, id: string): Promise<boolean> {
  if (!hasDatabaseUrl()) return false;

  const result = await dbQuery(
    `
      delete from public.messages m
      using public.mail_accounts a
      where m.mail_account_id = a.id
        and a.user_id = $1::uuid
        and m.id = $2::uuid
    `,
    [userId, id]
  );

  return (result.rowCount ?? 0) > 0;
}

export async function replyToMessage(userId: string, id: string, bodyText: string): Promise<MailMessage | undefined> {
  if (!hasDatabaseUrl() || !bodyText.trim()) return undefined;

  const source = await dbQuery<{
    id: string;
    mail_account_id: string;
    thread_id: string | null;
    subject: string;
    from_email: string | null;
    email: string;
  }>(
    `
      select m.id, m.mail_account_id, m.thread_id, m.subject, m.from_email, a.email
      from public.messages m
      join public.mail_accounts a on a.id = m.mail_account_id
      where a.user_id = $1::uuid and m.id = $2::uuid
      limit 1
    `,
    [userId, id]
  );

  const row = source.rows[0];
  if (!row) return undefined;

  const result = await dbQuery<MessageRow>(
    `
      insert into public.messages (
        mail_account_id, thread_id, provider_message_id, from_email, to_emails, subject, preview, body_text, received_at, is_unread
      )
      values (
        $1::uuid, $2::uuid, $3::text, $4::text, $5::text[], $6::text, $7::text, $8::text, timezone('utc', now()), false
      )
      returning id, mail_account_id as account_id, thread_id, subject, preview, body_text, received_at, is_unread, from_name, from_email, to_emails
    `,
    [
      row.mail_account_id,
      row.thread_id,
      `LOCAL-REPLY:${Date.now()}`,
      row.email,
      row.from_email ? [row.from_email] : [],
      row.subject.startsWith("Re:") ? row.subject : `Re: ${row.subject}`,
      toPreview(bodyText),
      bodyText
    ]
  );

  return result.rows[0] ? mapMessageRow(result.rows[0]) : undefined;
}
