import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import { INDICES, SECURITIES } from "@/data/securities";
import { history } from "@/lib/market";
import type { Holding, PriceMap } from "@/lib/finance";
import { uid } from "@/lib/format";

// localStorage can be unavailable (private mode, sandboxed previews) — degrade to memory.
const memory = new Map<string, string>();
const safeStorage: StateStorage = {
  getItem: (k) => { try { return localStorage.getItem(k); } catch { return memory.get(k) ?? null; } },
  setItem: (k, v) => { try { localStorage.setItem(k, v); } catch { memory.set(k, v); } },
  removeItem: (k) => { try { localStorage.removeItem(k); } catch { memory.delete(k); } },
};
const storage = createJSONStorage(() => safeStorage);

// ---------------- Settings ----------------

export type Theme = "dark" | "light" | "system";

interface SettingsState {
  theme: Theme;
  currency: string;
  riskFree: number;
  liveTicks: boolean;
  responseStyle: "concise" | "balanced" | "detailed";
  riskProfile: "conservative" | "moderate" | "aggressive";
  profile: { name: string; email: string; plan: string };
  set: (p: Partial<Omit<SettingsState, "set">>) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "dark",
      currency: "USD",
      riskFree: 0.04,
      liveTicks: true,
      responseStyle: "balanced",
      riskProfile: "moderate",
      profile: { name: "Alex Morgan", email: "alex@equidy.ai", plan: "Pro" },
      set: (p) => set(p),
    }),
    { name: "equidy.settings", storage },
  ),
);

// ---------------- Portfolio & watchlist ----------------

interface PortfolioState {
  owner: string | null; // account the saved data belongs to
  holdings: Holding[];
  watchlist: string[];
  addHolding: (h: Omit<Holding, "id" | "addedAt">) => void;
  updateHolding: (id: string, p: Partial<Holding>) => void;
  removeHolding: (id: string) => void;
  toggleWatch: (symbol: string) => void;
  reset: () => void;
  claim: (owner: string) => void;
}

const DEFAULT_HOLDINGS: Holding[] = [];

const DEFAULT_WATCH = ["TSLA", "AMZN", "META", "V", "XOM", "BTC"];

export const usePortfolio = create<PortfolioState>()(
  persist(
    (set) => ({
      owner: null,
      holdings: DEFAULT_HOLDINGS,
      watchlist: DEFAULT_WATCH,
      addHolding: (h) =>
        set((s) => {
          const existing = s.holdings.find((x) => x.symbol === h.symbol);
          if (existing) {
            const shares = existing.shares + h.shares;
            const costBasis = (existing.shares * existing.costBasis + h.shares * h.costBasis) / shares;
            return { holdings: s.holdings.map((x) => (x.id === existing.id ? { ...x, shares, costBasis } : x)) };
          }
          return { holdings: [...s.holdings, { ...h, id: uid(), addedAt: Date.now() }] };
        }),
      updateHolding: (id, p) => set((s) => ({ holdings: s.holdings.map((h) => (h.id === id ? { ...h, ...p } : h)) })),
      removeHolding: (id) => set((s) => ({ holdings: s.holdings.filter((h) => h.id !== id) })),
      toggleWatch: (symbol) =>
        set((s) => ({ watchlist: s.watchlist.includes(symbol) ? s.watchlist.filter((x) => x !== symbol) : [...s.watchlist, symbol] })),
      reset: () => set({ holdings: DEFAULT_HOLDINGS, watchlist: DEFAULT_WATCH }),
      // A different account signing in on this browser starts with its own empty portfolio.
      claim: (owner) => set((s) => (s.owner === owner ? s : { owner, holdings: DEFAULT_HOLDINGS, watchlist: DEFAULT_WATCH })),
    }),
    {
      name: "equidy.portfolio",
      storage,
      // v2: all portfolios reset to empty (previous versions seeded sample holdings).
      version: 2,
      migrate: (old) => ({ ...(old as PortfolioState), holdings: [], owner: null }),
    },
  ),
);

