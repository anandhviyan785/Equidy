import { BarChart3, BookOpen, Briefcase, GraduationCap, MessageSquare, Scale, type LucideIcon } from "lucide-react";
import { C } from "../theme";
import { Card } from "../ui";
import { PostFrame, Row } from "./PostFrame";

const IconBox = ({ Icon, size = 72 }: { Icon: LucideIcon; size?: number }) => (
  <div style={{ width: size, height: size, flexShrink: 0, borderRadius: size / 3, background: C.elevated, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <Icon size={size * 0.5} strokeWidth={1.8} />
  </div>
);

const WHAT_IT_DOES: [LucideIcon, string][] = [
  [MessageSquare, "Answers your money questions"],
  [Briefcase, "Tracks your portfolio"],
  [BarChart3, "Measures your risk"],
  [GraduationCap, "Teaches as you go"],
  [Scale, "Shows both sides, never pushes"],
];

export const PostIntro = () => (
  <PostFrame index={1} kicker="Meet Equidy" title={<>Your financial intelligence, reimagined.</>} body="An AI assistant for your money. Here is what it does.">
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {WHAT_IT_DOES.map(([Icon, text]) => (
        <div key={text} style={{ display: "flex", alignItems: "center", gap: 28, fontSize: 36, fontWeight: 500 }}>
          <IconBox Icon={Icon} />
          {text}
        </div>
      ))}
    </div>
  </PostFrame>
);

export const PostAsk = () => (
  <PostFrame index={2} kicker="Ask Equidy anything" title="Ask anything about your money." body="Plain-English answers with the working shown." illustrative>
    <Card style={{ padding: 40 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ background: C.elevated, borderRadius: "36px 36px 8px 36px", padding: "18px 30px", fontSize: 30 }}>Why is my portfolio down this month?</div>
      </div>
      <div style={{ marginTop: 28, fontSize: 29, lineHeight: 1.5 }}>
        You're down about <b>2.1%</b>, mostly because of your technology holdings.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 22 }}>
        <Row label="Technology" detail="52% of your portfolio" value="−3.4%" color={C.down} />
        <Row label="Financials" detail="21% of your portfolio" value="+1.2%" color={C.up} />
        <Row label="Healthcare" detail="14% of your portfolio" value="+0.4%" color={C.up} />
      </div>
    </Card>
  </PostFrame>
);

const ALLOCATION: [string, number, string][] = [
  ["Technology", 52, "#f5f5f7"],
  ["Financials", 21, "#a1a1a6"],
  ["Healthcare", 14, "#636366"],
  ["Other", 13, "#3a3a3c"],
];

export const PostPortfolio = () => (
  <PostFrame index={3} kicker="Portfolio tracking" title="Everything you own, in one calm view." body="Value, performance and allocation at a glance." illustrative>
    <Card style={{ padding: 44 }}>
      <div style={{ fontSize: 26, color: C.muted }}>Portfolio value</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 24, marginTop: 6 }}>
        <div style={{ fontSize: 88, fontWeight: 700, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>$48,320</div>
        <div style={{ fontSize: 32, fontWeight: 600, color: C.up }}>+1.8% today</div>
      </div>
      <div style={{ fontSize: 26, color: C.muted, marginTop: 40 }}>Allocation</div>
      <div style={{ display: "flex", height: 28, borderRadius: 14, overflow: "hidden", marginTop: 16, gap: 4 }}>
        {ALLOCATION.map(([name, pct, color]) => <div key={name} style={{ width: `${pct}%`, background: color }} />)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px 32px", marginTop: 30 }}>
        {ALLOCATION.map(([name, pct, color]) => (
          <div key={name} style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 28 }}>
            <span style={{ width: 18, height: 18, borderRadius: 9, background: color, border: `1px solid ${C.line}` }} />
            <span style={{ flex: 1 }}>{name}</span>
            <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{pct}%</span>
          </div>
        ))}
      </div>
    </Card>
  </PostFrame>
);

const STATS: [string, string, string][] = [
  ["Annualised return", "9.6%", "S&P 500: 10.2%"],
  ["Volatility", "16.4%", "S&P 500: 14.9%"],
  ["Sharpe ratio", "1.12", "S&P 500: 1.18"],
  ["Max drawdown", "−12.1%", "S&P 500: −10.3%"],
  ["Beta", "1.08", "vs the S&P 500"],
  ["1-day VaR (95%)", "1.7%", "Typical bad-day loss"],
];

export const PostStats = () => (
  <PostFrame index={4} kicker="Statistics and insights" title="Know your risk, in numbers." body="Risk analytics, benchmarked against the S&P 500." illustrative>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      {STATS.map(([label, value, note]) => (
        <Card key={label} style={{ padding: "26px 32px" }}>
          <div style={{ fontSize: 25, color: C.muted }}>{label}</div>
          <div style={{ fontSize: 54, fontWeight: 700, letterSpacing: "-0.02em", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{value}</div>
          <div style={{ fontSize: 22, color: C.muted, marginTop: 4 }}>{note}</div>
        </Card>
      ))}
    </div>
  </PostFrame>
);

const LESSONS = ["ETFs vs mutual funds", "Diversification", "Dividends", "Dollar-cost averaging", "How bonds work"];

export const PostLearn = () => (
  <PostFrame index={5} kicker="Learn as you go" title="Finance, finally explained." body="Plain-English lessons whenever you're curious.">
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {LESSONS.map((lesson) => (
        <Card key={lesson} style={{ display: "flex", alignItems: "center", gap: 26, padding: "22px 30px", borderRadius: 26 }}>
          <IconBox Icon={BookOpen} size={60} />
          <span style={{ fontSize: 34, fontWeight: 500 }}>{lesson}</span>
        </Card>
      ))}
    </div>
  </PostFrame>
);

const SIDES: [string, string, string][] = [
  ["The bull case", "Strong revenue growth and plenty of cash to reinvest.", C.up],
  ["The bear case", "The share price may already assume years of perfect growth.", C.down],
  ["The key risks", "Rate rises, new competitors and too much in one sector.", C.muted],
];

export const PostBalance = () => (
  <PostFrame index={6} kicker="Analysis, not advice" title="Both sides. Then you decide." body="Equidy educates. It never tells you what to buy.">
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {SIDES.map(([title, text, color]) => (
        <Card key={title} style={{ padding: "34px 40px", borderLeft: `8px solid ${color}` }}>
          <div style={{ fontSize: 36, fontWeight: 600, color }}>{title}</div>
          <div style={{ fontSize: 30, color: C.fg, marginTop: 10, lineHeight: 1.4 }}>{text}</div>
        </Card>
      ))}
    </div>
  </PostFrame>
);

const STEPS = ["Sign in", "Add your holdings, or skip it", "Ask your first question"];

export const PostStart = () => (
  <PostFrame index={7} kicker="Get started" title="Start understanding your money." body="Up and running in three steps.">
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {STEPS.map((step, i) => (
        <Card key={step} style={{ display: "flex", alignItems: "center", gap: 30, padding: "30px 36px" }}>
          <div style={{ width: 72, height: 72, borderRadius: 36, background: C.fg, color: C.bg, fontSize: 36, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</div>
          <span style={{ fontSize: 38, fontWeight: 600 }}>{step}</span>
        </Card>
      ))}
      <div style={{ marginTop: 30, alignSelf: "center", background: C.fg, color: C.bg, borderRadius: 999, padding: "24px 56px", fontSize: 34, fontWeight: 600 }}>Link in bio</div>
    </div>
  </PostFrame>
);

export const POSTS = [PostIntro, PostAsk, PostPortfolio, PostStats, PostLearn, PostBalance, PostStart];
