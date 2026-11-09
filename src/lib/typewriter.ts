// Paces streamed text so replies type out at a readable speed instead of appearing in bursts.

/** Characters per second when the reply is keeping up with the stream. */
const BASE_CHARS_PER_SECOND = 70;
/** A backlog is worked through in about this many seconds, so long replies never lag far behind. */
const CATCH_UP_SECONDS = 8;
/** Longest frame gap counted, so a paused tab doesn't dump everything at once on return. */
const MAX_FRAME_MS = 100;

/** How many queued characters to reveal after `dtMs` milliseconds. */
export function revealCount(backlog: number, dtMs: number): number {
  if (backlog <= 0 || dtMs <= 0) return 0;
  const perSecond = BASE_CHARS_PER_SECOND + backlog / CATCH_UP_SECONDS;
  return Math.min(backlog, Math.max(1, Math.round((perSecond * Math.min(dtMs, MAX_FRAME_MS)) / 1000)));
}

/** Avoids cutting an emoji or other surrogate pair in half. */
function safeCut(text: string, n: number): number {
  const code = text.charCodeAt(n - 1);
  return code >= 0xd800 && code <= 0xdbff && n < text.length ? n + 1 : n;
}

export interface Typewriter {
  push(text: string): void;
  /** Resolves once everything pushed so far has been shown. */
  drained(): Promise<void>;
  /** Shows everything immediately and returns the full text. */
  finish(): string;
}

export function createTypewriter(onText: (shown: string) => void): Typewriter {
  let shown = "";
  let queue = "";
  let frame = 0;
  let last = 0;
  let waiters: (() => void)[] = [];

  const settle = () => {
    waiters.forEach((resolve) => resolve());
    waiters = [];
  };

  const tick = (now: number) => {
    const n = revealCount(queue.length, now - last);
    last = now;
    if (n) {
      const cut = safeCut(queue, n);
      shown += queue.slice(0, cut);
      queue = queue.slice(cut);
      onText(shown);
    }
    if (queue) frame = requestAnimationFrame(tick);
    else {
      frame = 0;
      settle();
    }
  };

  return {
    push(text) {
      queue += text;
      if (!frame && queue) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      }
    },
    drained: () => (queue ? new Promise<void>((resolve) => waiters.push(resolve)) : Promise.resolve()),
    finish() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      shown += queue;
      queue = "";
      onText(shown);
      settle();
      return shown;
    },
  };
}
