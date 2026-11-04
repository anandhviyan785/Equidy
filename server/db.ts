import { neon } from "@neondatabase/serverless";
import { getEnv } from "./env.js";

// Postgres over Neon's HTTP driver (e.g. a free Neon database added from Vercel → Storage).
// Enabled when DATABASE_URL (or POSTGRES_URL, set by Vercel's Postgres integrations) is present.
// Tables are created automatically on first use.

type Sql = ReturnType<typeof neon>;
let client: { url: string; sql: Sql } | null = null;

const dbUrl = () => getEnv("DATABASE_URL") ?? getEnv("POSTGRES_URL");
export const dbEnabled = () => !!dbUrl();

/** The tagged-template SQL function. Values are always sent as parameters, never interpolated. */
export function db(): Sql {
  const url = dbUrl();
  if (!url) throw new Error("No database configured (set DATABASE_URL).");
  if (client?.url !== url) client = { url, sql: neon(url) };
  return client.sql;
}

let schema: Promise<void> | null = null;

/** Creates Equidy's data tables (users are created separately by accounts.ts). */
export function ensureSchema(): Promise<void> {
  schema ??= (async () => {
    const sql = db();
    await sql`
      CREATE TABLE IF NOT EXISTS equidy_user_data (
        user_id TEXT PRIMARY KEY,
        portfolio JSONB NOT NULL DEFAULT '{}'::jsonb,
        chats JSONB NOT NULL DEFAULT '[]'::jsonb,
        settings JSONB NOT NULL DEFAULT '{}'::jsonb,
        client_updated_at BIGINT NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
    await sql`
      CREATE TABLE IF NOT EXISTS equidy_plaid_items (
        item_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        access_token_enc TEXT NOT NULL,
        institution_name TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
    await sql`
      CREATE TABLE IF NOT EXISTS equidy_market_cache (
        key TEXT PRIMARY KEY,
        payload JSONB NOT NULL,
        fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
  })().catch((e) => {
    schema = null;
    throw e;
  });
  return schema;
}
