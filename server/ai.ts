// Picks the assistant's AI provider: Claude when ANTHROPIC_API_KEY is set, otherwise Gemini as a backup,
// otherwise none (the browser then uses its offline analysis engine).
import { CLAUDE_MODEL, describeClaudeError, generateClaude, hasClaudeKey, streamClaude, type Effort } from "./claude.js";
import { describeError as describeGeminiError, generate, hasGeminiKey, streamGenerateWithSearch, type ChatMessage, type FinishReason } from "./gemini.js";

export type Provider = "claude" | "gemini";

export function chooseProvider(keys: { claude: boolean; gemini: boolean }): Provider | null {
  if (keys.claude) return "claude";
  if (keys.gemini) return "gemini";
  return null;
}

export const PROVIDER = chooseProvider({ claude: hasClaudeKey(), gemini: hasGeminiKey() });
const GEMINI_MODEL = process.env.EQUIDY_MODEL ?? "gemini-3.6-flash";
export const MODEL = PROVIDER === "claude" ? CLAUDE_MODEL : PROVIDER === "gemini" ? GEMINI_MODEL : null;

export interface AiRequest {
  instructions: string;
  input: ChatMessage[];
  maxTokens: number;
  effort: Effort;
  signal?: AbortSignal;
}

/** Gemini only distinguishes low and dynamic thinking. */
const geminiThinking = (effort: Effort) => (effort === "low" ? "low" : undefined);

/** Streams a chat answer with live web search. */
export function streamChat(req: AiRequest, onDelta: (text: string) => void): Promise<FinishReason> {
  if (PROVIDER === "claude") return streamClaude({ ...req, webSearch: true }, onDelta);
  return streamGenerateWithSearch({ model: GEMINI_MODEL, instructions: req.instructions, input: req.input, maxOutputTokens: req.maxTokens, thinking: geminiThinking(req.effort), signal: req.signal }, onDelta);
}

/** One-shot text, for short jobs like naming a conversation. */
export function generateText(req: AiRequest): Promise<{ text: string; finish: FinishReason }> {
  if (PROVIDER === "claude") return generateClaude(req);
  return generate({ model: GEMINI_MODEL, instructions: req.instructions, input: req.input, maxOutputTokens: req.maxTokens, thinking: geminiThinking(req.effort), signal: req.signal });
}

export const describeAiError = (err: unknown) => (PROVIDER === "claude" ? describeClaudeError(err) : describeGeminiError(err));
