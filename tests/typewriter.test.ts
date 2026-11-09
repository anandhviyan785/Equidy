import { describe, expect, it } from "vitest";
import { revealCount } from "../src/lib/typewriter";

describe("revealCount", () => {
  it("reveals nothing when there is nothing queued or no time has passed", () => {
    expect(revealCount(0, 16)).toBe(0);
    expect(revealCount(50, 0)).toBe(0);
  });

  it("types short replies at a readable pace of roughly 70+ characters a second", () => {
    // One second's worth of 16ms frames with a small backlog.
    let shown = 0;
    let backlog = 200;
    for (let t = 0; t < 1000; t += 16) {
      const n = revealCount(backlog, 16);
      shown += n;
      backlog -= n;
    }
    expect(shown).toBeGreaterThan(60);
    expect(shown).toBeLessThan(140);
  });

  it("speeds up for a large backlog so long replies don't lag far behind", () => {
    expect(revealCount(4000, 100)).toBeGreaterThan(revealCount(100, 100) * 5);
  });

  it("never reveals more than is queued, and caps long frame gaps", () => {
    expect(revealCount(3, 1000)).toBe(3);
    expect(revealCount(10_000, 5000)).toBe(revealCount(10_000, 100));
  });
});
