import { Link, Navigate } from "react-router-dom";
import { ArrowRight, BarChart3, Briefcase, LineChart, Lock, MessageSquareText, Search, ShieldCheck, Sparkles } from "lucide-react";
import { Logo } from "@/components/ui";
import { useThemeSync } from "@/hooks";
import { useAuth } from "@/store";
import { hasUsedEquidy } from "@/lib/visitor";

const SIGN_UP = "/login?mode=signup";

const STEPS = [
  { n: "1", title: "Ask in plain English", body: "“Is my portfolio too tech-heavy?” “What would $500 a month become in 20 years?” No jargon required." },
  { n: "2", title: "Add what you own", body: "Enter your holdings and watchlist once. Equidy keeps them in context for every answer." },
  { n: "3", title: "Get a clear answer", body: "Charts, risk numbers and a written breakdown, in seconds, with the assumptions spelled out." },
];

const FEATURES = [
  { icon: MessageSquareText, title: "AI analyst", body: "Chat about any company, concept or decision and get structured, readable analysis." },
  { icon: Briefcase, title: "Portfolio tracking", body: "See allocation, performance and exposure across everything you hold." },
  { icon: BarChart3, title: "Risk statistics", body: "Volatility, drawdown and diversification measured, not guessed." },
  { icon: LineChart, title: "Live markets", body: "Indices, stocks and crypto with charts you can read at a glance." },
  { icon: Search, title: "Research tools", body: "Company profiles, key metrics, analyst ratings and news in one place." },
  { icon: Lock, title: "Private by default", body: "Your data stays tied to your account, and you decide what to sync." },
];

const FAQ = [
  { q: "Is Equidy financial advice?", a: "No. Equidy's AI can make mistakes and is for information and education only. Check important decisions with a qualified professional." },
  { q: "Do I need to connect a brokerage?", a: "No. You enter your holdings yourself, so there is nothing to link and no account access to hand over." },
  { q: "What does it cost to start?", a: "You can create an account and start asking questions right away." },
  { q: "Is the market data live?", a: "Where a data source is configured, quotes are live. Otherwise Equidy clearly labels data as simulated." },
];

export function LandingPage() {
  useThemeSync();
  const user = useAuth((s) => s.user);
  // This page is only for people who have never used Equidy.
  if (user || hasUsedEquidy()) return <Navigate to="/" replace />;

  return (
    <div className="min-h-full bg-bg">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Logo />
        <nav className="flex items-center gap-2" aria-label="Primary">
          <Link to="/login" className="btn-ghost">Sign in</Link>
          <Link to={SIGN_UP} className="btn-primary">Get started</Link>
        </nav>
      </header>

      <main>
        <Hero />
        <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8" aria-labelledby="how">
          <h2 id="how" className="text-balance text-center text-3xl font-semibold tracking-tight sm:text-4xl">From question to clarity in three steps</h2>
          <ol className="mt-12 grid gap-4 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="card p-6">
                <span className="num grid h-8 w-8 place-items-center rounded-full bg-fg text-sm font-semibold text-bg">{s.n}</span>
                <h3 className="mt-5 text-lg font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-y border-line bg-surface" aria-labelledby="features">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
            <h2 id="features" className="text-balance text-center text-3xl font-semibold tracking-tight sm:text-4xl">Everything you need to understand your money</h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-[15px] text-muted">One workspace for the questions, the numbers and the research behind them.</p>
            <ul className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <li key={title}>
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-elevated"><Icon className="h-5 w-5" aria-hidden /></span>
                  <h3 className="mt-4 font-semibold tracking-tight">{title}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-2xl px-5 py-20 sm:px-8" aria-labelledby="faq">
          <h2 id="faq" className="text-center text-3xl font-semibold tracking-tight">Questions, answered</h2>
          <div className="mt-10 divide-y divide-line border-y border-line">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="text-xl text-muted transition-transform group-open:rotate-45" aria-hidden>+</span>
                </summary>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-8">
          <div className="rounded-[28px] bg-fg px-6 py-14 text-center text-bg sm:px-12">
            <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Ready to meet your financial analyst?</h2>
            <p className="mx-auto mt-3 max-w-md text-[15px] opacity-70">Create your account in under a minute.</p>
            <Link to={SIGN_UP} className="btn mt-8 h-12 bg-bg px-6 text-[15px] text-fg hover:bg-bg/90">Get started free <ArrowRight className="h-4 w-4" aria-hidden /></Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>Equidy's AI can make mistakes and does not give financial advice.</p>
          <div className="flex gap-5">
            <Link to="/terms" className="hover:text-fg">Terms</Link>
            <Link to="/privacy" className="hover:text-fg">Privacy</Link>
            <Link to="/login" className="hover:text-fg">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-10 pt-12 text-center sm:px-8 sm:pt-20" aria-labelledby="hero">
      <span className="chip bg-surface animate-fade-up"><Sparkles className="h-3.5 w-3.5" aria-hidden /> AI-powered financial intelligence</span>
      <h1 id="hero" className="mx-auto mt-6 max-w-3xl animate-fade-up text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
        Understand your money in minutes, not months.
      </h1>
      <p className="mx-auto mt-5 max-w-xl animate-fade-up text-balance text-lg text-muted">
        Ask Equidy anything about your portfolio, the markets or a company, and get a clear, structured answer backed by real numbers.
      </p>
      <div className="mt-8 flex animate-fade-up flex-col items-center justify-center gap-3 sm:flex-row">
        <Link to={SIGN_UP} className="btn-primary h-12 px-6 text-[15px]">Get started free <ArrowRight className="h-4 w-4" aria-hidden /></Link>
        <Link to="/login" className="btn-outline h-12 px-6 text-[15px]">I already have an account</Link>
      </div>
      <ChatPreview />
    </section>
  );
}

function ChatPreview() {
  return (
    <figure className="mx-auto mt-14 max-w-2xl text-left" aria-label="Example conversation">
      <div className="card p-5 sm:p-6">
        <div className="ml-auto w-fit max-w-[85%] rounded-2xl bg-elevated px-4 py-2.5 text-[15px]">How risky is my portfolio?</div>
        <div className="mt-4 flex gap-3">
          <Logo compact className="mt-0.5 h-6 w-6 shrink-0" />
          <div className="min-w-0 flex-1 text-[15px] leading-relaxed">
            <p>Your portfolio is <strong>moderately high risk</strong>. Roughly two-thirds sits in technology, which is driving most of the volatility.</p>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[["Volatility", "18.4%"], ["Max drawdown", "−21%"], ["Diversification", "Medium"]].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-line bg-bg px-2 py-3">
                  <dt className="text-[11px] font-medium text-muted">{k}</dt>
                  <dd className="num mt-1 text-lg font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 flex items-center gap-1.5 text-sm text-muted"><ShieldCheck className="h-4 w-4" aria-hidden /> Adding bonds or international funds would lower concentration.</p>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-muted">Illustrative example, not real portfolio data.</figcaption>
    </figure>
  );
}
