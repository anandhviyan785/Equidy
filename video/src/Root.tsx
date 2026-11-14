import { Composition } from "remotion";
import type React from "react";
import { Promo, type PromoProps } from "./Promo";
import { FPS, HEIGHT, TOTAL, WIDTH } from "./theme";

export const Root = () => (
  <Composition id="EquidyPromo" component={Promo as React.FC<PromoProps>} defaultProps={{ voiceover: true }} durationInFrames={TOTAL} fps={FPS} width={WIDTH} height={HEIGHT} />
);
