import type { MailAccount } from "@/lib/types/account";
import { getEnvBackedAccount } from "@/lib/server/dev-mailbox-env";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { hasSupabaseServiceEnv } from "@/lib/supabase/env";

type MailAccountRow = {
  id: string;
  name: string;
  email: string;
  imap_host: string;
  imap_port: number;
  smtp_host: string;
  smtp_port: number;
  encrypted_secret: string | null;
};

export class AccountStoreError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "AccountStoreError";
    this.status = status;
  }
}

function mapSupabaseError(action: string, error: { message: string; code?: string | null }) {
  if (error.code === "23505") {
    return new AccountStoreError("That email address is already attached to one of your accounts.", 409);
  }

  if (error.code === "23503") {
    return new AccountStoreError("Your login session is out of sync with the database. Please sign out and sign back in.", 409);
  }

  if (error.code === "42P01") {
    return new AccountStoreError("The mail_accounts table is missing in Supabase. Re-run the latest schema.", 500);
  }

  return new AccountStoreError(`Unable to ${action}: ${error.message}`, 500);
}

function mapRowToAccount(row: MailAccountRow): MailAccount {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    imapHost: row.imap_host,
    imapPort: row.imap_port,
    smtpHost: row.smtp_host,
    smtpPort: row.smtp_port,
    passwordStored: Boolean(row.encrypted_secret),
    source: "manual"
  };
}

function mergeEnvAccount(accounts: MailAccount[]) {
  const envAccount = getEnvBackedAccount();
  return envAccount ? [envAccount, ...accounts.filter((account) => account.id !== envAccount.id)] : accounts;
}

export async function listAccounts(userId: string): Promise<MailAccount[]> {
  if (!hasSupabaseServiceEnv()) {
    return mergeEnvAccount([]);
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("mail_accounts")
    .select("id, name, email, imap_host, imap_port, smtp_host, smtp_port, encrypted_secret")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw mapSupabaseError("list accounts", error);
  }

  return mergeEnvAccount((data ?? []).map((row) => mapRowToAccount(row as MailAccountRow)));
}

export async function getAccount(userId: string, id: string): Promise<MailAccount | undefined> {
  const envAccount = getEnvBackedAccount();
  if (envAccount?.id === id) {
    return envAccount;
  }

  if (!hasSupabaseServiceEnv()) {
    return undefined;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("mail_accounts")
    .select("id, name, email, imap_host, imap_port, smtp_host, smtp_port, encrypted_secret")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw mapSupabaseError("load account", error);
  }

  return data ? mapRowToAccount(data as MailAccountRow) : undefined;
}

export async function createAccount(
  userId: string,
  input: {
    name: string;
    email: string;
    imapHost: string;
    imapPort: number;
    smtpHost: string;
    smtpPort: number;
    password?: string;
  }
): Promise<MailAccount | undefined> {
  if (!hasSupabaseServiceEnv()) {
    return undefined;
  }

  const name = input.name.trim();
  const email = input.email.trim();
  const imapHost = input.imapHost.trim();
  const smtpHost = input.smtpHost.trim();

  if (!name || !email || !imapHost || !smtpHost) {
    return undefined;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("mail_accounts")
    .insert({
      user_id: userId,
      name,
      email,
      imap_host: imapHost,
      imap_port: input.imapPort,
      smtp_host: smtpHost,
      smtp_port: input.smtpPort
    })
    .select("id, name, email, imap_host, imap_port, smtp_host, smtp_port, encrypted_secret")
    .single();

  if (error) {
    throw mapSupabaseError("create account", error);
  }

  const account = mapRowToAccount(data as MailAccountRow);
  if (input.password?.trim()) {
    account.passwordStored = true;
  }

  return account;
}

export async function updateAccount(
  userId: string,
  id: string,
  input: {
    name?: string;
    email?: string;
    imapHost?: string;
    imapPort?: number;
    smtpHost?: string;
    smtpPort?: number;
    password?: string;
  }
): Promise<MailAccount | undefined> {
  const envAccount = getEnvBackedAccount();
  if (envAccount?.id === id) {
    return undefined;
  }

  if (!hasSupabaseServiceEnv()) {
    return undefined;
  }

  const updates: Record<string, string | number> = {};
  if (input.name?.trim()) updates.name = input.name.trim();
  if (input.email?.trim()) updates.email = input.email.trim();
  if (input.imapHost?.trim()) updates.imap_host = input.imapHost.trim();
  if (typeof input.imapPort === "number" && Number.isFinite(input.imapPort)) updates.imap_port = input.imapPort;
  if (input.smtpHost?.trim()) updates.smtp_host = input.smtpHost.trim();
  if (typeof input.smtpPort === "number" && Number.isFinite(input.smtpPort)) updates.smtp_port = input.smtpPort;

  if (Object.keys(updates).length === 0) {
    return getAccount(userId, id);
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("mail_accounts")
    .update(updates)
    .eq("user_id", userId)
    .eq("id", id)
    .select("id, name, email, imap_host, imap_port, smtp_host, smtp_port, encrypted_secret")
    .maybeSingle();

  if (error) {
    throw mapSupabaseError("update account", error);
  }

  if (!data) {
    return undefined;
  }

  const account = mapRowToAccount(data as MailAccountRow);
  if (input.password !== undefined) {
    account.passwordStored = Boolean(input.password.trim()) || account.passwordStored;
  }

  return account;
}
