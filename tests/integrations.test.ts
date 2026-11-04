import { describe, expect, it } from "vitest";
import { intelToText, parseMetrics, parseNews } from "../server/finnhub";
import { parseUserData } from "../server/userdata";
import { mergeHistory } from "../src/lib/market";

describe("Finnhub parsing", () => {
  it("keeps valid news and known metrics", () => {
    const news = parseNews([{ headline: "Up", url: "https://x.y/1", source: "Reuters", datetime: 1_800_000_000 }, { headline: "", url: "https://x" }, { headline: "bad url", url: "javascript:alert(1)" }], 5);
    expect(news).toHaveLength(1);
    expect(news[0].datetime).toBe(1_800_000_000_000);
    expect(parseMetrics({ metric: { peTTM: 30.1, beta: null, unknown: 3 } })).toEqual({ peTTM: 30.1 });
    const text = intelToText({ symbol: "AAPL", profile: null, metrics: { peTTM: 30 }, recommendation: { period: "2026-11-01", strongBuy: 10, buy: 20, hold: 5, sell: 1, strongSell: 0 }, earnings: [], peers: ["MSFT"], news, asOf: 0 });
    expect(text).toContain("P/E (TTM) 30.00");
    expect(text).toContain("strong buy 10");
    expect(text).toContain("Peers: MSFT");
  });
});

describe("cloud sync documents", () => {
  it("normalises and bounds what the browser sends", () => {
    const d = parseUserData({ portfolio: { holdings: [{ symbol: "AAPL" }, 5], watchlist: ["TSLA", 3] }, chats: [{ id: "c" }, "x"], settings: { theme: "dark" }, updatedAt: 7 });
    expect(d).toEqual({ portfolio: { holdings: [{ symbol: "AAPL" }], watchlist: ["TSLA"] }, chats: [{ id: "c" }], settings: { theme: "dark" }, updatedAt: 7 });
    expect(() => parseUserData("nope")).toThrow();
  });
});

describe("history merge", () => {
  it("joins real bars onto a rescaled simulated prefix with the requested length", () => {
    const sim = Array.from({ length: 10 }, (_, i) => ({ t: i, close: 100 + i }));
    const real = [{ t: 1000, close: 50 }, { t: 2000, close: 51 }, { t: 3000, close: 52 }];
    const m = mergeHistory(sim, real, 10);
    expect(m).toHaveLength(10);
    expect(m.slice(-3)).toEqual(real);
    expect(m[6].close).toBeCloseTo(106 * (50 / 107)); // scaled so sim[7] would meet the first real close
    expect(m[6].t).toBeLessThan(1000);
    expect(mergeHistory(sim, real, 2)).toEqual(real.slice(-2));
  });
});
