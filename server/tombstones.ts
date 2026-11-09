import { db, dbEnabled } from "./db.js";

// Sessions are stateless cookies, so deleting an account must also invalidate cookies issued before it.
// A tombstone remembers when each user was deleted; sessions issued at or before that moment are refused.
// People who sign in again afterwards get a fresh session and work normally.

let table: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  table ??= db()`
    CREATE TABLE IF NOT EXISTS equidy_deleted_users (
      user_id TEXT PRIMARY KEY,
      deleted_at BIGINT NOT NULL
    )`.then(() => undefined).catch((e) => { table = null; throw e; });
  return table;
}

/** Records the deletion time. No-op without a database. */
export async function markUserDeleted(userId: string): Promise<void> {
  if (!dbEnabled()) return;
  await ensureTable();
  await db()`
    INSERT INTO equidy_deleted_users (user_id, deleted_at) VALUES (${userId}, ${Date.now()})
    ON CONFLICT (user_id) DO UPDATE SET deleted_at = EXCLUDED.deleted_at`;
}

/** True when the user was deleted at or after the moment this session was issued. */
export async function isSessionRevoked(userId: string, issuedAt: number): Promise<boolean> {
  if (!dbEnabled()) return false;
  await ensureTable();
  const rows = (await db()`SELECT deleted_at FROM equidy_deleted_users WHERE user_id = ${userId}`) as { deleted_at: number | string }[];
  return rows.length > 0 && issuedAt <= Number(rows[0].deleted_at);
}
