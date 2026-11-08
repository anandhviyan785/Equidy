/** Tracks whether this browser has ever used Equidy, so the landing page only greets brand-new visitors. */
const USED_KEY = "equidy.used";
const AUTH_KEY = "equidy.auth";
const CHATS_KEY = "equidy.chats";

type Store = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): Store | null {
  try { return localStorage; } catch { return null; }
}

function readJSON(store: Store, key: string): { state?: { user?: unknown; conversations?: unknown[] } } | null {
  try {
    const raw = store.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** True once someone has signed in here, including people who used Equidy before this flag existed. */
export function hasUsedEquidy(store: Store | null = browserStorage()): boolean {
  if (!store) return false;
  try {
    if (store.getItem(USED_KEY) === "1") return true;
  } catch {
    return false;
  }
  if (readJSON(store, AUTH_KEY)?.state?.user) return true;
  return (readJSON(store, CHATS_KEY)?.state?.conversations?.length ?? 0) > 0;
}

export function markUsedEquidy(store: Store | null = browserStorage()): void {
  try { store?.setItem(USED_KEY, "1"); } catch { /* storage unavailable */ }
}

/** Where a signed-out visitor should land. */
export function signedOutPath(store: Store | null = browserStorage()): "/welcome" | "/login" {
  return hasUsedEquidy(store) ? "/login" : "/welcome";
}
