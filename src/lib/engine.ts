// Offline analysis engine. Used when no Claude API key is configured on the server
// (or the server is unreachable), so every feature of the app works out of the box.
// It answers from the same data the rest of the app uses and formats replies as Markdown.

import { BY_SYMBOL, SECURITIES, findSecurity, type Security } from "@/data/securities";
import { compound, stdev } from "./finance";
import { history, returns } from "./market";
import { money, num, pct, price } from "./format";
import type { Snapshot } from "./context";

const DISCLAIMER = "\n\n*Equidy provides information and education, not personalised investment advice. Market data shown is simulated.*";

const CONCEPTS: { keys: RegExp; title: string; body: string }[] = [
  {
    keys: /\b(p\/?e|price[- ]to[- ]earnings|pe ratio)\b/i,
    title: "Price-to-Earnings (P/E) ratio",
    body: "The **P/E ratio** is the share price divided by earnings per share. It tells you how many dollars investors pay for each $1 of annual profit.\n\n- **High P/E** (e.g. 35+) — the market expects strong future growth, or the stock is expensive.\n- **Low P/E** (e.g. under 12) — slower growth, higher perceived risk, or a potential bargain.\n- Compare within the same industry — banks structurally trade on lower multiples than software.\n\n**Forward P/E** uses next year's expected earnings instead of trailing results. Pair P/E with growth using the **PEG ratio** (P/E ÷ EPS growth %); a PEG near 1 is often considered fair.",
  },
  {
    keys: /\b(etf|exchange[- ]traded fund|index fund)s?\b/i,
    title: "ETFs and index funds",
    body: "An **ETF** is a basket of securities that trades on an exchange like a single stock. Most track an index (S&P 500, total bond market, Nasdaq-100).\n\n| | ETFs | Mutual funds |\n|---|---|---|\n| Trading | Intraday at market price | Once daily at NAV |\n| Typical cost | 0.03–0.20% | 0.5–1.0% (active) |\n| Tax efficiency | High (in-kind redemptions) | Lower |\n| Minimums | 1 share (or fractional) | Often $1,000+ |\n\nFor long-term investors, low-cost broad index ETFs such as **VTI** or **SPY** offer instant diversification across hundreds of companies.",
  },
  {
    keys: /\bdiversif/i,
    title: "Diversification",
    body: "**Diversification** spreads money across assets that don't move in lockstep, so a single loss hurts less.\n\n1. **Across asset classes** — equities, bonds, cash, real assets.\n2. **Within equities** — sectors, company sizes, geographies.\n3. **Across time** — investing regularly (dollar-cost averaging).\n\nWhat matters is **correlation**: two tech stocks with 0.8 correlation add far less protection than a stock paired with a bond fund (≈0). Open **Statistics → Correlation** to see how your holdings interact.",
  },
  {
    keys: /\b(dollar[- ]cost averag|dca)\b/i,
    title: "Dollar-cost averaging",
    body: "**Dollar-cost averaging (DCA)** means investing a fixed amount at regular intervals regardless of price. You automatically buy more shares when prices are low and fewer when high.\n\n- Removes the pressure of timing the market\n- Builds discipline and habit\n- Historically, lump-sum investing wins ~2/3 of the time because markets tend to rise — but DCA reduces regret and drawdown risk for new money.",
  },
  {
    keys: /\b(sharpe)\b/i,
    title: "Sharpe ratio",
    body: "The **Sharpe ratio** measures return per unit of risk:\n\n`Sharpe = (Portfolio return − Risk-free rate) ÷ Volatility`\n\n- **< 0.5** — poor risk-adjusted performance\n- **0.5 – 1.0** — acceptable\n- **1.0 – 2.0** — good\n- **> 2.0** — excellent (and rare over long periods)\n\nThe **Sortino ratio** is a variant that only penalises downside volatility.",
  },
  {
    keys: /\bbeta\b/i,
    title: "Beta",
    body: "**Beta** measures how sensitive an asset is to the overall market (usually the S&P 500).\n\n- **β = 1.0** — moves with the market\n- **β > 1** — amplifies moves (e.g. NVDA ≈ 1.7: a 10% market drop tends to mean ~17%)\n- **β < 1** — more defensive (utilities, staples)\n- **β ≈ 0** — largely uncorrelated (short-term Treasuries, gold at times)\n\nYour portfolio beta is the weighted average of holdings' betas.",
  },
  {
    keys: /\b(bond|yield curve|treasur|fixed income)/i,
    title: "Bonds",
    body: "A **bond** is a loan to a government or company that pays periodic interest (the **coupon**) and returns principal at maturity.\n\n- **Prices and yields move inversely** — when rates rise, existing bond prices fall.\n- **Duration** measures rate sensitivity: a duration of 6 means ≈6% price drop for a 1-point rate rise.\n- **Credit quality** ranges from Treasuries (lowest risk) to high-yield \"junk\" bonds.\n\nBonds typically dampen portfolio volatility and provide income.",
  },
  {
    keys: /\binflation\b/i,
    title: "Inflation",
    body: "**Inflation** is the rate at which prices rise, eroding purchasing power. At 3% inflation, $100 buys only ~$74 of today's goods in 10 years.\n\nAssets that have historically outpaced inflation over long horizons include equities, real estate and TIPS (inflation-protected Treasuries). Cash and long-duration nominal bonds are most exposed.",
  },
  {
    keys: /\bdividend/i,
    title: "Dividends",
    body: "A **dividend** is a share of profits paid to shareholders, usually quarterly.\n\n- **Dividend yield** = annual dividend ÷ share price\n- **Payout ratio** = dividends ÷ earnings — above ~75% may be hard to sustain\n- **Dividend growth** stocks (e.g. KO, JNJ, PG) have raised payouts for 50+ consecutive years\n\nReinvesting dividends is a major driver of long-term total return.",
  },
  {
    keys: /\b(budget|50\/30\/20|emergency fund|saving money)\b/i,
    title: "Budgeting & emergency funds",
    body: "A simple framework is the **50/30/20 rule**:\n\n| Bucket | Share of after-tax income |\n|---|---|\n| Needs (rent, food, insurance) | 50% |\n| Wants (dining, travel) | 30% |\n| Savings & debt payoff | 20% |\n\nBefore investing, build an **emergency fund** of 3–6 months of essential expenses in a high-yield savings account, and pay down high-interest debt (>8%).",
  },
  {
    keys: /\b(401\s?k|ira|roth|retire)/i,
    title: "Retirement accounts",
    body: "**Tax-advantaged accounts** compound faster because returns aren't taxed every year.\n\n- **401(k)** — employer plan; always capture the full employer match (it's an instant 50–100% return).\n- **Traditional IRA** — contributions may be deductible; withdrawals taxed.\n- **Roth IRA** — contribute after-tax; qualified withdrawals are tax-free.\n\nA common rule of thumb: aim to save 15% of income for retirement, and target ~25× your expected annual spending (the **4% rule**).",
  },
  {
    keys: /\b(option|call|put)s?\b.*\b(work|explain|what)/i,
    title: "Options",
    body: "An **option** is a contract giving the right (not obligation) to buy (**call**) or sell (**put**) an asset at a set **strike price** before **expiry**.\n\n- Buyers pay a **premium**; maximum loss is that premium.\n- Sellers collect premium but can face large losses.\n- Price drivers: underlying price, time to expiry, volatility, rates.\n\nOptions are powerful for hedging but leveraged — most retail traders who buy short-dated options lose money.",
  },
  {
    keys: /\b(recession|bear market|market crash|correction)\b/i,
    title: "Market downturns",
    body: "- **Correction** — a 10%+ decline from a recent high (happens roughly once a year on average).\n- **Bear market** — a 20%+ decline.\n- **Recession** — a broad decline in economic activity, often two quarters of negative GDP.\n\nHistorically the S&P 500 has recovered from every bear market. Investors who stayed invested — and kept contributing — typically fared best. Check your **max drawdown** in Statistics to understand your own pain threshold.",
  },
];

