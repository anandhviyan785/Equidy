import { describe, expect, it } from "vitest";
import { compound, maxDrawdown, positions, riskMetrics, stdev, summarize, valueAtRisk } from "@/lib/finance";
import { history } from "@/lib/market";
import { answer } from "@/lib/engine";
import type { Snapshot } from "@/lib/context";

describe("finance math", () => {
  it("compounds monthly contributions", () => {
    const rows = compound(1000, 0, 0.12, 1);
    expect(rows[0].balance).toBeCloseTo(1000 * 1.01 ** 12, 6);
    const withContrib = compound(0, 100, 0, 2);
    expect(withContrib[1].balance).toBeCloseTo(2400);
  });

  it("computes drawdown, stdev and VaR", () => {
    expect(maxDrawdown([100, 120, 90, 130])).toBeCloseTo(-0.25);
    expect(stdev([1, 2, 3, 4])).toBeCloseTo(1.2910, 3);
    expect(valueAtRisk([-0.05, -0.02, 0, 0.01, 0.02, 0.03, 0.01, 0, -0.01, 0.02], 0.9)).toBeCloseTo(0.02);
  });

  it("values positions and weights", () => {
    const rows = positions(
      [{ id: "a", symbol: "AAPL", shares: 10, costBasis: 100, addedAt: 0 }, { id: "b", symbol: "BND", shares: 10, costBasis: 100, addedAt: 0 }],
      { AAPL: { price: 300, prevClose: 290 }, BND: { price: 100, prevClose: 100 } },
    );
    expect(rows[0].symbol).toBe("AAPL");
    expect(rows[0].weight).toBeCloseTo(0.75);
    const t = summarize(rows);
    expect(t.value).toBe(4000);
    expect(t.pnl).toBe(2000);
    expect(t.dayChange).toBe(100);
  });

  it("produces deterministic history ending at the reference price", () => {
    const a = history("TEST", 50, 0.2, 0.05, 1, 100);
    expect(a).toHaveLength(100);
    expect(a[a.length - 1].close).toBeCloseTo(50);
  });

  it("market beta is recoverable from simulated series", () => {
    const spy = history("SPY", 600, 0.16, 0.09, 1);
    const hi = history("NVDA", 180, 0.48, 0.2, 1.72);
    const m = riskMetrics(hi, spy, [1]);
    expect(m!.beta).toBeGreaterThan(1.2);
    expect(m!.beta).toBeLessThan(2.3);
  });
});

describe("offline engine", () => {
  const snap = {
    rows: [], total: { value: 0, cost: 0, pnl: 0, pnlPct: 0, dayChange: 0, dayChangePct: 0 }, metrics: null, sectors: [], watchlist: [], indices: [],
    prices: new Proxy({}, { get: () => ({ price: 100, prevClose: 99 }) }), riskProfile: "moderate", responseStyle: "balanced",
  } as unknown as Snapshot;

  it("routes intents", () => {
    expect(answer("Analyze Apple's financial performance", snap)).toContain("Apple Inc. (AAPL)");
    expect(answer("Explain how compound interest works", snap)).toContain("compound interest");
    expect(answer("Compare MSFT vs GOOGL", snap)).toContain("MSFT vs GOOGL");
    expect(answer("Analyze my investment portfolio", snap)).toContain("portfolio is empty");
    expect(answer("What is a P/E ratio?", snap)).toContain("Price-to-Earnings");
  });
});

describe("conversation", () => {
  const snap = {
    rows: [], total: { value: 0, cost: 0, pnl: 0, pnlPct: 0, dayChange: 0, dayChangePct: 0 }, metrics: null, sectors: [], watchlist: [], indices: [],
    prices: new Proxy({}, { get: () => ({ price: 100, prevClose: 99 }) }), riskProfile: "moderate", responseStyle: "balanced", userName: "Anandh Sridhar",
  } as unknown as Snapshot;

  it("greets the user by first name, without finance boilerplate", () => {
    for (const hi of ["hi", "Hello!", "hey there", "good morning"]) {
      const r = answer(hi, snap);
      expect(r).toContain("Anandh");
      expect(r).not.toContain("not personalised investment advice");
    }
  });

  it("responds warmly to feelings, thanks and off-topic chat", () => {
    expect(answer("how are you?", snap)).toMatch(/thanks for asking|wonderful/);
    expect(answer("thanks!", snap)).toContain("Anandh");
    expect(answer("I'm so stressed today", snap)).toContain("sorry you're feeling");
    expect(answer("what's your favourite pizza", snap)).toMatch(/Anandh.*(chat|numbers-and-markets)/s);
    expect(answer("what is diversification", snap)).toContain("## Diversification");
    expect(answer("tell me a joke", snap)).toContain("Anandh");
  });

  it("still answers finance questions, with a hello when greeted", () => {
    const r = answer("hi, analyze apple", snap);
    expect(r).toContain("Hi Anandh!");
    expect(r).toContain("Apple Inc. (AAPL)");
    expect(answer("Explain how compound interest works", snap)).toContain("compound interest");
  });
});
