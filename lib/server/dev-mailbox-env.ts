import type { MailAccount } from "@/lib/types/account";

function readNumberEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getEnvBackedAccount(): MailAccount | null {
  const email = process.env.DEV_MAIL_ACCOUNT_EMAIL?.trim();
  const password = process.env.DEV_MAIL_ACCOUNT_PASSWORD?.trim();
  const imapHost = process.env.DEV_MAIL_ACCOUNT_IMAP_HOST?.trim();
  const smtpHost = process.env.DEV_MAIL_ACCOUNT_SMTP_HOST?.trim();

  if (!email || !password || !imapHost || !smtpHost) return null;

  return {
    id: "acct_env_dev",
    name: process.env.DEV_MAIL_ACCOUNT_NAME?.trim() || "Work",
    email,
    imapHost,
    imapPort: readNumberEnv("DEV_MAIL_ACCOUNT_IMAP_PORT", 993),
    smtpHost,
    smtpPort: readNumberEnv("DEV_MAIL_ACCOUNT_SMTP_PORT", 587),
    passwordStored: true,
    source: "env"
  };
}
