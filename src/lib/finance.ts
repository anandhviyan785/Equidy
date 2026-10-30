import { BY_SYMBOL, type Sector } from "@/data/securities";
import { history, returns, type Bar } from "./market";

export interface Holding {
  id: string;
  symbol: string;
  shares: number;
  costBasis: number; // average cost per share
  addedAt: number;
}

export interface PositionView extends Holding {
  name: string;
  sector: Sector;
  price: number;
  prevClose: number;
  value: number;
  cost: number;
  pnl: number;
  pnlPct: number;
  dayChange: number;
  dayChangePct: number;
  weight: number;
}

export interface PriceMap {
  [symbol: string]: { price: number; prevClose: number };
}

export function positions(holdings: Holding[], prices: PriceMap): PositionView[] {
  const rows = holdings
    .filter((h) => BY_SYMBOL[h.symbol])
    .map((h) => {
      const s = BY_SYMBOL[h.symbol];
      const p = prices[h.symbol] ?? { price: s.price, prevClose: s.price };
      const value = h.shares * p.price;
      const cost = h.shares * h.costBasis;
      return {
        ...h,
        name: s.name,
        sector: s.sector,
        price: p.price,
        prevClose: p.prevClose,
        value,
        cost,
        pnl: value - cost,
        pnlPct: cost ? (value - cost) / cost : 0,
        dayChange: h.shares * (p.price - p.prevClose),
        dayChangePct: p.prevClose ? p.price / p.prevClose - 1 : 0,
        weight: 0,
      };
    });
  const total = rows.reduce((a, r) => a + r.value, 0);
  rows.forEach((r) => (r.weight = total ? r.value / total : 0));
  return rows.sort((a, b) => b.value - a.value);
}

export function summarize(rows: PositionView[]) {
  const value = sum(rows.map((r) => r.value));
  const cost = sum(rows.map((r) => r.cost));
  const day = sum(rows.map((r) => r.dayChange));
  return {
    value,
    cost,
    pnl: value - cost,
    pnlPct: cost ? (value - cost) / cost : 0,
    dayChange: day,
    dayChangePct: value - day ? day / (value - day) : 0,
  };
}

export function allocationBy<K extends keyof PositionView>(rows: PositionView[], key: K) {
  const m = new Map<string, number>();
  rows.forEach((r) => m.set(String(r[key]), (m.get(String(r[key])) ?? 0) + r.value));
  const total = sum([...m.values()]);
  return [...m.entries()]
    .map(([name, value]) => ({ name, value, weight: total ? value / total : 0 }))
    .sort((a, b) => b.value - a.value);
}

/** Portfolio value series using today's share counts applied to historical prices. */
export function portfolioHistory(holdings: Holding[], days = 504): Bar[] {
  const series = holdings
    .filter((h) => BY_SYMBOL[h.symbol])
    .map((h) => {
      const s = BY_SYMBOL[h.symbol];
      return { shares: h.shares, bars: history(s.symbol, s.price, s.vol, s.drift, s.beta, days) };
    });
  if (!series.length) return [];
  return series[0].bars.map((b, i) => ({ t: b.t, close: sum(series.map((s) => s.shares * s.bars[i].close)) }));
}

export function benchmarkHistory(days = 504): Bar[] {
  const s = BY_SYMBOL.SPY;
  return history(s.symbol, s.price, s.vol, s.drift, s.beta, days);
}

// ---------- Statistics ----------

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
export const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);

export function stdev(xs: number[]) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(sum(xs.map((x) => (x - m) ** 2)) / (xs.length - 1));
}

export function covariance(a: number[], b: number[]) {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const ma = mean(a.slice(0, n));
  const mb = mean(b.slice(0, n));
  let s = 0;
  for (let i = 0; i < n; i++) s += (a[i] - ma) * (b[i] - mb);
  return s / (n - 1);
}

export function maxDrawdown(values: number[]) {
  let peak = -Infinity;
  let mdd = 0;
  for (const v of values) {
    peak = Math.max(peak, v);
    if (peak > 0) mdd = Math.min(mdd, v / peak - 1);
  }
  return mdd;
}

/** Historical 1-day Value-at-Risk at the given confidence, as a positive fraction. */
export function valueAtRisk(rets: number[], confidence = 0.95) {
  if (!rets.length) return 0;
  const sorted = [...rets].sort((a, b) => a - b);
  const idx = Math.floor((1 - confidence) * sorted.length + 1e-9);
  return -sorted[Math.max(0, idx)];
}

export interface RiskMetrics {
  annualReturn: number;
  volatility: number;
  sharpe: number;
  sortino: number;
  beta: number;
  alpha: number;
  maxDrawdown: number;
  var95: number;
  diversification: number; // 0..100
  benchmarkReturn: number;
  bestDay: number;
  worstDay: number;
  winRate: number;
}

export function riskMetrics(port: Bar[], bench: Bar[], weights: number[], riskFree = 0.04): RiskMetrics | null {
  if (port.length < 30) return null;
  const pr = returns(port);
  const br = returns(bench.slice(-port.length));
  const years = pr.length / 252;
  const annualReturn = (port[port.length - 1].close / port[0].close) ** (1 / years) - 1;
  const benchmarkReturn = (bench[bench.length - 1].close / bench[bench.length - port.length].close) ** (1 / years) - 1;
  const volatility = stdev(pr) * Math.sqrt(252);
  const downside = pr.filter((r) => r < 0);
  const dVol = Math.sqrt(mean(downside.map((r) => r * r))) * Math.sqrt(252);
  const varB = stdev(br) ** 2;
  const beta = varB ? covariance(pr, br) / varB : 0;
  const hhi = sum(weights.map((w) => w * w));
  return {
    annualReturn,
    volatility,
    sharpe: volatility ? (annualReturn - riskFree) / volatility : 0,
    sortino: dVol ? (annualReturn - riskFree) / dVol : 0,
    beta,
    alpha: annualReturn - (riskFree + beta * (benchmarkReturn - riskFree)),
    maxDrawdown: maxDrawdown(port.map((b) => b.close)),
    var95: valueAtRisk(pr, 0.95),
    diversification: weights.length ? Math.round((1 - hhi) * 100) : 0, // 1 − Herfindahl index
    benchmarkReturn,
    bestDay: Math.max(...pr),
    worstDay: Math.min(...pr),
    winRate: pr.filter((r) => r > 0).length / pr.length,
  };
}

export function correlationMatrix(symbols: string[], days = 252) {
  const rets = symbols.map((sym) => {
    const s = BY_SYMBOL[sym];
    return returns(history(s.symbol, s.price, s.vol, s.drift, s.beta, 504).slice(-days));
  });
  return symbols.map((_, i) => symbols.map((__, j) => {
    const d = stdev(rets[i]) * stdev(rets[j]);
    return d ? covariance(rets[i], rets[j]) / d : 0;
  }));
}

// ---------- Planning ----------

export function compound(principal: number, monthly: number, annualRate: number, years: number, perYear = 12) {
  const r = annualRate / perYear;
  const rows: { year: number; balance: number; contributed: number; interest: number }[] = [];
  let bal = principal;
  let contributed = principal;
  for (let y = 1; y <= years; y++) {
    for (let p = 0; p < perYear; p++) {
      bal = bal * (1 + r) + monthly * (12 / perYear);
      contributed += monthly * (12 / perYear);
    }
    rows.push({ year: y, balance: bal, contributed, interest: bal - contributed });
  }
  return rows;
}
