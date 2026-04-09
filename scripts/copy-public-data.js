const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");

const TABLES_IN_COPY_ORDER = [
  "users",
  "mail_accounts",
  "mail_folders",
  "threads",
  "messages",
  "sync_state",
  "send_log",
  "issue_reports",
  "app_error_logs",
  "user_sessions",
  "password_reset_tokens"
];

const TABLES_IN_TRUNCATE_ORDER = [...TABLES_IN_COPY_ORDER].reverse();
const CHUNK_SIZE = 250;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const result = {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

function readRuntimeEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  const fileEnv = loadEnvFile(envPath);

  return {
    ...fileEnv,
    ...process.env
  };
}

function pickSourceUrl(env) {
  return env.SOURCE_DATABASE_URL || null;
}

function pickTargetUrl(env) {
  return env.TARGET_DATABASE_URL || env.DATABASE_URL || env.POSTGRES_URL || null;
}

function getSsl(url) {
  return url.includes("localhost") ? false : { rejectUnauthorized: false };
}

async function tableExists(client, tableName) {
  const result = await client.query(
    `
      select exists (
        select 1
        from information_schema.tables
        where table_schema = 'public'
          and table_name = $1
      ) as exists
    `,
    [tableName]
  );

  return Boolean(result.rows[0]?.exists);
}

async function getColumnNames(client, tableName) {
  const result = await client.query(
    `
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = $1
      order by ordinal_position asc
    `,
    [tableName]
  );

  return result.rows.map((row) => row.column_name);
}

function quoteIdentifier(identifier) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

async function truncateTarget(client) {
  for (const tableName of TABLES_IN_TRUNCATE_ORDER) {
    const exists = await tableExists(client, tableName);
    if (!exists) continue;

    await client.query(`truncate table public.${quoteIdentifier(tableName)} restart identity cascade`);
  }
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function copyTable(source, target, tableName) {
  const sourceExists = await tableExists(source, tableName);
  const targetExists = await tableExists(target, tableName);

  if (!targetExists) {
    throw new Error(`Target table public.${tableName} does not exist. Run the Neon bootstrap first.`);
  }

  if (!sourceExists) {
    console.log(`Skipping public.${tableName}: source table is missing.`);
    return { copied: 0, skipped: true };
  }

  const sourceColumns = await getColumnNames(source, tableName);
  const targetColumns = await getColumnNames(target, tableName);
  const sharedColumns = targetColumns.filter((column) => sourceColumns.includes(column));

  if (sharedColumns.length === 0) {
    console.log(`Skipping public.${tableName}: no shared columns.`);
    return { copied: 0, skipped: true };
  }

  const selectSql = `select ${sharedColumns.map(quoteIdentifier).join(", ")} from public.${quoteIdentifier(tableName)}`;
  const rows = (await source.query(selectSql)).rows;

  if (rows.length === 0) {
    console.log(`Copied public.${tableName}: 0 rows`);
    return { copied: 0, skipped: false };
  }

  const columnList = sharedColumns.map(quoteIdentifier).join(", ");

  for (const batch of chunk(rows, CHUNK_SIZE)) {
    const values = [];
    const placeholders = [];

    for (const row of batch) {
      const rowPlaceholders = [];

      for (const column of sharedColumns) {
        values.push(row[column]);
        rowPlaceholders.push(`$${values.length}`);
      }

      placeholders.push(`(${rowPlaceholders.join(", ")})`);
    }

    const insertSql = `insert into public.${quoteIdentifier(tableName)} (${columnList}) values ${placeholders.join(", ")}`;
    await target.query(insertSql, values);
  }

  console.log(`Copied public.${tableName}: ${rows.length} rows`);
  return { copied: rows.length, skipped: false };
}

async function main() {
  const env = readRuntimeEnv();
  const sourceUrl = pickSourceUrl(env);
  const targetUrl = pickTargetUrl(env);

  if (!sourceUrl) {
    throw new Error("Missing source DB URL. Set SOURCE_DATABASE_URL.");
  }

  if (!targetUrl) {
    throw new Error("Missing target DB URL. Set TARGET_DATABASE_URL, DATABASE_URL, or POSTGRES_URL to your Neon database.");
  }

  if (sourceUrl === targetUrl) {
    throw new Error("Source and target DB URLs are identical. Refusing to copy into the same database.");
  }

  const source = new Client({ connectionString: sourceUrl, ssl: getSsl(sourceUrl) });
  const target = new Client({ connectionString: targetUrl, ssl: getSsl(targetUrl) });

  await source.connect();
  await target.connect();

  try {
    await target.query("begin");
    await truncateTarget(target);

    for (const tableName of TABLES_IN_COPY_ORDER) {
      await copyTable(source, target, tableName);
    }

    await target.query("commit");
    console.log("Public data copy completed successfully.");
  } catch (error) {
    await target.query("rollback");
    throw error;
  } finally {
    await source.end();
    await target.end();
  }
}

main().catch((error) => {
  console.error("Public data copy failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
