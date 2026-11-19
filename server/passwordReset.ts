import crypto from "node:crypto";
import { AccountError, accountsEnabled, findAccount, normalizeEmail, setPassword, validateNewPassword, type Account } from "./accounts.js";
import { db, dbEnabled } from "./db.js";
import { devAccountsEnabled } from "./devAccounts.js";
import { emailEnabled, sendPasswordResetEmail } from "./email.js";
import { appUrl } from "./env.js";
import { revokeSessionsBefore } from "./tombstones.js";

// Forgot-password: a random single-use token is emailed as a link; only its SHA-256 hash is stored.
// Requests answer the same way whether or not the email has an account, so they can't be used to probe for users.

const TOKEN_TTL_MS = 60 * 60_000;
const TOKEN_BYTES = 32;
const MAX_EMAIL_LENGTH = 254;
export const INVALID_LINK = "This reset link is invalid or has expired. Request a new one.";

const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

interface TokenStore {
  save(tokenHash: string, userId: string, expiresAt: number): Promise<void>;
  /** Marks the token used and returns its user, or null if it is unknown, used or expired. */
  consume(tokenHash: string, now: number): Promise<string | null>;
}

// Local development without a database keeps tokens in memory (never used in production).
const memoryTokens = new Map<string, { userId: string; expiresAt: number }>();
const memoryStore: TokenStore = {
  async save(tokenHash, userId, expiresAt) {
    for (const [k, v] of memoryTokens) if (v.userId === userId) memoryTokens.delete(k);
    memoryTokens.set(tokenHash, { userId, expiresAt });
  },
  async consume(tokenHash, now) {
    const found = memoryTokens.get(tokenHash);
    memoryTokens.delete(tokenHash);
    return found && found.expiresAt > now ? found.userId : null;
  },
};

let table: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  table ??= db()`
    CREATE TABLE IF NOT EXISTS equidy_password_resets (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at BIGINT NOT NULL,
      used_at BIGINT
    )`.then(() => undefined).catch((e) => { table = null; throw e; });
  return table;
}

const dbStore: TokenStore = {
  async save(tokenHash, userId, expiresAt) {
    await ensureTable();
    const sql = db();
    // Only the newest link works; older unused ones are retired.
    await sql`UPDATE equidy_password_resets SET used_at = ${Date.now()} WHERE user_id = ${userId} AND used_at IS NULL`;
    await sql`INSERT INTO equidy_password_resets (token_hash, user_id, expires_at) VALUES (${tokenHash}, ${userId}, ${expiresAt})`;
  },
  async consume(tokenHash, now) {
    await ensureTable();
    // A single conditional UPDATE, so two simultaneous uses can't both succeed.
    const rows = (await db()`
      UPDATE equidy_password_resets SET used_at = ${now}
      WHERE token_hash = ${tokenHash} AND used_at IS NULL AND expires_at > ${now}
      RETURNING user_id`) as { user_id: string }[];
    return rows[0]?.user_id ?? null;
  },
};

const store = (): TokenStore => (dbEnabled() ? dbStore : memoryStore);

/** Reset needs accounts plus a way to deliver the link (email, or the server log in local development). */
export const passwordResetAvailable = () => accountsEnabled() && (emailEnabled() || (devAccountsEnabled() && !dbEnabled()));

function validEmail(input: unknown): string {
  const email = normalizeEmail(String(input ?? ""));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > MAX_EMAIL_LENGTH) throw new AccountError("Enter a valid email address.");
  return email;
}

/** Emails a reset link when the address has an account. Resolves the same way when it doesn't. */
export async function requestPasswordReset(emailInput: unknown): Promise<void> {
  const email = validEmail(emailInput);
  if (!passwordResetAvailable()) throw new AccountError("Password reset isn't available yet. Please contact support.", 503);
  const account = await findAccount(email);
  if (!account) return;

  const token = crypto.randomBytes(TOKEN_BYTES).toString("base64url");
  await store().save(hashToken(token), account.id, Date.now() + TOKEN_TTL_MS);
  const link = `${appUrl()}/reset-password?token=${token}`;

  if (emailEnabled()) {
    const sent = await sendPasswordResetEmail(account.email, link);
    if (!sent) console.error("[equidy] password reset email could not be sent");
    return;
  }
  console.info(`[equidy] (local development) password reset link: ${link}`);
}

/** Sets a new password from a reset link, signs the account out everywhere else, and returns the account. */
export async function resetPassword(tokenInput: unknown, passwordInput: unknown): Promise<Account> {
  if (!accountsEnabled()) throw new AccountError("Accounts aren't set up on this server yet.", 503);
  const password = validateNewPassword(passwordInput);
  if (typeof tokenInput !== "string" || !tokenInput || tokenInput.length > 200) throw new AccountError(INVALID_LINK);

  const userId = await store().consume(hashToken(tokenInput), Date.now());
  if (!userId) throw new AccountError(INVALID_LINK);
  const account = await setPassword(userId, password);
  if (!account) throw new AccountError(INVALID_LINK);
  // One millisecond back, so the fresh session issued right after this isn't caught by the revocation.
  await revokeSessionsBefore(`email:${account.id}`, Date.now() - 1);
  return account;
}
