import { create } from "zustand";
import { useChats, type ChatMessage } from "@/store";
import { streamChat, titleFrom } from "./ai";
import { uid } from "./format";

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
    const conv = chats.conversations.find((c) => c.id === conversationId);
    if (conv && conv.messages.length === 0) chats.rename(conversationId, titleFrom(text));
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

  let acc = "";
  let pending = "";
  let raf = 0;
  const flush = () => {
    raf = 0;
    acc += pending;
    pending = "";
    useChats.getState().patchMessage(conversationId, reply.id, { content: acc });
  };

  try {
    const source = await streamChat({
      history,
      signal: ctrl.signal,
      onDelta: (t) => {
        pending += t;
        if (!raf) raf = requestAnimationFrame(flush);
      },
    });
    if (raf) cancelAnimationFrame(raf);
    flush();
    useChats.getState().patchMessage(conversationId, reply.id, { source });
  } catch (err) {
    if (raf) cancelAnimationFrame(raf);
    flush();
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
  const id = useChats.getState().create(titleFrom(text));
  void send(id, text);
  return id;
}
