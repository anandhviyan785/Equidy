import { Composition, Still } from "remotion";
import { POST_HEIGHT, POST_WIDTH } from "./posts/PostFrame";
import { POSTS } from "./posts/Posts";
import type React from "react";
import { Promo, type PromoProps } from "./Promo";
import { FPS, HEIGHT, TOTAL, WIDTH } from "./theme";

export const Root = () => (
  <>
    <Composition id="EquidyPromo" component={Promo as React.FC<PromoProps>} defaultProps={{ voiceover: true }} durationInFrames={TOTAL} fps={FPS} width={WIDTH} height={HEIGHT} />
    {POSTS.map((Post, i) => (
      <Still key={i} id={`Post${i + 1}`} component={Post} width={POST_WIDTH} height={POST_HEIGHT} />
    ))}
  </>
);
