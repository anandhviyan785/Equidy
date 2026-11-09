import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Newspaper } from "lucide-react";
import { BY_SYMBOL } from "@/data/securities";
import { getIntel, METRIC_LABELS, PERCENT_METRICS, type CompanyIntel, type NewsItem } from "@/lib/live";
import { num, relTime } from "@/lib/format";

/** Headlines with source and age; links open in a new tab. */
export function NewsList({ items, empty = "No recent headlines." }: { items: NewsItem[]; empty?: string }) {
  if (!items.length) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="divide-y divide-line">
      {items.filter((n) => /^https?:\/\//i.test(n.url)).map((n) => (
        <li key={`${n.url}-${n.datetime}`} className="py-2.5">
          <a href={n.url} target="_blank" rel="noopener noreferrer" className="group block">
            <div className="flex items-start gap-1.5 text-sm font-medium leading-snug group-hover:underline">
              <span className="min-w-0 flex-1">{n.headline}</span>
              <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
            </div>
            <div className="mt-0.5 text-xs text-muted">
              {n.source}
              {n.datetime ? ` · ${relTime(n.datetime)}` : ""}
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}

function Ratings({ r }: { r: NonNullable<CompanyIntel["recommendation"]> }) {
  const parts = [
    { label: "Strong buy", n: r.strongBuy, cls: "bg-up" },
    { label: "Buy", n: r.buy, cls: "bg-up/60" },
    { label: "Hold", n: r.hold, cls: "bg-muted/50" },
    { label: "Sell", n: r.sell, cls: "bg-down/60" },
    { label: "Strong sell", n: r.strongSell, cls: "bg-down" },
  ];
  const total = parts.reduce((s, p) => s + p.n, 0);
  if (!total) return null;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <div className="label">Analyst ratings</div>
        <span className="text-xs text-muted">{total} analysts · {r.period}</span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-elevated">
        {parts.map((p) => p.n > 0 && <div key={p.label} className={p.cls} style={{ width: `${(p.n / total) * 100}%` }} title={`${p.label}: ${p.n}`} />)}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
        {parts.map((p) => (
          <span key={p.label}>
            {p.label} <b className="num text-fg">{p.n}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

const fmtMetric = (k: string, v: number) => (PERCENT_METRICS.has(k) ? `${num(v, 1)}%` : num(v, 2));

/** Finnhub intelligence for one company: ratings, key metrics, earnings surprises, peers and news. */
export function IntelPanel({ symbol }: { symbol: string }) {
  const [intel, setIntel] = useState<CompanyIntel | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    setIntel(undefined);
    void getIntel(symbol).then((i) => live && setIntel(i));
    return () => {
      live = false;
    };
  }, [symbol]);

  if (intel === undefined) return <div className="card p-5 text-sm text-muted">Loading market intelligence…</div>;
  if (!intel) return null;
  const metrics = Object.entries(intel.metrics);

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-3">
      <div className="card space-y-5 p-5">
        {intel.recommendation && <Ratings r={intel.recommendation} />}
        {metrics.length > 0 && (
          <div>
            <div className="label mb-2">Key metrics</div>
            <dl className="divide-y divide-line text-sm">
              {metrics.map(([k, v]) => (
                <div key={k} className="flex justify-between py-1.5">
                  <dt className="text-muted">{METRIC_LABELS[k] ?? k}</dt>
                  <dd className="num">{fmtMetric(k, v)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        {intel.earnings.length > 0 && (
          <div>
            <div className="label mb-2">Earnings per share</div>
            <table className="w-full text-sm">
              <thead className="text-xs text-muted">
                <tr><th className="py-1 text-left font-normal">Quarter</th><th className="text-right font-normal">Actual</th><th className="text-right font-normal">Est.</th><th className="text-right font-normal">Surprise</th></tr>
              </thead>
              <tbody>
                {intel.earnings.map((e) => (
                  <tr key={e.period} className="border-t border-line">
                    <td className="py-1.5">{e.period}</td>
                    <td className="num text-right">{e.actual === null ? "—" : num(e.actual, 2)}</td>
                    <td className="num text-right text-muted">{e.estimate === null ? "—" : num(e.estimate, 2)}</td>
                    <td className={`num text-right ${e.surprisePercent === null ? "" : e.surprisePercent >= 0 ? "text-up" : "text-down"}`}>
                      {e.surprisePercent === null ? "—" : `${e.surprisePercent >= 0 ? "+" : ""}${num(e.surprisePercent, 1)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {intel.peers.length > 0 && (
          <div>
            <div className="label mb-2">Peers</div>
            <div className="flex flex-wrap gap-1.5">
              {intel.peers.map((p) => (BY_SYMBOL[p] ? <Link key={p} to={`/symbol/${p}`} className="chip font-mono hover:bg-elevated">{p}</Link> : <span key={p} className="chip font-mono text-muted">{p}</span>))}
            </div>
          </div>
        )}
      </div>
      <div className="card p-5 lg:col-span-2">
        <div className="mb-1 flex items-center justify-between">
          <div className="label flex items-center gap-1.5"><Newspaper className="h-3.5 w-3.5" /> Latest news</div>
          <span className="text-[11px] text-muted">Finnhub</span>
        </div>
        <NewsList items={intel.news} empty="No headlines in the last week." />
      </div>
    </div>
  );
}
