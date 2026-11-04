import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { describeError, generate, GeminiError, sseEvents, streamGenerate, toContents } from "../server/gemini";

const req = { model: "gemini-test", instructions: "sys", input: [{ role: "user" as const, content: "hi" }], maxOutputTokens: 100 };

function sse(events: object[], splitAt = 7): ReadableStream<Uint8Array> {
  const text = events.map((e) => `data: ${JSON.stringify(e)}\r\n\r\n`).join("");
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream({
    start(c) {
      for (let i = 0; i < bytes.length; i += splitAt) c.enqueue(bytes.slice(i, i + splitAt));
      c.close();
    },
  });
}

const chunk = (text: string, finishReason?: string) => ({ candidates: [{ content: { role: "model", parts: [{ text }] }, ...(finishReason ? { finishReason } : {}) }] });

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  process.env.GEMINI_API_KEY = "gm-test";
});
afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe("Gemini client", () => {
  it("parses SSE events split across chunks", async () => {
    const out: unknown[] = [];
    for await (const e of sseEvents(sse([{ a: 1 }, { b: 2 }], 3))) out.push(e);
    expect(out).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("maps roles and merges consecutive turns", () => {
    expect(toContents([{ role: "user", content: "a" }, { role: "user", content: "b" }, { role: "assistant", content: "c" }])).toEqual([
      { role: "user", parts: [{ text: "a\n\nb" }] },
      { role: "model", parts: [{ text: "c" }] },
    ]);
  });

  it("sends the key, system instruction and thinking level", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(chunk("ok", "STOP")), { status: 200 }));
    await generate({ ...req, thinking: "low" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/models\/gemini-test:generateContent$/);
    expect(init.headers["x-goog-api-key"]).toBe("gm-test");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ systemInstruction: { parts: [{ text: "sys" }] }, generationConfig: { maxOutputTokens: 100, thinkingConfig: { thinkingLevel: "low" } } });
    expect(body.contents).toEqual([{ role: "user", parts: [{ text: "hi" }] }]);
  });

  it("returns text without thought summaries", async () => {
    const r = { candidates: [{ content: { parts: [{ text: "thinking…", thought: true }, { text: "Apple " }, { text: "Earnings" }] }, finishReason: "STOP" }] };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(r), { status: 200 }));
    expect(await generate(req)).toEqual({ text: "Apple Earnings", finish: "completed" });
  });

  it("streams text deltas and reports truncation", async () => {
    fetchMock.mockResolvedValue(new Response(sse([chunk("Hello"), chunk(" there"), chunk("", "MAX_TOKENS")]), { status: 200 }));
    let text = "";
    const finish = await streamGenerate(req, (d) => (text += d));
    expect(text).toBe("Hello there");
    expect(finish).toBe("max_tokens");
    expect(fetchMock.mock.calls[0][0]).toMatch(/:streamGenerateContent\?alt=sse$/);
  });

  it("flags blocked prompts and safety stops", async () => {
    fetchMock.mockResolvedValue(new Response(sse([{ promptFeedback: { blockReason: "SAFETY" } }]), { status: 200 }));
    expect(await streamGenerate(req, () => {})).toBe("refusal");
    fetchMock.mockResolvedValue(new Response(sse([chunk("x", "SAFETY")]), { status: 200 }));
    expect(await streamGenerate(req, () => {})).toBe("refusal");
  });

  it("maps HTTP errors to safe messages", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: { code: 400, message: "API key not valid. Please pass a valid API key.", status: "INVALID_ARGUMENT" } }), { status: 400 }));
    const err = await generate(req).catch((e) => e);
    expect(err).toBeInstanceOf(GeminiError);
    expect(describeError(err)).toBe("The server's Gemini API key was rejected.");
    expect(describeError(new GeminiError("quota", 429, "RESOURCE_EXHAUSTED"))).toMatch(/free usage limit/);
  });

  it("throws on an error inside the stream", async () => {
    fetchMock.mockResolvedValue(new Response(sse([chunk("a"), { error: { code: 500, message: "boom", status: "INTERNAL" } }]), { status: 200 }));
    await expect(streamGenerate(req, () => {})).rejects.toThrow("boom");
  });
});
