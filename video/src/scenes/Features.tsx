import { AbsoluteFill } from "remotion";
import { BarChart3, Briefcase, GraduationCap, MessageSquare, Scale } from "lucide-react";
import { C, SCENES } from "../theme";
import { Card, Glow, Pop, Reveal, Scene } from "../ui";

const FEATURES = [
  { Icon: MessageSquare, title: "Ask Equidy anything", body: "Company analysis, comparisons and finance concepts in plain English." },
  { Icon: Briefcase, title: "Portfolio tracking", body: "Value, performance and allocation in one calm view." },
  { Icon: BarChart3, title: "Statistics and insights", body: "Volatility, drawdown and Sharpe ratio, benchmarked against the S&P 500." },
  { Icon: GraduationCap, title: "Learn as you go", body: "Lessons on ETFs, diversification, dividends and more." },
  { Icon: Scale, title: "Analysis, not advice", body: "Equidy educates; it never tells you what to buy." },
];

export const Features = () => (
  <Scene duration={SCENES.features}>
    <Glow y={20} />
    <AbsoluteFill style={{ padding: "100px 140px", alignItems: "center" }}>
      <Reveal style={{ fontSize: 68, fontWeight: 700, letterSpacing: "-0.03em", textAlign: "center", whiteSpace: "nowrap" }}>
        Everything you need to understand your money
      </Reveal>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 28, marginTop: 70, width: "100%" }}>
        {FEATURES.map((f, i) => (
          <Pop key={f.title} delay={22 + i * 9} style={{ gridColumn: i < 3 ? "span 2" : "span 3" }}>
            <Card style={{ padding: 36, height: 320 }}>
              <div style={{ width: 76, height: 76, borderRadius: 24, background: C.elevated, display: "flex", alignItems: "center", justifyContent: "center" }}><f.Icon size={40} strokeWidth={1.8} /></div>
              <div style={{ marginTop: 24, fontSize: 36, fontWeight: 600, letterSpacing: "-0.02em" }}>{f.title}</div>
              <div style={{ marginTop: 10, fontSize: 25, color: C.muted, lineHeight: 1.4 }}>{f.body}</div>
            </Card>
          </Pop>
        ))}
      </div>
    </AbsoluteFill>
  </Scene>
);
