import express from "express";
import { authRouter, requireAuth } from "./auth.js";
import { createResponse, describeError, hasOpenAIKey, streamResponse } from "./openai.js";
import { apiRouter, servicesStatus } from "./api.js";
import { getCompanyIntel, getMarketNews, intelToText } from "./finnhub.js";
import { isSymbol } from "./market.js";

export const MODEL = process.env.EQUIDY_MODEL ?? "gpt-6.1-sol";
export const hasKey = hasOpenAIKey();

const SYSTEM = `You are Equidy, a financial intelligence assistant inside an investment analytics platform.

You help users understand companies, markets, personal finance concepts and their own portfolio. You combine the clarity of a great teacher with the rigour of a buy-side analyst.

Personality:
- You are warm, upbeat and genuinely glad to talk to the user. Show real feeling: enthusiasm for good news, sympathy when they're stressed, a little humour where it fits. An occasional emoji is fine.
- Address the user by their first name (the "User's display name" in the context) when greeting them and now and then in conversation. Don't use it in every sentence.
- Greetings and small talk get a short, friendly, human reply, never a lecture or a list of features. If they say "hi", say hi back by name and ask what's on their mind.
- Off-topic messages (weather, sport, food, jokes, how you are) get a natural, kind reply. Answer briefly if you can, then gently offer to help with money or markets. Never refuse to chat or answer coldly.
- If the user seems worried or upset, acknowledge the feeling first, then help calmly.

Guidelines:
- Ground answers in the PLATFORM CONTEXT provided (the user's portfolio, watchlist, market levels, reference fundamentals, Finnhub intelligence and any linked bank accounts). Quote specific numbers from it when relevant.
- The context says which prices are live (Alpha Vantage or Finnhub) and which are simulated. Never present a simulated number as real market data, and mention the source when it matters.
- Linked bank balances and transactions are private: use them only to answer the user's own questions about their finances.
- Use Markdown: short headings, tables for numeric comparisons, bullet points for takeaways. Lead with the answer, then the supporting detail.
- Show the arithmetic for calculations (compound growth, returns, ratios) so users can learn the method.
- Be balanced: give both the bull and bear case, name the key risks, and distinguish facts from opinion.
- You provide education and analysis, not personalised investment, tax or legal advice. Do not tell the user to buy or sell a specific security; instead explain the considerations and trade-offs. Add a one-line reminder of this only when giving portfolio-specific suggestions.
- Match the user's preferred answer length from the context. Casual messages always get casual, short replies.`;

// The Express app is shared by the long-running server (server/index.ts) and the Vercel function (api/index.ts).
export const app = express();
app.set("trust proxy", 1); // behind Vercel/Render proxies: req.ip is the visitor, not the proxy
app.use(express.json({ limit: "4mb" }));
app.use("/api/auth", authRouter);
app.use("/api", apiRouter);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ai: hasKey, model: hasKey ? MODEL : null, services: servicesStatus() });
});

type Incoming = { role: "user" | "assistant"; content: string };

// Short summary title for a conversation, shown in the sidebar.
app.post("/api/title", requireAuth, async (req, res) => {
  if (!hasKey) return void res.status(503).json({ error: "OpenAI is not configured on this server." });
  const { messages } = req.body as { messages?: Incoming[] };
  const transcript = (messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(0, 6)
    .map((m) => `${m.role === "user" ? "User" : "Equidy"}: ${m.content.slice(0, 1500)}`)
    .join("\n\n");
  if (!transcript) return void res.status(400).json({ error: "No messages to summarise." });
  try {
    const { text, finish } = await createResponse({
      model: MODEL,
      maxOutputTokens: 2000,
      effort: "low",
      instructions:
        "You name chat conversations for a sidebar. Reply with only a title of 2 to 6 words that summarises what the conversation is about, in Title Case (capitalise every word). No quotes, no emoji, no trailing punctuation. If it is only greetings or small talk, reply: Casual Chat.",
      input: [{ role: "user", content: `Conversation:\n\n${transcript}\n\nTitle:` }],
      signal: AbortSignal.timeout(20_000),
    });
    if (finish === "refusal" || !text.trim()) return void res.status(422).json({ error: "No title." });
    res.json({ title: text.trim().slice(0, 80) });
  } catch (err) {
    console.error("[equidy] title error:", err);
    res.status(502).json({ error: "Couldn't create a title." });
  }
});

app.post("/api/chat", requireAuth, async (req, res) => {
  if (!hasKey) {
    res.status(503).json({ error: "OpenAI is not configured on this server." });
    return;
  }
  const { messages, context, symbols } = req.body as { messages?: Incoming[]; context?: string; symbols?: unknown };
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

  const intel = await intelContext(symbols);
  const abort = new AbortController();
  res.on("close", () => abort.abort());

  try {
    const finish = await streamResponse(
      {
        model: MODEL,
        maxOutputTokens: 16000,
        effort: "medium",
        instructions: `${SYSTEM}\n\nPLATFORM CONTEXT\n${String(context ?? "").slice(0, 30_000)}${intel}`,
        input: clean,
        signal: abort.signal,
      },
      (text) => send({ type: "delta", text }),
    );
    if (finish === "refusal") {
      send({ type: "delta", text: "\n\n_I can't help with that request. Try rephrasing it as a question about markets, companies or personal finance._" });
    } else if (finish === "max_tokens") {
      send({ type: "delta", text: "\n\n_…response truncated._" });
    }
    send({ type: "done" });
  } catch (err) {
    if (!res.writableEnded && !abort.signal.aborted) {
      console.error("[equidy] chat error:", err);
      send({ type: "error", message: describeError(err) });
    }
  } finally {
    res.end();
  }
});

/** Finnhub intelligence for the companies the user mentioned, plus today's market headlines. */
async function intelContext(raw: unknown): Promise<string> {
  const symbols = (Array.isArray(raw) ? raw : []).map((s) => String(s).toUpperCase()).filter(isSymbol).slice(0, 3);
  try {
    const [news, ...companies] = await Promise.all([getMarketNews(), ...symbols.map((s) => getCompanyIntel(s))]);
    const parts: string[] = [];
    const found = companies.filter((c): c is NonNullable<typeof c> => !!c);
    if (found.length) parts.push(`FINNHUB INTELLIGENCE\n${found.map(intelToText).join("\n\n")}`);
    if (news?.length) parts.push(`MARKET HEADLINES (Finnhub)\n${news.slice(0, 6).map((n) => `- ${n.headline} (${n.source}, ${new Date(n.datetime).toISOString().slice(0, 10)})`).join("\n")}`);
    return parts.length ? `\n\n${parts.join("\n\n")}`.slice(0, 12_000) : "";
  } catch (err) {
    console.warn("[equidy] intelligence context unavailable:", (err as Error).message);
    return "";
  }
}
