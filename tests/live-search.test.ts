import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sourcesOf, streamGenerate } from "../server/gemini";
import { currentTimeNote } from "../server/freshness";

const req = { model: "gemini-test", instructions: "sys", input: [{ role: "user" as const, content: "Is Anthropic public?" }], maxOutputTokens: 100 };

function sse(events: object[]): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(""));
  return new ReadableStream({ start(c) { c.enqueue(bytes); c.close(); } });
}

const grounded = (text: string, chunks: { uri: string; title: string }[], finishReason?: string) => ({
  candidates: [{ content: { parts: [{ text }] }, ...(finishReason ? { finishReason } : {}), groundingMetadata: { groundingChunks: chunks.map((web) => ({ web })) } }],
});

const fetchMock = vi.fn();
beforeEach(() => { vi.stubGlobal("fetch", fetchMock); process.env.GEMINI_API_KEY = "gm-test"; });
afterEach(() => { fetchMock.mockReset(); vi.unstubAllGlobals(); });

describe("live web search", () => {
  it("turns on Google Search grounding only when asked", async () => {
    fetchMock.mockResolvedValue(new Response(sse([grounded("ok", [], "STOP")]), { status: 200 }));
    await streamGenerate({ ...req, webSearch: true }, () => {});
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).tools).toEqual([{ google_search: {} }]);

    fetchMock.mockResolvedValue(new Response(sse([grounded("ok", [], "STOP")]), { status: 200 }));
    await streamGenerate(req, () => {});
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).tools).toBeUndefined();
  });

  it("collects unique web sources from grounding metadata", () => {
    const r = grounded("x", [{ uri: "https://a.example/1", title: "a.example" }, { uri: "https://a.example/1", title: "a.example" }, { uri: "https://b.example", title: "b.example" }]);
    expect(sourcesOf(r)).toEqual([{ uri: "https://a.example/1", title: "a.example" }, { uri: "https://b.example", title: "b.example" }]);
  });

  it("appends a Sources list after a grounded answer", async () => {
    fetchMock.mockResolvedValue(new Response(sse([grounded("Yes, it listed today.", [{ uri: "https://news.example/ipo", title: "news.example" }], "STOP")]), { status: 200 }));
    let text = "";
    await streamGenerate({ ...req, webSearch: true }, (d) => (text += d));
    expect(text).toContain("Yes, it listed today.");
    expect(text).toMatch(/Sources[\s\S]*\[news\.example\]\(https:\/\/news\.example\/ipo\)/);
  });
});

describe("currentTimeNote", () => {
  it("gives the model the exact UTC time and tells it to search", () => {
    const note = currentTimeNote(new Date("2026-11-20T09:41:05Z"));
    expect(note).toContain("Friday, 2026-11-20 09:41 UTC");
    expect(note).toMatch(/search/i);
  });
});
