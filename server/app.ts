import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { authRouter, requireAuth } from "./auth.js";

export const MODEL = process.env.EQUIDY_MODEL ?? "claude-opus-5-5";
export const hasKey = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const client = hasKey ? new Anthropic() : null;

const SYSTEM = `You are Equidy, a financial intelligence assistant inside an investment analytics platform.

You help users understand companies, markets, personal finance concepts and their own portfolio. You combine the clarity of a great teacher with the rigour of a buy-side analyst.

Guidelines:
- Ground answers in the PLATFORM CONTEXT provided (the user's portfolio, watchlist, market levels and reference fundamentals). Quote specific numbers from it when relevant. Market data in the platform is simulated; never claim it is live exchange data.
- Use Markdown: short headings, tables for numeric comparisons, bullet points for takeaways. Lead with the answer, then the supporting detail.
- Show the arithmetic for calculations (compound growth, returns, ratios) so users can learn the method.
- Be balanced: give both the bull and bear case, name the key risks, and distinguish facts from opinion.
- You provide education and analysis, not personalised investment, tax or legal advice. Do not tell the user to buy or sell a specific security; instead explain the considerations and trade-offs. Add a one-line reminder of this only when giving portfolio-specific suggestions.
- Match the user's preferred answer length from the context.`;

// The Express app is shared by the long-running server (server/index.ts) and the Vercel function (api/index.ts).
export const app = express();
app.set("trust proxy", 1); // behind Vercel/Render proxies: req.ip is the visitor, not the proxy
app.use(express.json({ limit: "1mb" }));
app.use("/api/auth", authRouter);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ai: hasKey, model: hasKey ? MODEL : null });
});

type Incoming = { role: "user" | "assistant"; content: string };

app.post("/api/chat", requireAuth, async (req, res) => {
  if (!client) {
    res.status(503).json({ error: "Claude is not configured on this server." });
    return;
  }
  const { messages, context } = req.body as { messages?: Incoming[]; context?: string };
  const clean = (messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-30)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 20_000) }));
  if (!clean.length || clean[clean.length - 1].role !== "user") {
    res.status(400).json({ error: "The last message must come from the user." });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [
      { type: "text", text: SYSTEM },
      { type: "text", text: `PLATFORM CONTEXT\n${String(context ?? "").slice(0, 30_000)}` },
    ],
    messages: clean,
  });
  res.on("close", () => stream.abort());

  try {
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") send({ type: "delta", text: event.delta.text });
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") {
      send({ type: "delta", text: "\n\n_I can't help with that request. Try rephrasing it as a question about markets, companies or personal finance._" });
    } else if (final.stop_reason === "max_tokens") {
      send({ type: "delta", text: "\n\n_…response truncated._" });
    }
    send({ type: "done" });
  } catch (err) {
    if (!res.writableEnded && !stream.controller.signal.aborted) {
      console.error("[equidy] chat error:", err);
      const message =
        err instanceof Anthropic.RateLimitError ? "Rate limited by the AI provider — please retry in a moment."
        : err instanceof Anthropic.AuthenticationError ? "The server's Anthropic credentials were rejected."
        : err instanceof Anthropic.APIConnectionError ? "Could not reach the AI provider."
        : err instanceof Anthropic.APIError ? `AI provider error (${err.status ?? "unknown"}).`
        : "Unexpected server error.";
      send({ type: "error", message });
    }
  } finally {
    res.end();
  }
});
