import { simpleParser, type ParsedMail } from "mailparser";
import { ImapFlow, type ListResponse, type MailboxObject } from "imapflow";
import nodemailer from "nodemailer";
import type { MailMessage } from "@/lib/types/mail";
import { dbQuery, hasDatabaseUrl } from "@/lib/db/server";
import { getAccount } from "@/lib/server/account-store";
import { getDecryptedAccountCredentials } from "@/lib/server/account-credentials";
import { applySignature } from "@/lib/server/message-compose";

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

type FolderRow = {
  id: string;
  name: string;
  provider_folder_id: string | null;
  role: string | null;
};

type SyncStateRow = {
  id: string;
  uid_validity: string | null;
  last_seen_uid: string | null;
};

type MessageSourceRow = {
  id: string;
  mail_account_id: string;
  provider_message_id: string;
  folder_path: string | null;
  folder_role: string | null;
};

type ReplySourceRow = {
  id: string;
  mail_account_id: string;
  thread_id: string | null;
  subject: string;
  from_email: string | null;
  message_id_header: string | null;
  reference_headers: string[] | null;
  email: string;
};

type FolderCatalog = {
  inbox: FolderRow;
  trash: FolderRow | null;
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

function normalizeFolderRole(specialUse?: string | null) {
  switch (specialUse) {
    case "\\Inbox":
      return "inbox";
    case "\\Trash":
      return "trash";
    case "\\Sent":
      return "sent";
    case "\\Drafts":
      return "drafts";
    case "\\Junk":
      return "junk";
    case "\\Archive":
      return "archive";
    case "\\All":
      return "all";
    default:
      return null;
  }
}

function parseProviderUid(providerMessageId: string) {
  const parts = providerMessageId.split(":");
  const uid = Number(parts.at(-1));
  return Number.isFinite(uid) ? uid : null;
}

function asUidRange(startUid: number, endUid: number) {
  return `${startUid}:${endUid}`;
}

async function ensureFolder(accountId: string, mailbox: { path: string; name: string; role?: string | null }) {
  const result = await dbQuery<FolderRow>(
    `
      insert into public.mail_folders (mail_account_id, provider_folder_id, name, role)
      values ($1::uuid, $2::text, $3::text, $4::text)
      on conflict (mail_account_id, name) do update
        set provider_folder_id = excluded.provider_folder_id,
            role = coalesce(excluded.role, public.mail_folders.role)
      returning id, name, provider_folder_id, role
    `,
    [accountId, mailbox.path, mailbox.name, mailbox.role ?? null]
  );

  return result.rows[0];
}

async function syncFolderCatalog(accountId: string, client: ImapFlow): Promise<FolderCatalog> {
  const listedMailboxes = await client.list();
  const folders = new Map<string, FolderRow>();

  for (const mailbox of listedMailboxes) {
    const folder = await ensureFolder(accountId, {
      path: mailbox.path,
      name: mailbox.name,
      role: normalizeFolderRole(mailbox.specialUse)
    });
    folders.set(mailbox.path.toUpperCase(), folder);
  }

  const inbox = folders.get("INBOX") ?? (await ensureFolder(accountId, { path: "INBOX", name: "INBOX", role: "inbox" }));
  const trash =
    [...folders.values()].find((folder) => folder.role === "trash") ??
    null;

  return { inbox, trash };
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

async function getSyncState(accountId: string, folderId: string) {
  const result = await dbQuery<SyncStateRow>(
    `
      select id, uid_validity, last_seen_uid
      from public.sync_state
      where mail_account_id = $1::uuid and folder_id = $2::uuid
      limit 1
    `,
    [accountId, folderId]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    uidValidity: row.uid_validity,
    lastSeenUid: row.last_seen_uid ? Number(row.last_seen_uid) : 0
  };
}

async function upsertSyncState(input: {
  accountId: string;
  folderId: string;
  uidValidity: string | null;
  lastSeenUid: number;
  status: string;
}) {
  await dbQuery(
    `
      insert into public.sync_state (mail_account_id, folder_id, uid_validity, last_seen_uid, last_synced_at, status)
      values ($1::uuid, $2::uuid, $3::bigint, $4::bigint, timezone('utc', now()), $5::text)
      on conflict (mail_account_id, folder_id) do update
        set uid_validity = excluded.uid_validity,
            last_seen_uid = excluded.last_seen_uid,
            last_synced_at = excluded.last_synced_at,
            status = excluded.status,
            updated_at = timezone('utc', now())
    `,
    [input.accountId, input.folderId, input.uidValidity, input.lastSeenUid, input.status]
  );
}

async function upsertMessage(input: {
  accountId: string;
  folderId: string;
  providerMessageId: string;
  messageId: string | null;
  inReplyTo: string | null;
  references: string[] | null;
  fromName: string | null;
  fromEmail: string | null;
  toEmails: string[];
  subject: string;
  preview: string;
  bodyText: string;
  receivedAt: string;
  isUnread: boolean;
}) {
  const threadKey = deriveThreadKey(input.messageId, input.inReplyTo, input.references, input.subject);
  const threadId = await ensureThread(input.accountId, threadKey, input.subject, input.receivedAt);

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
      input.accountId,
      threadId,
      input.folderId,
      input.providerMessageId,
      input.messageId,
      input.inReplyTo,
      input.references,
      input.fromName,
      input.fromEmail,
      input.toEmails,
      input.subject,
      input.preview,
      input.bodyText.slice(0, 12000),
      input.receivedAt,
      input.isUnread
    ]
  );
}

