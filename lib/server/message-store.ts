import { simpleParser, type ParsedMail } from "mailparser";
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import type { MailMessage } from "@/lib/types/mail";
import { dbQuery, hasDatabaseUrl } from "@/lib/db/server";
import { getAccount } from "@/lib/server/account-store";
import { getDecryptedAccountCredentials } from "@/lib/server/account-credentials";

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

  const credentials = await getDecryptedAccountCredentials(userId, account.id);
  if (!credentials) {
    throw new Error("Mailbox account not found.");
  }

  const client = new ImapFlow({
    host: credentials.imapHost,
    port: credentials.imapPort,
    secure: credentials.imapPort === 993,
    auth: {
      user: credentials.email,
      pass: credentials.password
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

export async function syncAllAccounts() {
  if (!hasDatabaseUrl()) return;

  const result = await dbQuery<{ user_id: string; account_id: string }>(
    `
      select user_id, id as account_id
      from public.mail_accounts
      where encrypted_secret is not null
      order by created_at asc
    `
  );

  for (const row of result.rows) {
    await syncInboxHeaders(row.user_id, row.account_id);
  }
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

  const source = await dbQuery<{
    id: string;
    mail_account_id: string;
    provider_message_id: string;
  }>(
    `
      select m.id, m.mail_account_id, m.provider_message_id
      from public.messages m
      join public.mail_accounts a on a.id = m.mail_account_id
      where a.user_id = $1::uuid and m.id = $2::uuid
      limit 1
    `,
    [userId, id]
  );

  const row = source.rows[0];
  if (!row) return false;

  const credentials = await getDecryptedAccountCredentials(userId, row.mail_account_id);
  if (!credentials) return false;

  const uid = Number(row.provider_message_id.split(":").pop());
  const client = new ImapFlow({
    host: credentials.imapHost,
    port: credentials.imapPort,
    secure: credentials.imapPort === 993,
    auth: {
      user: credentials.email,
      pass: credentials.password
    },
    logger: false
  });

  try {
    await client.connect();
    await client.mailboxOpen("INBOX");
    try {
      await client.messageMove(uid, "Trash");
    } catch {
      await client.messageDelete(uid);
    }
  } finally {
    try {
      await client.logout();
    } catch {}
  }

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
    message_id_header: string | null;
    reference_headers: string[] | null;
    email: string;
  }>(
    `
      select m.id, m.mail_account_id, m.thread_id, m.subject, m.from_email, m.message_id_header, m.reference_headers, a.email
      from public.messages m
      join public.mail_accounts a on a.id = m.mail_account_id
      where a.user_id = $1::uuid and m.id = $2::uuid
      limit 1
    `,
    [userId, id]
  );

  const row = source.rows[0];
  if (!row) return undefined;

  const credentials = await getDecryptedAccountCredentials(userId, row.mail_account_id);
  if (!credentials) return undefined;

  const transporter = nodemailer.createTransport({
    host: credentials.smtpHost,
    port: credentials.smtpPort,
    secure: credentials.smtpPort === 465,
    auth: {
      user: credentials.email,
      pass: credentials.password
    }
  });

  const referenceHeaders = [...(row.reference_headers ?? []), ...(row.message_id_header ? [row.message_id_header] : [])];
  const send = await transporter.sendMail({
    from: credentials.email,
    to: row.from_email || undefined,
    subject: row.subject.startsWith("Re:") ? row.subject : `Re: ${row.subject}`,
    text: bodyText,
    inReplyTo: row.message_id_header || undefined,
    references: referenceHeaders.length > 0 ? referenceHeaders : undefined
  });

  const result = await dbQuery<MessageRow>(
    `
      insert into public.messages (
        mail_account_id, thread_id, provider_message_id, message_id_header, in_reply_to, reference_headers, from_email, to_emails, subject, preview, body_text, received_at, is_unread
      )
      values (
        $1::uuid, $2::uuid, $3::text, $4::text, $5::text, $6::text[], $7::text, $8::text[], $9::text, $10::text, $11::text, timezone('utc', now()), false
      )
      returning id, mail_account_id as account_id, thread_id, subject, preview, body_text, received_at, is_unread, from_name, from_email, to_emails
    `,
    [
      row.mail_account_id,
      row.thread_id,
      send.messageId || `SMTP:${Date.now()}`,
      send.messageId || null,
      row.message_id_header || null,
      referenceHeaders,
      credentials.email,
      row.from_email ? [row.from_email] : [],
      row.subject.startsWith("Re:") ? row.subject : `Re: ${row.subject}`,
      toPreview(bodyText),
      bodyText
    ]
  );

  return result.rows[0] ? mapMessageRow(result.rows[0]) : undefined;
}
