import { AbsoluteFill, Img, staticFile } from "remotion";
import { C, SCENES } from "../theme";
import { Glow, Pop, Reveal, Scene } from "../ui";

export const Outro = () => (
  <Scene duration={SCENES.outro}>
    <Glow y={50} />
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <Pop><Img src={staticFile("logo.png")} style={{ width: 130, height: 130 }} /></Pop>
      <Reveal delay={10} style={{ marginTop: 44, fontSize: 104, fontWeight: 700, letterSpacing: "-0.035em" }}>Start understanding your money.</Reveal>
      <Reveal delay={26} style={{ marginTop: 28, fontSize: 40, color: C.muted }}>Open Equidy and ask your first question.</Reveal>
      <Reveal delay={46} style={{ marginTop: 70 }}>
        <Img src={staticFile("wordmark.png")} style={{ height: 64 }} />
      </Reveal>
    </AbsoluteFill>
  </Scene>
);