async function insertSendLog(input: {
  accountId: string;
  threadId: string | null;
  toEmails: string[];
  subject: string;
  bodyText: string;
  status: string;
  errorMessage?: string | null;
}) {
  await dbQuery(
    `
      insert into public.send_log (mail_account_id, thread_id, to_emails, subject, body_text, status, error_message)
      values ($1::uuid, $2::uuid, $3::text[], $4::text, $5::text, $6::text, $7::text)
    `,
    [input.accountId, input.threadId, input.toEmails, input.subject, input.bodyText, input.status, input.errorMessage ?? null]
  );
}

function getCurrentMailbox(client: ImapFlow): MailboxObject {
  if (!client.mailbox) {
    throw new Error("No mailbox is currently open.");
  }

  return client.mailbox;
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

  let inboxFolder: FolderRow | null = null;

  try {
    await client.connect();
    const folderCatalog = await syncFolderCatalog(account.id, client);
    inboxFolder = folderCatalog.inbox;

    const lock = await client.getMailboxLock(inboxFolder.provider_folder_id ?? "INBOX", {
      readOnly: true,
      description: "sync inbox headers"
    });

    try {
      const mailbox = getCurrentMailbox(client);
      const currentUidValidity = mailbox.uidValidity.toString();
      const currentLastUid = Math.max(0, mailbox.uidNext - 1);
      const syncState = await getSyncState(account.id, inboxFolder.id);
      const sameMailbox = syncState?.uidValidity === currentUidValidity;

      let highestSeenUid = sameMailbox ? syncState?.lastSeenUid ?? 0 : 0;
      const startUid = sameMailbox ? highestSeenUid + 1 : Math.max(1, currentLastUid - 99);

      await upsertSyncState({
        accountId: account.id,
        folderId: inboxFolder.id,
        uidValidity: currentUidValidity,
        lastSeenUid: highestSeenUid,
        status: "syncing"
      });

      if (currentLastUid >= startUid) {
        for await (const message of client.fetch(
          asUidRange(startUid, currentLastUid),
          {
            uid: true,
            envelope: true,
            flags: true,
            internalDate: true,
            source: true
          },
          { uid: true }
        )) {
          if (!message.source) {
            continue;
          }

          const parsed = (await simpleParser(message.source, {})) as ParsedMail;
          const bodyText = (parsed.text || parsed.html || "").toString().trim();
          const preview = toPreview(bodyText);
          const messageId = parsed.messageId ?? null;
          const inReplyTo = typeof parsed.inReplyTo === "string" ? parsed.inReplyTo : null;
          const references = Array.isArray(parsed.references)
            ? parsed.references.filter((value: unknown): value is string => typeof value === "string")
            : null;
          const subject = message.envelope?.subject || parsed.subject || "(no subject)";
          const fromAddress = message.envelope?.from?.[0];
          const toAddresses = (message.envelope?.to || []).map((entry) => entry.address || "").filter(Boolean);

          await upsertMessage({
            accountId: account.id,
            folderId: inboxFolder.id,
            providerMessageId: `INBOX:${message.uid}`,
            messageId,
            inReplyTo,
            references,
            fromName: fromAddress?.name || null,
            fromEmail: fromAddress?.address || null,
            toEmails: toAddresses,
            subject,
            preview,
            bodyText,
            receivedAt: toIsoString(message.internalDate),
            isUnread: !message.flags?.has("\\Seen")
          });

          highestSeenUid = Math.max(highestSeenUid, message.uid);
        }
      }

      await upsertSyncState({
        accountId: account.id,
        folderId: inboxFolder.id,
        uidValidity: currentUidValidity,
        lastSeenUid: highestSeenUid,
        status: "idle"
      });
    } catch (error) {
      await upsertSyncState({
        accountId: account.id,
        folderId: inboxFolder.id,
        uidValidity: null,
        lastSeenUid: 0,
        status: "error"
      });
      throw error;
    } finally {
      lock.release();
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
  if (!hasDatabaseUrl()) {
    return { synced: 0, failed: [] as Array<{ userId: string; accountId: string; message: string }> };
  }

  const result = await dbQuery<{ user_id: string; account_id: string }>(
    `
      select user_id, id as account_id
      from public.mail_accounts
      where encrypted_secret is not null
      order by created_at asc
    `
  );

  const summary = {
    synced: 0,
    failed: [] as Array<{ userId: string; accountId: string; message: string }>
  };

  for (const row of result.rows) {
    try {
      await syncInboxHeaders(row.user_id, row.account_id);
      summary.synced += 1;
    } catch (error) {
      summary.failed.push({
        userId: row.user_id,
        accountId: row.account_id,
        message: error instanceof Error ? error.message : "Sync failed."
      });
    }
  }

  return summary;
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

  const source = await dbQuery<MessageSourceRow>(
    `
      select
        m.id,
        m.mail_account_id,
        m.provider_message_id,
        f.provider_folder_id as folder_path,
        f.role as folder_role
      from public.messages m
      join public.mail_accounts a on a.id = m.mail_account_id
      left join public.mail_folders f on f.id = m.folder_id
      where a.user_id = $1::uuid and m.id = $2::uuid
      limit 1
    `,
    [userId, id]
  );

  const row = source.rows[0];
  if (!row) return false;

  const credentials = await getDecryptedAccountCredentials(userId, row.mail_account_id);
  if (!credentials) return false;

  const uid = parseProviderUid(row.provider_message_id);
  if (!uid) {
    throw new Error("Message UID is missing.");
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
    const folderCatalog = await syncFolderCatalog(row.mail_account_id, client);
    const sourceFolderPath = row.folder_path ?? folderCatalog.inbox.provider_folder_id ?? "INBOX";
    const trashFolderPath = folderCatalog.trash?.provider_folder_id ?? null;
    const lock = await client.getMailboxLock(sourceFolderPath, { description: "delete message" });

    try {
      if (trashFolderPath && trashFolderPath !== sourceFolderPath) {
        await client.messageMove(uid, trashFolderPath, { uid: true });
      } else {
        await client.messageDelete(uid, { uid: true });
      }
    } finally {
      lock.release();
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

  const source = await dbQuery<ReplySourceRow>(
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

  const subject = row.subject.startsWith("Re:") ? row.subject : `Re: ${row.subject}`;
  const outgoingBody = applySignature(bodyText, credentials.signature);
  const toEmails = row.from_email ? [row.from_email] : [];
  const referenceHeaders = [...(row.reference_headers ?? []), ...(row.message_id_header ? [row.message_id_header] : [])];
  const transporter = nodemailer.createTransport({
    host: credentials.smtpHost,
    port: credentials.smtpPort,
    secure: credentials.smtpPort === 465,
    auth: {
      user: credentials.email,
      pass: credentials.password
    }
  });

  try {
    const send = await transporter.sendMail({
      from: credentials.email,
      to: row.from_email || undefined,
      subject,
      text: outgoingBody,
      inReplyTo: row.message_id_header || undefined,
      references: referenceHeaders.length > 0 ? referenceHeaders : undefined
    });

    await insertSendLog({
      accountId: row.mail_account_id,
      threadId: row.thread_id,
      toEmails,
      subject,
      bodyText: outgoingBody,
      status: "sent"
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
        toEmails,
        subject,
        toPreview(outgoingBody),
        outgoingBody
      ]
    );

    return result.rows[0] ? mapMessageRow(result.rows[0]) : undefined;
  } catch (error) {
    await insertSendLog({
      accountId: row.mail_account_id,
      threadId: row.thread_id,
      toEmails,
      subject,
      bodyText: outgoingBody,
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "SMTP send failed."
    });
    throw error;
  }
}
