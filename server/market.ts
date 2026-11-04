import { cached, peek } from "./cache.js";
import { envFlag, envNumber, getEnv } from "./env.js";
import { requestJson, UpstreamError } from "./http.js";

// Market data, designed to run on the providers' free plans. Alpha Vantage provides daily price history
// (and quotes); Finnhub provides real-time US stock quotes.
// Alpha Vantage's free tier allows 25 requests a day and has no batch quotes, so by default:
//   • history  → Alpha Vantage (cached 24h, shared through Supabase)
//   • quotes   → Finnhub when FINNHUB_API_KEY is set, otherwise Alpha Vantage; each falls back to the other,
//                and finally to the last two daily closes already in the history cache.
// With ALPHAVANTAGE_PREMIUM=true, Alpha Vantage is used first for quotes and returns full (20+ year) history.

export type QuoteSource = "alphavantage" | "finnhub";

export interface Quote {
  price: number;
  prevClose: number;
  asOf: number; // epoch ms
  source: QuoteSource;
}

export interface DailyBar {
  t: number; // epoch ms (US market close)
  close: number;
}

export interface History {
  bars: DailyBar[];
  source: "alphavantage";
  full: boolean; // true when the whole available history was returned (premium), false for the latest ~100 days
}

const CRYPTO = new Set(["BTC", "ETH"]);
const SYMBOL_RE = /^[A-Z][A-Z0-9.\-]{0,9}$/;
export const isSymbol = (s: string) => SYMBOL_RE.test(s);

const avKey = () => getEnv("ALPHAVANTAGE_API_KEY") ?? getEnv("ALPHA_VANTAGE_API_KEY");
const fhKey = () => getEnv("FINNHUB_API_KEY");
const avPremium = () => envFlag("ALPHAVANTAGE_PREMIUM");

export const marketStatus = () => ({ history: !!avKey(), quotes: !!(avKey() || fhKey()), realtime: !!fhKey() || (avPremium() && !!avKey()), premium: avPremium() });

const QUOTE_TTL_MS = () => envNumber("QUOTE_CACHE_SECONDS", 60) * 1000;
const AV_QUOTE_TTL_MS = () => envNumber("ALPHAVANTAGE_QUOTE_CACHE_MINUTES", 30) * 60_000;
const HISTORY_TTL_MS = () => envNumber("HISTORY_CACHE_HOURS", 24) * 3_600_000;

// ---------------- Alpha Vantage ----------------

let avBlockedUntil = 0;

function nextUtcMidnight(now = Date.now()) {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}

/** Alpha Vantage reports limits and errors with HTTP 200 and an Information/Note/Error Message field. */
export function avProblem(json: unknown): { limited: boolean; daily: boolean; message: string } | null {
  if (!json || typeof json !== "object") return { limited: false, daily: false, message: "Empty response" };
  const o = json as Record<string, unknown>;
  const message = (o.Information ?? o.Note ?? o["Error Message"]) as string | undefined;
  if (!message) return null;
  const limited = /rate limit|requests per|premium|frequency/i.test(message);
  return { limited, daily: /per day|daily/i.test(message), message };
}

async function av(params: Record<string, string>): Promise<Record<string, unknown> | null> {
  const key = avKey();
  if (!key || Date.now() < avBlockedUntil) return null;
  const q = new URLSearchParams({ ...params, apikey: key });
  const json = await requestJson<Record<string, unknown>>("Alpha Vantage", `https://www.alphavantage.co/query?${q}`);
  const problem = avProblem(json);
  if (problem) {
    if (problem.limited) {
      avBlockedUntil = problem.daily ? nextUtcMidnight() : Date.now() + 60_000;
      console.warn(`[equidy] Alpha Vantage limit reached — pausing until ${new Date(avBlockedUntil).toISOString()}`);
    } else {
      console.warn(`[equidy] Alpha Vantage: ${problem.message.slice(0, 160)}`);
    }
    return null;
  }
  return json;
}

const marketCloseUtc = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d, 21, 0, 0); // 4pm New York ≈ 21:00 UTC
};

export function parseAvGlobalQuote(json: Record<string, unknown> | null): Quote | null {
  const g = json?.["Global Quote"] as Record<string, string> | undefined;
  const price = Number(g?.["05. price"]);
  const prevClose = Number(g?.["08. previous close"]);
  if (!g || !(price > 0) || !(prevClose > 0)) return null;
  const day = g["07. latest trading day"];
  return { price, prevClose, asOf: day ? marketCloseUtc(day) : Date.now(), source: "alphavantage" };
}

/** Parses TIME_SERIES_DAILY or DIGITAL_CURRENCY_DAILY into ascending bars. Crypto keeps weekdays only, to line up with stocks. */
export function parseAvDaily(json: Record<string, unknown> | null, crypto: boolean): DailyBar[] {
  const series = (json?.[crypto ? "Time Series (Digital Currency Daily)" : "Time Series (Daily)"] ?? {}) as Record<string, Record<string, string>>;
  const bars: DailyBar[] = [];
  for (const [date, row] of Object.entries(series)) {
    const close = Number(row["4. close"] ?? row["4a. close (USD)"]);
    if (!(close > 0)) continue;
    const t = marketCloseUtc(date);
    const dow = new Date(t).getUTCDay();
    if (crypto && (dow === 0 || dow === 6)) continue;
    bars.push({ t, close });
  }
  return bars.sort((a, b) => a.t - b.t);
}

