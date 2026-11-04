import { useEffect } from "react";
import { useChats, usePortfolio, useSettings, type AuthUser, type Conversation } from "@/store";
import type { Holding } from "@/lib/finance";
import { api } from "./api";
import { services } from "./live";

// Cloud sync through the Equidy server (Postgres): the signed-in user's portfolio, watchlist, conversations and settings
// are saved on the server and restored on any device. Last writer wins, compared by modification time.

const PUSH_DEBOUNCE_MS = 2500;
const PUSH_MAX_WAIT_MS = 15_000;

interface SyncedSettings {
  theme: string;
  currency: string;
  riskFree: number;
  liveTicks: boolean;
  responseStyle: string;
  riskProfile: string;
  profile: { name: string; email: string };
}

interface UserData {
  portfolio: { holdings: Holding[]; watchlist: string[] };
  chats: Conversation[];
  settings: Partial<SyncedSettings>;
  updatedAt: number;
}

const modifiedKey = (uid: string) => `equidy.sync.modified.${uid}`;
const readModified = (uid: string) => {
  try { return Number(localStorage.getItem(modifiedKey(uid))) || 0; } catch { return 0; }
};
const writeModified = (uid: string, t: number) => {
  try { localStorage.setItem(modifiedKey(uid), String(t)); } catch { /* storage unavailable */ }
};

function collect(updatedAt: number): UserData {
  const { holdings, watchlist } = usePortfolio.getState();
  const s = useSettings.getState();
  return {
    portfolio: { holdings, watchlist },
    chats: useChats.getState().conversations,
    settings: { theme: s.theme, currency: s.currency, riskFree: s.riskFree, liveTicks: s.liveTicks, responseStyle: s.responseStyle, riskProfile: s.riskProfile, profile: s.profile },
    updatedAt,
  };
}

let applying = false;

function apply(d: UserData) {
  applying = true;
  try {
    if (d.portfolio) usePortfolio.setState({ holdings: d.portfolio.holdings ?? [], watchlist: d.portfolio.watchlist ?? [] });
    if (Array.isArray(d.chats)) useChats.setState({ conversations: d.chats });
    if (d.settings && typeof d.settings === "object") {
      const cur = useSettings.getState();
      useSettings.getState().set({ ...(d.settings as Partial<typeof cur>), profile: { ...cur.profile, ...(d.settings.profile ?? {}) } });
    }
  } finally {
    applying = false;
  }
}

export type SyncState = "off" | "syncing" | "synced" | "error";
let state: SyncState = "off";
const listeners = new Set<(s: SyncState) => void>();
const setState = (s: SyncState) => {
  state = s;
  listeners.forEach((l) => l(s));
};
export const syncState = () => state;
export function onSyncState(fn: (s: SyncState) => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

/** Starts syncing for a signed-in user; returns a function that stops it. */
async function start(user: AuthUser, isCancelled: () => boolean): Promise<() => void> {
  const noop = () => {};
  const svc = await services();
  if (!svc?.sync || user.demo || isCancelled()) return noop;
  setState("syncing");

  let remote: UserData | null = null;
  try {
    remote = (await api<{ data: UserData | null }>("/api/data")).data;
  } catch {
    setState("error");
    return noop;
  }
  if (isCancelled()) return noop;

  const localModified = readModified(user.id);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let firstPending = 0;

  const push = async () => {
    timer = undefined;
    firstPending = 0;
    setState("syncing");
    try {
      await api("/api/data", { method: "PUT", body: collect(readModified(user.id) || Date.now()) });
      setState("synced");
    } catch {
      setState("error");
    }
  };

  if (remote && remote.updatedAt >= localModified) {
    apply(remote);
    writeModified(user.id, remote.updatedAt);
    setState("synced");
  } else {
    if (!localModified) writeModified(user.id, Date.now());
    await push();
  }

  const onChange = () => {
    if (applying) return;
    const now = Date.now();
    writeModified(user.id, now);
    firstPending ||= now;
    if (timer) clearTimeout(timer);
    const wait = Math.max(0, Math.min(PUSH_DEBOUNCE_MS, firstPending + PUSH_MAX_WAIT_MS - now));
    timer = setTimeout(() => void push(), wait);
  };
  const unsubs = [
    usePortfolio.subscribe((s, prev) => (s.holdings !== prev.holdings || s.watchlist !== prev.watchlist) && onChange()),
    useChats.subscribe((s, prev) => s.conversations !== prev.conversations && onChange()),
    useSettings.subscribe(onChange),
  ];
  const flush = () => {
    if (timer) {
      clearTimeout(timer);
      void push();
    }
  };
  window.addEventListener("pagehide", flush);
  return () => {
    unsubs.forEach((u) => u());
    window.removeEventListener("pagehide", flush);
    flush();
    setState("off");
  };
}

/** Syncs the signed-in user's data with the server for as long as the component is mounted. */
export function useCloudSync(user: AuthUser | null) {
  const uid = user && !user.demo ? user.id : null;
  useEffect(() => {
    if (!uid || !user) return;
    let cancelled = false;
    let stop: (() => void) | null = null;
    void start(user, () => cancelled).then((s) => {
      if (cancelled) s();
      else stop = s;
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps
}
