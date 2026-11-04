import { create } from "zustand";
import { api } from "./api";

// Bank connections through Plaid. The browser only ever sees Plaid Link's short-lived tokens;
// access tokens stay on the server. Balances and transactions are kept in memory, never in localStorage.

export interface BankAccount {
  id: string;
  name: string;
  mask: string | null;
  type: string;
  subtype: string | null;
  current: number | null;
  available: number | null;
  currency: string;
}

export interface Institution {
  itemId: string;
  institution: string;
  accounts: BankAccount[];
  error: string | null;
}

export interface Transaction {
  id: string;
  accountId: string;
  date: string;
  name: string;
  amount: number; // positive = money out
  currency: string;
  category: string;
  pending: boolean;
}

export interface BrokerageHolding {
  ticker: string | null;
  name: string;
  quantity: number;
  costBasis: number | null;
  price: number | null;
  value: number | null;
  type: string;
  currency: string;
}

interface BankingState {
  loaded: boolean;
  loading: boolean;
  error: string | null;
  institutions: Institution[];
  transactions: Transaction[];
  holdings: BrokerageHolding[];
  set: (p: Partial<Omit<BankingState, "set">>) => void;
}

export const useBanking = create<BankingState>()((set) => ({
  loaded: false,
  loading: false,
  error: null,
  institutions: [],
  transactions: [],
  holdings: [],
  set: (p) => set(p),
}));

export async function loadBanking(): Promise<void> {
  const s = useBanking.getState();
  s.set({ loading: true, error: null });
  try {
    const [{ institutions }, { transactions }, { holdings }] = await Promise.all([
      api<{ institutions: Institution[] }>("/api/plaid/accounts"),
      api<{ transactions: Transaction[] }>("/api/plaid/transactions?days=30"),
      api<{ holdings: BrokerageHolding[] }>("/api/plaid/holdings"),
    ]);
    s.set({ institutions, transactions, holdings, loaded: true, loading: false });
  } catch (err) {
    s.set({ loading: false, loaded: true, error: (err as Error).message });
  }
}

export function clearBanking() {
  useBanking.getState().set({ loaded: false, institutions: [], transactions: [], holdings: [], error: null });
}

// ---------------- Plaid Link ----------------

interface PlaidHandler {
  open: () => void;
  exit: (opts?: { force?: boolean }) => void;
  destroy: () => void;
}

interface PlaidGlobal {
  create: (config: {
    token: string;
    receivedRedirectUri?: string;
    onSuccess: (publicToken: string, metadata: { institution?: { name?: string } | null }) => void;
    onExit?: (err: { display_message?: string | null; error_message?: string } | null) => void;
  }) => PlaidHandler;
}

const LINK_SCRIPT = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
const TOKEN_KEY = "equidy.plaid.linkToken";
let scriptPromise: Promise<PlaidGlobal> | null = null;

function loadLink(): Promise<PlaidGlobal> {
  const w = window as unknown as { Plaid?: PlaidGlobal };
  if (w.Plaid) return Promise.resolve(w.Plaid);
  scriptPromise ??= new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = LINK_SCRIPT;
    el.async = true;
    el.onload = () => (w.Plaid ? resolve(w.Plaid) : reject(new Error("Plaid didn't load.")));
    el.onerror = () => {
      scriptPromise = null;
      reject(new Error("Couldn't load Plaid. Check your connection and try again."));
    };
    document.head.appendChild(el);
  });
  return scriptPromise;
}

function openLink(token: string, receivedRedirectUri?: string): Promise<boolean> {
  return loadLink().then(
    (Plaid) =>
      new Promise<boolean>((resolve, reject) => {
        const handler = Plaid.create({
          token,
          receivedRedirectUri,
          onSuccess: (publicToken, metadata) => {
            sessionStorage.removeItem(TOKEN_KEY);
            api("/api/plaid/exchange", { body: { publicToken, institution: metadata.institution?.name ?? null } })
              .then(() => resolve(true), reject)
              .finally(() => handler.destroy());
          },
          onExit: (err) => {
            handler.destroy();
            if (err) reject(new Error(err.display_message || "The bank connection was interrupted. Please try again."));
            else resolve(false);
          },
        });
        handler.open();
      }),
  );
}

/** Opens Plaid Link. Resolves true when a bank was connected, false if the user closed it. */
export async function connectBank(): Promise<boolean> {
  const { linkToken } = await api<{ linkToken: string }>("/api/plaid/link-token", { method: "POST", body: {} });
  try { sessionStorage.setItem(TOKEN_KEY, linkToken); } catch { /* storage unavailable */ }
  return openLink(linkToken);
}

/** Banks that sign in through their own site send the user back with ?oauth_state_id=…; finish the flow. */
export async function resumeOAuthLink(): Promise<boolean> {
  if (!new URLSearchParams(window.location.search).has("oauth_state_id")) return false;
  let token: string | null = null;
  try { token = sessionStorage.getItem(TOKEN_KEY); } catch { /* storage unavailable */ }
  if (!token) return false;
  return openLink(token, window.location.href);
}

export async function disconnectBank(itemId: string): Promise<void> {
  await api(`/api/plaid/items/${encodeURIComponent(itemId)}`, { method: "DELETE" });
}

/** Short plain-text summary for the AI's context (balances and 30-day cash flow, no account numbers). */
export function bankingContext(): string {
  const { institutions, transactions } = useBanking.getState();
  const accounts = institutions.flatMap((i) => i.accounts.map((a) => ({ ...a, institution: i.institution })));
  if (!accounts.length) return "";
  const lines = ["\nLINKED BANK ACCOUNTS (via Plaid)"];
  for (const a of accounts) {
    const bal = a.current === null ? "n/a" : `${a.current.toFixed(2)} ${a.currency}`;
    lines.push(`${a.institution} · ${a.name} (${a.subtype ?? a.type}) · balance ${bal}${a.available !== null && a.available !== a.current ? ` · available ${a.available.toFixed(2)}` : ""}`);
  }
  const posted = transactions.filter((t) => !t.pending);
  if (posted.length) {
    const out = posted.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const inn = posted.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0);
    const byCat = new Map<string, number>();
    for (const t of posted) if (t.amount > 0) byCat.set(t.category, (byCat.get(t.category) ?? 0) + t.amount);
    const top = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([c, v]) => `${c} ${v.toFixed(0)}`);
    lines.push(`Last 30 days: money in ${inn.toFixed(2)}, money out ${out.toFixed(2)}. Top spending: ${top.join(", ")}`);
  }
  return lines.join("\n");
}
