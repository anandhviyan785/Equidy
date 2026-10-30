import { useAuth, useSettings, type AuthUser, type ProviderId } from "@/store";

export type Providers = Record<ProviderId, boolean>;

export interface AuthInfo {
  online: boolean; // auth server reachable
  providers: Providers;
}

const NONE: Providers = { google: false, microsoft: false, apple: false };
let infoPromise: Promise<AuthInfo> | null = null;

/** Checks the server session once per page load and syncs it into the store. */
export function loadAuth(): Promise<AuthInfo> {
  infoPromise ??= fetch("/api/auth/session", { credentials: "same-origin", signal: AbortSignal.timeout(3000) })
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((j: { user: AuthUser | null; providers: Providers }) => {
      const anyProvider = Object.values(j.providers).some(Boolean);
      const local = useAuth.getState().user;
      if (j.user) signIn(j.user);
      // With real providers configured, only a server session counts.
      else if (anyProvider || !local?.demo) useAuth.getState().setUser(null);
      return { online: true, providers: j.providers };
    })
    .catch(() => ({ online: false, providers: NONE }))
    .finally(() => useAuth.getState().setChecked(true));
  return infoPromise;
}

function signIn(user: AuthUser) {
  useAuth.getState().setUser(user);
  const s = useSettings.getState();
  s.set({ profile: { ...s.profile, name: user.name, email: user.email ?? s.profile.email } });
}

/** Starts the real OAuth redirect. */
export function startOAuth(p: ProviderId) {
  window.location.href = `/api/auth/${p}/start`;
}

const PROVIDER_LABEL: Record<ProviderId, string> = { google: "Google", microsoft: "Microsoft", apple: "Apple" };
export const providerLabel = (p: ProviderId) => PROVIDER_LABEL[p];

/** Local demo account, used only when the server has no providers configured. */
export function demoSignIn(p: ProviderId) {
  signIn({ id: `demo:${p}`, provider: p, name: "Demo Investor", email: "demo@equidy.app", avatar: null, demo: true });
}

export async function signOut() {
  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
  } catch { /* server unreachable: local sign-out still applies */ }
  useAuth.getState().setUser(null);
}
