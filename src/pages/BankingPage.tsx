import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Landmark, Plus, RefreshCw, Sparkles, Trash2, Download } from "lucide-react";
import { BY_SYMBOL } from "@/data/securities";
import { useAuth, usePortfolio } from "@/store";
import { connectBank, disconnectBank, loadBanking, resumeOAuthLink, useBanking, type BrokerageHolding, type Institution } from "@/lib/banking";
import { services } from "@/lib/live";
import type { Services } from "@/lib/ai";
import { cn } from "@/lib/format";
import { Empty, Page, PageHeader, Stat } from "@/components/ui";
import { askEquidy } from "./ChatPage";

function fmt(v: number | null, currency: string) {
  if (v === null) return "—";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(v);
  } catch {
    return `${v.toFixed(2)} ${currency}`;
  }
}

/** Sums balances per currency so mixed-currency accounts aren't added together. */
function totals(institutions: Institution[], types: string[]) {
  const m = new Map<string, number>();
  for (const a of institutions.flatMap((i) => i.accounts)) {
    if (types.includes(a.type) && a.current !== null) m.set(a.currency, (m.get(a.currency) ?? 0) + a.current);
  }
  return [...m.entries()];
}

const showTotals = (t: [string, number][]) => (t.length ? t.map(([c, v]) => fmt(v, c)).join(" · ") : "—");

