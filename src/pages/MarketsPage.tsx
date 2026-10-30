import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Star } from "lucide-react";
import { INDICES, SECURITIES, type Sector } from "@/data/securities";
import { history, intraday, sliceRange, RANGES, type Range } from "@/lib/market";
import { useMarket, usePortfolio } from "@/store";
import { cn, price } from "@/lib/format";
import { Change, ChangePill, Page, PageHeader, Segmented } from "@/components/ui";
import { PriceChart, ReturnBars, Sparkline } from "@/components/charts";
import { SymbolSearch } from "@/components/SymbolSearch";

export function MarketsPage() {
  const navigate = useNavigate();
  const prices = useMarket((s) => s.prices);
  const [sel, setSel] = useState(INDICES[0].symbol);
  const [range, setRange] = useState<Range>("3M");
  const [filter, setFilter] = useState<"All" | Sector>("All");
  const idx = INDICES.find((i) => i.symbol === sel)!;
  const p = prices[sel];

  const series = useMemo(() => {
    if (range === "1D") return intraday(sel, p.prevClose, p.price, idx.vol);
    const s = sliceRange(history(sel, idx.price, idx.vol, idx.drift, 1), range);
    return [...s.slice(0, -1), { t: Date.now(), close: p.price }];
  }, [sel, range, p.price, p.prevClose, idx]);

  const stocks = SECURITIES.map((s) => ({ s, p: prices[s.symbol], ch: prices[s.symbol].price / prices[s.symbol].prevClose - 1 }));
  const movers = stocks.filter((x) => x.s.sector !== "ETF").sort((a, b) => b.ch - a.ch);
  const sectors = useMemo(() => {
    const m = new Map<string, number[]>();
    stocks.filter((x) => !["ETF", "Crypto"].includes(x.s.sector)).forEach((x) => m.set(x.s.sector, [...(m.get(x.s.sector) ?? []), x.ch]));
    return [...m.entries()].map(([name, v]) => ({ name, value: v.reduce((a, b) => a + b, 0) / v.length })).sort((a, b) => b.value - a.value);
  }, [stocks]);
  const sectorOptions = ["All", ...new Set(SECURITIES.map((s) => s.sector))] as ("All" | Sector)[];

  return (
    <Page wide>
      <PageHeader title="Markets" subtitle="Indices, sectors and movers across equities, ETFs and crypto." />
      <div className="mb-5 max-w-xl">
        <SymbolSearch onPick={(sec) => navigate(`/symbol/${sec.symbol}`)} placeholder="Search stocks, ETFs or crypto by name or ticker…" />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {INDICES.map((i) => {
          const ip = prices[i.symbol];
          const spark = history(i.symbol, i.price, i.vol, i.drift, 1).slice(-30).map((b) => b.close);
          return (
            <button key={i.symbol} onClick={() => setSel(i.symbol)} className={cn("card p-3.5 text-left transition-colors hover:bg-elevated", sel === i.symbol && "border-accent/50 bg-elevated")}>
              <div className="text-xs text-muted">{i.name}</div>
              <div className="num mt-1 font-semibold">{price(ip.price)}</div>
              <div className="mt-1 flex items-end justify-between">
                <Change value={ip.price / ip.prevClose - 1} className="text-xs" />
                <Sparkline data={[...spark.slice(0, -1), ip.price]} width={56} height={22} />
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="label">{idx.name}</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="num text-2xl font-semibold">{price(p.price)}</span>
                <Change value={series[series.length - 1].close / series[0].close - 1} />
                <span className="text-xs text-muted">{range}</span>
              </div>
            </div>
            <Segmented value={range} options={RANGES} onChange={setRange} size="xs" />
          </div>
          <PriceChart data={series} intraday={range === "1D"} height={300} />
        </div>
        <div className="card p-5">
          <div className="label mb-4">Sector performance · today</div>
          <ReturnBars data={sectors} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <MoverList title="Top gainers" items={movers.slice(0, 5)} />
        <MoverList title="Top decliners" items={movers.slice(-5).reverse()} />
      </div>

      <div className="card mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="label">All securities</div>
          <select className="input h-9 w-auto" value={filter} onChange={(e) => setFilter(e.target.value as "All" | Sector)} aria-label="Filter by sector">
            {sectorOptions.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <SecurityTable items={stocks.filter((x) => filter === "All" || x.s.sector === filter)} />
      </div>
    </Page>
  );
}

function MoverList({ title, items }: { title: string; items: { s: (typeof SECURITIES)[number]; p: { price: number }; ch: number }[] }) {
  return (
    <div className="card p-5">
      <div className="label mb-3">{title}</div>
      <ul className="divide-y divide-line">
        {items.map(({ s, p, ch }) => (
          <li key={s.symbol}>
            <Link to={`/symbol/${s.symbol}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-elevated">
              <span className="w-14 font-mono text-xs font-semibold">{s.symbol}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-muted">{s.name}</span>
              <span className="num text-sm">{price(p.price)}</span>
              <ChangePill value={ch} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SecurityTable({ items }: { items: { s: (typeof SECURITIES)[number]; p: { price: number; prevClose: number }; ch: number }[] }) {
  const watchlist = usePortfolio((s) => s.watchlist);
  const toggleWatch = usePortfolio((s) => s.toggleWatch);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-sm">
        <thead>
          <tr className="border-y border-line bg-elevated/50 text-left text-xs text-muted">
            <th className="w-10 px-4 py-2.5" />
            <th className="px-2 py-2.5 font-medium">Symbol</th>
            <th className="px-4 py-2.5 font-medium">Sector</th>
            <th className="px-4 py-2.5 text-right font-medium">Price</th>
            <th className="px-4 py-2.5 text-right font-medium">Change</th>
            <th className="px-4 py-2.5 text-right font-medium">P/E</th>
            <th className="px-4 py-2.5 text-right font-medium">1M trend</th>
          </tr>
        </thead>
        <tbody>
          {items.map(({ s, p, ch }) => {
            const watched = watchlist.includes(s.symbol);
            return (
              <tr key={s.symbol} className="border-b border-line last:border-0 hover:bg-elevated/40">
                <td className="px-4 py-2.5">
                  <button onClick={() => toggleWatch(s.symbol)} aria-label={watched ? `Remove ${s.symbol} from watchlist` : `Add ${s.symbol} to watchlist`}>
                    <Star className={cn("h-4 w-4", watched ? "fill-accent text-accent" : "text-muted hover:text-fg")} />
                  </button>
                </td>
                <td className="px-2 py-2.5">
                  <Link to={`/symbol/${s.symbol}`} className="hover:underline">
                    <span className="font-mono text-xs font-semibold">{s.symbol}</span>
                    <span className="ml-2 text-muted">{s.name}</span>
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-muted">{s.sector}</td>
                <td className="num px-4 py-2.5 text-right">{price(p.price)}</td>
                <td className="px-4 py-2.5 text-right"><ChangePill value={ch} /></td>
                <td className="num px-4 py-2.5 text-right text-muted">{s.pe?.toFixed(1) ?? "—"}</td>
                <td className="px-4 py-2.5"><div className="flex justify-end"><Sparkline data={[...history(s.symbol, s.price, s.vol, s.drift, s.beta).slice(-22, -1).map((b) => b.close), p.price]} width={80} height={24} /></div></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
