import { AbsoluteFill, Img, staticFile } from "remotion";
import { Chip, Glow, Pop, Reveal, Scene } from "../ui";
import { SCENES } from "../theme";

export const Intro = () => (
  <Scene duration={SCENES.intro}>
    <Glow />
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <Pop><Img src={staticFile("logo.png")} style={{ width: 150, height: 150 }} /></Pop>
      <Reveal delay={14} style={{ marginTop: 48 }}><Chip>AI-powered finance and investing</Chip></Reveal>
      <Reveal delay={24} style={{ marginTop: 36, fontSize: 104, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1.05 }}>
        Your financial intelligence,<br />reimagined.
      </Reveal>
      <Reveal delay={44} style={{ marginTop: 36, fontSize: 36, color: "#98989d", maxWidth: 1100, lineHeight: 1.4 }}>
        Ask questions, track what you own and learn how markets work.
      </Reveal>
    </AbsoluteFill>
  </Scene>
);
