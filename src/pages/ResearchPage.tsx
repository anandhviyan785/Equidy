import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Calculator, Building2, GraduationCap, Sparkles, ArrowRight } from "lucide-react";
import { SECURITIES } from "@/data/securities";
import { compound } from "@/lib/finance";
import { money, pct } from "@/lib/format";
import { Page, PageHeader, Segmented, Stat } from "@/components/ui";
import { GrowthChart, useSeriesColors } from "@/components/charts";
import { askEquidy } from "./ChatPage";

const TOPICS = [
  { title: "P/E ratio", q: "Explain the P/E ratio and how to use it" },
  { title: "ETFs vs mutual funds", q: "Explain ETFs and index funds" },
  { title: "Diversification", q: "Explain diversification and correlation" },
  { title: "Sharpe ratio", q: "Explain the Sharpe ratio" },
  { title: "Beta", q: "What does beta mean for a stock?" },
  { title: "How bonds work", q: "Explain how bonds work and why prices fall when rates rise" },
  { title: "Dividends", q: "Explain dividends, yield and payout ratio" },
  { title: "Dollar-cost averaging", q: "Explain dollar-cost averaging" },
  { title: "Retirement accounts", q: "Explain 401(k), IRA and Roth IRA accounts" },
  { title: "Inflation", q: "How does inflation affect my investments?" },
  { title: "Budgeting 50/30/20", q: "Explain the 50/30/20 budget and emergency funds" },
  { title: "Bear markets", q: "What happens in a bear market or recession?" },
];

type Tab = "Companies" | "Calculator" | "Learn";

export function ResearchPage() {
  const [tab, setTab] = useState<Tab>("Companies");
  const navigate = useNavigate();
  return (
    <Page wide>
      <PageHeader title="Financial Research" subtitle="Company fundamentals, planning tools and financial education." actions={<Segmented value={tab} options={["Companies", "Calculator", "Learn"] as const} onChange={setTab} />} />
      {tab === "Companies" && <Companies onAsk={(q) => askEquidy(navigate, q)} />}
      {tab === "Calculator" && <CompoundCalculator onAsk={(q) => askEquidy(navigate, q)} />}
      {tab === "Learn" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TOPICS.map((t) => (
            <button key={t.title} onClick={() => askEquidy(navigate, t.q)} className="card group flex items-center gap-3 p-4 text-left transition-colors hover:border-accent/40 hover:bg-elevated">
              <GraduationCap className="h-5 w-5 shrink-0 text-muted group-hover:text-accent" />
              <span className="flex-1">
                <span className="block text-sm font-medium">{t.title}</span>
                <span className="block text-xs text-muted">{t.q}</span>
              </span>
              <ArrowRight className="h-4 w-4 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          ))}
        </div>
      )}
    </Page>
  );
}

function Companies({ onAsk }: { onAsk: (q: string) => void }) {
  const list = SECURITIES.filter((s) => s.financials);
  const [sort, setSort] = useState<"Market cap" | "Growth" | "Margin" | "P/E">("Market cap");
  const rows = useMemo(() => {
    const withG = list.map((s) => {
      const f = s.financials!;
      const n = f.years.length - 1;
      return { s, growth: (f.revenue[n] / f.revenue[0]) ** (1 / n) - 1, margin: f.netIncome[n] / f.revenue[n] };
    });
    const key = { "Market cap": (r: (typeof withG)[number]) => -(r.s.marketCap ?? 0), Growth: (r: (typeof withG)[number]) => -r.growth, Margin: (r: (typeof withG)[number]) => -r.margin, "P/E": (r: (typeof withG)[number]) => r.s.pe ?? 999 }[sort];
    return withG.sort((a, b) => key(a) - key(b));
  }, [list, sort]);

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted" /><span className="label">Company screener</span></div>
        <Segmented value={sort} options={["Market cap", "Growth", "Margin", "P/E"] as const} onChange={setSort} size="xs" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-y border-line bg-elevated/50 text-left text-xs text-muted">
              <th className="px-5 py-2.5 font-medium">Company</th>
              <th className="px-4 py-2.5 text-right font-medium">Market cap</th>
              <th className="px-4 py-2.5 text-right font-medium">Revenue CAGR (4y)</th>
              <th className="px-4 py-2.5 text-right font-medium">Net margin</th>
              <th className="px-4 py-2.5 text-right font-medium">Op. margin</th>
              <th className="px-4 py-2.5 text-right font-medium">P/E</th>
              <th className="px-4 py-2.5 text-right font-medium">ROE</th>
              <th className="w-28 px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ s, growth, margin }) => (
              <tr key={s.symbol} className="border-b border-line last:border-0 hover:bg-elevated/40">
                <td className="px-5 py-3"><Link to={`/symbol/${s.symbol}`} className="hover:underline"><span className="font-mono text-xs font-semibold">{s.symbol}</span> <span className="text-muted">{s.name}</span></Link></td>
                <td className="num px-4 py-3 text-right">${s.marketCap?.toLocaleString()}B</td>
                <td className="num px-4 py-3 text-right">{pct(growth, 1)}</td>
                <td className="num px-4 py-3 text-right">{pct(margin, 1, false)}</td>
                <td className="num px-4 py-3 text-right">{s.financials!.operatingMargin}%</td>
                <td className="num px-4 py-3 text-right">{s.pe?.toFixed(1)}</td>
                <td className="num px-4 py-3 text-right">{s.financials!.roe}%</td>
                <td className="px-4 py-3 text-right">
                  <button className="btn-ghost px-2 py-1 text-xs" onClick={() => onAsk(`Analyze ${s.name}'s financial performance`)}><Sparkles className="h-3.5 w-3.5 text-accent" /> Analyze</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, suffix, step = 1 }: { label: string; value: number; onChange: (v: number) => void; suffix?: string; step?: number }) {
  return (
    <div>
      <label className="label mb-1.5 block">{label}</label>
      <div className="relative">
        <input type="number" step={step} min={0} className="input num pr-12" value={value} onChange={(e) => onChange(Math.max(0, Number(e.target.value)))} />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">{suffix}</span>}
      </div>
    </div>
  );
}