// ---------------- helpers ----------------

function tickerMentions(text: string): Security[] {
  const found = new Map<string, Security>();
  const tokens = text.match(/\$?[A-Za-z][A-Za-z.&'-]{0,20}/g) ?? [];
  for (const raw of tokens) {
    const t = raw.replace(/^\$/, "").replace(/'s$/i, "");
    const upper = t.toUpperCase();
    if (BY_SYMBOL[upper] && (t === upper || raw.startsWith("$")) && upper.length > 1) found.set(upper, BY_SYMBOL[upper]);
    else if (t.length > 3) {
      const s = findSecurity(t);
      if (s && !["the", "and"].includes(t.toLowerCase())) found.set(s.symbol, s);
    }
  }
  return [...found.values()];
}

function cagr(a: number, b: number, years: number) {
  return a > 0 && b > 0 ? (b / a) ** (1 / years) - 1 : NaN;
}

function perf(s: Security, days: number) {
  const h = history(s.symbol, s.price, s.vol, s.drift, s.beta);
  return h[h.length - 1].close / h[h.length - 1 - days].close - 1;
}

// ---------------- intents ----------------

function analyzeCompany(s: Security, snap: Snapshot): string {
  const live = snap.prices[s.symbol]?.price ?? s.price;
  const out: string[] = [`## ${s.name} (${s.symbol})`, `${s.description}`, ""];
  out.push(`**Price** ${price(live)} · **1Y** ${pct(perf(s, 252))} · **3M** ${pct(perf(s, 63))} · **Beta** ${s.beta.toFixed(2)} · **Volatility** ${pct(s.vol, 0, false)}`);
  if (s.marketCap) out.push(`**Market cap** $${num(s.marketCap, 0)}B · **P/E** ${s.pe?.toFixed(1) ?? "—"} · **Dividend yield** ${s.dividendYield ? s.dividendYield.toFixed(2) + "%" : "—"}`);
  const f = s.financials;
  if (f) {
    const n = f.years.length - 1;
    out.push("", "### Financial performance", "| Fiscal year | Revenue | Net income | Net margin | Free cash flow |", "|---|---:|---:|---:|---:|");
    f.years.forEach((y, i) => out.push(`| ${y} | $${f.revenue[i].toFixed(1)}B | $${f.netIncome[i].toFixed(1)}B | ${((f.netIncome[i] / f.revenue[i]) * 100).toFixed(1)}% | $${f.freeCashFlow[i].toFixed(1)}B |`));
    const revG = cagr(f.revenue[0], f.revenue[n], n);
    const niG = cagr(f.netIncome[0], f.netIncome[n], n);
    const lastG = f.revenue[n] / f.revenue[n - 1] - 1;
    out.push("", "### Key takeaways");
    out.push(`- **Growth:** revenue compounded at **${pct(revG, 1, false)}** per year over ${n} years${isNaN(niG) ? "" : `, with net income at **${pct(niG, 1, false)}**`}. Latest year: ${pct(lastG, 1)}.`);
    out.push(`- **Profitability:** ${f.grossMargin ? `gross margin ${f.grossMargin}%, ` : ""}operating margin **${f.operatingMargin}%**, return on equity ${f.roe}%.`);
    out.push(`- **Balance sheet:** debt-to-equity of ${f.debtToEquity.toFixed(2)} — ${f.debtToEquity < 0.5 ? "conservatively financed" : f.debtToEquity < 1.5 ? "moderate leverage" : "relatively leveraged (partly reflects buybacks or the business model)"}.`);
    const fcfYield = s.marketCap ? (f.freeCashFlow[n] / s.marketCap) * 100 : 0;
    if (fcfYield) out.push(`- **Cash generation:** free-cash-flow yield of ~${fcfYield.toFixed(1)}% at the current market cap.`);
    const peView = !s.pe ? "" : s.pe > 40 ? "a premium multiple that prices in sustained high growth" : s.pe > 22 ? "above the market average, reflecting quality and growth expectations" : "a moderate multiple relative to the broader market";
    if (peView) out.push(`- **Valuation:** a P/E of ${s.pe!.toFixed(1)} is ${peView}.`);
    out.push("", "### What to watch");
    const risks: string[] = [];
    if (s.beta > 1.4) risks.push("High beta — expect larger swings than the market in both directions.");
    if (lastG < 0.03) risks.push("Top-line growth has slowed; watch for margin pressure.");
    if (s.pe && s.pe > 35) risks.push("Elevated valuation leaves less room for earnings disappointments.");
    if (f.debtToEquity > 1.5) risks.push("Higher leverage increases sensitivity to interest rates.");
    if (!risks.length) risks.push("Execution against expectations and the broader rate environment.");
    risks.forEach((r) => out.push(`- ${r}`));
  }
  const held = snap.rows.find((r) => r.symbol === s.symbol);
  if (held) out.push("", `> You hold **${held.shares} shares** (${pct(held.weight, 1, false)} of your portfolio) with an unrealised return of **${pct(held.pnlPct)}**.`);
  return out.join("\n");
}

function compare(a: Security, b: Security, snap: Snapshot): string {
  const rows = [
    ["Price", price(snap.prices[a.symbol]?.price ?? a.price), price(snap.prices[b.symbol]?.price ?? b.price)],
    ["Sector", a.sector, b.sector],
    ["Market cap", a.marketCap ? `$${num(a.marketCap, 0)}B` : "—", b.marketCap ? `$${num(b.marketCap, 0)}B` : "—"],
    ["P/E", a.pe?.toFixed(1) ?? "—", b.pe?.toFixed(1) ?? "—"],
    ["1Y return", pct(perf(a, 252)), pct(perf(b, 252))],
    ["Beta", a.beta.toFixed(2), b.beta.toFixed(2)],
    ["Volatility", pct(a.vol, 0, false), pct(b.vol, 0, false)],
    ["Dividend yield", a.dividendYield ? a.dividendYield + "%" : "—", b.dividendYield ? b.dividendYield + "%" : "—"],
    ["Operating margin", a.financials ? a.financials.operatingMargin + "%" : "—", b.financials ? b.financials.operatingMargin + "%" : "—"],
  ];
  const lines = [`## ${a.symbol} vs ${b.symbol}`, "", `| Metric | ${a.symbol} | ${b.symbol} |`, "|---|---:|---:|", ...rows.map((r) => `| ${r.join(" | ")} |`)];
  const ra = returns(history(a.symbol, a.price, a.vol, a.drift, a.beta).slice(-253));
  const rb = returns(history(b.symbol, b.price, b.vol, b.drift, b.beta).slice(-253));
  const ma = ra.reduce((x, y) => x + y, 0) / ra.length, mb = rb.reduce((x, y) => x + y, 0) / rb.length;
  const corr = ra.reduce((acc, r, i) => acc + (r - ma) * (rb[i] - mb), 0) / (ra.length - 1) / (stdev(ra) * stdev(rb));
  lines.push("", "### Summary");
  lines.push(`- **${a.beta > b.beta ? a.symbol : b.symbol}** is the more aggressive holding (higher beta and volatility).`);
  if (a.pe && b.pe) lines.push(`- **${a.pe < b.pe ? a.symbol : b.symbol}** is cheaper on earnings (${Math.min(a.pe, b.pe).toFixed(1)}× vs ${Math.max(a.pe, b.pe).toFixed(1)}×).`);
  lines.push(`- Their 1-year daily-return correlation is **${corr.toFixed(2)}** — ${corr > 0.6 ? "owning both adds limited diversification" : corr > 0.3 ? "moderately related" : "they diversify each other well"}.`);
  return lines.join("\n");
}

function compoundAnswer(q: string): string {
  const amounts = [...q.matchAll(/\$?\s?(\d[\d,]*(?:\.\d+)?)\s?(k|K|m|M)?/g)].map((m) => {
    const v = parseFloat(m[1].replace(/,/g, ""));
    return m[2]?.toLowerCase() === "k" ? v * 1e3 : m[2]?.toLowerCase() === "m" ? v * 1e6 : v;
  });
  const rateM = q.match(/(\d+(?:\.\d+)?)\s?%/);
  const yearsM = q.match(/(\d+)\s?(years|yrs|year)/i);
  const monthlyM = q.match(/\$?\s?(\d[\d,]*)\s?(?:\/|per|a|each)\s?month/i);
  const rate = rateM ? parseFloat(rateM[1]) / 100 : 0.07;
  const years = yearsM ? parseInt(yearsM[1]) : 30;
  const monthly = monthlyM ? parseFloat(monthlyM[1].replace(/,/g, "")) : 500;
  const principal = amounts.find((v) => v >= 100 && v !== monthly && v !== years) ?? 10_000;
  const rows = compound(principal, monthly, rate, years);
  const last = rows[rows.length - 1];
  const pick = rows.filter((r) => r.year % Math.max(1, Math.round(years / 6)) === 0 || r.year === years);
  return [
    "## How compound interest works",
    "Compound interest means you earn returns **on your returns**. Each period, growth is added to the balance, and the next period's growth is calculated on that larger amount — so the curve bends upward over time.",
    "",
    "`Future value = P × (1 + r/n)^(n·t) + contributions`",
    "",
    `### Example: ${money(principal, { decimals: 0 })} upfront + ${money(monthly, { decimals: 0 })}/month at ${pct(rate, 1, false)} for ${years} years`,
    "| Year | Contributed | Interest earned | Balance |",
    "|---:|---:|---:|---:|",
    ...pick.map((r) => `| ${r.year} | ${money(r.contributed, { decimals: 0 })} | ${money(r.interest, { decimals: 0 })} | **${money(r.balance, { decimals: 0 })}** |`),
    "",
    `After ${years} years, **${pct(last.interest / last.balance, 0, false)} of your balance is growth**, not money you put in.`,
    "",
    "### Three levers",
    "1. **Time** — starting 10 years earlier can roughly double the outcome.",
    "2. **Rate** — fees matter: a 1% annual fee can consume ~25% of a 30-year result.",
    `3. **Consistency** — regular contributions keep feeding the engine. The **Rule of 72** says money doubles in ≈ 72 ÷ rate years (≈${(72 / (rate * 100)).toFixed(1)} years at ${pct(rate, 1, false)}).`,
    "",
    "Try different numbers in **Research → Compound calculator**.",
  ].join("\n");
}

function portfolioAnswer(snap: Snapshot): string {
  const { total, rows, metrics: m, sectors } = snap;
  if (!rows.length) return "Your portfolio is empty. Add holdings from the **Portfolio** page and I'll analyse allocation, risk and performance.";
  const top = rows[0];
  const winners = [...rows].sort((a, b) => b.pnlPct - a.pnlPct);
  const out = [
    "## Portfolio analysis",
    `**Value** ${money(total.value)} · **Unrealised P/L** ${money(total.pnl, { sign: true })} (${pct(total.pnlPct)}) · **Today** ${money(total.dayChange, { sign: true })} (${pct(total.dayChangePct)})`,
    "",
    "### Allocation",
    "| Sector | Weight |",
    "|---|---:|",
    ...sectors.map((s) => `| ${s.name} | ${pct(s.weight, 1, false)} |`),
  ];
  if (m) {
    out.push("", "### Risk profile (trailing 1 year)", "| Metric | Portfolio | Read-out |", "|---|---:|---|");
    out.push(`| Annual return | ${pct(m.annualReturn)} | ${m.annualReturn > m.benchmarkReturn ? "Ahead of" : "Behind"} SPY (${pct(m.benchmarkReturn)}) |`);
    out.push(`| Volatility | ${pct(m.volatility, 1, false)} | ${m.volatility > 0.22 ? "Higher than the broad market" : m.volatility > 0.14 ? "In line with equities" : "Defensive"} |`);
    out.push(`| Sharpe ratio | ${m.sharpe.toFixed(2)} | ${m.sharpe > 1 ? "Good risk-adjusted return" : m.sharpe > 0.5 ? "Acceptable" : "Weak"} |`);
    out.push(`| Beta | ${m.beta.toFixed(2)} | ${m.beta > 1.1 ? "Amplifies market moves" : m.beta < 0.9 ? "More defensive than the market" : "Market-like"} |`);
    out.push(`| Max drawdown | ${pct(m.maxDrawdown)} | Largest peak-to-trough fall |`);
    out.push(`| 1-day VaR (95%) | ${pct(m.var95, 2, false)} | ≈ ${money(m.var95 * total.value, { decimals: 0 })} on a bad day |`);
    out.push(`| Diversification | ${m.diversification}/100 | ${m.diversification > 75 ? "Well spread" : m.diversification > 55 ? "Moderately concentrated" : "Concentrated"} |`);
  }
  out.push("", "### Observations");
  const tech = sectors.find((s) => s.name === "Technology");
  if (top.weight > 0.2) out.push(`- **Concentration:** ${top.symbol} is ${pct(top.weight, 1, false)} of the portfolio. A 30% drop in it alone would cost ≈ ${money(top.value * 0.3, { decimals: 0 })}.`);
  if (tech && tech.weight > 0.35) out.push(`- **Sector tilt:** Technology is ${pct(tech.weight, 0, false)} of assets — well above its ~30% weight in the S&P 500.`);
  const bonds = rows.filter((r) => r.symbol === "BND").reduce((a, r) => a + r.weight, 0);
  const target = { conservative: 0.4, moderate: 0.2, aggressive: 0.05 }[snap.riskProfile];
  out.push(`- **Fixed income:** ${pct(bonds, 0, false)} in bonds vs ~${pct(target, 0, false)} typical for a *${snap.riskProfile}* profile.`);
  out.push(`- **Best performer:** ${winners[0].symbol} (${pct(winners[0].pnlPct)}); **weakest:** ${winners[winners.length - 1].symbol} (${pct(winners[winners.length - 1].pnlPct)}).`);
  out.push("", "### Ideas to consider");
  if (top.weight > 0.2) out.push(`- Trim ${top.symbol} toward 10–15% and redeploy into under-weighted sectors.`);
  if (bonds < target) out.push(`- Raise fixed income toward your profile target to reduce drawdowns.`);
  out.push(`- Add exposure to sectors you lack (${["Healthcare", "Consumer Staples", "Industrials", "Energy", "Utilities"].filter((x) => !sectors.find((s) => s.name === x)).slice(0, 3).join(", ") || "international equities"}) or broad index ETFs.`);
  out.push("- Rebalance on a schedule (e.g. semi-annually) or when any weight drifts more than 5 points.");
  return out.join("\n");
}

function marketAnswer(snap: Snapshot): string {
  const movers = SECURITIES.filter((s) => s.sector !== "ETF")
    .map((s) => ({ s, ch: snap.prices[s.symbol].price / snap.prices[s.symbol].prevClose - 1 }))
    .sort((a, b) => b.ch - a.ch);
  return [
    "## Market overview",
    "| Index | Level | Change |",
    "|---|---:|---:|",
    ...snap.indices.map((i) => `| ${i.name} | ${price(i.price)} | ${pct(i.price / i.prevClose - 1)} |`),
    "",
    `**Top gainers:** ${movers.slice(0, 3).map((m) => `${m.s.symbol} ${pct(m.ch)}`).join(", ")}`,
    `**Top decliners:** ${movers.slice(-3).reverse().map((m) => `${m.s.symbol} ${pct(m.ch)}`).join(", ")}`,
    "",
    "Open **Markets** for interactive charts, sector performance and the full movers list.",
  ].join("\n");
}

function helpAnswer(name: string): string {
  return [
    `I'm not quite sure what you mean${name ? `, ${name}` : ""}, but I'd love to help. Here are a few things I'm great at:`,
    "",
    "- *Analyze NVIDIA's financial performance*",
    "- *Compare MSFT vs GOOGL*",
    "- *How risky is my portfolio?*",
    "- *If I invest $15,000 plus $400 per month at 8% for 25 years, what do I end up with?*",
    "- *Explain the Sharpe ratio / P/E / ETFs / bonds / dividends*",
    "- *What are the markets doing today?*",
  ].join("\n");
}

// ---------------- conversation ----------------

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const FINANCE_WORDS = /\b(stock|share|market|portfolio|invest|fund|etf|bond|dividend|interest|price|analy[sz]e|compare|risk|return|crypto|bitcoin|money|budget|save|saving|retire|tax|inflation|p\/e|ratio|earnings|revenue)/i;

/** Friendly replies for greetings, feelings and small talk. Returns null for real finance questions. */
export function smallTalk(text: string, snap: Pick<Snapshot, "userName" | "total" | "rows">): string | null {
  const q = text.toLowerCase().replace(/[^\p{L}\p{N}\s'?!]/gu, " ").replace(/\s+/g, " ").trim();
  const name = snap.userName ? snap.userName.split(" ")[0] : "";
  const you = name ? `, ${name}` : "";
  const words = q.split(" ").filter(Boolean);
  const isFinance = FINANCE_WORDS.test(text);
  const short = words.length <= 8;

  if (/^(hi|hii+|hello|hey+|heya|hiya|yo|sup|howdy|greetings|good (morning|afternoon|evening|day)|what'?s up|wassup)\b/.test(q) && short && !isFinance) {
    const hour = new Date().getHours();
    const part = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
    const portfolioLine = snap.rows.length
      ? `Your portfolio is ${snap.total.dayChange >= 0 ? "up" : "down"} ${Math.abs(snap.total.dayChangePct * 100).toFixed(2)}% today${snap.total.dayChange >= 0 ? " — nice!" : ", but one day is just one day."}`
      : "Your portfolio is a blank canvas right now. Want help picking your first few holdings to research?";
    return pick([
      `Hey${you}! 👋 Great to see you. ${portfolioLine} What's on your mind?`,
      `Hi${you}! Good ${part} 😊 ${portfolioLine} How can I help today?`,
      `Hello${you}! I'm really glad you stopped by. ${portfolioLine} Anything you'd like to dig into?`,
    ]);
  }
  if (/\b(how are you|how r u|how are u|how's it going|hows it going|how do you do|how have you been|you good)\b/.test(q)) {
    return pick([
      `I'm doing great, thanks for asking${you}! 😊 Honestly, I get a little excited every time the markets open. How are *you* doing?`,
      `Pretty wonderful${you} — I've been watching the markets tick all day, which is my idea of a good time. How about you? Anything I can help with?`,
    ]);
  }
  if (/\b(thank|thanks|thx|ty|cheers|appreciate)\b/.test(q) && short) {
    return pick([`You're so welcome${you}! 😊 That's what I'm here for.`, `Anytime${you}! Happy to help — come back whenever something's on your mind.`, `My pleasure${you}! 🙌 Let me know if there's anything else.`]);
  }
  if (/^(bye|goodbye|see you|see ya|cya|good night|gn|later|catch you later)\b/.test(q) && short) {
    return pick([`Bye${you}! 👋 Take care, and may your portfolio be green tomorrow.`, `See you soon${you}! It was lovely chatting.`, `Good night${you}! 🌙 The markets will still be here in the morning.`]);
  }
  if (/\b(who are you|what are you|what can you do|your name|are you (a |an )?(ai|bot|robot|human))\b/.test(q)) {
    return `I'm **Equidy**, your financial sidekick${you}! 🤖📈 I can analyse companies, explain money concepts in plain English, run the numbers on your investments and review your portfolio's risk. I'm an AI, so I don't have a bank account of my own — but I genuinely enjoy this stuff. What would you like to explore?`;
  }
  if (/\b(sad|stressed|stress|anxious|worried|scared|nervous|upset|depressed|tired|lonely|bad day|rough day|panic)\b/.test(q) && !/\b(sad|stress)\w* test\b/.test(q)) {
    return `I'm really sorry you're feeling that way${you}. 💛 That's completely understandable — money and markets can be stressful, and so can life in general. Take a breath; you don't have to figure everything out today.\n\nIf it's about your investments, I'm happy to walk through things calmly with you, one step at a time. And if it's something else, it's okay to step away from the charts for a bit. I'm here whenever you want to talk.`;
  }
  if (/\b(happy|excited|great news|awesome|amazing|i got (a |the )?(job|raise|promotion|bonus))\b/.test(q) && short && !isFinance) {
    return `That's wonderful${you}! 🎉 I love hearing that. If there's a raise or bonus involved, I'd be thrilled to help you think about making that money work for you.`;
  }
  if (/\b(joke|funny|make me laugh)\b/.test(q)) {
    return pick([
      `Here's one${you}: Why did the stock market go to therapy? It had too many *depressions*. 😄`,
      `Okay${you}: I told my portfolio a joke… it didn't laugh, but it did *split*. 📈😄`,
      `Why don't bonds ever get invited to parties${you}? They're too *fixed* in their ways. 😂`,
    ]);
  }
  if (/\b(love you|you're (great|awesome|amazing|the best)|good bot|nice work|well done)\b/.test(q)) {
    return `Aww, thank you${you}! 🥹 That genuinely made my day. I'm here whenever you need me.`;
  }
  if (/\b(bored|boring)\b/.test(q) && short) {
    return `Bored${you}? Let's fix that! 😄 Want a fun fact? If you'd invested $1,000 in the S&P 500 in 1990 and reinvested dividends, it'd be worth around $25,000 today. Ask me anything — I promise to keep it interesting.`;
  }
  // Short, clearly non-financial chit-chat: answer warmly and gently steer back.
  const knownTopic = CONCEPTS.some((c) => c.keys.test(text)) || tickerMentions(text).length > 0 || /\b(compound|market|today|index)\b/.test(q);
  if (short && !isFinance && !knownTopic && words.length >= 2) {
    return pick([
      `Ha, I like where your head's at${you}! 😄 I'm best with money, markets and investing, but I'm always up for a chat. Is there anything finance-related on your mind?`,
      `That's a fun one${you}! I'm more of a numbers-and-markets kind of AI, so I might not be much help there — but if you want to talk stocks, savings or your portfolio, I'm all yours. 😊`,
    ]);
  }
  return null;
}

export function answer(question: string, snap: Snapshot): string {
  const chat = smallTalk(question, snap);
  if (chat) return chat;
  const q = question.toLowerCase();
  const tickers = tickerMentions(question);
  const first = snap.userName ? snap.userName.split(" ")[0] : "";
  // "Hi, analyse Apple" gets a friendly hello before the analysis.
  const hello = /^(hi|hello|hey|good (morning|afternoon|evening))\b/i.test(question.trim()) ? `Hi${first ? ` ${first}` : ""}! 👋 Happy to help with that.\n\n` : "";
  let body: string;
  if (/\b(compound|interest|grow|future value|invest \$?\d|rule of 72)\b/.test(q) && !tickers.length) body = compoundAnswer(question);
  else if (/(\bvs\.?\b|versus|compare)/.test(q) && tickers.length >= 2) body = compare(tickers[0], tickers[1], snap);
  else if (/\b(my|portfolio|holdings|allocation|rebalanc|risk(y)?)\b/.test(q) && /(portfolio|holding|allocation|rebalanc|my (risk|investments?))/.test(q)) body = portfolioAnswer(snap);
  else if (tickers.length) body = tickers.slice(0, 2).map((t) => analyzeCompany(t, snap)).join("\n\n---\n\n");
  else if (/\b(market|today|indices|index|movers|s&p)\b/.test(q)) body = marketAnswer(snap);
  else {
    const c = CONCEPTS.find((x) => x.keys.test(question));
    if (!c) return hello + helpAnswer(first);
    body = `## ${c.title}\n${c.body}`;
  }
  return hello + body + DISCLAIMER;
}

/** Streams text in small chunks to mimic token streaming. */
export async function streamText(text: string, onDelta: (t: string) => void, signal?: AbortSignal) {
  const parts = text.match(/\S+\s*|\s+/g) ?? [];
  for (let i = 0; i < parts.length; i += 3) {
    if (signal?.aborted) return;
    onDelta(parts.slice(i, i + 3).join(""));
    await new Promise((r) => setTimeout(r, 14));
  }
}

export { tickerMentions };
