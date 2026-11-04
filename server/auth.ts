import express, { type Request, type Response, type NextFunction } from "express";
import crypto from "node:crypto";
import { Apple, Google, MicrosoftEntraId, OAuth2RequestError, decodeIdToken, generateCodeVerifier, generateState } from "arctic";
import { AccountError, accountsEnabled, createAccount, deleteAccount, rateLimit, verifyAccount } from "./accounts.js";
import { appUrl, getEnv } from "./env.js";
import { deleteUserData } from "./userdata.js";
import { removeAllItems } from "./plaid.js";

// Sign-in: email + password accounts (stored in Postgres, see accounts.ts) and OAuth with
// Google, Microsoft (Entra ID) and Apple. Each OAuth provider is enabled when its credentials are set.

export type ProviderId = "google" | "microsoft" | "apple";

export interface SessionUser {
  id: string; // "email:<id>" or "<provider>:<subject>"
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

function pemToPkcs8(pem: string): Uint8Array {
  const b64 = pem.replace(/\\n/g, "\n").replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  return new Uint8Array(Buffer.from(b64, "base64"));
}

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
  return directProviders;
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

function accountRoute(action: "signup" | "signin") {
  return async (req: Request, res: Response) => {
    try {
      rateLimit(`${action}:${req.ip}`);
      const body = (req.body ?? {}) as { name?: string; email?: string; password?: string };
      const acct = action === "signup" ? await createAccount(body) : await verifyAccount(body);
      const user: SessionUser = { id: `email:${acct.id}`, provider: "email", name: acct.name, email: acct.email, avatar: null };
      startSession(res, user);
      res.json({ user });
    } catch (err) {
      if (err instanceof AccountError) return void res.status(err.status).json({ error: err.message });
      console.error(`[equidy] ${action} failed:`, err);
      res.status(500).json({ error: "Something went wrong on our side. Please try again." });
    }
  };
}

authRouter.post("/signup", express.json(), accountRoute("signup"));
authRouter.post("/signin", express.json(), accountRoute("signin"));

// Account deletion (required by the App Store and Google Play for apps with sign-up).
authRouter.post("/delete", async (req, res) => {
  const user = readSession(req);
  if (!user) return void res.status(401).json({ error: "Please sign in to continue." });
  try {
    await removeAllItems(user.id).catch((e) => console.error("[equidy] couldn't unlink banks during deletion:", e));
    await deleteUserData(user.id);
    if (user.provider === "email") await deleteAccount(user.id.replace(/^email:/, ""));
    setCookie(res, SESSION_COOKIE, "", { maxAge: 0 });
    res.json({ ok: true });
  } catch (err) {
    console.error("[equidy] account deletion failed:", err);
    const status = err instanceof AccountError ? err.status : 500;
    res.status(status).json({ error: err instanceof AccountError ? err.message : "We couldn't delete your account. Please try again." });
  }
});

// ---------------- OAuth ----------------

authRouter.get("/:provider/start", (req, res) => {
  const p = req.params.provider as ProviderId;
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