// ---------------- Conversations ----------------

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  error?: boolean;
  source?: "claude" | "offline";
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
}

interface ChatState {
  conversations: Conversation[];
  create: (title?: string) => string;
  rename: (id: string, title: string) => void;
  remove: (id: string) => void;
  togglePin: (id: string) => void;
  append: (id: string, m: ChatMessage) => void;
  patchMessage: (id: string, mid: string, p: Partial<ChatMessage>) => void;
  truncateAfter: (id: string, mid: string) => void;
  clearAll: () => void;
}

export const useChats = create<ChatState>()(
  persist(
    (set) => ({
      conversations: [],
      create: (title = "New conversation") => {
        const id = uid();
        const now = Date.now();
        set((s) => ({ conversations: [{ id, title, messages: [], createdAt: now, updatedAt: now }, ...s.conversations] }));
        return id;
      },
      rename: (id, title) => set((s) => ({ conversations: s.conversations.map((c) => (c.id === id ? { ...c, title } : c)) })),
      remove: (id) => set((s) => ({ conversations: s.conversations.filter((c) => c.id !== id) })),
      togglePin: (id) => set((s) => ({ conversations: s.conversations.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)) })),
      append: (id, m) =>
        set((s) => ({
          conversations: s.conversations.map((c) => (c.id === id ? { ...c, messages: [...c.messages, m], updatedAt: Date.now() } : c)),
        })),
      patchMessage: (id, mid, p) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, messages: c.messages.map((m) => (m.id === mid ? { ...m, ...p } : m)) } : c,
          ),
        })),
      truncateAfter: (id, mid) =>
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== id) return c;
            const i = c.messages.findIndex((m) => m.id === mid);
            return i < 0 ? c : { ...c, messages: c.messages.slice(0, i) };
          }),
        })),
      clearAll: () => set({ conversations: [] }),
    }),
    { name: "equidy.chats", storage },
  ),
);

// ---------------- Live market (not persisted) ----------------

interface MarketState {
  prices: PriceMap;
  updatedAt: number;
  tick: () => void;
}

function initialPrices(): PriceMap {
  const out: PriceMap = {};
  for (const s of SECURITIES) {
    const h = history(s.symbol, s.price, s.vol, s.drift, s.beta);
    out[s.symbol] = { price: h[h.length - 1].close, prevClose: h[h.length - 2].close };
  }
  for (const i of INDICES) {
    const h = history(i.symbol, i.price, i.vol, i.drift, 1);
    out[i.symbol] = { price: h[h.length - 1].close, prevClose: h[h.length - 2].close };
  }
  return out;
}

const VOL: Record<string, number> = Object.fromEntries([...SECURITIES, ...INDICES].map((s) => [s.symbol, s.vol]));

export const useMarket = create<MarketState>()((set) => ({
  prices: initialPrices(),
  updatedAt: Date.now(),
  tick: () =>
    set((s) => {
      const common = (Math.random() - 0.5) * 0.0006;
      const prices: PriceMap = {};
      for (const [sym, p] of Object.entries(s.prices)) {
        const sigma = (VOL[sym] ?? 0.2) / Math.sqrt(252 * 390);
        const move = common + sigma * (Math.random() - 0.5) * 3.4;
        prices[sym] = { ...p, price: p.price * (1 + move) };
      }
      return { prices, updatedAt: Date.now() };
    }),
}));

// ---------------- Auth ----------------

export type ProviderId = "google" | "microsoft" | "apple";

export interface AuthUser {
  id: string;
  provider: ProviderId | "email";
  name: string;
  email: string | null;
  avatar: string | null;
  demo?: boolean; // local-only account used when the server has no sign-in providers configured
}

interface AuthState {
  user: AuthUser | null;
  checked: boolean; // server session has been checked this page load
  setUser: (u: AuthUser | null) => void;
  setChecked: (v: boolean) => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      checked: false,
      setUser: (user) => set({ user }),
      setChecked: (checked) => set({ checked }),
    }),
    { name: "equidy.auth", storage, partialize: (s) => ({ user: s.user }) },
  ),
);
