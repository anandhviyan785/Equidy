import crypto from "node:crypto";
import { promisify } from "node:util";
import { neon } from "@neondatabase/serverless";

// Email + password accounts stored in Postgres (e.g. Neon, added from Vercel → Storage).
// Enabled when DATABASE_URL (or POSTGRES_URL, set by Vercel's Postgres integrations) is present.

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const sql = DB_URL ? neon(DB_URL) : null;
export const accountsEnabled = !!sql;

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export interface Account {
  id: string;
  email: string;
  name: string;
}

let ready: Promise<void> | null = null;
function ensureTable() {
  ready ??= sql!`
    CREATE TABLE IF NOT EXISTS equidy_users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`.then(() => undefined).catch((e) => { ready = null; throw e; });
  return ready;
}

async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt:${salt.toString("base64")}:${key.toString("base64")}`;
}

async function verifyPassword(password: string, stored: string) {
  const [, saltB64, keyB64] = stored.split(":");
  if (!saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

export class AccountError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export const normalizeEmail = (e: string) => e.trim().toLowerCase();

export function validate(input: { name?: string; email?: string; password?: string }, signup: boolean) {
  const email = normalizeEmail(String(input.email ?? ""));
  const password = String(input.password ?? "");
  const name = String(input.name ?? "").trim().slice(0, 80);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new AccountError("Enter a valid email address.");
  if (signup && password.length < 8) throw new AccountError("Use a password of at least 8 characters.");
  if (password.length > 200) throw new AccountError("That password is too long.");
  if (signup && !name) throw new AccountError("Enter your name.");
  return { email, password, name };
}

export async function createAccount(input: { name?: string; email?: string; password?: string }): Promise<Account> {
  if (!sql) throw new AccountError("Accounts aren't set up on this server yet.", 503);
  const { email, password, name } = validate(input, true);
  await ensureTable();
  const id = crypto.randomUUID();
  const hash = await hashPassword(password);
  const rows = (await sql`
    INSERT INTO equidy_users (id, email, name, password_hash) VALUES (${id}, ${email}, ${name}, ${hash})
    ON CONFLICT (email) DO NOTHING
    RETURNING id, email, name`) as Account[];
  if (!rows.length) throw new AccountError("An account with this email already exists. Sign in instead.", 409);
  return rows[0];
}

// Used when the email is unknown, so the response takes as long as a real check.
const DUMMY_HASH = `scrypt:${Buffer.alloc(16).toString("base64")}:${Buffer.alloc(64).toString("base64")}`;

export async function verifyAccount(input: { email?: string; password?: string }): Promise<Account> {
  if (!sql) throw new AccountError("Accounts aren't set up on this server yet.", 503);
  const { email, password } = validate(input, false);
  await ensureTable();
  const rows = (await sql`SELECT id, email, name, password_hash FROM equidy_users WHERE email = ${email}`) as (Account & { password_hash: string })[];
  const ok = await verifyPassword(password, rows[0]?.password_hash ?? DUMMY_HASH);
  if (!rows.length || !ok) throw new AccountError("Incorrect email or password.", 401);
  return { id: rows[0].id, email: rows[0].email, name: rows[0].name };
}

// Best-effort brute-force protection (per server instance).
const attempts = new Map<string, { n: number; reset: number }>();
export function rateLimit(key: string, max = 10, windowMs = 10 * 60_000) {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || a.reset < now) {
    attempts.set(key, { n: 1, reset: now + windowMs });
    return;
  }
  if (++a.n > max) throw new AccountError("Too many attempts. Please wait a few minutes and try again.", 429);
}

/** Permanently removes an email account. */
export async function deleteAccount(id: string) {
  if (!sql) return;
  await ensureTable();
  await sql`DELETE FROM equidy_users WHERE id = ${id}`;
}
