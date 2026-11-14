import { Composition } from "remotion";
import { Promo } from "./Promo";
import { FPS, HEIGHT, TOTAL, WIDTH } from "./theme";

export const Root = () => (
  <Composition id="EquidyPromo" component={Promo} durationInFrames={TOTAL} fps={FPS} width={WIDTH} height={HEIGHT} />
);
