import type { ReactNode } from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { C, FONT, FONT_FACE_CSS } from "../theme";
import { Chip } from "../ui";

export const POST_WIDTH = 1080;
export const POST_HEIGHT = 1350; // 4:5, the tallest Instagram feed format
export const POST_COUNT = 7;

interface PostFrameProps {
  index: number;
  kicker: string;
  title: ReactNode;
  body?: string;
  /** Shown bottom-left when the post contains example numbers. */
  illustrative?: boolean;
  children?: ReactNode;
}

/** Static layout shared by every post: brand row, headline block, visual, footer. */
export const PostFrame = ({ index, kicker, title, body, illustrative = false, children }: PostFrameProps) => (
  <AbsoluteFill style={{ background: C.bg, color: C.fg, fontFamily: FONT, padding: 80 }}>
    <style>{FONT_FACE_CSS}</style>
    <AbsoluteFill style={{ background: "radial-gradient(900px 700px at 50% 0%, rgba(255,255,255,0.09), transparent 70%)" }} />
    <div style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Img src={staticFile("wordmark.png")} style={{ height: 44 }} />
        <div style={{ fontSize: 26, color: C.muted, fontVariantNumeric: "tabular-nums" }}>
          {String(index).padStart(2, "0")} / {String(POST_COUNT).padStart(2, "0")}
        </div>
      </div>
      <div style={{ marginTop: 72 }}><Chip>{kicker}</Chip></div>
      <div style={{ marginTop: 28, fontSize: 84, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1.04 }}>{title}</div>
      {body && <div style={{ marginTop: 24, fontSize: 34, color: C.muted, lineHeight: 1.4 }}>{body}</div>}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", paddingTop: 48 }}>{children}</div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, color: C.muted, marginTop: 32 }}>
        <span>{illustrative ? "Illustrative example, not live data" : ""}</span>
        <span>Analysis, not advice.</span>
      </div>
    </div>
  </AbsoluteFill>
);

export const Row = ({ label, detail, value, color }: { label: string; detail?: string; value: string; color?: string }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: C.elevated, borderRadius: 24, padding: "20px 28px" }}>
    <div>
      <div style={{ fontSize: 30, fontWeight: 500 }}>{label}</div>
      {detail && <div style={{ fontSize: 22, color: C.muted, marginTop: 2 }}>{detail}</div>}
    </div>
    <div style={{ fontSize: 32, fontWeight: 600, color: color ?? C.fg, fontVariantNumeric: "tabular-nums" }}>{value}</div>
  </div>
);
