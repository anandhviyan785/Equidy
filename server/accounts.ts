import { UpstreamError } from "./http.js";
import { appUrl } from "./env.js";
import { deleteAuthUser, describeUser, signInWithPassword, signUp, supabaseAuthEnabled, supabaseDbEnabled, type SupabaseUser } from "./supabase.js";

// Email + password accounts, stored and verified by Supabase Auth.
// Enabled when SUPABASE_URL and SUPABASE_ANON_KEY (or SUPABASE_PUBLISHABLE_KEY) are set.

export const accountsEnabled = () => supabaseAuthEnabled();

export interface Account {
  id: string;
  email: string;
  name: string;
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

/** Turns Supabase Auth errors into messages that are safe to show to the person signing in. */
export function accountErrorFrom(err: unknown): AccountError {
  if (err instanceof AccountError) return err;
  if (!(err instanceof UpstreamError)) return new AccountError("Something went wrong on our side. Please try again.", 500);
  const code = err.code ?? "";
  const msg = err.message.toLowerCase();
  if (code === "not_configured") return new AccountError("Accounts aren't set up on this server yet.", 503);
  if (code === "user_already_exists" || code === "email_exists" || msg.includes("already registered")) return new AccountError("An account with this email already exists. Sign in instead.", 409);
  if (code === "invalid_credentials" || code === "invalid_grant" || msg.includes("invalid login credentials")) return new AccountError("Incorrect email or password.", 401);
  if (code === "email_not_confirmed" || msg.includes("email not confirmed")) return new AccountError("Confirm your email first — check your inbox for the link we sent.", 403);
  if (code === "weak_password" || msg.includes("password should")) return new AccountError("Choose a stronger password (at least 8 characters, mixing letters and numbers).");
  if (code === "email_address_invalid") return new AccountError("Enter a valid email address.");
  if (code === "signup_disabled") return new AccountError("New sign-ups are switched off at the moment.", 403);
  if (err.status === 429 || code.includes("rate_limit")) return new AccountError("Too many attempts. Please wait a few minutes and try again.", 429);
  return new AccountError("Something went wrong on our side. Please try again.", 502);
}

const toAccount = (u: SupabaseUser, fallbackName: string): Account => {
  const d = describeUser(u);
  return { id: u.id, email: d.email ?? "", name: d.name || fallbackName };
};

/** Creates an account. Returns `pending` when Supabase requires the email to be confirmed first. */
export async function createAccount(input: { name?: string; email?: string; password?: string }): Promise<{ account: Account | null; pending: boolean }> {
  if (!accountsEnabled()) throw new AccountError("Accounts aren't set up on this server yet.", 503);
  const { email, password, name } = validate(input, true);
  try {
    const { user, confirmed } = await signUp(email, password, name, `${appUrl()}/login?confirmed=1`);
    if (!confirmed || !user) return { account: null, pending: true };
    return { account: toAccount(user, name), pending: false };
  } catch (err) {
    throw accountErrorFrom(err);
  }
}

export async function verifyAccount(input: { email?: string; password?: string }): Promise<Account> {
  if (!accountsEnabled()) throw new AccountError("Accounts aren't set up on this server yet.", 503);
  const { email, password } = validate(input, false);
  try {
    return toAccount(await signInWithPassword(email, password), email.split("@")[0]);
  } catch (err) {
    throw accountErrorFrom(err);
  }
}

/** Permanently removes a Supabase user (needs the service-role key). */
export async function deleteAccount(id: string) {
  if (!supabaseDbEnabled()) throw new AccountError("Account deletion needs SUPABASE_SERVICE_ROLE_KEY on the server.", 503);
  await deleteAuthUser(id);
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
