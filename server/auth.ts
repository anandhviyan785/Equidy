import express, { type Request, type Response, type NextFunction } from "express";
import crypto from "node:crypto";
import { Apple, Google, MicrosoftEntraId, OAuth2RequestError, decodeIdToken, generateCodeVerifier, generateState } from "arctic";
import { AccountError, accountErrorFrom, accountsEnabled, createAccount, deleteAccount, rateLimit, verifyAccount } from "./accounts.js";
import { appUrl, getEnv } from "./env.js";
import { authorizeUrl, describeUser, enabledOAuthProviders, exchangeCode, supabaseAuthEnabled } from "./supabase.js";
import { deleteUserData } from "./userdata.js";
import { removeAllItems } from "./plaid.js";

// Sign-in. With Supabase configured, email/password and Google/Microsoft/Apple all go through Supabase Auth.
// Without it, Google/Microsoft/Apple can still be used directly (arctic) when their credentials are set.

export type ProviderId = "google" | "microsoft" | "apple";

export interface SessionUser {
  id: string; // "sb:<supabase uuid>" or "<provider>:<subject>"
  provider: ProviderId | "email";
  name: string;
  email: string | null;
  avatar: string | null;
}

const APP_URL = appUrl();
const SECURE = APP_URL.startsWith("https://");
const SESSION_COOKIE = "equidy_session";
const SESSION_DAYS = 30;
const SECRET = getEnv("SESSION_SECRET") || crypto.randomBytes(32).toString("hex");
if (!getEnv("SESSION_SECRET")) console.warn("[equidy] SESSION_SECRET not set — sessions will reset when the server restarts.");

const callback = (p: ProviderId) => `${APP_URL}/api/auth/${p}/callback`;
const SUPABASE_CALLBACK = `${APP_URL}/api/auth/supabase/callback`;

function pemToPkcs8(pem: string): Uint8Array {
  const b64 = pem.replace(/\\n/g, "\n").replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  return new Uint8Array(Buffer.from(b64, "base64"));
}

// Direct OAuth clients, used only when Supabase Auth isn't configured.
const env = (k: string) => getEnv(k);
const google = env("GOOGLE_CLIENT_ID") && env("GOOGLE_CLIENT_SECRET") ? new Google(env("GOOGLE_CLIENT_ID")!, env("GOOGLE_CLIENT_SECRET")!, callback("google")) : null;
const microsoft =
  env("MICROSOFT_CLIENT_ID") && env("MICROSOFT_CLIENT_SECRET")
    ? new MicrosoftEntraId(env("MICROSOFT_TENANT") || "common", env("MICROSOFT_CLIENT_ID")!, env("MICROSOFT_CLIENT_SECRET")!, callback("microsoft"))
    : null;
const apple =
  env("APPLE_CLIENT_ID") && env("APPLE_TEAM_ID") && env("APPLE_KEY_ID") && env("APPLE_PRIVATE_KEY")
    ? new Apple(env("APPLE_CLIENT_ID")!, env("APPLE_TEAM_ID")!, env("APPLE_KEY_ID")!, pemToPkcs8(env("APPLE_PRIVATE_KEY")!), callback("apple"))
    : null;
const directProviders: Record<ProviderId, boolean> = { google: !!google, microsoft: !!microsoft, apple: !!apple };

export async function getProviders(): Promise<Record<ProviderId, boolean>> {
  return supabaseAuthEnabled() ? enabledOAuthProviders() : directProviders;
}

export const authEnabled = () => accountsEnabled() || Object.values(directProviders).some(Boolean);

// ---------------- cookies & signed sessions ----------------