export function BankingPage() {
  const user = useAuth((s) => s.user);
  const navigate = useNavigate();
  const { loaded, loading, error, institutions, transactions, holdings } = useBanking();
  const [svc, setSvc] = useState<Services | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void services().then(setSvc);
  }, []);

  useEffect(() => {
    if (!svc?.banking || user?.demo) return;
    void resumeOAuthLink()
      .then((linked) => {
        if (linked) {
          window.history.replaceState(null, "", "/banking");
          setNotice("Bank connected.");
        }
      })
      .catch((e) => setNotice((e as Error).message))
      .finally(() => void loadBanking());
  }, [svc, user?.demo]);

  const connect = async () => {
    setBusy(true);
    setNotice(null);
    try {
      if (await connectBank()) {
        setNotice("Bank connected. It can take a minute for transactions to appear.");
        await loadBanking();
      }
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const cash = useMemo(() => totals(institutions, ["depository"]), [institutions]);
  const credit = useMemo(() => totals(institutions, ["credit", "loan"]), [institutions]);
  const invest = useMemo(() => totals(institutions, ["investment", "brokerage"]), [institutions]);

  if (svc === undefined) return <Page><PageHeader title="Banking" /></Page>;
  if (!svc?.banking) {
    return (
      <Page>
        <PageHeader title="Banking" subtitle="Connect bank and brokerage accounts with Plaid." />
        <Empty icon={<Landmark className="h-6 w-6" />} title="Bank connections aren't set up yet" body="This server needs Plaid keys and a database before accounts can be linked." />
      </Page>
    );
  }
  if (user?.demo) {
    return (
      <Page>
        <PageHeader title="Banking" />
        <Empty icon={<Landmark className="h-6 w-6" />} title="Sign in to connect a bank" body="Bank connections are tied to your Equidy account." />
      </Page>
    );
  }

  const accounts = institutions.flatMap((i) => i.accounts);
  return (
    <Page wide>
      <PageHeader
        title="Banking"
        subtitle="Balances, spending and brokerage holdings from your linked accounts."
        actions={
          <>
            {accounts.length > 0 && (
              <button className="btn-outline" onClick={() => askEquidy(navigate, "Review my bank balances and spending over the last 30 days")}>
                <Sparkles className="h-4 w-4 text-accent" /> Analyze with AI
              </button>
            )}
            {institutions.length > 0 && (
              <button className="btn-ghost" onClick={() => void loadBanking()} disabled={loading} aria-label="Refresh">
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              </button>
            )}
            <button className="btn-primary" onClick={() => void connect()} disabled={busy}><Plus className="h-4 w-4" /> {busy ? "Connecting…" : "Connect a bank"}</button>
          </>
        }
      />
      {svc.bankingEnv === "sandbox" && (
        <p className="mb-4 rounded-xl bg-elevated px-3 py-2 text-xs text-muted">Test mode (Plaid sandbox): pick any bank and sign in with <b>user_good</b> / <b>pass_good</b>. No real accounts are connected.</p>
      )}
      {notice && <p className="mb-4 rounded-xl border border-line px-3 py-2 text-sm">{notice}</p>}
      {error && <p className="mb-4 rounded-xl border border-down/40 px-3 py-2 text-sm text-down">{error}</p>}

      {loaded && !institutions.length ? (
        <Empty
          icon={<Landmark className="h-6 w-6" />}
          title="No banks connected"
          body="Link a bank, card or brokerage account to see balances and spending here, and let Equidy factor them into its answers."
          action={<button className="btn-primary" onClick={() => void connect()} disabled={busy}><Plus className="h-4 w-4" />Connect a bank</button>}
        />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label="Cash" value={showTotals(cash)} />
            <Stat label="Credit & loans owed" value={showTotals(credit)} />
            <Stat label="Investment accounts" value={showTotals(invest)} />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-4">
              {institutions.map((i) => <InstitutionCard key={i.itemId} inst={i} />)}
            </div>
            <div className="card p-5 lg:col-span-2">
              <div className="label mb-2">Recent transactions (30 days)</div>
              {transactions.length === 0 ? (
                <p className="text-sm text-muted">{loading ? "Loading…" : "No transactions yet. New connections can take a few minutes."}</p>
              ) : (
                <ul className="divide-y divide-line text-sm">
                  {transactions.slice(0, 40).map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <div className="truncate">{t.name}</div>
                        <div className="text-xs capitalize text-muted">{t.date} · {t.category}{t.pending ? " · pending" : ""}</div>
                      </div>
                      <div className={cn("num shrink-0", t.amount < 0 ? "text-up" : "")}>{fmt(-t.amount, t.currency)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          {holdings.length > 0 && <HoldingsCard holdings={holdings} />}
        </>
      )}
    </Page>
  );
}

function InstitutionCard({ inst }: { inst: Institution }) {
  const [confirm, setConfirm] = useState(false);
  const [removing, setRemoving] = useState(false);
  const remove = async () => {
    setRemoving(true);
    try {
      await disconnectBank(inst.itemId);
      await loadBanking();
    } catch (e) {
      useBanking.getState().set({ error: (e as Error).message });
      setRemoving(false);
    }
  };
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="font-medium">{inst.institution}</div>
        {confirm ? (
          <div className="flex gap-1">
            <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setConfirm(false)} disabled={removing}>Cancel</button>
            <button className="btn-ghost px-2 py-1 text-xs text-down" onClick={() => void remove()} disabled={removing}>{removing ? "Removing…" : "Remove"}</button>
          </div>
        ) : (
          <button className="btn-ghost p-1.5" onClick={() => setConfirm(true)} aria-label={`Disconnect ${inst.institution}`}><Trash2 className="h-4 w-4" /></button>
        )}
      </div>
      {inst.error && <p className="text-xs text-down">{inst.error}</p>}
      <ul className="divide-y divide-line text-sm">
        {inst.accounts.map((a) => (
          <li key={a.id} className="flex justify-between gap-3 py-1.5">
            <div className="min-w-0">
              <div className="truncate">{a.name}{a.mask ? <span className="text-muted"> ··{a.mask}</span> : null}</div>
              <div className="text-xs capitalize text-muted">{a.subtype ?? a.type}</div>
            </div>
            <div className="text-right">
              <div className="num">{fmt(a.current, a.currency)}</div>
              {a.available !== null && a.available !== a.current && <div className="num text-xs text-muted">{fmt(a.available, a.currency)} available</div>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HoldingsCard({ holdings }: { holdings: BrokerageHolding[] }) {
  const { holdings: mine, addHolding } = usePortfolio();
  const [done, setDone] = useState<string | null>(null);
  const supported = holdings.filter((h) => h.ticker && BY_SYMBOL[h.ticker] && h.quantity > 0);
  const owned = new Set(mine.map((h) => h.symbol));
  const importable = supported.filter((h) => !owned.has(h.ticker!));

  const importAll = () => {
    for (const h of importable) {
      const perShare = h.costBasis && h.quantity ? h.costBasis / h.quantity : h.price ?? 0;
      addHolding({ symbol: h.ticker!, shares: h.quantity, costBasis: perShare });
    }
    setDone(`Added ${importable.length} holding${importable.length === 1 ? "" : "s"} to your portfolio.`);
  };

  return (
    <div className="card mt-4 p-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="label">Brokerage holdings</div>
        {importable.length > 0 && <button className="btn-outline text-sm" onClick={importAll}><Download className="h-4 w-4" /> Add {importable.length} to portfolio</button>}
      </div>
      {done && <p className="mb-2 text-sm text-muted">{done}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted">
            <tr><th className="py-1 text-left font-normal">Security</th><th className="text-right font-normal">Quantity</th><th className="text-right font-normal">Value</th><th className="text-right font-normal">In Equidy</th></tr>
          </thead>
          <tbody>
            {holdings.map((h, i) => (
              <tr key={`${h.ticker ?? h.name}-${i}`} className="border-t border-line">
                <td className="py-1.5">{h.ticker && <span className="mr-1.5 font-mono">{h.ticker}</span>}<span className="text-muted">{h.name}</span></td>
                <td className="num text-right">{h.quantity}</td>
                <td className="num text-right">{fmt(h.value, h.currency)}</td>
                <td className="text-right text-xs text-muted">{h.ticker && owned.has(h.ticker) ? "In portfolio" : h.ticker && BY_SYMBOL[h.ticker] ? "Can add" : "Not tracked"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
