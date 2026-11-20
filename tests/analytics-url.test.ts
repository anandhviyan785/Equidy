import { describe, expect, it } from "vitest";
import { sanitizeEventUrl } from "../src/lib/analytics";

describe("sanitizeEventUrl", () => {
  it("drops the reset token query from the URL", () => {
    expect(sanitizeEventUrl("https://equidy.app/reset-password?token=secret")).toBe("https://equidy.app/reset-password");
  });
  it("drops hashes and conversation ids", () => {
    expect(sanitizeEventUrl("https://equidy.app/c/abc123?x=1#y")).toBe("https://equidy.app/c");
  });
  it("falls back to a cleaned path for relative input", () => {
    expect(sanitizeEventUrl("/reset-password?token=secret")).toBe("/reset-password");
  });
});
