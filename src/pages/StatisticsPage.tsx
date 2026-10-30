import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Info } from "lucide-react";
import { useMarket, usePortfolio, useSettings } from "@/store";
import { allocationBy, benchmarkHistory, correlationMatrix, maxDrawdown, portfolioHistory, positions, riskMetrics } from "@/lib/finance";
import { returns, type Bar } from "@/lib/market";
import { cn, money, pct } from "@/lib/format";
import { Page, PageHeader, Segmented, Stat } from "@/components/ui";
import { ReturnBars } from "@/components/charts";
import { askEquidy } from "./ChatPage";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar as RBar, BarChart } from "recharts";

const WINDOWS = { "3M": 63, "6M": 126, "1Y": 252, "2Y": 503 } as const;
type Win = keyof typeof WINDOWS;

export function StatisticsPage() {
  const holdings = usePortfolio((s) => s.holdings);
  const prices = useMarket((s) => s.prices);
  const riskFree = useSettings((s) => s.riskFree);
  const navigate = useNavigate();
  const [win, setWin] = useState<Win>("1Y");

  const rows = useMemo(() => positions(holdings, prices), [holdings, prices]);
  const days = WINDOWS[win];
  const port = useMemo(() => portfolioHistory(holdings).slice(-days - 1), [holdings, days]);
  const bench = useMemo(() => benchmarkHistory().slice(-days - 1), [days]);
  const m = useMemo(() => riskMetrics(port, bench, rows.map((r) => r.weight), riskFree), [port, bench, rows, riskFree]);
  const drawdown = useMemo(() => drawdownSeries(port), [port]);
  const monthly = useMemo(() => monthlyReturns(port), [port]);
  const hist = useMemo(() => histogram(returns(port)), [port]);
  const symbols = rows.slice(0, 8).map((r) => r.symbol);
  const corr = useMemo(() => correlationMatrix(symbols, days), [symbols.join(), days]); // eslint-disable-line react-hooks/exhaustive-deps
  const contrib = rows.map((r) => ({ name: r.symbol, value: r.pnlPct })).sort((a, b) => b.value - a.value);

  if (!m) {
    return (
      <Page>
        <PageHeader title="Statistics" subtitle="Add holdings to unlock risk analytics." />
      </Page>
    );
  }

  return (
    <Page wide>
      <PageHeader
        title="Statistics"
        subtitle="Risk-adjusted performance analytics for your portfolio, benchmarked against the S&P 500."
        actions={
          <>
            <Segmented value={win} options={Object.keys(WINDOWS) as Win[]} onChange={setWin} />
            <button className="btn-outline" onClick={() => askEquidy(navigate, "How risky is my portfolio? Explain my risk metrics and what I could improve.")}>
              <Sparkles className="h-4 w-4 text-accent" /> Explain my risk
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Annualised return" value={<span className={m.annualReturn >= 0 ? "text-up" : "text-down"}>{pct(m.annualReturn)}</span>} sub={<>S&P 500 {pct(m.benchmarkReturn)}</>} />
        <Stat label="Volatility" value={pct(m.volatility, 1, false)} sub="Annualised std. deviation" />
        <Stat label="Sharpe ratio" value={m.sharpe.toFixed(2)} sub={`Sortino ${m.sortino.toFixed(2)} · rf ${pct(riskFree, 1, false)}`} />
        <Stat label="Beta" value={m.beta.toFixed(2)} sub={<>Alpha <span className={m.alpha >= 0 ? "text-up" : "text-down"}>{pct(m.alpha)}</span></>} />
        <Stat label="Max drawdown" value={<span className="text-down">{pct(m.maxDrawdown)}</span>} sub="Peak to trough" />
        <Stat label="1-day VaR (95%)" value={pct(m.var95, 2, false)} sub={`≈ ${money(m.var95 * rows.reduce((a, r) => a + r.value, 0), { decimals: 0 })}`} />
        <Stat label="Diversification" value={`${m.diversification}/100`} sub={<DiversBar v={m.diversification} />} />
        <Stat label="Positive days" value={pct(m.winRate, 0, false)} sub={<>Best {pct(m.bestDay)} · worst {pct(m.worstDay)}</>} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Drawdown" hint="How far the portfolio sat below its previous high on each day.">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={drawdown} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="rgb(var(--line))" strokeOpacity={0.6} />
              <XAxis dataKey="t" tickFormatter={(t) => new Date(t).toLocaleDateString(undefined, { month: "short", year: "2-digit" })} tick={{ fill: "rgb(var(--muted))", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={48} />
              <YAxis tickFormatter={(v) => pct(v, 0)} tick={{ fill: "rgb(var(--muted))", fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
              <Tooltip content={({ active, payload }) => active && payload?.length ? <Tip title={new Date(payload[0].payload.t).toLocaleDateString()} value={pct(payload[0].payload.dd)} /> : null} cursor={{ stroke: "rgb(var(--muted))", strokeDasharray: "3 3" }} />
              <Area dataKey="dd" stroke="rgb(var(--down))" strokeWidth={1.5} fill="rgb(var(--down))" fillOpacity={0.12} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Daily return distribution" hint="Frequency of daily portfolio moves.">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={hist} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap={2}>
              <CartesianGrid vertical={false} stroke="rgb(var(--line))" strokeOpacity={0.6} />
              <XAxis dataKey="mid" tickFormatter={(v) => pct(v, 1)} tick={{ fill: "rgb(var(--muted))", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis tick={{ fill: "rgb(var(--muted))", fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
              <Tooltip content={({ active, payload }) => active && payload?.length ? <Tip title={`${pct(payload[0].payload.lo, 2)} to ${pct(payload[0].payload.hi, 2)}`} value={`${payload[0].payload.count} days`} /> : null} cursor={{ fill: "rgb(var(--elevated))" }} />
              <RBar dataKey="count" radius={[3, 3, 0, 0]} isAnimationActive={false} fill="rgb(var(--accent))" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Monthly returns">
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
            {monthly.map((mo) => (
              <div key={mo.label} className="rounded-lg px-2 py-2 text-center" style={{ background: heat(mo.r) }} title={`${mo.label}: ${pct(mo.r)}`}>
                <div className="text-[10px] text-muted">{mo.label}</div>
                <div className={cn("num text-xs font-medium", mo.r >= 0 ? "text-up" : "text-down")}>{pct(mo.r, 1)}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Return by holding" hint="Unrealised return on cost.">
          <ReturnBars data={contrib} />
        </Card>
        <Card title="Correlation matrix" hint="Daily return correlation between your largest holdings. Lower is better for diversification." className="lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="mx-auto text-xs">
              <thead>
                <tr>
                  <th />
                  {symbols.map((s) => <th key={s} className="px-1 pb-2 font-mono font-medium text-muted">{s}</th>)}
                </tr>
              </thead>
              <tbody>
                {symbols.map((s, i) => (
                  <tr key={s}>
                    <th className="pr-2 text-right font-mono font-medium text-muted">{s}</th>
                    {corr[i].map((c, j) => (
                      <td key={j} className="p-0.5">
                        <div className="num grid h-10 w-14 place-items-center rounded-md text-[11px]" style={corrStyle(c)} title={`${s} / ${symbols[j]}: ${c.toFixed(2)}`}>{c.toFixed(2)}</div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-muted">
            <span>−1 (hatched)</span>
            <div className="h-2 w-40 rounded-full" style={{ background: `linear-gradient(90deg, ${corrColor(-1)}, ${corrColor(0)}, ${corrColor(1)})` }} />
            <span>+1</span>
          </div>
        </Card>
        <Card title="Sector exposure">
          <div className="space-y-3">
            {allocationBy(rows, "sector").map((s) => (
              <div key={s.name}>
                <div className="mb-1 flex justify-between text-sm"><span>{s.name}</span><span className="num text-muted">{pct(s.weight, 1, false)}</span></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-accent" style={{ width: `${s.weight * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Benchmark comparison">
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-muted"><th className="py-1.5 text-left font-medium">Metric</th><th className="text-right font-medium">Portfolio</th><th className="text-right font-medium">S&P 500</th></tr></thead>
            <tbody className="[&_td]:border-t [&_td]:border-line [&_td]:py-2">
              <tr><td>Annual return</td><td className="num text-right">{pct(m.annualReturn)}</td><td className="num text-right">{pct(m.benchmarkReturn)}</td></tr>
              <tr><td>Volatility</td><td className="num text-right">{pct(m.volatility, 1, false)}</td><td className="num text-right">{pct(benchVol(bench), 1, false)}</td></tr>
              <tr><td>Max drawdown</td><td className="num text-right">{pct(m.maxDrawdown)}</td><td className="num text-right">{pct(maxDrawdown(bench.map((b) => b.close)))}</td></tr>
              <tr><td>Beta</td><td className="num text-right">{m.beta.toFixed(2)}</td><td className="num text-right">1.00</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
    </Page>
  );
}

function Card({ title, hint, children, className }: { title: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("card p-5", className)}>
      <div className="mb-4 flex items-center gap-1.5">
        <div className="label">{title}</div>
        {hint && <span title={hint}><Info className="h-3.5 w-3.5 text-muted" /></span>}
      </div>
      {children}
    </div>
  );
}

function Tip({ title, value }: { title: string; value: string }) {
  return <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-xl"><div className="text-muted">{title}</div><div className="num font-semibold">{value}</div></div>;
}

function DiversBar({ v }: { v: number }) {
  return <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-accent" style={{ width: `${v}%` }} /></div>;
}

function drawdownSeries(bars: Bar[]) {
  let peak = 0;
  return bars.map((b) => { peak = Math.max(peak, b.close); return { t: b.t, dd: b.close / peak - 1 }; });
}

function monthlyReturns(bars: Bar[]) {
  const out: { label: string; r: number }[] = [];
  let start = bars[0];
  for (let i = 1; i < bars.length; i++) {
    const a = new Date(bars[i - 1].t), b = new Date(bars[i].t);
    if (a.getMonth() !== b.getMonth() || i === bars.length - 1) {
      out.push({ label: a.toLocaleDateString(undefined, { month: "short", year: "2-digit" }), r: bars[i - 1].close / start.close - 1 });
      start = bars[i - 1];
    }
  }
  return out.slice(-12);
}

function histogram(rets: number[], bins = 24) {
  if (!rets.length) return [];
  const lo = Math.max(Math.min(...rets), -0.05), hi = Math.min(Math.max(...rets), 0.05);
  const w = (hi - lo) / bins;
  const out = Array.from({ length: bins }, (_, i) => ({ lo: lo + i * w, hi: lo + (i + 1) * w, mid: lo + (i + 0.5) * w, count: 0 }));
  rets.forEach((r) => { out[Math.max(0, Math.min(bins - 1, Math.floor((r - lo) / w)))].count++; });
  return out;
}

function benchVol(b: Bar[]) {
  const r = returns(b);
  const m = r.reduce((a, x) => a + x, 0) / r.length;
  return Math.sqrt(r.reduce((a, x) => a + (x - m) ** 2, 0) / (r.length - 1)) * Math.sqrt(252);
}

const heat = (r: number) => `rgb(var(${r >= 0 ? "--up" : "--down"}) / ${Math.min(0.28, Math.abs(r) * 3 + 0.04)})`;
// Monochrome: cell strength shows |correlation|; negative cells are hatched so sign never relies on tone alone.
const corrColor = (c: number) => `rgb(var(--fg) / ${0.05 + Math.abs(c) * 0.4})`;
const corrStyle = (c: number) => ({
  background: corrColor(c),
  backgroundImage: c < 0 ? "repeating-linear-gradient(45deg, rgb(var(--bg) / .35) 0 2px, transparent 2px 6px)" : undefined,
  color: Math.abs(c) > 0.6 ? "rgb(var(--bg))" : undefined,
});
