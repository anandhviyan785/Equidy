// Claude (Anthropic) client for the Equidy assistant: streamed chat with optional live web search, and one-shot text.
import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage, FinishReason, WebSource } from "./gemini.js";

export type Effort = "low" | "medium" | "high";

export interface ClaudeRequest {
  instructions: string;
  input: ChatMessage[];
  maxTokens: number;
  /** How hard Claude thinks before answering. Claude Opus 5.5 always thinks; effort is the only control. */
  effort: Effort;
  /** Let Claude search the web for news, prices and anything recent. */
  webSearch?: boolean;
  signal?: AbortSignal;
}

/** The parts of the SDK client this module uses, so tests can pass a stand-in. */
export type ClaudeClient = Pick<Anthropic, "beta">;

export const CLAUDE_MODEL = process.env.EQUIDY_CLAUDE_MODEL ?? "claude-opus-5-5";
export const hasClaudeKey = () => !!process.env.ANTHROPIC_API_KEY;

/** On a safety refusal, the API retries on a fallback model it picks by refusal category. */
const FALLBACK_BETA = "server-side-fallback-2026-07-01";
const MAX_SEARCHES = 3;
/** A web-search turn can pause after the server's own tool loop; resume it at most this many times. */
const MAX_CONTINUATIONS = 3;
const MAX_SOURCES = 6;

let shared: Anthropic | null = null;
const defaultClient = (): ClaudeClient => (shared ??= new Anthropic());

function finishOf(stopReason: string | null): FinishReason {
  if (stopReason === "max_tokens") return "max_tokens";
  if (stopReason === "refusal") return "refusal";
  return "completed";
}

type Block = { type: string; citations?: unknown };
type Citation = { type?: string; url?: string; title?: string | null };

/** Web pages Claude cited in its answer, once each, in the order first cited. */
function sourcesOf(content: readonly Block[]): WebSource[] {
  const seen = new Map<string, WebSource>();
  for (const block of content) {
    if (block.type !== "text" || !Array.isArray(block.citations)) continue;
    for (const c of block.citations as Citation[]) {
      if (c.type !== "web_search_result_location" || !c.url || seen.has(c.url)) continue;
      seen.set(c.url, { uri: c.url, title: c.title || new URL(c.url).hostname });
    }
  }
  return [...seen.values()].slice(0, MAX_SOURCES);
}

const sourcesMarkdown = (sources: WebSource[]) =>
  sources.length ? `\n\n**Sources:** ${sources.map((s) => `[${s.title.replace(/[[\]]/g, "")}](${s.uri})`).join(" · ")}` : "";

/** Streams Claude's answer through `onDelta`, resuming paused search turns, then appends any web sources. */
export async function streamClaude(req: ClaudeRequest, onDelta: (text: string) => void, client: ClaudeClient = defaultClient()): Promise<FinishReason> {
  const tools = req.webSearch ? [{ type: "web_search_20260209" as const, name: "web_search" as const, max_uses: MAX_SEARCHES }] : undefined;
  let messages: Anthropic.Beta.BetaMessageParam[] = req.input.map((m) => ({ role: m.role, content: m.content }));
  let stopReason: string | null = null;
  let sources: WebSource[] = [];

  for (let turn = 0; turn <= MAX_CONTINUATIONS; turn++) {
    const stream = client.beta.messages.stream(
      {
        model: CLAUDE_MODEL,
        max_tokens: req.maxTokens,
        system: req.instructions,
        messages,
        output_config: { effort: req.effort },
        betas: [FALLBACK_BETA],
        fallbacks: "default",
        ...(tools ? { tools } : {}),
      },
      { signal: req.signal },
    );
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") onDelta(event.delta.text);
    }
    const final = await stream.finalMessage();
    stopReason = final.stop_reason;
    sources = [...sources, ...sourcesOf(final.content).filter((s) => !sources.some((k) => k.uri === s.uri))];
    if (stopReason !== "pause_turn") break;
    messages = [...messages, { role: "assistant", content: final.content }];
  }

  const finish = finishOf(stopReason);
  if (finish !== "refusal") {
    const list = sourcesMarkdown(sources.slice(0, MAX_SOURCES));
    if (list) onDelta(list);
  }
  return finish;
}

/** One-shot text (no web search), for short jobs like naming a conversation. */
export async function generateClaude(req: ClaudeRequest, client: ClaudeClient = defaultClient()): Promise<{ text: string; finish: FinishReason }> {
  let text = "";
  const finish = await streamClaude({ ...req, webSearch: false }, (t) => { text += t; }, client);
  return { text, finish };
}

/** User-facing error text that never leaks provider details or keys. */
export function describeClaudeError(err: unknown): string {
  if (err instanceof Anthropic.RateLimitError) return "The AI is busy (usage limit reached). Please retry in a minute.";
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) return "The server's Claude API key was rejected.";
  if (err instanceof Anthropic.APIConnectionError) return "Could not reach the AI provider.";
  if (err instanceof Anthropic.APIError) {
    if (err.status === 529 || err.status === 503) return "The AI is busy right now. Please retry in a moment.";
    return `AI provider error (${err.status ?? "unknown"}).`;
  }
  return "Unexpected server error.";
}
