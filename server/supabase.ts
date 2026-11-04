import { getEnv } from "./env.js";
import { requestJson, UpstreamError } from "./http.js";

// Supabase over its REST APIs (Auth = GoTrue at /auth/v1, database = PostgREST at /rest/v1).
// Auth needs SUPABASE_URL + the anon/publishable key; database access needs the service-role/secret key,
// which stays on the server. Tables are created by supabase/schema.sql with row-level security on and
// no policies, so only this server (service role) can read or write them.

const PROVIDER = "Supabase";

function config() {
  return {
    url: getEnv("SUPABASE_URL")?.replace(/\/+$/, ""),
    anonKey: getEnv("SUPABASE_ANON_KEY") ?? getEnv("SUPABASE_PUBLISHABLE_KEY"),
    serviceKey: getEnv("SUPABASE_SERVICE_ROLE_KEY") ?? getEnv("SUPABASE_SECRET_KEY"),
  };
}

export const supabaseAuthEnabled = () => {
  const c = config();
  return !!(c.url && c.anonKey);
};

export const supabaseDbEnabled = () => {
  const c = config();
  return !!(c.url && c.serviceKey);
};

function headersFor(key: string): Record<string, string> {
  // Legacy anon/service_role keys are JWTs and go in Authorization too; new sb_publishable_/sb_secret_ keys only in apikey.
  return key.startsWith("eyJ") ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key };
}

function authCall<T>(path: string, body?: unknown, key: "anon" | "service" = "anon", method?: "GET" | "POST" | "DELETE") {
  const c = config();
  const k = key === "anon" ? c.anonKey : c.serviceKey;
  if (!c.url || !k) throw new UpstreamError(PROVIDER, "Supabase is not configured.", 503, "not_configured");
  return requestJson<T>(PROVIDER, `${c.url}/auth/v1${path}`, { method, body, headers: headersFor(k) });
}

// ---------------- Auth ----------------

export interface SupabaseUser {
  id: string;
  email?: string;
  user_metadata?: { name?: string; full_name?: string; avatar_url?: string; picture?: string };
  app_metadata?: { provider?: string };
  identities?: unknown[];
}

interface SessionResponse {
  access_token?: string;
  user?: SupabaseUser;
}

export type OAuthProvider = "google" | "microsoft" | "apple";
const SUPABASE_PROVIDER: Record<OAuthProvider, string> = { google: "google", microsoft: "azure", apple: "apple" };

/** Creates a user. `confirmed` is false when Supabase requires email confirmation before sign-in. */
export async function signUp(email: string, password: string, name: string, emailRedirectTo: string): Promise<{ user: SupabaseUser | null; confirmed: boolean }> {
  const res = await authCall<SessionResponse & SupabaseUser>(`/signup?redirect_to=${encodeURIComponent(emailRedirectTo)}`, {
    email,
    password,
    data: { name, full_name: name },
  });
  if (res.access_token && res.user) return { user: res.user, confirmed: true };
  return { user: null, confirmed: false };
}

export async function signInWithPassword(email: string, password: string): Promise<SupabaseUser> {
  const res = await authCall<SessionResponse>("/token?grant_type=password", { email, password });
  if (!res.user) throw new UpstreamError(PROVIDER, "Sign-in did not return a user.");
  return res.user;
}

/** URL that starts an OAuth sign-in through Supabase using PKCE. */
export function authorizeUrl(provider: OAuthProvider, redirectTo: string, codeChallenge: string): string {
  const { url } = config();
  const q = new URLSearchParams({
    provider: SUPABASE_PROVIDER[provider],
    redirect_to: redirectTo,
    code_challenge: codeChallenge,
    code_challenge_method: "s256",
  });
  if (provider === "microsoft") q.set("scopes", "email");
  return `${url}/auth/v1/authorize?${q}`;
}

export async function exchangeCode(authCode: string, codeVerifier: string): Promise<SupabaseUser> {
  const res = await authCall<SessionResponse>("/token?grant_type=pkce", { auth_code: authCode, code_verifier: codeVerifier });
  if (!res.user) throw new UpstreamError(PROVIDER, "Sign-in did not return a user.");
  return res.user;
}

let providerCache: { at: number; value: Record<OAuthProvider, boolean> } | null = null;
const PROVIDER_CACHE_MS = 10 * 60_000;

/** Which OAuth providers are switched on in the Supabase dashboard. */
export async function enabledOAuthProviders(): Promise<Record<OAuthProvider, boolean>> {
  if (providerCache && Date.now() - providerCache.at < PROVIDER_CACHE_MS) return providerCache.value;
  const none = { google: false, microsoft: false, apple: false };
  try {
    const s = await authCall<{ external?: Record<string, boolean> }>("/settings", undefined, "anon", "GET");
    const ext = s.external ?? {};
    const value = { google: !!ext.google, microsoft: !!ext.azure, apple: !!ext.apple };
    providerCache = { at: Date.now(), value };
    return value;
  } catch (err) {
    console.error("[equidy] couldn't read Supabase auth settings:", (err as Error).message);
    return none;
  }
}

export async function deleteAuthUser(id: string): Promise<void> {
  await authCall(`/admin/users/${encodeURIComponent(id)}`, undefined, "service", "DELETE");
}

/** Maps a Supabase user to the fields Equidy keeps in its session. */
export function describeUser(u: SupabaseUser): { name: string; email: string | null; avatar: string | null; provider: OAuthProvider | "email" } {
  const email = u.email ?? null;
  const meta = u.user_metadata ?? {};
  const raw = u.app_metadata?.provider;
  const provider = raw === "google" ? "google" : raw === "azure" ? "microsoft" : raw === "apple" ? "apple" : "email";
  return {
    name: (meta.name || meta.full_name || email?.split("@")[0] || "Equidy user").slice(0, 80),
    email,
    avatar: meta.avatar_url ?? meta.picture ?? null,
    provider,
  };
}

// ---------------- Database (PostgREST) ----------------

function restUrl(table: string, query: Record<string, string>) {
  const { url } = config();
  const q = new URLSearchParams(query);
  return `${url}/rest/v1/${table}${q.size ? `?${q}` : ""}`;
}

function serviceHeaders(extra: Record<string, string> = {}) {
  const { serviceKey } = config();
  if (!serviceKey) throw new UpstreamError(PROVIDER, "Supabase database is not configured.", 503, "not_configured");
  return { ...headersFor(serviceKey), ...extra };
}

/** Equality filters, e.g. { user_id: "abc" } → user_id=eq.abc */
const eq = (filters: Record<string, string>) => Object.fromEntries(Object.entries(filters).map(([k, v]) => [k, `eq.${v}`]));

export async function dbSelect<T>(table: string, filters: Record<string, string>, select = "*"): Promise<T[]> {
  return (await requestJson<T[]>(PROVIDER, restUrl(table, { select, ...eq(filters) }), { headers: serviceHeaders() })) ?? [];
}

export async function dbUpsert(table: string, rows: object | object[], onConflict: string): Promise<void> {
  await requestJson(PROVIDER, restUrl(table, { on_conflict: onConflict }), {
    method: "POST",
    body: rows,
    headers: serviceHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
  });
}

export async function dbDelete(table: string, filters: Record<string, string>): Promise<void> {
  await requestJson(PROVIDER, restUrl(table, eq(filters)), { method: "DELETE", headers: serviceHeaders({ Prefer: "return=minimal" }) });
}
