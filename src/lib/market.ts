// Deterministic market simulator. Each symbol gets a reproducible price history
// (seeded geometric Brownian motion) that ends at its reference price, so charts,
// statistics and the AI engine all see the same numbers across reloads.

export interface Bar {
  t: number; // epoch ms
  close: number;
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rng(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number) {
  const u = Math.max(rand(), 1e-12);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const DAY = 86_400_000;
const MARKET_SEED = "EQUIDY-24"; // chosen so the simulated S&P 500 has a realistic trailing year
const cache = new Map<string, Bar[]>();

/** Shared market factor so that correlated assets move together (enables beta). */
function marketShocks(days: number): number[] {
  const key = `__mkt_${days}`;
  const hit = cache.get(key);
  if (hit) return hit.map((b) => b.close);
  const rand = rng(hash(MARKET_SEED));
  const shocks = Array.from({ length: days }, () => gaussian(rand));
  cache.set(key, shocks.map((close, t) => ({ t, close })));
  return shocks;
}

// Real daily closes (from Alpha Vantage via the server) replace the simulated series where available.
const live = new Map<string, Bar[]>();

/** Registers real daily closes for a symbol; later history() calls use them. */
export function setLiveHistory(symbol: string, bars: Bar[]) {
  if (bars.length < 2) return;
  live.set(symbol, bars);
  for (const k of [...cache.keys()]) if (k.startsWith(`${symbol}_`)) cache.delete(k);
}

/** Number of real (non-simulated) daily bars held for a symbol, or 0. */
export const liveDays = (symbol: string) => live.get(symbol)?.length ?? 0;

/**
 * Joins real bars onto the end of a simulated series so callers still get `days` aligned bars.
 * The simulated part is rescaled to meet the first real close, and re-dated to end the trading day before it.
 */
export function mergeHistory(sim: Bar[], real: Bar[], days: number): Bar[] {
  const tail = real.slice(-days);
  const k = days - tail.length;
  if (k <= 0) return tail;
  const anchor = sim[k]?.close ?? sim[sim.length - 1].close;
  const factor = tail[0].close / anchor;
  const step = DAY * (7 / 5);
  const head = sim.slice(0, k).map((b, i) => ({ t: tail[0].t - (k - i) * step, close: b.close * factor }));
  return [...head, ...tail];
}

/** Daily closes for `days` trading days: real where available, otherwise simulated to end today at `endPrice`. */
export function history(symbol: string, endPrice: number, vol: number, drift: number, beta = 1, days = 504): Bar[] {
  const key = `${symbol}_${days}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const sim = simulate(symbol, endPrice, vol, drift, beta, days);
  const real = live.get(symbol);
  const bars = real ? mergeHistory(sim, real, days) : sim;
  cache.set(key, bars);
  return bars;
}

function simulate(symbol: string, endPrice: number, vol: number, drift: number, beta: number, days: number): Bar[] {
  const key = `sim:${symbol}_${days}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const rand = rng(hash(symbol));
  const mkt = marketShocks(days);
  const dt = 1 / 252;
  const corr = Math.max(-0.95, Math.min(0.95, beta * 0.16 / Math.max(vol, 0.01))); // ρ implied by beta
  const logs: number[] = [0];
  for (let i = 1; i < days; i++) {
    const z = corr * mkt[i] + Math.sqrt(1 - corr * corr) * gaussian(rand);
    const r = (drift - (vol * vol) / 2) * dt + vol * Math.sqrt(dt) * z;
    logs.push(logs[i - 1] + r);
  }
  const shift = Math.log(endPrice) - logs[logs.length - 1];
  const today = new Date();
  today.setHours(16, 0, 0, 0);
  const bars = logs.map((l, i) => ({ t: today.getTime() - (days - 1 - i) * DAY * (7 / 5), close: Math.exp(l + shift) }));
  cache.set(key, bars);
  return bars;
}

export type Range = "1D" | "1W" | "1M" | "3M" | "YTD" | "1Y" | "2Y";
export const RANGES: Range[] = ["1D", "1W", "1M", "3M", "YTD", "1Y", "2Y"];

export function sliceRange(bars: Bar[], range: Range): Bar[] {
  const n = { "1D": 2, "1W": 5, "1M": 21, "3M": 63, YTD: ytdDays(), "1Y": 252, "2Y": 504 }[range];
  return bars.slice(-Math.min(n + 1, bars.length));
}

function ytdDays() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return Math.max(5, Math.round(((now.getTime() - start.getTime()) / DAY) * (5 / 7)));
}

/** Intraday path for the 1D view, seeded per symbol per day. */
export function intraday(symbol: string, open: number, last: number, vol: number, points = 78): Bar[] {
  const d = new Date();
  const rand = rng(hash(symbol + d.toDateString()));
  const step = vol / Math.sqrt(252 * points);
  const raw: number[] = [0];
  for (let i = 1; i < points; i++) raw.push(raw[i - 1] + step * gaussian(rand));
  const end = raw[points - 1];
  const target = Math.log(last / open);
  const start = new Date(d);
  start.setHours(9, 30, 0, 0);
  return raw.map((r, i) => ({
    t: start.getTime() + i * 5 * 60_000,
    close: open * Math.exp(r + (target - end) * (i / (points - 1))),
  }));
}

export function returns(bars: Bar[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < bars.length; i++) out.push(bars[i].close / bars[i - 1].close - 1);
  return out;
}
