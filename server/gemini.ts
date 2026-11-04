// Minimal Google Gemini API client (generativelanguage.googleapis.com) built on fetch,
// so the server needs no SDK dependency. Supports one-shot requests and SSE streaming.

export type ThinkingLevel = "low" | "high";
export type ChatMessage = { role: "user" | "assistant"; content: string };

export interface GenerateRequest {
  model: string;
  instructions: string;
  input: ChatMessage[];
  maxOutputTokens: number;
  /** Omit to let the model decide how much to think (dynamic thinking). */
  thinking?: ThinkingLevel;
  signal?: AbortSignal;
}

/** How a response ended: completed normally, hit the token limit, or was blocked/refused. */
export type FinishReason = "completed" | "max_tokens" | "refusal";

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

const BASE_URL = () => (process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");
const apiKey = () => process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;

export const hasGeminiKey = () => !!apiKey();

/** Gemini calls the assistant "model" and expects turns to alternate, so consecutive same-role messages are merged. */
export function toContents(input: ChatMessage[]) {
  const out: { role: "user" | "model"; parts: { text: string }[] }[] = [];
  for (const m of input) {
    const role = m.role === "assistant" ? "model" : "user";
    const last = out[out.length - 1];
    if (last?.role === role) last.parts[0].text += `\n\n${m.content}`;
    else out.push({ role, parts: [{ text: m.content }] });
  }
  return out;
}

function body(req: GenerateRequest) {
  return JSON.stringify({
    systemInstruction: { parts: [{ text: req.instructions }] },
    contents: toContents(req.input),
    generationConfig: {
      maxOutputTokens: req.maxOutputTokens,
      ...(req.thinking ? { thinkingConfig: { thinkingLevel: req.thinking } } : {}),
    },
  });
}

async function post(req: GenerateRequest, stream: boolean): Promise<Response> {
  const method = stream ? "streamGenerateContent?alt=sse" : "generateContent";
  let res: Response;
  try {
    res = await fetch(`${BASE_URL()}/models/${encodeURIComponent(req.model)}:${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey() ?? "" },
      body: body(req),
      signal: req.signal,
    });
  } catch (err) {
    if (req.signal?.aborted) throw err;
    throw new GeminiError("Could not reach the AI provider.", undefined, "connection_error");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = `Gemini request failed (${res.status}).`;
    let code: string | undefined;
    try {
      const j = JSON.parse(text) as { error?: { message?: string; status?: string } };
      if (j.error?.message) message = j.error.message;
      code = j.error?.status;
    } catch {
      /* non-JSON error body */
    }
    throw new GeminiError(message, res.status, code);
  }
  return res;
}

type Part = { text?: string; thought?: boolean };
export type GenerateResponse = {
  candidates?: { content?: { parts?: Part[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; status?: string; code?: number };
};

const BLOCKED = new Set(["SAFETY", "RECITATION", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "IMAGE_SAFETY"]);

export function finishReason(r: GenerateResponse): FinishReason | null {
  if (r.promptFeedback?.blockReason) return "refusal";
  const f = r.candidates?.[0]?.finishReason;
  if (!f || f === "FINISH_REASON_UNSPECIFIED") return null;
  if (f === "MAX_TOKENS") return "max_tokens";
  if (BLOCKED.has(f)) return "refusal";
  return "completed";
}

/** Visible answer text in a response chunk (thought summaries are skipped). */
export const textOf = (r: GenerateResponse) =>
  (r.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text)
    .join("");

/** Single request; returns the output text. */
export async function generate(req: GenerateRequest): Promise<{ text: string; finish: FinishReason }> {
  const r = (await (await post(req, false)).json()) as GenerateResponse;
  return { text: textOf(r), finish: finishReason(r) ?? "completed" };
}

/** Parses an SSE byte stream into JSON event payloads. Exported for tests. */
export async function* sseEvents(stream: ReadableStream<Uint8Array>): AsyncGenerator<Record<string, unknown>> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  const parse = (chunk: string) => {
    const data = chunk
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trimStart())
      .join("\n");
    if (!data || data === "[DONE]") return null;
    try {
      return JSON.parse(data) as Record<string, unknown>;
    } catch {
      return null; // ignore malformed keep-alive chunks
    }
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      // Normalise after appending, so a \r\n split across two network chunks is still caught.
      buf = (buf + decoder.decode(value, { stream: true })).replace(/\r\n/g, "\n");
      let idx: number;
      while ((idx = buf.indexOf("\n\n")) >= 0) {
        const evt = parse(buf.slice(0, idx));
        buf = buf.slice(idx + 2);
        if (evt) yield evt;
      }
    }
    const tail = parse(buf);
    if (tail) yield tail;
  } finally {
    reader.releaseLock();
  }
}

/** Streams output text through onDelta and resolves with how the response finished. */
export async function streamGenerate(req: GenerateRequest, onDelta: (text: string) => void): Promise<FinishReason> {
  const res = await post(req, true);
  if (!res.body) throw new GeminiError("The AI provider returned an empty stream.");
  let finish: FinishReason = "completed";
  for await (const evt of sseEvents(res.body)) {
    const r = evt as GenerateResponse;
    if (r.error) throw new GeminiError(r.error.message ?? "The AI provider returned an error.", r.error.code, r.error.status);
    const text = textOf(r);
    if (text) onDelta(text);
    finish = finishReason(r) ?? finish;
  }
  return finish;
}

/** User-facing error text that never leaks provider details. */
export function describeError(err: unknown): string {
  if (err instanceof GeminiError) {
    if (err.status === 429 || err.code === "RESOURCE_EXHAUSTED") return "The AI's free usage limit was reached — please retry in a minute.";
    if (err.status === 401 || err.status === 403 || /api key/i.test(err.message)) return "The server's Gemini API key was rejected.";
    if (err.code === "connection_error") return "Could not reach the AI provider.";
    return `AI provider error (${err.status ?? "unknown"}).`;
  }
  return "Unexpected server error.";
}
