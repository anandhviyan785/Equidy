import { db, dbEnabled, ensureSchema } from "./db.js";

// Two-level cache for third-party API responses: in-memory per server instance, plus (optionally)
// the equidy_market_cache table in Postgres so serverless instances share results. This matters for
// Alpha Vantage, whose free tier allows only 25 requests a day.

const memory = new Map<string, { at: number; value: unknown }>();
const inflight = new Map<string, Promise<unknown>>();
const MAX_MEMORY_ENTRIES = 2000;
const NEGATIVE_TTL_MS = 5 * 60_000;

interface Options {
  /** Also store in the database so other server instances can reuse it. */
  persist?: boolean;
}

export function peek<T>(key: string, ttlMs: number): T | undefined {
  const hit = memory.get(key);
  return hit && Date.now() - hit.at < ttlMs ? (hit.value as T) : undefined;
}

function remember(key: string, value: unknown, at = Date.now()) {
  if (memory.size >= MAX_MEMORY_ENTRIES) memory.delete(memory.keys().next().value as string);
  memory.set(key, { at, value });
}

async function readPersisted<T>(key: string, ttlMs: number): Promise<T | undefined> {
  if (!dbEnabled()) return undefined;
  try {
    await ensureSchema();
    const [row] = (await db()`SELECT payload, fetched_at FROM equidy_market_cache WHERE key = ${key}`) as { payload: T; fetched_at: string | Date }[];
    if (!row) return undefined;
    const at = new Date(row.fetched_at).getTime();
    if (!(Date.now() - at < ttlMs)) return undefined;
    remember(key, row.payload, at);
    return row.payload;
  } catch (err) {
    console.error("[equidy] cache read failed:", (err as Error).message);
    return undefined;
  }
}

async function writePersisted(key: string, value: unknown) {
  if (!dbEnabled()) return;
  try {
    await ensureSchema();
    await db()`
      INSERT INTO equidy_market_cache (key, payload, fetched_at) VALUES (${key}, ${JSON.stringify(value)}::jsonb, now())
      ON CONFLICT (key) DO UPDATE SET payload = EXCLUDED.payload, fetched_at = now()`;
  } catch (err) {
    console.error("[equidy] cache write failed:", (err as Error).message);
  }
}

/**
 * Returns a cached value younger than ttlMs, or runs the loader once (concurrent callers share it).
 * A loader result of `null` is cached in memory only, so misses are retried by other instances.
 */
export async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T | null>, opts: Options = {}): Promise<T | null> {
  const fresh = peek<T | null>(key, ttlMs);
  if (fresh !== undefined) return fresh;
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T | null>;
  const run = (async () => {
    if (opts.persist) {
      const stored = await readPersisted<T>(key, ttlMs);
      if (stored !== undefined) return stored;
    }
    const value = await loader();
    // Misses expire after NEGATIVE_TTL_MS whatever ttlMs is, so a rate-limited provider is retried soon.
    remember(key, value, value === null ? Date.now() - Math.max(0, ttlMs - NEGATIVE_TTL_MS) : Date.now());
    if (value !== null && opts.persist) await writePersisted(key, value);
    return value;
  })().finally(() => inflight.delete(key));
  inflight.set(key, run);
  return run;
}

/** For tests. */
export function clearCache() {
  memory.clear();
  inflight.clear();
}
