import { cached } from "./cache.js";
import { getEnv } from "./env.js";
import { requestJson } from "./http.js";

// Financial intelligence from Finnhub: company profile, key metrics, analyst recommendations,
// earnings surprises, peers and news. Used by the symbol page and fed to the AI as context.

const key = () => getEnv("FINNHUB_API_KEY");
export const intelEnabled = () => !!key();

const INTEL_TTL_MS = 3 * 3_600_000;
const NEWS_TTL_MS = 30 * 60_000;
const CRYPTO = new Set(["BTC", "ETH"]);

async function fh<T>(path: string, params: Record<string, string>): Promise<T | null> {
  const k = key();
  if (!k) return null;
  try {
    return await requestJson<T>("Finnhub", `https://finnhub.io/api/v1${path}?${new URLSearchParams(params)}`, { headers: { "X-Finnhub-Token": k }, timeoutMs: 10_000 });
  } catch (err) {
    console.warn(`[equidy] Finnhub ${path}:`, (err as Error).message);
    return null;
  }
}

export interface NewsItem {
  headline: string;
  source: string;
  url: string;
  datetime: number; // epoch ms
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

const METRIC_KEYS: Record<string, string> = {
  peTTM: "P/E (TTM)",
  pbAnnual: "P/B",
  epsTTM: "EPS (TTM)",
  revenueGrowthTTMYoy: "Revenue growth YoY % (TTM)",
  netProfitMarginTTM: "Net margin % (TTM)",
  roeTTM: "ROE % (TTM)",
  dividendYieldIndicatedAnnual: "Dividend yield %",
  beta: "Beta",
  "52WeekHigh": "52-week high",
  "52WeekLow": "52-week low",
  "totalDebt/totalEquityAnnual": "Debt/Equity",
};
export const METRIC_LABELS = METRIC_KEYS;

const ymd = (d: Date) => d.toISOString().slice(0, 10);

export function parseNews(raw: unknown, limit: number): NewsItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((n) => n && typeof n.headline === "string" && n.headline && typeof n.url === "string" && /^https?:\/\//.test(n.url))
    .slice(0, limit)
    .map((n) => ({
      headline: String(n.headline).slice(0, 300),
      source: String(n.source ?? ""),
      url: String(n.url),
      datetime: Number(n.datetime) * 1000 || 0,
      summary: String(n.summary ?? "").slice(0, 500),
    }));
}

export function parseMetrics(raw: unknown): Record<string, number> {
  const m = ((raw as { metric?: Record<string, unknown> } | null)?.metric ?? {}) as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const k of Object.keys(METRIC_KEYS)) {
    const v = Number(m[k]);
    if (m[k] !== null && m[k] !== undefined && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

async function loadIntel(symbol: string): Promise<CompanyIntel | null> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const [profile, metric, recs, earnings, peers, news] = await Promise.all([
    fh<Record<string, unknown>>("/stock/profile2", { symbol }),
    fh("/stock/metric", { symbol, metric: "all" }),
    fh<Record<string, unknown>[]>("/stock/recommendation", { symbol }),
    fh<Record<string, unknown>[]>("/stock/earnings", { symbol, limit: "4" }),
    fh<string[]>("/stock/peers", { symbol }),
    fh("/company-news", { symbol, from: ymd(weekAgo), to: ymd(now) }),
  ]);
  if (!profile && !metric && !recs && !news) return null; // Finnhub unreachable — retry later
  const rec = Array.isArray(recs) && recs[0] ? recs[0] : null;
  const num = (v: unknown) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v));
  return {
    symbol,
    profile:
      profile && profile.name
        ? {
            name: String(profile.name),
            industry: String(profile.finnhubIndustry ?? ""),
            country: String(profile.country ?? ""),
            exchange: String(profile.exchange ?? ""),
            ipo: String(profile.ipo ?? ""),
            marketCapB: num(profile.marketCapitalization) === null ? null : Number(profile.marketCapitalization) / 1000,
            website: String(profile.weburl ?? ""),
            logo: String(profile.logo ?? ""),
          }
        : null,
    metrics: parseMetrics(metric),
    recommendation: rec
      ? { period: String(rec.period ?? ""), strongBuy: Number(rec.strongBuy) || 0, buy: Number(rec.buy) || 0, hold: Number(rec.hold) || 0, sell: Number(rec.sell) || 0, strongSell: Number(rec.strongSell) || 0 }
      : null,
    earnings: (Array.isArray(earnings) ? earnings : []).slice(0, 4).map((e) => ({
      period: String(e.period ?? ""),
      actual: num(e.actual),
      estimate: num(e.estimate),
      surprisePercent: num(e.surprisePercent),
    })),
    peers: (Array.isArray(peers) ? peers : []).filter((p) => typeof p === "string" && p !== symbol).slice(0, 8),
    news: parseNews(news, 8),
    asOf: Date.now(),
  };
}

export function getCompanyIntel(symbol: string): Promise<CompanyIntel | null> {
  if (!intelEnabled() || CRYPTO.has(symbol)) return Promise.resolve(null);
  return cached(`intel:${symbol}`, INTEL_TTL_MS, () => loadIntel(symbol), { persist: true });
}

export function getMarketNews(): Promise<NewsItem[] | null> {
  if (!intelEnabled()) return Promise.resolve(null);
  return cached("news:general", NEWS_TTL_MS, async () => {
    const raw = await fh("/news", { category: "general" });
    return raw ? parseNews(raw, 12) : null;
  });
}

const fmt = (v: number | null | undefined, d = 2) => (v === null || v === undefined ? "n/a" : v.toFixed(d));

/** Compact text for the AI's context window. */
export function intelToText(i: CompanyIntel): string {
  const lines = [`${i.symbol}${i.profile ? ` — ${i.profile.name} (${i.profile.industry}, ${i.profile.country}, ${i.profile.exchange})` : ""}`];
  if (i.profile?.marketCapB) lines.push(`Market cap: $${i.profile.marketCapB.toFixed(1)}B`);
  const m = Object.entries(i.metrics).map(([k, v]) => `${METRIC_KEYS[k]} ${fmt(v)}`);
  if (m.length) lines.push(`Key metrics: ${m.join("; ")}`);
  if (i.recommendation) {
    const r = i.recommendation;
    lines.push(`Analyst ratings (${r.period}): strong buy ${r.strongBuy}, buy ${r.buy}, hold ${r.hold}, sell ${r.sell}, strong sell ${r.strongSell}`);
  }
  if (i.earnings.length) lines.push(`Recent EPS (actual vs estimate): ${i.earnings.map((e) => `${e.period} ${fmt(e.actual)} vs ${fmt(e.estimate)} (${fmt(e.surprisePercent, 1)}% surprise)`).join("; ")}`);
  if (i.peers.length) lines.push(`Peers: ${i.peers.join(", ")}`);
  if (i.news.length) lines.push(`Headlines (last 7 days): ${i.news.slice(0, 5).map((n) => `"${n.headline}" (${n.source}, ${new Date(n.datetime).toISOString().slice(0, 10)})`).join("; ")}`);
  return lines.join("\n");
}
