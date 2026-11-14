import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT } from "./theme";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const ease = Easing.bezier(0.16, 1, 0.3, 1);

/** 0→1 progress between two frames with an ease-out curve. */
export const prog = (frame: number, from: number, to: number) =>
  interpolate(frame, [from, to], [0, 1], { ...clamp, easing: ease });

/** Fades a whole scene in and out so scenes cross-dissolve against the black background. */
export const Scene = ({ children, duration }: { children: ReactNode; duration: number }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 12, duration - 12, duration], [0, 1, 1, 0], clamp);
  return (
    <AbsoluteFill style={{ opacity, backgroundColor: C.bg, fontFamily: FONT, color: C.fg }}>{children}</AbsoluteFill>
  );
};

/** Rises and fades in `delay` frames after the scene starts. */
export const Reveal = ({ delay = 0, y = 28, children, style }: { delay?: number; y?: number; children: ReactNode; style?: CSSProperties }) => {
  const p = prog(useCurrentFrame(), delay, delay + 24);
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * y}px)`, ...style }}>{children}</div>;
};

export const Pop = ({ delay = 0, children, style }: { delay?: number; children: ReactNode; style?: CSSProperties }) => {
  const { fps } = useVideoConfig();
  const s = spring({ frame: useCurrentFrame() - delay, fps, config: { damping: 16, stiffness: 140 } });
  return <div style={{ opacity: Math.min(1, s * 1.6), transform: `scale(${0.9 + s * 0.1})`, ...style }}>{children}</div>;
};

export const Card = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 32, ...style }}>{children}</div>
);

export const Chip = ({ children }: { children: ReactNode }) => (
  <div style={{ display: "inline-block", padding: "10px 24px", borderRadius: 999, background: C.elevated, color: C.muted, fontSize: 24, fontWeight: 500 }}>
    {children}
  </div>
);

/** Soft ambient glow behind a scene; drifts slowly so static frames never feel dead. */
export const Glow = ({ x = 50, y = 40 }: { x?: number; y?: number }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(900px 600px at ${x + Math.sin(f / 60) * 4}% ${y + Math.cos(f / 70) * 4}%, rgba(255,255,255,0.09), transparent 70%)`,
      }}
    />
  );
};