function CompoundCalculator({ onAsk }: { onAsk: (q: string) => void }) {
  const [principal, setPrincipal] = useState(10000);
  const [monthly, setMonthly] = useState(500);
  const [rate, setRate] = useState(7);
  const [years, setYears] = useState(30);
  const rows = useMemo(() => compound(principal, monthly, rate / 100, Math.min(60, Math.max(1, years))), [principal, monthly, rate, years]);
  const last = rows[rows.length - 1];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="card space-y-4 p-5">
        <div className="flex items-center gap-2"><Calculator className="h-4 w-4 text-muted" /><span className="label">Compound growth</span></div>
        <Field label="Initial investment" value={principal} onChange={setPrincipal} suffix="USD" step={1000} />
        <Field label="Monthly contribution" value={monthly} onChange={setMonthly} suffix="USD" step={50} />
        <Field label="Annual return" value={rate} onChange={setRate} suffix="%" step={0.5} />
        <Field label="Years" value={years} onChange={setYears} suffix="yrs" />
        <button className="btn-outline w-full" onClick={() => onAsk(`If I invest $${principal} plus $${monthly} per month at ${rate}% for ${years} years, how does compound interest grow it?`)}>
          <Sparkles className="h-4 w-4 text-accent" /> Explain this scenario
        </button>
      </div>
      <div className="space-y-4 lg:col-span-2">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Final balance" value={money(last.balance, { compact: true })} />
          <Stat label="Contributed" value={money(last.contributed, { compact: true })} />
          <Stat label="Growth" value={<span className="text-up">{money(last.interest, { compact: true })}</span>} sub={`${pct(last.interest / last.balance, 0, false)} of balance`} />
        </div>
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="label">Balance by year</div>
            <GrowthLegend />
          </div>
          <GrowthChart data={rows} />
        </div>
      </div>
    </div>
  );
}

function GrowthLegend() {
  const c = useSeriesColors();
  return (
    <div className="flex gap-3 text-xs text-muted">
      <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: c[0] }} />Contributed</span>
      <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: c[2] }} />Growth</span>
    </div>
  );
}
