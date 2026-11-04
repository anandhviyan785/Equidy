import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createResponse, describeError, OpenAIError, sseEvents, streamResponse } from "../server/openai";

const req = { model: "gpt-test", instructions: "sys", input: [{ role: "user" as const, content: "hi" }], maxOutputTokens: 100, effort: "low" as const };

function sse(events: object[], splitAt = 7): ReadableStream<Uint8Array> {
  const text = events.map((e) => `event: x\ndata: ${JSON.stringify(e)}\n\n`).join("");
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream({
    start(c) {
      for (let i = 0; i < bytes.length; i += splitAt) c.enqueue(bytes.slice(i, i + splitAt));
      c.close();
    },
  });
}

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  process.env.OPENAI_API_KEY = "sk-test";
});
afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe("OpenAI Responses client", () => {
  it("parses SSE events split across chunks", async () => {
    const out: unknown[] = [];
    for await (const e of sseEvents(sse([{ type: "a" }, { type: "b", n: 2 }], 3))) out.push(e);
    expect(out).toEqual([{ type: "a" }, { type: "b", n: 2 }]);
  });

  it("sends the request to /responses with the key, model, instructions and effort", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: "completed", output: [] }), { status: 200 }));
    await createResponse(req);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/responses$/);
    expect(init.headers.Authorization).toBe("Bearer sk-test");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ model: "gpt-test", instructions: "sys", max_output_tokens: 100, reasoning: { effort: "low" }, store: false, stream: false });
    expect(body.input).toEqual([{ role: "user", content: "hi" }]);
  });

  it("returns output text from a one-shot response", async () => {
    const output = [{ type: "reasoning" }, { type: "message", content: [{ type: "output_text", text: "Apple " }, { type: "output_text", text: "Earnings" }] }];
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: "completed", output }), { status: 200 }));
    expect(await createResponse(req)).toEqual({ text: "Apple Earnings", finish: "completed" });
  });

  it("streams text deltas and reports truncation", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        sse([
          { type: "response.created" },
          { type: "response.output_text.delta", delta: "Hello" },
          { type: "response.output_text.delta", delta: " there" },
          { type: "response.incomplete", response: { status: "incomplete", incomplete_details: { reason: "max_output_tokens" } } },
        ]),
        { status: 200 },
      ),
    );
    let text = "";
    const finish = await streamResponse(req, (d) => (text += d));
    expect(text).toBe("Hello there");
    expect(finish).toBe("max_tokens");
  });

  it("flags refusals", async () => {
    fetchMock.mockResolvedValue(new Response(sse([{ type: "response.refusal.delta", delta: "no" }, { type: "response.completed", response: { status: "completed" } }]), { status: 200 }));
    expect(await streamResponse(req, () => {})).toBe("refusal");
  });

  it("maps HTTP errors to safe messages", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: { message: "bad key", code: "invalid_api_key" } }), { status: 401 }));
    const err = await createResponse(req).catch((e) => e);
    expect(err).toBeInstanceOf(OpenAIError);
    expect(describeError(err)).toBe("The server's OpenAI credentials were rejected.");
    expect(describeError(new OpenAIError("x", 429))).toMatch(/Rate limited/);
  });

  it("throws on a failed stream", async () => {
    fetchMock.mockResolvedValue(new Response(sse([{ type: "response.failed", response: { status: "failed", error: { message: "boom" } } }]), { status: 200 }));
    await expect(streamResponse(req, () => {})).rejects.toThrow("boom");
  });
});
