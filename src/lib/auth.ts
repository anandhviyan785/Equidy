import { useAuth, useChats, usePortfolio, useSettings, type AuthUser, type ProviderId } from "@/store";

export type Providers = Record<ProviderId, boolean>;

export interface AuthInfo {
  online: boolean; // auth server reachable
  accounts: boolean; // email + password accounts available
  providers: Providers;
}

const NONE: Providers = { google: false, microsoft: false, apple: false };
let infoPromise: Promise<AuthInfo> | null = null;

/** Checks the server session once per page load and syncs it into the store. */
export function loadAuth(): Promise<AuthInfo> {
  infoPromise ??= fetch("/api/auth/session", { credentials: "same-origin", signal: AbortSignal.timeout(5000) })
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((j: { user: AuthUser | null; providers: Providers; accounts?: boolean }) => {
      // When the server is reachable, only a real server session counts.
      if (j.user) signIn(j.user);
      else useAuth.getState().setUser(null);
      return { online: true, accounts: !!j.accounts, providers: j.providers };
    })
    .catch(() => ({ online: false, accounts: false, providers: NONE }))
    .finally(() => useAuth.getState().setChecked(true));
  return infoPromise;
}

function signIn(user: AuthUser) {
  // Each account keeps its own portfolio and chats on this browser.
  const prevOwner = usePortfolio.getState().owner;
  if (prevOwner && prevOwner !== user.id) useChats.getState().clearAll();
  usePortfolio.getState().claim(user.id);
  useAuth.getState().setUser(user);
  const s = useSettings.getState();
  s.set({ profile: { ...s.profile, name: user.name, email: user.email ?? s.profile.email } });
}

async function post(path: string, body: object): Promise<AuthUser> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Couldn't reach Equidy. Check your connection and try again.");
  }
  const j = (await res.json().catch(() => ({}))) as { user?: AuthUser; error?: string };
  if (!res.ok || !j.user) throw new Error(j.error || "Sign-in failed. Please try again.");
  return j.user;
}

export async function signUpWithEmail(name: string, email: string, password: string) {
  signIn(await post("/api/auth/signup", { name, email, password }));
}

export async function signInWithEmail(email: string, password: string) {
  signIn(await post("/api/auth/signin", { email, password }));
}

/** Starts the real OAuth redirect. */
export function startOAuth(p: ProviderId) {
  window.location.href = `/api/auth/${p}/start`;
}

const PROVIDER_LABEL: Record<ProviderId | "email", string> = { google: "Google", microsoft: "Microsoft", apple: "Apple", email: "email" };
export const providerLabel = (p: ProviderId | "email") => PROVIDER_LABEL[p];

/** Local demo account, only offered when no Equidy server is reachable (e.g. the static preview). */
export function demoSignIn() {
  signIn({ id: "demo", provider: "email", name: "Demo Investor", email: "demo@equidy.app", avatar: null, demo: true });
}

export async function signOut() {
  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
  } catch { /* server unreachable: local sign-out still applies */ }
  useAuth.getState().setUser(null);
}
