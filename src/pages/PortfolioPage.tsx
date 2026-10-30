import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, Sparkles, Briefcase, ArrowUpDown } from "lucide-react";
import { BY_SYMBOL, type Security } from "@/data/securities";
import { useMarket, usePortfolio } from "@/store";
import { allocationBy, benchmarkHistory, portfolioHistory, positions, summarize, type Holding, type PositionView } from "@/lib/finance";
import { RANGES, sliceRange, type Range } from "@/lib/market";
import { cn, money, pct, price, tone } from "@/lib/format";
import { Change, Empty, Modal, Page, PageHeader, Segmented, Stat } from "@/components/ui";
import { Donut, PriceChart } from "@/components/charts";
import { SymbolSearch } from "@/components/SymbolSearch";
import { askEquidy } from "./ChatPage";

type SortKey = "value" | "pnlPct" | "dayChangePct" | "symbol";

export function PortfolioPage() {
  const holdings = usePortfolio((s) => s.holdings);
  const { removeHolding } = usePortfolio();
  const prices = useMarket((s) => s.prices);
  const navigate = useNavigate();
  const [range, setRange] = useState<Range>("1Y");
  const [allocBy, setAllocBy] = useState<"Sector" | "Holding">("Sector");
  const [compare, setCompare] = useState(false);
  const [modal, setModal] = useState<{ mode: "add" } | { mode: "edit"; h: Holding } | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "value", dir: -1 });

  const rows = useMemo(() => positions(holdings, prices), [holdings, prices]);
  const total = summarize(rows);
  const hist = useMemo(() => portfolioHistory(holdings), [holdings]);
  const bench = useMemo(() => benchmarkHistory(), []);
  const series = useMemo(() => {
    if (!hist.length) return [];
    const s = sliceRange(hist, range === "1D" ? "1W" : range);
    // Replace the final point with the live value so the chart matches the header.
    return [...s.slice(0, -1), { t: Date.now(), close: total.value }];
  }, [hist, range, total.value]);
  const sorted = useMemo(
    () => [...rows].sort((a, b) => (sort.key === "symbol" ? a.symbol.localeCompare(b.symbol) : a[sort.key] - b[sort.key]) * sort.dir),
    [rows, sort],
  );
  const rangeChange = series.length > 1 ? series[series.length - 1].close / series[0].close - 1 : 0;

  return (
    <Page wide>
      <PageHeader
        title="Portfolio"
        subtitle="Track holdings, performance and allocation in real time."
        actions={
          <>
            <button className="btn-outline" onClick={() => askEquidy(navigate, "Analyze my investment portfolio")}>
              <Sparkles className="h-4 w-4 text-accent" /> Analyze with AI
            </button>
            <button className="btn-primary" onClick={() => setModal({ mode: "add" })}><Plus className="h-4 w-4" /> Add holding</button>
          </>
        }
      />

      {rows.length === 0 ? (
        <Empty icon={<Briefcase className="h-6 w-6" />} title="No holdings yet" body="Add your first position to see performance, allocation and AI-powered insights." action={<button className="btn-primary" onClick={() => setModal({ mode: "add" })}><Plus className="h-4 w-4" />Add holding</button>} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Total value" value={money(total.value)} sub={`${rows.length} positions`} />
            <Stat label="Today" value={<span className={tone(total.dayChange)}>{money(total.dayChange, { sign: true })}</span>} sub={<Change value={total.dayChangePct} />} />
            <Stat label="Unrealised P/L" value={<span className={tone(total.pnl)}>{money(total.pnl, { sign: true })}</span>} sub={<Change value={total.pnlPct} />} />
            <Stat label="Cost basis" value={money(total.cost)} sub="Total invested" />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="card p-5 lg:col-span-2">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="label">Performance</div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="num text-lg font-semibold">{money(total.value)}</span>
                    <Change value={rangeChange} className="text-sm" />
                    <span className="text-xs text-muted">{range}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className={cn("chip transition-colors", compare && "border-accent/50 text-fg")} onClick={() => setCompare((c) => !c)}>vs S&P 500</button>
                  <Segmented value={range} options={RANGES.filter((r) => r !== "1D")} onChange={setRange} size="xs" />
                </div>
              </div>
              <PriceChart data={series} valueFormat="money" height={290} compare={compare ? { label: "SPY", data: sliceRange(bench, range).slice(-series.length) } : undefined} />
            </div>
            <div className="card p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="label">Allocation</div>
                <Segmented value={allocBy} options={["Sector", "Holding"] as const} onChange={setAllocBy} size="xs" />
              </div>
              <Donut data={allocBy === "Sector" ? allocationBy(rows, "sector") : allocationBy(rows, "symbol")} height={180} />
            </div>
          </div>

          <div className="card mt-4 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="label">Holdings</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-y border-line bg-elevated/50 text-left text-xs text-muted">
                    <Th onClick={() => setSort({ key: "symbol", dir: sort.key === "symbol" ? (-sort.dir as 1 | -1) : 1 })}>Asset</Th>
                    <th className="px-4 py-2.5 text-right font-medium">Shares</th>
                    <th className="px-4 py-2.5 text-right font-medium">Avg cost</th>
                    <th className="px-4 py-2.5 text-right font-medium">Price</th>
                    <Th right onClick={() => setSort({ key: "dayChangePct", dir: (-sort.dir) as 1 | -1 })}>Today</Th>
                    <Th right onClick={() => setSort({ key: "value", dir: (-sort.dir) as 1 | -1 })}>Value</Th>
                    <Th right onClick={() => setSort({ key: "pnlPct", dir: (-sort.dir) as 1 | -1 })}>P/L</Th>
                    <th className="px-4 py-2.5 text-right font-medium">Weight</th>
                    <th className="w-20 px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => <Row key={r.id} r={r} onEdit={() => setModal({ mode: "edit", h: r })} onDelete={() => removeHolding(r.id)} />)}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <HoldingModal state={modal} onClose={() => setModal(null)} />
    </Page>
  );
}

function Th({ children, onClick, right }: { children: React.ReactNode; onClick: () => void; right?: boolean }) {
  return (
    <th className={cn("px-4 py-2.5 font-medium", right && "text-right")}>
      <button onClick={onClick} className={cn("inline-flex items-center gap-1 hover:text-fg", right && "flex-row-reverse")}>
        {children} <ArrowUpDown className="h-3 w-3 opacity-60" />
      </button>
    </th>
  );
}

function Row({ r, onEdit, onDelete }: { r: PositionView; onEdit: () => void; onDelete: () => void }) {
  return (
    <tr className="group border-b border-line last:border-0 hover:bg-elevated/40">
      <td className="px-4 py-3">
        <Link to={`/symbol/${r.symbol}`} className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-elevated font-mono text-[10px] font-semibold">{r.symbol.slice(0, 4)}</span>
          <span className="min-w-0">
            <span className="block font-medium">{r.symbol}</span>
            <span className="block max-w-[180px] truncate text-xs text-muted">{r.name}</span>
          </span>
        </Link>
      </td>
      <td className="num px-4 py-3 text-right">{r.shares}</td>
      <td className="num px-4 py-3 text-right text-muted">{price(r.costBasis)}</td>
      <td className="num px-4 py-3 text-right">{price(r.price)}</td>
      <td className="px-4 py-3 text-right"><Change value={r.dayChangePct} /></td>
      <td className="num px-4 py-3 text-right font-medium">{money(r.value)}</td>
      <td className="px-4 py-3 text-right">
        <div className={cn("num", tone(r.pnl))}>{money(r.pnl, { sign: true })}</div>
        <Change value={r.pnlPct} className="text-xs" />
      </td>
      <td className="px-4 py-3 text-right">
        <div className="num">{pct(r.weight, 1, false)}</div>
        <div className="ml-auto mt-1 h-1 w-16 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-accent" style={{ width: `${r.weight * 100}%` }} /></div>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 max-lg:opacity-100">
          <button className="btn-ghost p-1.5" onClick={onEdit} aria-label={`Edit ${r.symbol}`}><Pencil className="h-3.5 w-3.5" /></button>
          <button className="btn-ghost p-1.5 hover:text-down" onClick={onDelete} aria-label={`Remove ${r.symbol}`}><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </td>
    </tr>
  );
}

function HoldingModal({ state, onClose }: { state: { mode: "add" } | { mode: "edit"; h: Holding } | null; onClose: () => void }) {
  return (
    <Modal open={!!state} onClose={onClose} title={state?.mode === "edit" ? `Edit ${state.h.symbol}` : "Add holding"}>
      {state && <HoldingForm key={state.mode === "edit" ? state.h.id : "new"} state={state} onDone={onClose} />}
    </Modal>
  );
}

function HoldingForm({ state, onDone }: { state: { mode: "add" } | { mode: "edit"; h: Holding }; onDone: () => void }) {
  const { addHolding, updateHolding } = usePortfolio();
  const prices = useMarket((s) => s.prices);
  const edit = state.mode === "edit" ? state.h : null;
  const [sec, setSec] = useState<Security | null>(edit ? BY_SYMBOL[edit.symbol] : null);
  const [shares, setShares] = useState(edit ? String(edit.shares) : "");
  const [cost, setCost] = useState(edit ? String(edit.costBasis) : "");
  const valid = sec && Number(shares) > 0 && Number(cost) > 0;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid || !sec) return;
        if (edit) updateHolding(edit.id, { shares: Number(shares), costBasis: Number(cost) });
        else addHolding({ symbol: sec.symbol, shares: Number(shares), costBasis: Number(cost) });
        onDone();
      }}
    >
      {!edit && (
        <div>
          <label className="label mb-1.5 block">Asset</label>
          {sec ? (
            <div className="flex items-center justify-between rounded-xl border border-line bg-elevated px-3 py-2 text-sm">
              <span><span className="font-mono font-semibold">{sec.symbol}</span> <span className="text-muted">· {sec.name}</span></span>
              <button type="button" className="text-xs text-accent" onClick={() => setSec(null)}>Change</button>
            </div>
          ) : (
            <SymbolSearch autoFocus onPick={(s) => { setSec(s); setCost(prices[s.symbol].price.toFixed(2)); }} />
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label mb-1.5 block" htmlFor="shares">Shares</label>
          <input id="shares" className="input num" inputMode="decimal" value={shares} onChange={(e) => setShares(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0" />
        </div>
        <div>
          <label className="label mb-1.5 block" htmlFor="cost">Avg cost / share</label>
          <input id="cost" className="input num" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0.00" />
        </div>
      </div>
      {valid && sec && (
        <div className="rounded-xl bg-elevated px-3 py-2.5 text-xs text-muted">
          Position value <span className="num font-medium text-fg">{money(Number(shares) * prices[sec.symbol].price)}</span> · cost{" "}
          <span className="num text-fg">{money(Number(shares) * Number(cost))}</span>
        </div>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn-ghost" onClick={onDone}>Cancel</button>
        <button className="btn-primary" disabled={!valid}>{edit ? "Save changes" : "Add to portfolio"}</button>
      </div>
    </form>
  );
}
