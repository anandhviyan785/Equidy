import { AbsoluteFill } from "remotion";
import { C, SCENES } from "../theme";
import { Card, Glow, Pop, Reveal, Scene } from "../ui";

const STEPS = [
  { title: "Sign in", body: "Sign in with your account and open your dashboard." },
  { title: "Add your holdings", body: "Enter what you own, or skip this and start asking questions right away." },
  { title: "Ask, learn, decide", body: "Get clear answers with the working shown, then make your own decisions." },
];

export const Steps = () => (
  <Scene duration={SCENES.steps}>
    <Glow y={70} />
    <AbsoluteFill style={{ padding: "0 140px", alignItems: "center", justifyContent: "center" }}>
      <Reveal style={{ fontSize: 80, fontWeight: 700, letterSpacing: "-0.03em" }}>Up and running in three steps</Reveal>
      <div style={{ display: "flex", gap: 36, marginTop: 90, width: "100%" }}>
        {STEPS.map((s, i) => (
          <Pop key={s.title} delay={18 + i * 14} style={{ flex: 1 }}>
            <Card style={{ padding: 48, height: 400 }}>
              <div style={{ width: 72, height: 72, borderRadius: 36, background: C.fg, color: C.bg, fontSize: 36, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</div>
              <div style={{ marginTop: 28, fontSize: 44, fontWeight: 600, letterSpacing: "-0.02em" }}>{s.title}</div>
              <div style={{ marginTop: 14, fontSize: 28, color: C.muted, lineHeight: 1.4 }}>{s.body}</div>
            </Card>
          </Pop>
        ))}
      </div>
    </AbsoluteFill>
  </Scene>
);
