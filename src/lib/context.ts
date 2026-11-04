import { BY_SYMBOL, INDICES } from "@/data/securities";
import { useMarket, usePortfolio, useSettings } from "@/store";
import { allocationBy, benchmarkHistory, portfolioHistory, positions, riskMetrics, summarize } from "./finance";
import { money, pct, price } from "./format";
import { liveDays } from "./market";
import { bankingContext } from "./banking";

/** A snapshot of the user's financial state, shared by the Gemini backend and the offline engine. */
export function buildSnapshot() {
  const { holdings, watchlist } = usePortfolio.getState();
  const { prices, sources } = useMarket.getState();
  const { riskFree, riskProfile, responseStyle, profile } = useSettings.getState();
  const rows = positions(holdings, prices);
  const total = summarize(rows);
  const metrics = riskMetrics(portfolioHistory(holdings).slice(-253), benchmarkHistory().slice(-253), rows.map((r) => r.weight), riskFree);
  return {
    rows,
    total,
    metrics,
    sectors: allocationBy(rows, "sector"),
    watchlist: watchlist.map((s) => ({ symbol: s, ...prices[s] })),
    indices: INDICES.map((i) => ({ ...i, ...prices[i.symbol] })),
    prices,
    sources,
    riskProfile,
    userName: profile.name.trim(),
    responseStyle,
  };
}

export type Snapshot = ReturnType<typeof buildSnapshot>;

/** Compact plain-text context passed to the model alongside the conversation. */
export function snapshotToText(s: Snapshot): string {
  const lines: string[] = [];
  lines.push(`Date: ${new Date().toDateString()}`);
  if (s.userName) lines.push(`User's display name: ${s.userName}`);
  lines.push(`Investor risk profile: ${s.riskProfile}. Preferred answer length: ${s.responseStyle}.`);
  lines.push(`\nPORTFOLIO — value ${money(s.total.value)}, cost ${money(s.total.cost)}, unrealised P/L ${money(s.total.pnl, { sign: true })} (${pct(s.total.pnlPct)}), today ${money(s.total.dayChange, { sign: true })} (${pct(s.total.dayChangePct)})`);
  lines.push("symbol | shares | avg cost | price | value | weight | P/L% | sector");
  for (const r of s.rows) {
    lines.push(`${r.symbol} | ${r.shares} | ${price(r.costBasis)} | ${price(r.price)} | ${money(r.value)} | ${pct(r.weight, 1, false)} | ${pct(r.pnlPct)} | ${r.sector}`);
  }
  lines.push("Sector weights: " + s.sectors.map((x) => `${x.name} ${pct(x.weight, 1, false)}`).join(", "));
  if (s.metrics) {
    const m = s.metrics;
    lines.push(`1Y risk: return ${pct(m.annualReturn)}, volatility ${pct(m.volatility, 1, false)}, Sharpe ${m.sharpe.toFixed(2)}, beta ${m.beta.toFixed(2)} vs SPY, max drawdown ${pct(m.maxDrawdown)}, 1-day VaR95 ${pct(m.var95, 2, false)}, diversification score ${m.diversification}/100, SPY 1Y ${pct(m.benchmarkReturn)}`);
  }
  lines.push("\nWATCHLIST: " + s.watchlist.map((w) => `${w.symbol} ${price(w.price)} (${pct(w.price / w.prevClose - 1)})`).join(", "));
  lines.push("INDICES: " + s.indices.map((i) => `${i.name} ${price(i.price)} (${pct(i.price / i.prevClose - 1)})`).join(", "));
  const covered = Object.values(BY_SYMBOL).filter((x) => x.financials).map((x) => x.symbol);
  lines.push(`\nReference fundamentals available in-app for: ${covered.join(", ")}.`);
  lines.push(dataSources(s));
  const bank = bankingContext();
  if (bank) lines.push(bank);
  return lines.join("\n");
}

const SOURCE_LABEL = { alphavantage: "Alpha Vantage", finnhub: "Finnhub" } as const;

/** Tells the model which prices and histories are real and which are simulated. */
function dataSources(s: Snapshot): string {
  const live = Object.entries(s.sources);
  if (!live.length) return "\nDATA SOURCES: all prices, indices and histories in this context are simulated (no market data provider is connected).";
  const by = (src: keyof typeof SOURCE_LABEL) => live.filter(([, v]) => v === src).map(([k]) => k);
  const parts = (Object.keys(SOURCE_LABEL) as (keyof typeof SOURCE_LABEL)[]).filter((k) => by(k).length).map((k) => `${SOURCE_LABEL[k]}: ${by(k).join(", ")}`);
  const hist = live.map(([k]) => k).filter((k) => liveDays(k) > 0).map((k) => `${k} (${liveDays(k)} days)`);
  return [
    `\nDATA SOURCES: live prices — ${parts.join("; ")}. Every other symbol and all indices are simulated.`,
    hist.length ? `Real daily history (Alpha Vantage): ${hist.join(", ")}; older history and risk statistics beyond that window are simulated.` : "Price histories and risk statistics are simulated.",
  ].join("\n");
}
