import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Star, Sparkles, Plus } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BY_SYMBOL } from "@/data/securities";
import { history, intraday, sliceRange, RANGES, type Range } from "@/lib/market";
import { useMarket, usePortfolio } from "@/store";
import { cn, money, num, pct, price } from "@/lib/format";
import { Change, Page, Segmented } from "@/components/ui";
import { PriceChart, useSeriesColors } from "@/components/charts";
import { askEquidy } from "./ChatPage";

export function SymbolPage() {
  const { symbol = "" } = useParams();
  const s = BY_SYMBOL[symbol.toUpperCase()];
  const p = useMarket((st) => (s ? st.prices[s.symbol] : undefined));
  const { watchlist, toggleWatch, holdings, addHolding } = usePortfolio();
  const navigate = useNavigate();
  const [range, setRange] = useState<Range>("1Y");
  const colors = useSeriesColors();

  const bars = useMemo(() => (s ? history(s.symbol, s.price, s.vol, s.drift, s.beta) : []), [s]);
  const series = useMemo(() => {
    if (!s || !p) return [];
    if (range === "1D") return intraday(s.symbol, p.prevClose, p.price, s.vol);
    const sl = sliceRange(bars, range);
    return [...sl.slice(0, -1), { t: Date.now(), close: p.price }];
  }, [s, p, range, bars]);

  if (!s || !p) return <Navigate to="/markets" replace />;
  const watched = watchlist.includes(s.symbol);
  const held = holdings.find((h) => h.symbol === s.symbol);
  const yr = bars.slice(-252).map((b) => b.close);
  const f = s.financials;
  const finRows = f?.years.map((y, i) => ({ year: String(y), revenue: f.revenue[i], netIncome: f.netIncome[i] }));

  return (
    <Page wide>
      <Link to="/markets" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg"><ArrowLeft className="h-4 w-4" /> Markets</Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{s.name}</h1>
            <span className="chip font-mono">{s.symbol}</span>
            <span className="chip">{s.sector}</span>
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="num text-3xl font-semibold">{price(p.price)}</span>
            <Change value={p.price / p.prevClose - 1} icon />
            <span className="text-xs text-muted">today</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-outline" onClick={() => toggleWatch(s.symbol)}>
            <Star className={cn("h-4 w-4", watched && "fill-accent text-accent")} /> {watched ? "Watching" : "Watch"}
          </button>
          {!held && <button className="btn-outline" onClick={() => addHolding({ symbol: s.symbol, shares: 1, costBasis: p.price })}><Plus className="h-4 w-4" /> Add 1 share</button>}
          <button className="btn-primary" onClick={() => askEquidy(navigate, `Analyze ${s.name}'s financial performance`)}><Sparkles className="h-4 w-4" /> Ask Equidy</button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-baseline gap-2">
              <Change value={series.length > 1 ? series[series.length - 1].close / series[0].close - 1 : 0} />
              <span className="text-xs text-muted">{range}</span>
            </div>
            <Segmented value={range} options={RANGES} onChange={setRange} size="xs" />
          </div>
          <PriceChart data={series} intraday={range === "1D"} height={320} />
        </div>
        <div className="card p-5">
          <div className="label mb-3">Key statistics</div>
          <dl className="divide-y divide-line text-sm">
            {[
              ["Previous close", price(p.prevClose)],
              ["52-week range", `${price(Math.min(...yr))} – ${price(Math.max(...yr))}`],
              ["Market cap", s.marketCap ? `$${num(s.marketCap, 0)}B` : "—"],
              ["P/E ratio", s.pe?.toFixed(1) ?? "—"],
              ["Dividend yield", s.dividendYield ? `${s.dividendYield.toFixed(2)}%` : "—"],
              ["Beta", s.beta.toFixed(2)],
              ["Volatility (ann.)", pct(s.vol, 0, false)],
              ...(f ? [["Operating margin", `${f.operatingMargin}%`], ["Return on equity", `${f.roe}%`], ["Debt / equity", f.debtToEquity.toFixed(2)]] : []),
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between py-2"><dt className="text-muted">{k}</dt><dd className="num">{v}</dd></div>
            ))}
          </dl>
          {held && (
            <div className="mt-4 rounded-xl bg-elevated p-3 text-xs">
              You own <b>{held.shares}</b> shares · value <span className="num font-medium">{money(held.shares * p.price)}</span> · <Change value={p.price / held.costBasis - 1} />
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="card p-5">
          <div className="label mb-2">About</div>
          <p className="text-sm leading-relaxed text-muted">{s.description}</p>
        </div>
        {finRows && f && (
          <div className="card p-5 lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <div className="label">Revenue & net income (USD B)</div>
              <div className="flex gap-3 text-xs text-muted">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: colors[0] }} />Revenue</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: colors[2] }} />Net income</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={finRows} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={2}>
                <CartesianGrid vertical={false} stroke="rgb(var(--line))" strokeOpacity={0.6} />
                <XAxis dataKey="year" tick={{ fill: "rgb(var(--muted))", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "rgb(var(--muted))", fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  cursor={{ fill: "rgb(var(--elevated))" }}
                  content={({ active, payload }) => active && payload?.length ? (
                    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-xl">
                      <div className="mb-1 text-muted">FY{payload[0].payload.year}</div>
                      <div className="num">Revenue ${payload[0].payload.revenue.toFixed(1)}B</div>
                      <div className="num">Net income ${payload[0].payload.netIncome.toFixed(1)}B</div>
                      <div className="num text-muted">Margin {pct(payload[0].payload.netIncome / payload[0].payload.revenue, 1, false)}</div>
                    </div>
                  ) : null}
                />
                <Bar dataKey="revenue" fill={colors[0]} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="netIncome" fill={colors[2]} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Page>
  );
}
