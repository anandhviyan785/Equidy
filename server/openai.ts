// Minimal OpenAI Responses API client (https://api.openai.com/v1/responses) built on fetch,
// so the server needs no SDK dependency. Supports one-shot requests and SSE streaming.

export type Effort = "low" | "medium" | "high";
export type ChatMessage = { role: "user" | "assistant"; content: string };

export interface ResponseRequest {
  model: string;
  instructions: string;
  input: ChatMessage[];
  maxOutputTokens: number;
  effort: Effort;
  signal?: AbortSignal;
}

/** How a response ended: completed normally, hit the token limit, or was refused by the model. */
export type FinishReason = "completed" | "max_tokens" | "refusal";

export class OpenAIError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "OpenAIError";
  }
}

const BASE_URL = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "");

export const hasOpenAIKey = () => !!process.env.OPENAI_API_KEY;

function body(req: ResponseRequest, stream: boolean) {
  return JSON.stringify({
    model: req.model,
    instructions: req.instructions,
    input: req.input.map((m) => ({ role: m.role, content: m.content })),
    max_output_tokens: req.maxOutputTokens,
    reasoning: { effort: req.effort },
    store: false,
    stream,
  });
}

async function post(req: ResponseRequest, stream: boolean): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ""}`,
        ...(process.env.OPENAI_ORG_ID ? { "OpenAI-Organization": process.env.OPENAI_ORG_ID } : {}),
      },
      body: body(req, stream),
      signal: req.signal,
    });
  } catch (err) {
    if (req.signal?.aborted) throw err;
    throw new OpenAIError("Could not reach the AI provider.", undefined, "connection_error");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = `OpenAI request failed (${res.status}).`;
    let code: string | undefined;
    try {
      const j = JSON.parse(text) as { error?: { message?: string; code?: string; type?: string } };
      if (j.error?.message) message = j.error.message;
      code = j.error?.code ?? j.error?.type;
    } catch {
      /* non-JSON error body */
    }
    throw new OpenAIError(message, res.status, code);
  }
  return res;
}

type OutputItem = { type: string; content?: { type: string; text?: string; refusal?: string }[] };
type ResponseObject = {
  status?: string;
  output?: OutputItem[];
  incomplete_details?: { reason?: string } | null;
  error?: { message?: string; code?: string } | null;
};

function finishReason(r: ResponseObject, refused: boolean): FinishReason {
  if (refused) return "refusal";
  if (r.status === "incomplete" && r.incomplete_details?.reason === "max_output_tokens") return "max_tokens";
  if (r.status === "incomplete" && r.incomplete_details?.reason === "content_filter") return "refusal";
  return "completed";
}

/** Single request; returns the concatenated output text. */
export async function createResponse(req: ResponseRequest): Promise<{ text: string; finish: FinishReason }> {
  const res = await post(req, false);
  const r = (await res.json()) as ResponseObject;
  if (r.status === "failed") throw new OpenAIError(r.error?.message ?? "The AI provider returned an error.", undefined, r.error?.code);
  const parts = (r.output ?? []).filter((o) => o.type === "message").flatMap((o) => o.content ?? []);
  const refused = parts.some((p) => p.type === "refusal");
  const text = parts.map((p) => (p.type === "output_text" ? p.text ?? "" : "")).join("");
  return { text, finish: finishReason(r, refused) };
}

/** Parses an SSE byte stream into JSON event payloads. Exported for tests. */
export async function* sseEvents(stream: ReadableStream<Uint8Array>): AsyncGenerator<Record<string, unknown>> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
      let idx: number;
      while ((idx = buf.indexOf("\n\n")) >= 0) {
        const chunk = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const data = chunk
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trimStart())
          .join("\n");
        if (!data || data === "[DONE]") continue;
        try {
          yield JSON.parse(data) as Record<string, unknown>;
        } catch {
          /* ignore malformed keep-alive chunks */
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** Streams output text through onDelta and resolves with how the response finished. */
export async function streamResponse(req: ResponseRequest, onDelta: (text: string) => void): Promise<FinishReason> {
  const res = await post(req, true);
  if (!res.body) throw new OpenAIError("The AI provider returned an empty stream.");
  let refused = false;
  for await (const evt of sseEvents(res.body)) {
    switch (evt.type) {
      case "response.output_text.delta":
        if (typeof evt.delta === "string" && evt.delta) onDelta(evt.delta);
        break;
      case "response.refusal.delta":
        refused = true;
        break;
      case "response.completed":
      case "response.incomplete":
        return finishReason((evt.response ?? {}) as ResponseObject, refused);
      case "response.failed": {
        const r = (evt.response ?? {}) as ResponseObject;
        throw new OpenAIError(r.error?.message ?? "The AI provider returned an error.", undefined, r.error?.code);
      }
      case "error":
        throw new OpenAIError(String(evt.message ?? "The AI provider returned an error."), undefined, evt.code as string | undefined);
    }
  }
  return refused ? "refusal" : "completed";
}

/** User-facing error text that never leaks provider details. */
export function describeError(err: unknown): string {
  if (err instanceof OpenAIError) {
    if (err.status === 429) return "Rate limited by the AI provider — please retry in a moment.";
    if (err.status === 401 || err.status === 403) return "The server's OpenAI credentials were rejected.";
    if (err.code === "connection_error") return "Could not reach the AI provider.";
    return `AI provider error (${err.status ?? "unknown"}).`;
  }
  return "Unexpected server error.";
}
