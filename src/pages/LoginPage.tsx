import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Info, Loader2 } from "lucide-react";
import { INDICES } from "@/data/securities";
import { history } from "@/lib/market";
import { demoSignIn, loadAuth, providerLabel, startOAuth, type AuthInfo } from "@/lib/auth";
import { useAuth, useMarket, type ProviderId } from "@/store";
import { useLiveTicks, useThemeSync } from "@/hooks";
import { Change, Logo } from "@/components/ui";
import { Sparkline } from "@/components/charts";
import { price } from "@/lib/format";

const ORDER: ProviderId[] = ["apple", "google", "microsoft"];

export function LoginPage() {
  useThemeSync();
  useLiveTicks();
  const user = useAuth((s) => s.user);
  const navigate = useNavigate();
  const location = useLocation();
  const [info, setInfo] = useState<AuthInfo | null>(null);
  const [pending, setPending] = useState<ProviderId | null>(null);
  const error = useMemo(() => new URLSearchParams(location.search).get("error"), [location.search]);

  useEffect(() => { loadAuth().then(setInfo); }, []);
  if (user) return <Navigate to="/" replace />;

  const anyReal = info && Object.values(info.providers).some(Boolean);
  const choose = (p: ProviderId) => {
    if (!info) return;
    setPending(p);
    if (info.providers[p]) startOAuth(p);
    else {
      demoSignIn(p);
      navigate("/", { replace: true });
    }
  };

  return (
    <div className="flex min-h-full flex-col bg-bg lg:flex-row">
      <section className="flex flex-1 flex-col px-6 py-8 sm:px-10">
        <Logo className="self-start" />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12 animate-fade-up">
          <h1 className="text-balance text-3xl font-semibold tracking-tight">Welcome to Equidy</h1>
          <p className="mt-2 text-[15px] text-muted">Sign in to analyse your portfolio, track markets and ask anything about your finances.</p>

          {error && (
            <div role="alert" className="mt-6 rounded-xl border border-down/40 bg-down/10 px-3.5 py-2.5 text-sm text-down">{error}</div>
          )}

          <div className="mt-8 space-y-3">
            {ORDER.map((p) => {
              const unavailable = info?.online && anyReal && !info.providers[p];
              return (
                <button
                  key={p}
                  onClick={() => choose(p)}
                  disabled={!info || !!pending || !!unavailable}
                  className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-line bg-surface text-[15px] font-medium transition-colors hover:bg-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:opacity-50"
                >
                  {pending === p ? <Loader2 className="h-5 w-5 animate-spin" /> : <ProviderIcon p={p} />}
                  Continue with {providerLabel(p)}
                  {unavailable && <span className="text-xs text-muted">(not set up)</span>}
                </button>
              );
            })}
          </div>

          {info && !anyReal && (
            <div className="mt-6 flex gap-2.5 rounded-xl border border-line bg-elevated/60 px-3.5 py-3 text-xs leading-relaxed text-muted">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <b className="font-medium text-fg">Demo mode.</b> Sign-in providers aren't configured{info.online ? " on this server" : " in this preview"}, so any button opens a local demo account. No Apple, Google or Microsoft account is contacted.
              </span>
            </div>
          )}

          <p className="mt-8 text-xs leading-relaxed text-muted">
            By continuing you agree to Equidy's Terms of Service and Privacy Policy. Equidy provides financial information and education, not investment advice.
          </p>
        </div>
      </section>
      <MarketPanel />
    </div>
  );
}

function MarketPanel() {
  const prices = useMarket((s) => s.prices);
  const rows = INDICES.slice(0, 4);
  return (
    <aside className="relative hidden flex-1 overflow-hidden border-l border-line bg-surface lg:flex lg:flex-col lg:justify-center lg:px-14">
      <div className="max-w-md">
        <div className="label">Markets now</div>
        <p className="mt-3 text-balance text-4xl font-semibold leading-tight tracking-tight">Your financial intelligence, reimagined.</p>
        <div className="mt-10 divide-y divide-line rounded-2xl border border-line bg-bg">
          {rows.map((i) => {
            const p = prices[i.symbol];
            const spark = history(i.symbol, i.price, i.vol, i.drift, 1).slice(-40, -1).map((b) => b.close);
            return (
              <div key={i.symbol} className="flex items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{i.name}</div>
                  <div className="num text-xs text-muted">{price(p.price)}</div>
                </div>
                <Sparkline data={[...spark, p.price]} width={96} height={28} />
                <Change value={p.price / p.prevClose - 1} className="w-16 text-right text-sm" />
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-muted">Simulated market data.</p>
      </div>
    </aside>
  );
}

function ProviderIcon({ p }: { p: ProviderId }) {
  if (p === "apple")
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
        <path d="M16.37 12.62c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.48.83-.72 0-1.83-.81-3-.79-1.55.02-2.97.9-3.77 2.28-1.6 2.78-.41 6.9 1.15 9.16.77 1.1 1.68 2.34 2.87 2.3 1.15-.05 1.59-.75 2.98-.75 1.39 0 1.78.75 3 .72 1.24-.02 2.02-1.12 2.78-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.4-.92-2.42-3.68ZM14.1 5.86c.64-.77 1.07-1.84.95-2.91-.92.04-2.03.61-2.69 1.38-.59.68-1.11 1.77-.97 2.82 1.03.08 2.07-.52 2.71-1.29Z" />
      </svg>
    );
  if (p === "google")
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
        <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.57-5.17 3.57-8.81Z" />
        <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.11A12 12 0 0 0 12 24Z" />
        <path fill="#FBBC05" d="M5.29 14.29a7.2 7.2 0 0 1 0-4.58V6.6H1.28a12 12 0 0 0 0 10.8l4.01-3.11Z" />
        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44A11.53 11.53 0 0 0 12 0 12 12 0 0 0 1.28 6.6l4.01 3.11C6.23 6.86 8.88 4.75 12 4.75Z" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="#F25022" d="M1 1h10.5v10.5H1z" />
      <path fill="#7FBA00" d="M12.5 1H23v10.5H12.5z" />
      <path fill="#00A4EF" d="M1 12.5h10.5V23H1z" />
      <path fill="#FFB900" d="M12.5 12.5H23V23H12.5z" />
    </svg>
  );
}
