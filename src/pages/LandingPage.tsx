import { useEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, Briefcase, ChevronDown, GraduationCap, MessageSquare, Scale, type LucideIcon } from "lucide-react";
import logoUrl from "@/assets/logo-block.png";
import { ConsentBanner } from "@/components/ConsentBanner";
import { useAuth } from "@/store";
import { cn } from "@/lib/format";

// The public landing page. It is always dark, and its numbers are illustrative examples, never live data.

const delay = (ms: number) => ({ "--reveal-delay": `${ms}ms` }) as CSSProperties;

/** Fades sections in as they scroll into view. Everything is shown at once if motion is reduced. */
function useReveal(root: RefObject<HTMLElement>) {
  useEffect(() => {
    const nodes = Array.from(root.current?.querySelectorAll<HTMLElement>("[data-reveal]") ?? []);
    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      nodes.forEach((n) => n.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.12 },
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [root]);
}

// ---------------- illustrative chart ----------------

const CHART = [44, 47, 46, 52, 50, 56, 54, 58, 55, 52, 54, 49, 47, 50, 46, 45, 46, 43];
const W = 320;
const H = 96;
const LOW = Math.min(...CHART);
const HIGH = Math.max(...CHART);
const POINTS = CHART.map((v, i) => [(i / (CHART.length - 1)) * W, H - 8 - ((v - LOW) / (HIGH - LOW)) * (H - 16)] as const);
const LINE = POINTS.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
const AREA = `${LINE} L${W} ${H} L0 ${H} Z`;

const ALLOCATION: [string, number][] = [["Technology", 52], ["Financials", 21], ["Healthcare", 14], ["Other", 13]];

function MoveRow({ label, detail, value, down = false }: { label: string; detail: string; value: string; down?: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-2xl bg-elevated px-4 py-3">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted">{detail}</span>
      </span>
      <span className={cn("num text-sm font-semibold", down ? "text-down" : "text-up")}>{value}</span>
    </li>
  );
}

function ProductPreview() {
  return (
    <div className="card mx-auto mt-14 max-w-5xl overflow-hidden text-left sm:mt-20" data-reveal style={delay(160)}>
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <img src={logoUrl} alt="" className="h-5 w-5" />
        <span className="chip">Example screen with illustrative numbers</span>
      </div>
      <div className="grid gap-px bg-line md:grid-cols-5">
        <div className="space-y-4 bg-surface p-5 sm:p-6 md:col-span-3">
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-elevated px-4 py-2.5 text-[15px]">Why is my portfolio down this month?</div>
          </div>
          <div className="text-[15px] leading-relaxed">
            <p>Your portfolio is down about 2.1% this month, mostly because of your technology holdings. Here is what moved it:</p>
            <ul className="mt-3 space-y-2">
              <MoveRow label="Technology" detail="52% of your portfolio" value="−3.4%" down />
              <MoveRow label="Financials" detail="21% of your portfolio" value="+1.2%" />
              <MoveRow label="Healthcare" detail="14% of your portfolio" value="+0.4%" />
            </ul>
            <p className="mt-3 text-sm text-muted">Swings like this are common when one sector dominates. Want me to explain diversification?</p>
          </div>
        </div>
        <div className="bg-surface p-5 sm:p-6 md:col-span-2">
          <div className="label">Portfolio value</div>
          <div className="num mt-2 text-3xl font-semibold tracking-[-0.02em]">$48,210</div>
          <div className="num mt-1 text-sm text-down">−2.1% this month</div>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-5 h-24 w-full" role="img" aria-label="Example portfolio chart, down slightly this month">
            <defs>
              <linearGradient id="landing-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: "rgb(var(--down))", stopOpacity: 0.22 }} />
                <stop offset="100%" style={{ stopColor: "rgb(var(--down))", stopOpacity: 0 }} />
              </linearGradient>
            </defs>
            <path d={AREA} fill="url(#landing-fill)" />
            <path d={LINE} className="fill-none stroke-down" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          <ul className="mt-5 space-y-3">
            {ALLOCATION.map(([name, share]) => (
              <li key={name}>
                <div className="flex justify-between text-xs"><span className="text-muted">{name}</span><span className="num">{share}%</span></div>
                <div className="mt-1.5 h-1.5 rounded-full bg-elevated"><div className="h-full rounded-full bg-fg" style={{ width: `${share}%` }} /></div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ---------------- sections ----------------

function Nav({ signedIn }: { signedIn: boolean }) {
  const link = "rounded-full px-3 py-1.5 text-sm text-muted transition-colors hover:text-fg";
  return (
    <header className="sticky top-3 z-40 px-3 pt-3 sm:px-6">
      <nav aria-label="Main" className="glass mx-auto flex max-w-5xl items-center justify-between rounded-full border py-2 pl-4 pr-2">
        <a href="#top" aria-label="Equidy home" className="flex items-center rounded-lg">
          <img src={logoUrl} alt="" className="h-7 w-7" />
        </a>
        <div className="hidden items-center gap-1 md:flex">
          <a href="#features" className={link}>Features</a>
          <a href="#how" className={link}>How it works</a>
          <a href="#faq" className={link}>FAQ</a>
        </div>
        <div className="flex items-center gap-1">
          {!signedIn && <Link to="/login" className="btn-ghost max-sm:hidden">Sign in</Link>}
          <Link to={signedIn ? "/" : "/login"} className="btn-primary">{signedIn ? "Open Equidy" : "Get started"}</Link>
        </div>
      </nav>
    </header>
  );
}

function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="relative px-4 pb-16 pt-16 sm:px-6 sm:pt-24 lg:pt-28">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[620px] bg-[radial-gradient(60%_60%_at_50%_0%,rgb(255_255_255/0.13),transparent_70%)]" />
      <div className="relative mx-auto max-w-5xl text-center">
        <p className="chip mx-auto" data-reveal>AI-powered finance and investing</p>
        <div className="mt-6 flex items-center justify-center gap-4 sm:gap-6" data-reveal style={delay(60)}>
          <img src={logoUrl} alt="" className="h-9 w-9 shrink-0 sm:h-14 sm:w-14 lg:h-16 lg:w-16" />
          <h1 className="max-w-3xl text-balance text-center text-[26px] font-bold leading-[1.1] tracking-[-0.03em] sm:text-5xl lg:max-w-none lg:whitespace-nowrap lg:text-[46px]">Your financial intelligence, reimagined.</h1>
        </div>
        <p className="mx-auto mt-6 max-w-xl text-balance text-base leading-relaxed text-muted sm:text-lg" data-reveal style={delay(120)}>
          Ask anything about companies, markets or personal finance. Equidy analyses your portfolio, explains complex concepts and turns data into clear decisions.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3" data-reveal style={delay(180)}>
          <Link to={signedIn ? "/" : "/login"} className="btn-primary h-12 px-6 text-base">{signedIn ? "Open Equidy" : "Get started"} <ArrowRight className="h-4 w-4" aria-hidden /></Link>
          <a href="#features" className="btn-outline h-12 px-6 text-base">Explore features</a>
        </div>
        <p className="mt-5 text-xs text-muted" data-reveal style={delay(220)}>Powered by Google Gemini. Market data from Finnhub and Alpha Vantage.</p>
        <ProductPreview />
      </div>
    </section>
  );
}

function SectionHeading({ id, title, body }: { id: string; title: string; body?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center" data-reveal>
      <h2 id={id} className="text-balance text-3xl font-bold tracking-[-0.025em] sm:text-5xl">{title}</h2>
      {body && <p className="mt-4 text-balance text-base leading-relaxed text-muted sm:text-lg">{body}</p>}
    </div>
  );
}

interface Feature { icon: LucideIcon; title: string; body: string; wide?: boolean; chips?: string[] }

const FEATURES: Feature[] = [
  {
    icon: MessageSquare,
    title: "Ask Equidy anything",
    body: "Get clear answers about companies, markets and personal finance, with the working shown so you can learn the method as well as the answer.",
    wide: true,
    chips: ["Explain the P/E ratio", "How diversified am I?", "Compare two companies", "What does a rate rise mean?"],
  },
  { icon: Briefcase, title: "Portfolio tracking", body: "Add your holdings and see value, performance and allocation in one calm view." },
  { icon: BarChart3, title: "Statistics and insights", body: "Risk-adjusted analytics benchmarked against the S&P 500, from volatility and drawdown to the Sharpe ratio." },
  { icon: GraduationCap, title: "Learn as you go", body: "Plain-English lessons on ETFs, diversification, dividends and more, whenever you are curious." },
  { icon: Scale, title: "Analysis, not advice", body: "Balanced views with the bull case, the bear case and the key risks. Equidy educates; it never tells you what to buy." },
];

function Features() {
  return (
    <section id="features" aria-labelledby="features-title" className="scroll-mt-24 px-4 py-20 sm:px-6 sm:py-28">
      <SectionHeading id="features-title" title="Everything you need to understand your money" body="One place to ask questions, track what you own and learn how markets work." />
      <div className="mx-auto mt-12 grid max-w-5xl gap-4 lg:grid-cols-3">
        {FEATURES.map((f, i) => {
          const Icon = f.icon;
          return (
            <article key={f.title} className={cn("card p-6 sm:p-7", f.wide && "lg:col-span-2")} data-reveal style={delay(i * 70)}>
              <div className="mb-5 grid h-11 w-11 place-items-center rounded-2xl bg-elevated"><Icon className="h-5 w-5" aria-hidden /></div>
              <h3 className="text-xl font-semibold tracking-tight">{f.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{f.body}</p>
              {f.chips && <div className="mt-5 flex flex-wrap gap-2">{f.chips.map((c) => <span key={c} className="chip">{c}</span>)}</div>}
            </article>
          );
        })}
      </div>
    </section>
  );
}

const STEPS = [
  { title: "Sign in", body: "Sign in with your account and open your dashboard." },
  { title: "Add your holdings", body: "Enter what you own, or skip this and start asking questions right away." },
  { title: "Ask, learn, decide", body: "Get clear answers with the working shown, then make your own decisions with more confidence." },
];

function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-title" className="scroll-mt-24 px-4 py-20 sm:px-6 sm:py-28">
      <SectionHeading id="how-title" title="Up and running in three steps" />
      <ol className="mx-auto mt-12 grid max-w-5xl gap-4 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="card p-6 sm:p-7" data-reveal style={delay(i * 80)}>
            <span className="num text-sm font-semibold text-muted">0{i + 1}</span>
            <h3 className="mt-3 text-xl font-semibold tracking-tight">{s.title}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Faq({ question, children }: { question: string; children: ReactNode }) {
  return (
    <details className="group border-b border-line py-5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-lg font-medium [&::-webkit-details-marker]:hidden">
        {question}
        <ChevronDown className="h-5 w-5 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180" aria-hidden />
      </summary>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">{children}</p>
    </details>
  );
}

function Questions() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-24 px-4 py-20 sm:px-6 sm:py-28">
      <SectionHeading id="faq-title" title="Questions, answered" />
      <div className="mx-auto mt-12 max-w-3xl border-t border-line" data-reveal>
        <Faq question="Is Equidy financial advice?">
          No. Equidy provides education and analysis, not personalised investment, tax or legal advice. It explains the considerations and trade-offs and never tells you to buy or sell a specific security.
        </Faq>
        <Faq question="Can the AI be wrong?">
          Yes. AI answers can be incomplete, out of date or mistaken, even when they sound confident. Check important figures against official sources before you act on them.
        </Faq>
        <Faq question="Where does the market data come from?">
          Stock prices, history and news come from Finnhub and Alpha Vantage. Where live data is not available, Equidy uses clearly labelled simulated data.
        </Faq>
        <Faq question="Is my data private?">
          Your portfolio and chats are kept in your browser, and in your account when cloud sync is available. We do not sell your personal information or show advertising. Read the <Link to="/privacy" className="underline">Privacy Policy</Link> for details.
        </Faq>
      </div>
    </section>
  );
}

function FinalCall({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="px-4 pb-20 sm:px-6 sm:pb-28">
      <div className="card mx-auto max-w-5xl px-6 py-14 text-center sm:py-20" data-reveal>
        <img src={logoUrl} alt="" className="mx-auto h-12 w-12" />
        <h2 className="mt-6 text-balance text-3xl font-bold tracking-[-0.025em] sm:text-5xl">Start understanding your money.</h2>
        <p className="mx-auto mt-4 max-w-md text-balance text-base text-muted sm:text-lg">Open Equidy and ask your first question.</p>
        <Link to={signedIn ? "/" : "/login"} className="btn-primary mt-8 h-12 px-6 text-base">{signedIn ? "Open Equidy" : "Get started"} <ArrowRight className="h-4 w-4" aria-hidden /></Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <a href="#top" aria-label="Back to top" className="inline-block rounded-lg"><img src={logoUrl} alt="Equidy" className="h-7 w-7" /></a>
          <p className="mt-4 max-w-sm text-xs leading-relaxed text-muted">
            Equidy provides education and analysis, not personalised financial advice. Investing involves risk, including the loss of money.
          </p>
        </div>
        <nav aria-label="Footer" className="flex gap-5 text-sm text-muted">
          <Link to="/privacy" className="hover:text-fg">Privacy</Link>
          <Link to="/terms" className="hover:text-fg">Terms</Link>
          <Link to="/login" className="hover:text-fg">Sign in</Link>
        </nav>
      </div>
      <p className="mx-auto mt-8 max-w-5xl text-xs text-muted">© {new Date().getFullYear()} Equidy</p>
    </footer>
  );
}

export function LandingPage() {
  const signedIn = !!useAuth((s) => s.user);
  const root = useRef<HTMLDivElement>(null);
  useReveal(root);
  return (
    <div ref={root} id="top" className="dark relative min-h-full overflow-x-hidden bg-bg text-fg">
      <a href="#landing-main" className="sr-only rounded-full bg-fg px-4 py-2 text-sm text-bg focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50">Skip to content</a>
      <Nav signedIn={signedIn} />
      <main id="landing-main" tabIndex={-1} className="focus:outline-none">
        <Hero signedIn={signedIn} />
        <Features />
        <HowItWorks />
        <Questions />
        <FinalCall signedIn={signedIn} />
      </main>
      <Footer />
      <ConsentBanner />
    </div>
  );
}
