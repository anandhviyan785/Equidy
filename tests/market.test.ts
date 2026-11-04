import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { avProblem, getHistory, getQuotes, parseAvDaily, parseAvGlobalQuote, parseFinnhubQuote, resetMarketState } from "../server/market";
import { clearCache } from "../server/cache";

const fetchMock = vi.fn();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  clearCache();
  resetMarketState();
  delete process.env.DATABASE_URL;
  delete process.env.ALPHAVANTAGE_PREMIUM;
  process.env.ALPHAVANTAGE_API_KEY = "av-test";
  process.env.FINNHUB_API_KEY = "fh-test";
});
afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe("Alpha Vantage parsing", () => {
  it("parses GLOBAL_QUOTE", () => {
    const q = parseAvGlobalQuote({ "Global Quote": { "05. price": "231.50", "08. previous close": "229.00", "07. latest trading day": "2026-11-03" } });
    expect(q).toMatchObject({ price: 231.5, prevClose: 229, source: "alphavantage" });
    expect(q!.asOf).toBe(Date.UTC(2026, 10, 3, 21));
    expect(parseAvGlobalQuote({ "Global Quote": {} })).toBeNull();
  });

  it("parses daily series ascending, and drops crypto weekends", () => {
    const stock = parseAvDaily({ "Time Series (Daily)": { "2026-11-03": { "4. close": "11" }, "2026-11-02": { "4. close": "10" } } }, false);
    expect(stock.map((b) => b.close)).toEqual([10, 11]);
    // 2026-11-01 is a Sunday; older responses use "4a. close (USD)".
    const crypto = parseAvDaily({ "Time Series (Digital Currency Daily)": { "2026-11-02": { "4. close": "70000" }, "2026-11-01": { "4a. close (USD)": "69000" } } }, true);
    expect(crypto.map((b) => b.close)).toEqual([70000]);
  });

  it("recognises rate-limit notices", () => {
    expect(avProblem({ Information: "We have detected your API key and our standard API rate limit is 25 requests per day." })).toMatchObject({ limited: true, daily: true });
    expect(avProblem({ "Error Message": "Invalid API call." })).toMatchObject({ limited: false });
    expect(avProblem({ "Global Quote": {} })).toBeNull();
  });
});

describe("quotes and history", () => {
  it("parses Finnhub quotes", () => {
    expect(parseFinnhubQuote({ c: 10, pc: 9, t: 1_800_000_000 })).toEqual({ price: 10, prevClose: 9, asOf: 1_800_000_000_000, source: "finnhub" });
    expect(parseFinnhubQuote({ c: 0, pc: 0 })).toBeNull();
  });

  it("uses Finnhub for quotes and falls back to Alpha Vantage", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("finnhub.io") && url.includes("symbol=AAPL")) return json({ c: 200, pc: 198, t: 1 });
      if (url.includes("finnhub.io")) return json({ c: 0, pc: 0 });
      if (url.includes("GLOBAL_QUOTE")) return json({ "Global Quote": { "05. price": "50", "08. previous close": "49" } });
      throw new Error("unexpected " + url);
    });
    const q = await getQuotes(["AAPL", "KO", "bad symbol!"]);
    expect(q.AAPL.source).toBe("finnhub");
    expect(q.KO).toMatchObject({ price: 50, source: "alphavantage" });
    expect(Object.keys(q).sort()).toEqual(["AAPL", "KO"]);
    expect(fetchMock.mock.calls[0][1].headers["X-Finnhub-Token"]).toBe("fh-test");
  });

  it("caches history and stops calling Alpha Vantage after its daily limit", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("symbol=MSFT")) return json({ "Time Series (Daily)": { "2026-11-02": { "4. close": "500" }, "2026-11-03": { "4. close": "505" } } });
      return json({ Information: "Our standard API rate limit is 25 requests per day." });
    });
    const h = await getHistory("MSFT");
    expect(h).toMatchObject({ source: "alphavantage", full: false });
    expect(h!.bars.map((b) => b.close)).toEqual([500, 505]);
    await getHistory("MSFT");
    expect(fetchMock.mock.calls.length).toBe(1); // cached
    expect(await getHistory("NVDA")).toBeNull(); // limit reached
    expect(await getHistory("JPM")).toBeNull();
    expect(fetchMock.mock.calls.length).toBe(2); // paused, no further calls
  });

  it("derives a quote from cached history when no quote source answers", async () => {
    delete process.env.FINNHUB_API_KEY;
    fetchMock.mockImplementation(async () => json({ "Time Series (Daily)": { "2026-11-02": { "4. close": "100" }, "2026-11-03": { "4. close": "102" } } }));
    await getHistory("PG");
    const q = await getQuotes(["PG"]);
    expect(q.PG).toMatchObject({ price: 102, prevClose: 100 });
    expect(fetchMock.mock.calls.length).toBe(1);
  });
});
