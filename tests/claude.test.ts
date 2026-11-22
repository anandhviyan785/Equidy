import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { CLAUDE_MODEL, describeClaudeError, generateClaude, streamClaude } from "../server/claude";
import { chooseProvider } from "../server/ai";

type Event = Record<string, unknown>;
type Final = { stop_reason: string; content: Record<string, unknown>[] };

/** A stand-in for client.beta.messages.stream: replays events, then resolves the final message. */
function fakeClient(turns: { events: Event[]; final: Final }[]) {
  const stream = vi.fn((_params: Record<string, unknown>, _opts?: unknown) => {
    const turn = turns[stream.mock.calls.length - 1];
    return {
      async *[Symbol.asyncIterator]() { for (const e of turn.events) yield e; },
      finalMessage: async () => turn.final,
    };
  });
  return { client: { beta: { messages: { stream } } } as never, stream };
}

const delta = (text: string): Event => ({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text } });
const text = (t: string, citations?: unknown[]) => ({ type: "text", text: t, ...(citations ? { citations } : {}) });
const cite = (url: string, title: string) => ({ type: "web_search_result_location", url, title, cited_text: "", encrypted_index: "" });
const base = { instructions: "You are Equidy.", input: [{ role: "user" as const, content: "Hi" }], maxTokens: 16000, effort: "medium" as const };

describe("streamClaude", () => {
  it("streams text and calls Claude Opus 5.5 with refusal fallbacks", async () => {
    const { client, stream } = fakeClient([{ events: [delta("Hel"), delta("lo")], final: { stop_reason: "end_turn", content: [text("Hello")] } }]);
    const out: string[] = [];
    const finish = await streamClaude(base, (t) => out.push(t), client);
    expect(out.join("")).toBe("Hello");
    expect(finish).toBe("completed");
    const params = stream.mock.calls[0][0];
    expect(params.model).toBe(CLAUDE_MODEL);
    expect(CLAUDE_MODEL).toBe("claude-opus-5-5");
    expect(params.fallbacks).toBe("default");
    expect(params.betas).toContain("server-side-fallback-2026-07-01");
    expect(params.system).toBe("You are Equidy.");
    expect(params.output_config).toEqual({ effort: "medium" });
    expect(params.tools).toBeUndefined();
  });

  it("adds the web search tool only when asked", async () => {
    const { client, stream } = fakeClient([{ events: [], final: { stop_reason: "end_turn", content: [] } }]);
    await streamClaude({ ...base, webSearch: true }, () => {}, client);
    expect(stream.mock.calls[0][0].tools).toEqual([expect.objectContaining({ type: "web_search_20260209", name: "web_search" })]);
  });

  it("resumes a paused server-tool turn by sending the assistant content back", async () => {
    const paused = [{ type: "server_tool_use", id: "s1", name: "web_search", input: { query: "AAPL" } }];
    const { client, stream } = fakeClient([
      { events: [], final: { stop_reason: "pause_turn", content: paused } },
      { events: [delta("Done")], final: { stop_reason: "end_turn", content: [text("Done")] } },
    ]);
    const out: string[] = [];
    expect(await streamClaude({ ...base, webSearch: true }, (t) => out.push(t), client)).toBe("completed");
    expect(stream).toHaveBeenCalledTimes(2);
    const second = stream.mock.calls[1][0].messages as { role: string; content: unknown }[];
    expect(second.at(-1)).toEqual({ role: "assistant", content: paused });
    expect(out.join("")).toBe("Done");
  });

  it("does not report a still-paused search as completed once the continuation limit is hit", async () => {
    const paused = { events: [], final: { stop_reason: "pause_turn", content: [] } };
    const { client } = fakeClient([paused, paused, paused, paused, paused, paused]);
    expect(await streamClaude({ ...base, webSearch: true }, () => {}, client)).toBe("max_tokens");
  });

  it("lists web sources once each after a searched answer", async () => {
    const content = [text("Apple rose", [cite("https://a.com/x", "A news"), cite("https://a.com/x", "A news")]), text(" today", [cite("https://b.com", "B news")])];
    const { client } = fakeClient([{ events: [delta("Apple rose today")], final: { stop_reason: "end_turn", content } }]);
    const out: string[] = [];
    await streamClaude({ ...base, webSearch: true }, (t) => out.push(t), client);
    const all = out.join("");
    expect(all).toContain("[A news](https://a.com/x)");
    expect(all).toContain("[B news](https://b.com)");
    expect(all.match(/a\.com\/x/g)).toHaveLength(1);
  });

  it("skips non-http citation links and escapes parentheses in source urls", async () => {
    const content = [text("x", [cite("javascript:alert(1)", "bad"), cite("https://a.com/p(1)", "A (news)")])];
    const { client } = fakeClient([{ events: [delta("x")], final: { stop_reason: "end_turn", content } }]);
    const out: string[] = [];
    await streamClaude({ ...base, webSearch: true }, (t) => out.push(t), client);
    const all = out.join("");
    expect(all).not.toContain("javascript:");
    expect(all).toContain("[A news](https://a.com/p%281%29)");
  });

  it("reports the token limit and refusals", async () => {
    const long = fakeClient([{ events: [], final: { stop_reason: "max_tokens", content: [] } }]);
    expect(await streamClaude(base, () => {}, long.client)).toBe("max_tokens");
    const refused = fakeClient([{ events: [], final: { stop_reason: "refusal", content: [] } }]);
    expect(await streamClaude(base, () => {}, refused.client)).toBe("refusal");
  });
});

describe("generateClaude", () => {
  it("returns the whole text and how it finished", async () => {
    const { client, stream } = fakeClient([{ events: [delta("Apple "), delta("Earnings")], final: { stop_reason: "end_turn", content: [text("Apple Earnings")] } }]);
    expect(await generateClaude({ ...base, effort: "low", maxTokens: 2000 }, client)).toEqual({ text: "Apple Earnings", finish: "completed" });
    expect(stream.mock.calls[0][0].output_config).toEqual({ effort: "low" });
  });
});

describe("describeClaudeError", () => {
  const headers = new Headers();
  it("explains rate limits, bad keys and connection problems without leaking details", () => {
    expect(describeClaudeError(new Anthropic.RateLimitError(429, undefined, "rate", headers))).toMatch(/busy|limit/i);
    expect(describeClaudeError(new Anthropic.AuthenticationError(401, undefined, "bad key sk-ant-123", headers))).toBe("The server's Claude API key was rejected.");
    expect(describeClaudeError(new Anthropic.APIConnectionError({ message: "down" }))).toBe("Could not reach the AI provider.");
    expect(describeClaudeError(new Anthropic.InternalServerError(529, undefined, "overloaded", headers))).toMatch(/busy/i);
    expect(describeClaudeError(new Error("boom"))).toBe("Unexpected server error.");
  });
});

describe("chooseProvider", () => {
  it("prefers Claude, falls back to Gemini, else none", () => {
    expect(chooseProvider({ claude: true, gemini: true })).toBe("claude");
    expect(chooseProvider({ claude: false, gemini: true })).toBe("gemini");
    expect(chooseProvider({ claude: false, gemini: false })).toBeNull();
  });
});
