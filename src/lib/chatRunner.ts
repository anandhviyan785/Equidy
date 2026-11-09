import { create } from "zustand";
import { useChats, type ChatMessage } from "@/store";
import { aiTitle, streamChat } from "./ai";
import { summarizeTitle } from "./titles";
import { uid } from "./format";
import { createTypewriter } from "./typewriter";

interface RunState {
  streaming: Record<string, string>; // conversationId -> assistant message id
}

export const useRuns = create<RunState>()(() => ({ streaming: {} }));
const controllers = new Map<string, AbortController>();

/** Sends a user message (or regenerates) and streams the assistant reply into the store. */
export async function send(conversationId: string, text?: string) {
  const chats = useChats.getState();
  if (controllers.has(conversationId)) return;

  if (text !== undefined) {
    chats.append(conversationId, { id: uid(), role: "user", content: text, createdAt: Date.now() });
  }

  const conv = useChats.getState().conversations.find((c) => c.id === conversationId);
  if (!conv) return;
  const history = conv.messages.filter((m) => !m.error).map(({ role, content }) => ({ role, content }));

  const reply: ChatMessage = { id: uid(), role: "assistant", content: "", createdAt: Date.now() };
  chats.append(conversationId, reply);
  const ctrl = new AbortController();
  controllers.set(conversationId, ctrl);
  useRuns.setState((s) => ({ streaming: { ...s.streaming, [conversationId]: reply.id } }));

  const typer = createTypewriter((shown) => useChats.getState().patchMessage(conversationId, reply.id, { content: shown }));
  // Stop shows everything received so far right away.
  ctrl.signal.addEventListener("abort", () => typer.finish(), { once: true });

  try {
    const source = await streamChat({ history, signal: ctrl.signal, onDelta: typer.push });
    await typer.drained();
    typer.finish();
    useChats.getState().patchMessage(conversationId, reply.id, { source });
  } catch (err) {
    const acc = typer.finish();
    if (!ctrl.signal.aborted) {
      useChats.getState().patchMessage(conversationId, reply.id, {
        content: acc + (acc ? "\n\n" : "") + `**Something went wrong.** ${(err as Error).message}`,
        error: true,
      });
    }
  } finally {
    controllers.delete(conversationId);
    useRuns.setState((s) => {
      const next = { ...s.streaming };
      delete next[conversationId];
      return { streaming: next };
    });
    void autoTitle(conversationId);
  }
}

export function stop(conversationId: string) {
  controllers.get(conversationId)?.abort();
}

export function regenerate(conversationId: string) {
  const conv = useChats.getState().conversations.find((c) => c.id === conversationId);
  const last = conv?.messages[conv.messages.length - 1];
  if (!conv || !last || last.role !== "assistant") return;
  useChats.getState().truncateAfter(conversationId, last.id);
  void send(conversationId);
}

/** Start a brand-new conversation from the home screen. */
export function startConversation(text: string) {
  const id = useChats.getState().create(summarizeTitle([{ role: "user", content: text }]));
  void send(id, text);
  return id;
}

/**
 * Keeps the sidebar title a summary of the chat: refined after each of the first few replies
 * (so "hi" becomes "Apple Financial Analysis" once the topic appears), and never after a manual rename.
 */
async function autoTitle(conversationId: string) {
  const conv = useChats.getState().conversations.find((c) => c.id === conversationId);
  if (!conv || conv.titleLocked) return;
  const history = conv.messages.filter((m) => !m.error && m.content).map(({ role, content }) => ({ role, content }));
  if (history.filter((m) => m.role === "user").length > 3) return;
  const local = summarizeTitle(history);
  useChats.getState().setAutoTitle(conversationId, local);
  const fromAi = await aiTitle(history);
  if (fromAi) useChats.getState().setAutoTitle(conversationId, fromAi);
}

/** Gives older chats (named after their first message) a summary title. */
export function retitleExisting() {
  for (const c of useChats.getState().conversations) {
    if (!c.titleLocked && c.messages.length) useChats.getState().setAutoTitle(c.id, summarizeTitle(c.messages));
  }
}
