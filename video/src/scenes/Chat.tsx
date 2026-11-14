import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, SCENES } from "../theme";
import { Card, Chip, Glow, Reveal, Scene, clamp, prog } from "../ui";

const QUESTION = "Why is my portfolio down this month?";
const MOVES = [
  { label: "Technology", detail: "52% of your portfolio", value: "−3.4%", down: true },
  { label: "Financials", detail: "21% of your portfolio", value: "+1.2%", down: false },
  { label: "Healthcare", detail: "14% of your portfolio", value: "+0.4%", down: false },
];
const CHART = [44, 47, 46, 52, 50, 56, 54, 58, 55, 52, 54, 49, 47, 50, 46, 45, 46, 43];
const CW = 520;
const CH = 170;
const lo = Math.min(...CHART);
const hi = Math.max(...CHART);
const PTS = CHART.map((v, i) => [(i / (CHART.length - 1)) * CW, CH - 14 - ((v - lo) / (hi - lo)) * (CH - 28)] as const);
const LINE = PTS.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");

export const Chat = () => {
  const frame = useCurrentFrame();
  const typed = Math.floor(interpolate(frame, [12, 52], [0, QUESTION.length], clamp));
  const draw = prog(frame, 100, 170);
  return (
    <Scene duration={SCENES.chat}>
      <Glow x={30} y={50} />
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", padding: "0 140px", gap: 100 }}>
        <div style={{ flex: 1 }}>
          <Reveal><Chip>Ask Equidy anything</Chip></Reveal>
          <Reveal delay={8} style={{ marginTop: 28, fontSize: 80, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.08 }}>
            Clear answers,<br />with the working shown.
          </Reveal>
          <Reveal delay={20} style={{ marginTop: 28, fontSize: 32, color: C.muted, lineHeight: 1.45, maxWidth: 640 }}>
            Balanced views with the bull case, the bear case and the key risks.
          </Reveal>
        </div>
        <Reveal y={50} style={{ width: 920 }}>
          <Card style={{ padding: 44, boxShadow: "0 30px 80px rgba(0,0,0,.6)" }}>
            <div style={{ display: "flex", justifyContent: "flex-end", minHeight: 76 }}>
              {typed > 0 && (
                <div style={{ background: C.elevated, borderRadius: "36px 36px 8px 36px", padding: "18px 30px", fontSize: 30 }}>
                  {QUESTION.slice(0, typed)}
                  {typed < QUESTION.length && <span style={{ opacity: frame % 16 < 8 ? 1 : 0 }}>|</span>}
                </div>
              )}
            </div>
            <div style={{ opacity: prog(frame, 62, 82), marginTop: 28, fontSize: 28, lineHeight: 1.5 }}>
              Your portfolio is down about <b>2.1%</b> this month, mostly because of your technology holdings.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 22 }}>
              {MOVES.map((m, i) => {
                const p = prog(frame, 84 + i * 10, 104 + i * 10);
                return (
                  <div key={m.label} style={{ opacity: p, transform: `translateX(${(1 - p) * 30}px)`, display: "flex", justifyContent: "space-between", alignItems: "center", background: C.elevated, borderRadius: 22, padding: "16px 26px" }}>
                    <div>
                      <div style={{ fontSize: 26, fontWeight: 500 }}>{m.label}</div>
                      <div style={{ fontSize: 20, color: C.muted }}>{m.detail}</div>
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 600, color: m.down ? C.down : C.up, fontVariantNumeric: "tabular-nums" }}>{m.value}</div>
                  </div>
                );
              })}
            </div>
            <svg width="100%" viewBox={`0 0 ${CW} ${CH}`} style={{ marginTop: 26, opacity: prog(frame, 100, 118) }}>
              <path d={LINE} fill="none" stroke={C.down} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
            </svg>
          </Card>
        </Reveal>
      </AbsoluteFill>
    </Scene>
  );
};
