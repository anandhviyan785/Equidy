import { useAuth, useChats, usePortfolio, useSettings, type AuthUser, type ProviderId } from "@/store";
import { shouldAdoptLocalData } from "./adopt";

export type Providers = Record<ProviderId, boolean>;

export interface AuthInfo {
  online: boolean; // auth server reachable
  accounts: boolean; // email + password accounts available
  passwordReset: boolean; // forgot-password emails available
  clerk: boolean; // Clerk sign-in available on the server
  providers: Providers;
}

const NONE: Providers = { google: false, microsoft: false, apple: false };
let infoPromise: Promise<AuthInfo> | null = null;

/** Checks the server session once per page load and syncs it into the store. */
export function loadAuth(): Promise<AuthInfo> {
  infoPromise ??= fetch("/api/auth/session", { credentials: "same-origin", signal: AbortSignal.timeout(5000) })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((j: { user: AuthUser | null; providers: Providers; accounts?: boolean; passwordReset?: boolean; clerk?: boolean }) => {
      // When the server is reachable, only a real server session counts.
      if (j.user) signIn(j.user);
      else useAuth.getState().setUser(null);
      return { online: true, accounts: !!j.accounts, passwordReset: !!j.passwordReset, clerk: !!j.clerk, providers: j.providers };
    })
    .catch((e: unknown) => {
      console.warn("[equidy] auth session check failed:", e instanceof Error ? e.message : e);
      return { online: false, accounts: false, passwordReset: false, clerk: false, providers: NONE };
    })
    .finally(() => useAuth.getState().setChecked(true));
  return infoPromise;
}

function signIn(user: AuthUser) {
  // Each account keeps its own portfolio and chats on this browser.
  const prevOwner = usePortfolio.getState().owner;
  if (shouldAdoptLocalData(prevOwner, user, useSettings.getState().profile.email)) {
    usePortfolio.setState({ owner: user.id });
  } else {
    if (prevOwner && prevOwner !== user.id) useChats.getState().clearAll();
    usePortfolio.getState().claim(user.id);
  }
  useAuth.getState().setUser(user);
  const s = useSettings.getState();
  s.set({ profile: { ...s.profile, name: user.name, email: user.email ?? s.profile.email } });
}

async function postJson(path: string, body: object, fallbackError: string): Promise<{ user?: AuthUser }> {
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
  const j = ((await res.json().catch(() => null)) ?? {}) as { user?: AuthUser; error?: string };
  if (!res.ok) throw new Error(j.error || fallbackError);
  return j;
}

async function post(path: string, body: object): Promise<AuthUser> {
  const j = await postJson(path, body, "Sign-in failed. Please try again.");
  if (!j.user) throw new Error("Sign-in failed. Please try again.");
  return j.user;
}

/** Asks the server to email a reset link. Succeeds the same way whether or not the email has an account. */
export async function requestPasswordReset(email: string) {
  await postJson("/api/auth/forgot", { email }, "We couldn't send a reset link. Please try again.");
}

/** Sets a new password from an emailed reset link, then signs in. */
export async function resetPassword(token: string, password: string) {
  signIn(await post("/api/auth/reset", { token, password }));
}

export async function signUpWithEmail(name: string, email: string, password: string) {
  signIn(await post("/api/auth/signup", { name, email, password }));
}

export async function signInWithEmail(email: string, password: string) {
  signIn(await post("/api/auth/signin", { email, password }));
}

export async function signInWithClerk(token: string) {
  signIn(await post("/api/auth/clerk", { token }));
}

/** A Clerk session outlives Equidy's cookie, so the login page ends it too. */
function endClerkSession(wasClerk: boolean) {
  if (wasClerk) window.location.assign("/login?signout=1");
}

/** Starts the real OAuth redirect. */
export function startOAuth(p: ProviderId) {
  window.location.href = `/api/auth/${p}/start`;
}

const PROVIDER_LABEL: Record<ProviderId | "email" | "clerk", string> = { google: "Google", microsoft: "Microsoft", apple: "Apple", email: "email", clerk: "your account" };
export const providerLabel = (p: ProviderId | "email" | "clerk") => PROVIDER_LABEL[p];

/** Local demo account, only offered when no Equidy server is reachable (e.g. the static preview). */
export function demoSignIn() {
  signIn({ id: "demo", provider: "email", name: "Demo Investor", email: "demo@equidy.app", avatar: null, demo: true });
}

/** Signs out; resolves false (and tells the user) when the server could not end the session. */
export async function signOut(): Promise<boolean> {
  const wasClerk = useAuth.getState().user?.provider === "clerk";
  const res = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch((e: unknown) => {
    console.warn("[equidy] logout request failed:", e);
    return null;
  });
  // The session cookie is HttpOnly, so a failed logout (HTTP error or unreachable network) would
  // leave the server session alive and the next page load would sign the user straight back in.
  // Only a missing server (the static preview, 404) or a demo user can sign out locally.
  const demo = useAuth.getState().user?.demo === true;
  if (!demo && (!res || (!res.ok && res.status !== 404))) {
    window.alert("We couldn't sign you out. Please check your connection and try again.");
    return false;
  }
  useAuth.getState().setUser(null);
  endClerkSession(wasClerk);
  return true;
}

/** Permanently deletes the account and clears this browser's Equidy data. */
export async function deleteAccount() {
  const current = useAuth.getState().user;
  const wasClerk = current?.provider === "clerk";
  const res = await fetch("/api/auth/delete", { method: "POST", credentials: "same-origin" }).catch(() => null);
  if (!res) throw new Error("We couldn't reach the server, so your account was not deleted. Check your connection and try again.");
  // A 401 only means "nothing to delete" for the local demo user. For a real
  // account it can mean the session was already revoked by a half-finished
  // delete, so surface it instead of reporting a false success.
  if (res.status === 401 && !current?.demo) {
    // The session is dead either way, so don't leave the UI looking signed in while every request fails.
    useAuth.getState().setUser(null);
    endClerkSession(wasClerk);
    throw new Error("Your session has expired, so we couldn't confirm your account was deleted. Please sign in again and retry.");
  }
  if (!res.ok && res.status !== 401) {
    const j = ((await res.json().catch(() => null)) ?? {}) as { error?: string };
    throw new Error(j.error || "We couldn't delete your account. Please try again.");
  }
  usePortfolio.setState({ holdings: [], owner: null });
  useChats.getState().clearAll();
  useAuth.getState().setUser(null);
  endClerkSession(wasClerk);
}
