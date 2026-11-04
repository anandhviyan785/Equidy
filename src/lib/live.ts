import { useEffect } from "react";
import { SECURITIES } from "@/data/securities";
import { setLiveHistory, type Bar } from "@/lib/market";
import { useMarket, usePortfolio } from "@/store";
import { aiStatus, type Services } from "./ai";
import { api } from "./api";

// Live market data and intelligence from the Equidy server (Alpha Vantage, Finnhub).
// Everything here is best-effort: when a provider isn't configured or is rate-limited,
// the app keeps using its simulator for that symbol.

export async function services(): Promise<Services | null> {
  return (await aiStatus()).services ?? null;
}

const REALTIME_REFRESH_MS = 60_000;
const SLOW_REFRESH_MS = 30 * 60_000; // Alpha Vantage free tier: 25 requests a day

type QuoteResponse = { quotes: Record<string, { price: number; prevClose: number; source: "alphavantage" | "finnhub" }> };

async function refreshQuotes(svc: Services) {
  // Without a real-time source, only ask for the symbols the user actually holds or watches.
  const { holdings, watchlist } = usePortfolio.getState();
  const symbols = svc.quotesRealtime ? SECURITIES.map((s) => s.symbol) : [...new Set([...holdings.map((h) => h.symbol), ...watchlist])];
  if (!symbols.length) return;
  try {
    const { quotes } = await api<QuoteResponse>(`/api/market/quotes?symbols=${encodeURIComponent(symbols.join(","))}`);
    useMarket.getState().applyQuotes(quotes);
  } catch {
    /* keep current prices */
  }
}

const historyRequested = new Set<string>();

/** Loads real daily history for a symbol once per page load (cached on the server for hours). */
export async function ensureHistory(symbol: string): Promise<void> {
  if (historyRequested.has(symbol)) return;
  historyRequested.add(symbol);
  const svc = await services();
  if (!svc?.history) return;
  try {
    const { bars } = await api<{ bars: Bar[] | null }>(`/api/market/history/${encodeURIComponent(symbol)}`);
    if (!bars || bars.length < 2) return;
    setLiveHistory(symbol, bars);
    useMarket.getState().applyHistory(symbol, { price: bars[bars.length - 1].close, prevClose: bars[bars.length - 2].close });
  } catch {
    historyRequested.delete(symbol); // try again next time it's needed
  }
}

/** Keeps quotes fresh while the tab is visible and loads history for held symbols and the benchmark. */
export function useLiveMarket() {
  const holdingSymbols = usePortfolio((s) => s.holdings.map((h) => h.symbol).join(","));
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;
    void services().then((svc) => {
      if (cancelled || !svc?.quotes) return;
      void refreshQuotes(svc);
      timer = setInterval(() => document.visibilityState === "visible" && void refreshQuotes(svc), svc.quotesRealtime ? REALTIME_REFRESH_MS : SLOW_REFRESH_MS);
    });
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    for (const s of ["SPY", ...holdingSymbols.split(",").filter(Boolean)]) void ensureHistory(s);
  }, [holdingSymbols]);
}

// ---------------- intelligence (Finnhub) ----------------

export interface NewsItem {
  headline: string;
  source: string;
  url: string;
  datetime: number;
  summary: string;
}

export interface CompanyIntel {
  symbol: string;
  profile: { name: string; industry: string; country: string; exchange: string; ipo: string; marketCapB: number | null; website: string; logo: string } | null;
  metrics: Record<string, number>;
  recommendation: { period: string; strongBuy: number; buy: number; hold: number; sell: number; strongSell: number } | null;
  earnings: { period: string; actual: number | null; estimate: number | null; surprisePercent: number | null }[];
  peers: string[];
  news: NewsItem[];
  asOf: number;
}

const intelCache = new Map<string, Promise<CompanyIntel | null>>();

export function getIntel(symbol: string): Promise<CompanyIntel | null> {
  let p = intelCache.get(symbol);
  if (!p) {
    p = services()
      .then((svc) => (svc?.intel ? api<{ intel: CompanyIntel | null }>(`/api/intel/${encodeURIComponent(symbol)}`).then((r) => r.intel) : null))
      .catch(() => {
        intelCache.delete(symbol);
        return null;
      });
    intelCache.set(symbol, p);
  }
  return p;
}

let newsPromise: Promise<NewsItem[]> | null = null;

export function getMarketNews(): Promise<NewsItem[]> {
  newsPromise ??= services()
    .then((svc) => (svc?.intel ? api<{ news: NewsItem[] }>("/api/intel/news").then((r) => r.news) : []))
    .catch(() => {
      newsPromise = null;
      return [];
    });
  return newsPromise;
}

export const METRIC_LABELS: Record<string, string> = {
  peTTM: "P/E (TTM)",
  pbAnnual: "Price / book",
  epsTTM: "EPS (TTM)",
  revenueGrowthTTMYoy: "Revenue growth (YoY)",
  netProfitMarginTTM: "Net margin",
  roeTTM: "Return on equity",
  dividendYieldIndicatedAnnual: "Dividend yield",
  beta: "Beta",
  "52WeekHigh": "52-week high",
  "52WeekLow": "52-week low",
  "totalDebt/totalEquityAnnual": "Debt / equity",
};

/** Metrics Finnhub reports as percentages. */
export const PERCENT_METRICS = new Set(["revenueGrowthTTMYoy", "netProfitMarginTTM", "roeTTM", "dividendYieldIndicatedAnnual"]);
