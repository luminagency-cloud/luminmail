import { Pool, type QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __luminmailPgPool: Pool | undefined;
}

function getDatabaseUrl() {
  return process.env.SUPABASE_DB_URL ?? process.env.POSTGRES_URL ?? null;
}

export function hasDatabaseUrl() {
  return Boolean(getDatabaseUrl());
}

function getPool() {
  const connectionString = getDatabaseUrl();
  if (!connectionString) {
    throw new Error("Missing SUPABASE_DB_URL for direct database access.");
  }

  if (!global.__luminmailPgPool) {
    global.__luminmailPgPool = new Pool({
      connectionString,
      max: 5,
      ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false }
    });
  }

  return global.__luminmailPgPool;
}

export async function dbQuery<T extends QueryResultRow>(text: string, values: unknown[] = []) {
  const pool = getPool();
  return pool.query<T>(text, values);
}
