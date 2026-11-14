import { AbsoluteFill, Audio, Series, staticFile } from "remotion";
import { C, FONT_FACE_CSS, SCENES } from "./theme";
import { Chat } from "./scenes/Chat";
import { Features } from "./scenes/Features";
import { Intro } from "./scenes/Intro";
import { Outro } from "./scenes/Outro";
import { Steps } from "./scenes/Steps";

export type PromoProps = { voiceover: boolean };

/** `voiceover` plays public/voiceover.wav: the generated track, or a human recording saved over it (see VOICEOVER.md). */
export const Promo = ({ voiceover }: PromoProps) => (
  <AbsoluteFill style={{ backgroundColor: C.bg }}>
    <style>{FONT_FACE_CSS}</style>
    {voiceover && <Audio src={staticFile("voiceover.wav")} />}
    <Series>
      <Series.Sequence durationInFrames={SCENES.intro}><Intro /></Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.chat}><Chat /></Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.features}><Features /></Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.steps}><Steps /></Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.outro}><Outro /></Series.Sequence>
    </Series>
  </AbsoluteFill>
);
