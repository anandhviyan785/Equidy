import { neon } from "@neondatabase/serverless";
import pg from "pg";
import { getEnv } from "./env.js";

// Postgres through one tagged-template interface.
// Supabase connection strings use a standard Postgres connection (use Supabase's transaction pooler URL).
// Anything else uses Neon's HTTP driver (e.g. a free Neon database added from Vercel → Storage).
// Enabled when DATABASE_URL (or POSTGRES_URL, set by Vercel's Postgres integrations) is present.
// Tables are created automatically on first use.

type Sql = ReturnType<typeof neon>;
let client: { url: string; sql: Sql } | null = null;

const dbUrl = () => getEnv("DATABASE_URL") ?? getEnv("POSTGRES_URL");
export const dbEnabled = () => !!dbUrl();

export const usesStandardPostgres = (url: string) => /\.supabase\.(co|com)\b/i.test(url);

/** Turns a tagged template's text parts into a parameterised statement ($1, $2, …). */
export function toStatement(strings: readonly string[]): string {
  return strings.reduce((text, part, i) => `${text}$${i}${part}`);
}

function standardPostgres(url: string): Sql {
  const ca = getEnv("DATABASE_CA");
  // One connection per serverless instance: the provider's pooler handles sharing.
  const pool = new pg.Pool({
    connectionString: url,
    max: 1,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
    ssl: ca ? { ca: ca.replace(/\\n/g, "\n") } : { rejectUnauthorized: false },
  });
  const run = async (strings: TemplateStringsArray, ...values: unknown[]) => (await pool.query(toStatement(strings), values)).rows;
  return run as unknown as Sql;
}

/** The tagged-template SQL function. Values are always sent as parameters, never interpolated. */
export function db(): Sql {
  const url = dbUrl();
  if (!url) throw new Error("No database configured (set DATABASE_URL).");
  if (client?.url !== url) client = { url, sql: usesStandardPostgres(url) ? standardPostgres(url) : neon(url) };
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
