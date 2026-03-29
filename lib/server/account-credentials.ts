import { dbQuery } from "@/lib/db/server";
import { decryptMailboxPassword } from "@/lib/server/mail-secrets";

type AccountCredentialRow = {
  id: string;
  user_id: string;
  email: string;
  imap_host: string;
  imap_port: number;
  smtp_host: string;
  smtp_port: number;
  signature: string | null;
  encrypted_secret: Buffer | null;
  secret_iv: Buffer | null;
};

export async function getDecryptedAccountCredentials(userId: string, accountId: string) {
  const result = await dbQuery<AccountCredentialRow>(
    `
      select id, user_id, email, imap_host, imap_port, smtp_host, smtp_port, signature, encrypted_secret, secret_iv
      from public.mail_accounts
      where user_id = $1::uuid and id = $2::uuid
      limit 1
    `,
    [userId, accountId]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  if (!row.encrypted_secret || !row.secret_iv) {
    throw new Error("Mailbox password is not stored for this account. Re-save the account with a password.");
  }

  return {
    accountId: row.id,
    email: row.email,
    imapHost: row.imap_host,
    imapPort: row.imap_port,
    smtpHost: row.smtp_host,
    smtpPort: row.smtp_port,
    signature: row.signature ?? "",
    password: decryptMailboxPassword(row.encrypted_secret, row.secret_iv)
  };
}
