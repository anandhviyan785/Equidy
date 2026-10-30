import { answer, streamText, tickerMentions } from "./engine";
import { buildSnapshot, snapshotToText } from "./context";

export interface AIStatus {
  online: boolean; // backend reachable
  ai: boolean; // Claude configured
  model?: string;
}

let statusPromise: Promise<AIStatus> | null = null;

export function aiStatus(refresh = false): Promise<AIStatus> {
  if (!statusPromise || refresh) {
    statusPromise = fetch("/api/health", { signal: AbortSignal.timeout(2500) })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => ({ online: true, ai: !!j.ai, model: j.model }))
      .catch(() => ({ online: false, ai: false }));
  }
  return statusPromise;
}

export interface StreamArgs {
  history: { role: "user" | "assistant"; content: string }[];
  onDelta: (text: string) => void;
  signal?: AbortSignal;
}

/** Streams an answer from Claude via the backend, or from the offline engine if Claude is unavailable. */
export async function streamChat({ history, onDelta, signal }: StreamArgs): Promise<"claude" | "offline"> {
  const snap = buildSnapshot();
  const last = history[history.length - 1]?.content ?? "";
  const status = await aiStatus();

  if (status.ai) {
    const mentioned = tickerMentions(last).filter((s) => s.financials);
    const fundamentals = mentioned.length ? "\n\nFUNDAMENTALS FOR MENTIONED COMPANIES:\n" + JSON.stringify(mentioned.map(({ symbol, name, marketCap, pe, dividendYield, beta, financials }) => ({ symbol, name, marketCap, pe, dividendYield, beta, financials }))) : "";
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history, context: snapshotToText(snap) + fundamentals }),
      signal,
    }).catch((e) => {
      if (signal?.aborted) throw e;
      return null;
    });
    if (res?.ok && res.body) {
      await readSSE(res.body, onDelta, signal);
      return "claude";
    }
    if (res && res.status !== 503) {
      const msg = await res.text().catch(() => "");
      throw new Error(safeError(msg) || `Request failed (${res.status})`);
    }
  }

  await streamText(answer(last, snap), onDelta, signal);
  return "offline";
}

async function readSSE(body: ReadableStream<Uint8Array>, onDelta: (t: string) => void, signal?: AbortSignal) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    while (true) {
      if (signal?.aborted) break;
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n\n")) >= 0) {
        const chunk = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const data = chunk.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("");
        if (!data) continue;
        const evt = JSON.parse(data) as { type: string; text?: string; message?: string };
        if (evt.type === "delta" && evt.text) onDelta(evt.text);
        else if (evt.type === "error") throw new Error(evt.message || "The AI service returned an error.");
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function safeError(raw: string) {
  try {
    return (JSON.parse(raw) as { error?: string }).error;
  } catch {
    return raw.slice(0, 200);
  }
}

/** Short title from the first user message. */
export function titleFrom(text: string) {
  const clean = text.replace(/\s+/g, " ").trim().replace(/[?.!]+$/, "");
  return clean.length > 48 ? clean.slice(0, 46).trimEnd() + "…" : clean || "New conversation";
}