function parseCookies(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function setCookie(res: Response, name: string, value: string, opts: { maxAge: number; sameSite?: "Lax" | "None" }) {
  const sameSite = opts.sameSite ?? "Lax";
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", `Max-Age=${opts.maxAge}`, `SameSite=${sameSite}`];
  if (SECURE || sameSite === "None") parts.push("Secure");
  res.append("Set-Cookie", parts.join("; "));
}

const sign = (data: string) => crypto.createHmac("sha256", SECRET).update(data).digest("base64url");

function encodeSession(user: SessionUser) {
  const body = Buffer.from(JSON.stringify({ user, exp: Date.now() + SESSION_DAYS * 86_400_000 })).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function readSession(req: Request): SessionUser | null {
  const raw = parseCookies(req)[SESSION_COOKIE];
  if (!raw) return null;
  const [body, sig] = raw.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const { user, exp } = JSON.parse(Buffer.from(body, "base64url").toString()) as { user: SessionUser; exp: number };
    return exp > Date.now() ? user : null;
  } catch {
    return null;
  }
}

/** Blocks a route unless the visitor is signed in — only when sign-in is configured at all. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!authEnabled() || readSession(req)) return next();
  res.status(401).json({ error: "Please sign in to continue." });
}

/** Blocks a route unless there is a real signed-in user (for per-user data such as sync and bank links). */
export function requireUser(req: Request, res: Response, next: NextFunction) {
  const user = readSession(req);
  if (!user) return void res.status(401).json({ error: "Please sign in to continue." });
  res.locals.user = user;
  next();
}

// ---------------- routes ----------------

type Claims = { sub: string; email?: string; name?: string; picture?: string; preferred_username?: string; given_name?: string; family_name?: string };

function userFrom(provider: ProviderId, c: Claims, appleName?: string): SessionUser {
  const email = c.email ?? c.preferred_username ?? null;
  const name = appleName || c.name || [c.given_name, c.family_name].filter(Boolean).join(" ") || email?.split("@")[0] || "Equidy user";
  return { id: `${provider}:${c.sub}`, provider, name, email, avatar: c.picture ?? null };
}

function fail(res: Response, message: string) {
  res.redirect(`${APP_URL}/login?error=${encodeURIComponent(message)}`);
}

export const authRouter = express.Router();
authRouter.use(express.urlencoded({ extended: false })); // Apple posts its callback as a form

authRouter.get("/session", async (req, res) => {
  res.json({ user: readSession(req), providers: await getProviders(), accounts: accountsEnabled() });
});

authRouter.post("/logout", (_req, res) => {
  setCookie(res, SESSION_COOKIE, "", { maxAge: 0 });
  res.json({ ok: true });
});

function startSession(res: Response, user: SessionUser) {
  setCookie(res, SESSION_COOKIE, encodeSession(user), { maxAge: SESSION_DAYS * 86_400 });
}

const sbUser = (id: string, name: string, email: string | null, provider: SessionUser["provider"], avatar: string | null = null): SessionUser => ({
  id: `sb:${id}`,
  provider,
  name,
  email,
  avatar,
});

authRouter.post("/signup", express.json(), async (req, res) => {
  try {
    rateLimit(`signup:${req.ip}`);
    const { account, pending } = await createAccount((req.body ?? {}) as { name?: string; email?: string; password?: string });
    if (pending || !account) {
      return void res.status(202).json({ pending: true, message: "Check your email and tap the confirmation link, then sign in." });
    }
    const user = sbUser(account.id, account.name, account.email, "email");
    startSession(res, user);
    res.json({ user });
  } catch (err) {
    const e = accountErrorFrom(err);
    if (e.status >= 500) console.error("[equidy] signup failed:", err);
    res.status(e.status).json({ error: e.message });
  }
});

authRouter.post("/signin", express.json(), async (req, res) => {
  try {
    rateLimit(`signin:${req.ip}`);
    const account = await verifyAccount((req.body ?? {}) as { email?: string; password?: string });
    const user = sbUser(account.id, account.name, account.email, "email");
    startSession(res, user);
    res.json({ user });
  } catch (err) {
    const e = accountErrorFrom(err);
    if (e.status >= 500) console.error("[equidy] signin failed:", err);
    res.status(e.status).json({ error: e.message });
  }
});

// Account deletion (required by the App Store and Google Play for apps with sign-up).
authRouter.post("/delete", async (req, res) => {
  const user = readSession(req);
  if (!user) return void res.status(401).json({ error: "Please sign in to continue." });
  try {
    await removeAllItems(user.id).catch((e) => console.error("[equidy] couldn't unlink banks during deletion:", e));
    await deleteUserData(user.id);
    if (user.id.startsWith("sb:")) await deleteAccount(user.id.slice(3));
    setCookie(res, SESSION_COOKIE, "", { maxAge: 0 });
    res.json({ ok: true });
  } catch (err) {
    console.error("[equidy] account deletion failed:", err);
    const status = err instanceof AccountError ? err.status : 500;
    res.status(status).json({ error: err instanceof AccountError ? err.message : "We couldn't delete your account. Please try again." });
  }
});

// ---------------- OAuth through Supabase (PKCE) ----------------

const VERIFIER_COOKIE = "sb_pkce_verifier";

function startSupabaseOAuth(p: ProviderId, res: Response) {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  setCookie(res, VERIFIER_COOKIE, verifier, { maxAge: 600 });
  res.redirect(authorizeUrl(p, SUPABASE_CALLBACK, challenge));
}

authRouter.get("/supabase/callback", async (req, res) => {
  const verifier = parseCookies(req)[VERIFIER_COOKIE];
  setCookie(res, VERIFIER_COOKIE, "", { maxAge: 0 });
  const q = req.query as Record<string, string | undefined>;
  if (q.error) return fail(res, q.error === "access_denied" ? "Sign-in was cancelled." : "The provider declined the sign-in.");
  if (!q.code || !verifier) return fail(res, "Your sign-in session expired. Please try again.");
  try {
    const u = await exchangeCode(q.code, verifier);
    const d = describeUser(u);
    startSession(res, sbUser(u.id, d.name, d.email, d.provider, d.avatar));
    res.redirect(`${APP_URL}/`);
  } catch (err) {
    console.error("[equidy] Supabase sign-in failed:", err);
    fail(res, "We couldn't complete sign-in. Please try again.");
  }
});

// ---------------- direct OAuth (no Supabase) ----------------

authRouter.get("/:provider/start", async (req, res) => {
  const p = req.params.provider as ProviderId;
  if (supabaseAuthEnabled()) {
    if (!(p in directProviders) || !(await getProviders())[p]) return fail(res, "That sign-in method isn't available.");
    return startSupabaseOAuth(p, res);
  }
  const state = generateState();
  const verifier = generateCodeVerifier();
  let url: URL;
  if (p === "google" && google) url = google.createAuthorizationURL(state, verifier, ["openid", "profile", "email"]);
  else if (p === "microsoft" && microsoft) url = microsoft.createAuthorizationURL(state, verifier, ["openid", "profile", "email"]);
  else if (p === "apple" && apple) {
    url = apple.createAuthorizationURL(state, ["name", "email"]);
    url.searchParams.set("response_mode", "form_post"); // required by Apple when requesting name/email
  } else return fail(res, "That sign-in method isn't available.");

  // Apple returns via a cross-site POST, which only carries SameSite=None cookies.
  const sameSite = p === "apple" ? "None" : "Lax";
  setCookie(res, `oauth_${p}_state`, state, { maxAge: 600, sameSite });
  setCookie(res, `oauth_${p}_verifier`, verifier, { maxAge: 600, sameSite });
  res.redirect(url.toString());
});

async function handleCallback(req: Request, res: Response) {
  const p = req.params.provider as ProviderId;
  const params = { ...req.query, ...(req.body ?? {}) } as Record<string, string | undefined>;
  const cookies = parseCookies(req);
  const expectedState = cookies[`oauth_${p}_state`];
  const verifier = cookies[`oauth_${p}_verifier`];
  for (const name of ["state", "verifier"]) setCookie(res, `oauth_${p}_${name}`, "", { maxAge: 0, sameSite: p === "apple" ? "None" : "Lax" });

  if (params.error) return fail(res, params.error === "access_denied" || params.error === "user_cancelled_authorize" ? "Sign-in was cancelled." : "The provider declined the sign-in.");
  if (!params.code || !params.state || params.state !== expectedState) return fail(res, "Your sign-in session expired. Please try again.");

  try {
    let tokens;
    if (p === "google" && google && verifier) tokens = await google.validateAuthorizationCode(params.code, verifier);
    else if (p === "microsoft" && microsoft && verifier) tokens = await microsoft.validateAuthorizationCode(params.code, verifier);
    else if (p === "apple" && apple) tokens = await apple.validateAuthorizationCode(params.code);
    else return fail(res, "That sign-in method isn't available.");

    // The ID token comes straight from the provider's token endpoint over TLS, so its claims can be trusted here.
    const claims = decodeIdToken(tokens.idToken()) as Claims;
    let appleName: string | undefined;
    if (p === "apple" && params.user) {
      try {
        const u = JSON.parse(params.user) as { name?: { firstName?: string; lastName?: string } };
        appleName = [u.name?.firstName, u.name?.lastName].filter(Boolean).join(" ") || undefined;
      } catch { /* Apple only sends the name on first sign-in */ }
    }
    startSession(res, userFrom(p, claims, appleName));
    res.redirect(`${APP_URL}/`);
  } catch (err) {
    console.error(`[equidy] ${p} sign-in failed:`, err instanceof OAuth2RequestError ? `${err.code} ${err.description ?? ""}` : err);
    fail(res, "We couldn't complete sign-in. Please try again.");
  }
}

authRouter.get("/:provider/callback", handleCallback);
authRouter.post("/:provider/callback", handleCallback);