async function avHistory(symbol: string): Promise<History | null> {
  const crypto = CRYPTO.has(symbol);
  const json = crypto
    ? await av({ function: "DIGITAL_CURRENCY_DAILY", symbol, market: "USD" })
    : await av({ function: "TIME_SERIES_DAILY", symbol, outputsize: avPremium() ? "full" : "compact" });
  const bars = parseAvDaily(json, crypto);
  return bars.length >= 2 ? { bars, source: "alphavantage", full: avPremium() || crypto } : null;
}

async function avQuote(symbol: string): Promise<Quote | null> {
  if (CRYPTO.has(symbol)) return null; // crypto quotes come from the daily series
  return parseAvGlobalQuote(await av({ function: "GLOBAL_QUOTE", symbol }));
}

// ---------------- Finnhub quotes ----------------


export function parseFinnhubQuote(json: unknown): Quote | null {
  const q = json as { c?: number; pc?: number; t?: number } | null;
  if (!q || !(Number(q.c) > 0) || !(Number(q.pc) > 0)) return null;
  return { price: Number(q.c), prevClose: Number(q.pc), asOf: q.t ? q.t * 1000 : Date.now(), source: "finnhub" };
}

/** Finnhub's free plan has real-time quotes for US stocks and ETFs; crypto comes from Alpha Vantage's daily series. */
async function fhQuote(symbol: string): Promise<Quote | null> {
  const key = fhKey();
  if (!key || CRYPTO.has(symbol)) return null;
  const json = await requestJson("Finnhub", `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}`, {
    headers: { "X-Finnhub-Token": key },
  });
  return parseFinnhubQuote(json);
}

// ---------------- public API ----------------

const quiet = async <T>(p: Promise<T | null>): Promise<T | null> => {
  try {
    return await p;
  } catch (err) {
    if (!(err instanceof UpstreamError) || err.status !== 429) console.warn("[equidy] market data:", (err as Error).message);
    return null;
  }
};

export function getHistory(symbol: string): Promise<History | null> {
  if (!avKey()) return Promise.resolve(null);
  return cached(`hist:${symbol}:${avPremium() ? "full" : "compact"}`, HISTORY_TTL_MS(), () => quiet(avHistory(symbol)), { persist: true });
}

function quoteFromHistory(symbol: string): Quote | null {
  const h = peek<History | null>(`hist:${symbol}:${avPremium() ? "full" : "compact"}`, HISTORY_TTL_MS());
  const bars = h?.bars;
  if (!bars || bars.length < 2) return null;
  const last = bars[bars.length - 1];
  return { price: last.close, prevClose: bars[bars.length - 2].close, asOf: last.t, source: "alphavantage" };
}

const fhCached = (s: string) => cached(`quote:fh:${s}`, QUOTE_TTL_MS(), () => quiet(fhQuote(s)));
const avCached = (s: string) => cached(`quote:av:${s}`, AV_QUOTE_TTL_MS(), () => quiet(avQuote(s)), { persist: true });

/** Alpha Vantage quote, limited by a per-request budget on the free tier (cache hits don't count). */
async function avBudgeted(symbol: string, budget: { left: number }): Promise<Quote | null> {
  const hit = peek<Quote | null>(`quote:av:${symbol}`, AV_QUOTE_TTL_MS());
  if (hit !== undefined) return hit;
  if (!avPremium() && budget.left-- <= 0) return null;
  return avCached(symbol);
}

async function quoteFor(symbol: string, budget: { left: number }): Promise<Quote | null> {
  if (avPremium()) return (await avCached(symbol)) ?? (await fhCached(symbol)) ?? quoteFromHistory(symbol);
  if (fhKey()) return (await fhCached(symbol)) ?? (await avBudgeted(symbol, budget)) ?? quoteFromHistory(symbol);
  return quoteFromHistory(symbol) ?? (await avBudgeted(symbol, budget));
}

/** Latest quotes for up to 60 symbols. Symbols without data are left out (the app keeps simulating those). */
export async function getQuotes(symbols: string[]): Promise<Record<string, Quote>> {
  const list = [...new Set(symbols.map((s) => s.toUpperCase()).filter(isSymbol))].slice(0, 60);
  const budget = { left: fhKey() ? 2 : 4 }; // protects the 25-a-day Alpha Vantage quota
  const out: Record<string, Quote> = {};
  const CONCURRENCY = 8;
  for (let i = 0; i < list.length; i += CONCURRENCY) {
    const batch = list.slice(i, i + CONCURRENCY);
    const quotes = await Promise.all(batch.map((s) => quoteFor(s, budget)));
    batch.forEach((s, j) => {
      const q = quotes[j];
      if (q) out[s] = q;
    });
  }
  return out;
}

/** For tests. */
export function resetMarketState() {
  avBlockedUntil = 0;
}
