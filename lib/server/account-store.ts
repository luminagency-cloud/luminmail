import type { MailAccount } from "@/lib/types/account";
import { getEnvBackedAccount } from "@/lib/server/dev-mailbox-env";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { hasSupabaseServiceEnv } from "@/lib/supabase/env";
import { dbQuery, hasDatabaseUrl } from "@/lib/db/server";
import { encryptMailboxPassword } from "@/lib/server/mail-secrets";

type MailAccountRow = {
  id: string;
  name: string;
  email: string;
  imap_host: string;
  imap_port: number;
  smtp_host: string;
  smtp_port: number;
  signature: string | null;
  sync_interval_minutes: number | null;
  encrypted_secret: Buffer | null;
  secret_iv?: Buffer | null;
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
    signature: row.signature ?? "",
    syncIntervalMinutes: row.sync_interval_minutes ?? 15,
    passwordStored: Boolean(row.encrypted_secret),
    source: "manual"
  };
}

function mergeEnvAccount(accounts: MailAccount[]) {
  const envAccount = getEnvBackedAccount();
  return envAccount ? [envAccount, ...accounts.filter((account) => account.id !== envAccount.id)] : accounts;
}

export async function listAccounts(userId: string): Promise<MailAccount[]> {
  if (hasDatabaseUrl()) {
    const result = await dbQuery<MailAccountRow>(
      `
        select id, name, email, imap_host, imap_port, smtp_host, smtp_port, signature, sync_interval_minutes, encrypted_secret
        from public.mail_accounts
        where user_id = $1::uuid
        order by created_at asc
      `,
      [userId]
    );

    return mergeEnvAccount(result.rows.map(mapRowToAccount));
  }

  if (!hasSupabaseServiceEnv()) {
    return mergeEnvAccount([]);
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("mail_accounts")
    .select("id, name, email, imap_host, imap_port, smtp_host, smtp_port, signature, sync_interval_minutes, encrypted_secret")
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

  if (hasDatabaseUrl()) {
    const result = await dbQuery<MailAccountRow>(
      `
        select id, name, email, imap_host, imap_port, smtp_host, smtp_port, signature, sync_interval_minutes, encrypted_secret
        from public.mail_accounts
        where user_id = $1::uuid and id = $2::uuid
        limit 1
      `,
      [userId, id]
    );

    return result.rows[0] ? mapRowToAccount(result.rows[0]) : undefined;
  }

  if (!hasSupabaseServiceEnv()) {
    return undefined;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("mail_accounts")
    .select("id, name, email, imap_host, imap_port, smtp_host, smtp_port, signature, sync_interval_minutes, encrypted_secret")
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
    signature?: string;
    syncIntervalMinutes?: number;
    password?: string;
  }
): Promise<MailAccount | undefined> {
  if (hasDatabaseUrl()) {
    const name = input.name.trim();
    const email = input.email.trim();
    const imapHost = input.imapHost.trim();
    const smtpHost = input.smtpHost.trim();
    const signature = input.signature ?? "";
    const syncIntervalMinutes =
      typeof input.syncIntervalMinutes === "number" && Number.isFinite(input.syncIntervalMinutes)
        ? Math.max(5, Math.floor(input.syncIntervalMinutes))
        : 15;

    if (!name || !email || !imapHost || !smtpHost) {
      return undefined;
    }

    try {
      const secret = input.password?.trim() ? encryptMailboxPassword(input.password.trim()) : null;
      const result = await dbQuery<MailAccountRow>(
        `
          insert into public.mail_accounts (
            user_id, name, email, imap_host, imap_port, smtp_host, smtp_port, signature, sync_interval_minutes, encrypted_secret, secret_iv
          )
          values ($1::uuid, $2::text, $3::text, $4::text, $5::integer, $6::text, $7::integer, $8::text, $9::integer, $10::bytea, $11::bytea)
          returning id, name, email, imap_host, imap_port, smtp_host, smtp_port, signature, sync_interval_minutes, encrypted_secret
        `,
        [
          userId,
          name,
          email,
          imapHost,
          input.imapPort,
          smtpHost,
          input.smtpPort,
          signature,
          syncIntervalMinutes,
          secret?.encryptedSecret ?? null,
          secret?.secretIv ?? null
        ]
      );

      const account = mapRowToAccount(result.rows[0]);
      if (input.password?.trim()) account.passwordStored = true;
      return account;
    } catch (error) {
      const pgError = error as { code?: string; message?: string };
      throw mapSupabaseError("create account", { code: pgError.code ?? null, message: pgError.message ?? "Database error" });
    }
  }

  if (!hasSupabaseServiceEnv()) {
    return undefined;
  }

  const name = input.name.trim();
  const email = input.email.trim();
  const imapHost = input.imapHost.trim();
  const smtpHost = input.smtpHost.trim();
  const signature = input.signature ?? "";
  const syncIntervalMinutes =
    typeof input.syncIntervalMinutes === "number" && Number.isFinite(input.syncIntervalMinutes)
      ? Math.max(5, Math.floor(input.syncIntervalMinutes))
      : 15;

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
      smtp_port: input.smtpPort,
      signature,
      sync_interval_minutes: syncIntervalMinutes
    })
    .select("id, name, email, imap_host, imap_port, smtp_host, smtp_port, signature, sync_interval_minutes, encrypted_secret")
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
    signature?: string;
    syncIntervalMinutes?: number;
    password?: string;
  }
): Promise<MailAccount | undefined> {
  const envAccount = getEnvBackedAccount();
  if (envAccount?.id === id) {
    return undefined;
  }

  if (hasDatabaseUrl()) {
    const updates: string[] = [];
    const values: unknown[] = [userId, id];
    let index = 3;

    if (input.name?.trim()) {
      updates.push(`name = $${index++}::text`);
      values.push(input.name.trim());
    }
    if (input.email?.trim()) {
      updates.push(`email = $${index++}::text`);
      values.push(input.email.trim());
    }
    if (input.imapHost?.trim()) {
      updates.push(`imap_host = $${index++}::text`);
      values.push(input.imapHost.trim());
    }
    if (typeof input.imapPort === "number" && Number.isFinite(input.imapPort)) {
      updates.push(`imap_port = $${index++}::integer`);
      values.push(input.imapPort);
    }
    if (input.smtpHost?.trim()) {
      updates.push(`smtp_host = $${index++}::text`);
      values.push(input.smtpHost.trim());
    }
    if (typeof input.smtpPort === "number" && Number.isFinite(input.smtpPort)) {
      updates.push(`smtp_port = $${index++}::integer`);
      values.push(input.smtpPort);
    }
    if (input.signature !== undefined) {
      updates.push(`signature = $${index++}::text`);
      values.push(input.signature);
    }
    if (typeof input.syncIntervalMinutes === "number" && Number.isFinite(input.syncIntervalMinutes)) {
      updates.push(`sync_interval_minutes = $${index++}::integer`);
      values.push(Math.max(5, Math.floor(input.syncIntervalMinutes)));
    }
    if (input.password?.trim()) {
      const secret = encryptMailboxPassword(input.password.trim());
      updates.push(`encrypted_secret = $${index++}::bytea`);
      values.push(secret.encryptedSecret);
      updates.push(`secret_iv = $${index++}::bytea`);
      values.push(secret.secretIv);
    }

    if (updates.length === 0) {
      return getAccount(userId, id);
    }

    try {
      const result = await dbQuery<MailAccountRow>(
        `
          update public.mail_accounts
          set ${updates.join(", ")}, updated_at = timezone('utc', now())
          where user_id = $1::uuid and id = $2::uuid
          returning id, name, email, imap_host, imap_port, smtp_host, smtp_port, signature, sync_interval_minutes, encrypted_secret
        `,
        values
      );

      if (!result.rows[0]) {
        return undefined;
      }

      const account = mapRowToAccount(result.rows[0]);
      if (input.password !== undefined) {
        account.passwordStored = Boolean(input.password.trim()) || account.passwordStored;
      }

      return account;
    } catch (error) {
      const pgError = error as { code?: string; message?: string };
      throw mapSupabaseError("update account", { code: pgError.code ?? null, message: pgError.message ?? "Database error" });
    }
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
  if (input.signature !== undefined) updates.signature = input.signature;
  if (typeof input.syncIntervalMinutes === "number" && Number.isFinite(input.syncIntervalMinutes)) {
    updates.sync_interval_minutes = Math.max(5, Math.floor(input.syncIntervalMinutes));
  }

  if (Object.keys(updates).length === 0) {
    return getAccount(userId, id);
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("mail_accounts")
    .update(updates)
    .eq("user_id", userId)
    .eq("id", id)
    .select("id, name, email, imap_host, imap_port, smtp_host, smtp_port, signature, sync_interval_minutes, encrypted_secret")
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

export async function deleteAccount(userId: string, id: string): Promise<boolean> {
  const envAccount = getEnvBackedAccount();
  if (envAccount?.id === id) {
    return false;
  }

  if (hasDatabaseUrl()) {
    const result = await dbQuery(
      `
        delete from public.mail_accounts
        where user_id = $1::uuid and id = $2::uuid
      `,
      [userId, id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  if (!hasSupabaseServiceEnv()) {
    return false;
  }

  const supabase = getSupabaseAdminClient();
  const { error, count } = await supabase
    .from("mail_accounts")
    .delete({ count: "exact" })
    .eq("user_id", userId)
    .eq("id", id);

  if (error) {
    throw mapSupabaseError("delete account", error);
  }

  return Boolean(count);
}
