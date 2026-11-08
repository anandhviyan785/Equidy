import { describe, expect, it } from "vitest";
import { hasUsedEquidy, markUsedEquidy, signedOutPath } from "@/lib/visitor";

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

describe("visitor tracking", () => {
  it("treats an empty browser as a brand-new visitor", () => {
    const store = memory();
    expect(hasUsedEquidy(store)).toBe(false);
    expect(signedOutPath(store)).toBe("/welcome");
  });

  it("sends people to login once they have been marked as used", () => {
    const store = memory();
    markUsedEquidy(store);
    expect(hasUsedEquidy(store)).toBe(true);
    expect(signedOutPath(store)).toBe("/login");
  });

  it("recognises existing users who have a saved session", () => {
    const store = memory({ "equidy.auth": JSON.stringify({ state: { user: { id: "u1" } } }) });
    expect(hasUsedEquidy(store)).toBe(true);
  });

  it("recognises existing users who have saved chats", () => {
    const store = memory({ "equidy.chats": JSON.stringify({ state: { conversations: [{ id: "c1" }] } }) });
    expect(hasUsedEquidy(store)).toBe(true);
  });

  it("ignores empty persisted state written on first load", () => {
    const store = memory({
      "equidy.auth": JSON.stringify({ state: { user: null } }),
      "equidy.chats": JSON.stringify({ state: { conversations: [] } }),
    });
    expect(hasUsedEquidy(store)).toBe(false);
  });

  it("survives corrupt stored data and missing storage", () => {
    expect(hasUsedEquidy(memory({ "equidy.auth": "{not json" }))).toBe(false);
    expect(hasUsedEquidy(null)).toBe(false);
    expect(() => markUsedEquidy(null)).not.toThrow();
  });

  it("falls back to new-visitor when storage throws", () => {
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(hasUsedEquidy(broken)).toBe(false);
    expect(() => markUsedEquidy(broken)).not.toThrow();
  });
});
