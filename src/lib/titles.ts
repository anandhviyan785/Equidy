import type { Security } from "@/data/securities";
import { conceptTitle, tickerMentions } from "./engine";

// Conversation titles that summarise what a chat is about, in Title Case.

const SMALL_WORDS = new Set(["a", "an", "the", "and", "or", "of", "to", "in", "on", "for", "vs"]);

/** Capitalises the first letter of every word, keeping existing capitals (ETFs, AAPL, P/E). */
export function titleCase(s: string) {
  return s
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

const shortName = (s: Security) =>
  s.sector === "ETF" || s.sector === "Crypto" ? s.symbol : s.name.replace(/\b(Inc\.?|Corporation|Corp\.?|plc|Co\.|& Co\.?|Group|Platforms|Holdings)\b/gi, "").replace(/[.,]/g, "").trim().split(" ").slice(0, 2).join(" ");

const GREETING = /^(hi+|hello|hey+|heya|hiya|yo|sup|howdy|good (morning|afternoon|evening|day)|what'?s up|thanks?|thank you|thx|ok(ay)?|cool|bye|how are you)\b[\s\w'!?.,]{0,20}$/i;
const STOP = new Set("i me my we you your it is are was be can could would should will do does did what whats how why when where which who please tell give show explain about with from into this that these those there their them just really very some any much many lot also like want need know think make get".split(" "));

/** Topic title for one user message, or null when it's small talk. */
function topicOf(text: string): string | null {
  const t = text.trim();
  const q = t.toLowerCase();
  if (!t || (GREETING.test(t) && t.split(/\s+/).length <= 5)) return null;
  const tickers = tickerMentions(t);
  if (/(\bvs\.?\b|versus|compare)/.test(q) && tickers.length >= 2) return `${shortName(tickers[0])} Vs ${shortName(tickers[1])}`;
  if (/\bwatchlist\b/.test(q)) return "Watchlist Briefing";
  if (/\bportfolio|holdings|allocation|rebalanc/.test(q)) {
    if (/risk|volatil|drawdown|safe/.test(q)) return "Portfolio Risk Review";
    if (/rebalanc/.test(q)) return "Portfolio Rebalancing";
    return "Portfolio Analysis";
  }
  if (tickers.length) {
    const n = shortName(tickers[0]);
    if (/\b(buy|sell|invest in|should i)\b/.test(q)) return `Should I Invest In ${n}`;
    if (/\b(price|chart|today|move|drop|fall|rise|up|down)\b/.test(q)) return `${n} Price Moves`;
    return `${n} Financial Analysis`;
  }
  if (/\b(compound|future value|rule of 72)\b/.test(q) || /\binvest \$?\d/.test(q)) return /\$?\d/.test(q) ? "Investment Growth Projection" : "Compound Interest Explained";
  const concept = conceptTitle(t);
  if (concept) return `${concept.replace(/\s*\(.*?\)\s*/g, " ").trim()} Explained`;
  if (/\b(market|today|indices|index|movers|s&p)\b/.test(q)) return "Today's Market Overview";
  if (/\b(joke|funny|laugh)\b/.test(q)) return "Finance Jokes";
  if (/\b(sad|stressed|stress|anxious|worried|scared|nervous|upset|bad day|rough day)\b/.test(q)) return "Talking It Through";
  // Fallback: the key words of the message.
  const words = t.replace(/[^\p{L}\p{N}&$%'\s-]/gu, " ").split(/\s+/).filter((w) => w && !STOP.has(w.toLowerCase()) && !SMALL_WORDS.has(w.toLowerCase()));
  if (!words.length) return null;
  return titleCase(words.slice(0, 6).join(" "));
}

/** Summary title for a conversation from its user messages. */
export function summarizeTitle(messages: { role: string; content: string }[]): string {
  const userTexts = messages.filter((m) => m.role === "user").map((m) => m.content);
  for (const text of userTexts) {
    const topic = topicOf(text);
    if (topic) return titleCase(topic);
  }
  return userTexts.length ? "Casual Chat" : "New Conversation";
}

/** Cleans a model-written title: one line, no quotes or trailing punctuation, Title Case, at most 8 words. */
export function cleanTitle(raw: string) {
  const line = raw.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  const t = line.replace(/^title:\s*/i, "").replace(/^["'“”‘’*#\s]+|["'“”‘’*.!?\s]+$/g, "");
  return t ? titleCase(t.split(/\s+/).slice(0, 8).join(" ")) : "";
}
