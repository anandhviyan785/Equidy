import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowUp, Square, Copy, Check, RotateCcw, Apple, Percent, PieChart, Scale, Activity, ShieldAlert, Cpu, WifiOff } from "lucide-react";
import { useChats, type ChatMessage } from "@/store";
import { regenerate, send, startConversation, stop, useRuns } from "@/lib/chatRunner";
import { aiStatus, type AIStatus } from "@/lib/ai";
import { Markdown } from "@/components/Markdown";
import { Logo } from "@/components/ui";
import { cn } from "@/lib/format";

const SUGGESTIONS = [
  { icon: Apple, title: "Analyze Apple's financial performance", hint: "Revenue, margins, cash flow and valuation" },
  { icon: Percent, title: "Explain how compound interest works", hint: "With a worked example and the Rule of 72" },
  { icon: PieChart, title: "Analyze my investment portfolio", hint: "Allocation, risk and concentration" },
  { icon: Scale, title: "Compare Microsoft vs Alphabet", hint: "Side-by-side fundamentals and risk" },
  { icon: Activity, title: "What are the markets doing today?", hint: "Indices, movers and sentiment" },
  { icon: ShieldAlert, title: "How risky is my portfolio?", hint: "Volatility, beta, drawdown and VaR" },
];

function useAIStatus() {
  const [s, setS] = useState<AIStatus | null>(null);
  useEffect(() => { aiStatus().then(setS); }, []);
  return s;
}

export function ChatPage() {
  const { id } = useParams();
  const conv = useChats((s) => s.conversations.find((c) => c.id === id));
  const streamingId = useRuns((s) => (id ? s.streaming[id] : undefined));
  const navigate = useNavigate();
  const status = useAIStatus();
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  const lastLen = conv?.messages[conv.messages.length - 1]?.content.length ?? 0;
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [conv?.messages.length, lastLen]);
  useEffect(() => { stick.current = true; }, [id]);

  if (id && !conv) return <Navigate to="/" replace />;

  const submit = (text: string) => {
    stick.current = true;
    if (!id) navigate(`/c/${startConversation(text)}`);
    else void send(id, text);
  };

  if (!conv) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex flex-1 flex-col items-center overflow-y-auto px-4 py-10">
          <div className="my-auto w-full max-w-3xl animate-fade-up">
            <div className="mb-8 flex flex-col items-center text-center">
              <Logo className="mb-8 h-10 sm:h-12" />
              <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-[40px] sm:leading-[1.15]">Your financial intelligence, reimagined.</h1>
              <p className="mt-4 max-w-xl text-balance text-[15px] leading-relaxed text-muted">
                Ask anything about companies, markets or personal finance. Equidy analyses your portfolio, explains complex concepts and turns data into clear decisions.
              </p>
            </div>
            <Composer onSubmit={submit} streaming={false} status={status} large />
            <div className="mt-6 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={s.title}
                  onClick={() => submit(s.title)}
                  style={{ animationDelay: `${80 + i * 40}ms` }}
                  className="card group flex items-start gap-3 p-3.5 text-left transition-colors hover:border-accent/40 hover:bg-elevated animate-fade-up"
                >
                  <s.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted transition-colors group-hover:text-accent" />
                  <span>
                    <span className="block text-sm font-medium leading-snug">{s.title}</span>
                    <span className="mt-0.5 block text-xs text-muted">{s.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const lastAssistant = [...conv.messages].reverse().find((m) => m.role === "assistant");

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-line px-4 max-lg:hidden">
        <h2 className="truncate text-sm font-medium">{conv.title}</h2>
        <StatusBadge status={status} />
      </div>
      <div
        ref={scroller}
        className="min-h-0 flex-1 overflow-y-auto"
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
      >
        <div className="mx-auto w-full max-w-3xl space-y-7 px-4 py-8">
          {conv.messages.map((m) => (
            <Message
              key={m.id}
              m={m}
              streaming={streamingId === m.id}
              canRegenerate={!streamingId && m.id === lastAssistant?.id && m.id === conv.messages[conv.messages.length - 1].id}
              onRegenerate={() => regenerate(conv.id)}
            />
          ))}
        </div>
      </div>
      <div className="shrink-0 px-4 pb-4 pt-2">
        <div className="mx-auto max-w-3xl">
          <Composer onSubmit={submit} streaming={!!streamingId} onStop={() => stop(conv.id)} status={status} />
          <p className="mt-2 text-center text-[11px] text-muted">Equidy can make mistakes. Educational information only — not investment advice.</p>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: AIStatus | null }) {
  if (!status) return null;
  return status.ai ? (
    <span className="chip"><Cpu className="h-3 w-3 text-accent" /> Claude · {status.model}</span>
  ) : (
    <span className="chip" title="Set ANTHROPIC_API_KEY on the server to enable Claude">
      <WifiOff className="h-3 w-3" /> Offline engine
    </span>
  );
}

function Message({ m, streaming, canRegenerate, onRegenerate }: { m: ChatMessage; streaming: boolean; canRegenerate: boolean; onRegenerate: () => void }) {
  const [copied, setCopied] = useState(false);
  if (m.role === "user") {
    return (
      <div className="flex justify-end animate-fade-up">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-3xl rounded-br-lg bg-elevated px-4 py-2.5 text-[15px] leading-relaxed">{m.content}</div>
      </div>
    );
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(m.content); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard unavailable */ }
  };
  return (
    // Replies are plain text on the page; only the user's messages sit in a box.
    <div className="group animate-fade-up">
      <div className="min-w-0">
        {m.content ? (
          <div className={cn(m.error && "text-down")}>
            <Markdown text={m.content} />
            {streaming && <span className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 animate-blink rounded-sm bg-accent" />}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 py-2" aria-label="Thinking">
            {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 animate-blink rounded-full bg-muted" style={{ animationDelay: `${i * 0.2}s` }} />)}
            <span className="ml-2 text-xs text-muted">Analysing…</span>
          </div>
        )}
        {!streaming && m.content && (
          <div className="mt-2 flex items-center gap-1 text-muted opacity-0 transition-opacity group-hover:opacity-100 max-lg:opacity-100">
            <button className="btn-ghost p-1.5" onClick={copy} aria-label="Copy">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}</button>
            {canRegenerate && <button className="btn-ghost p-1.5" onClick={onRegenerate} aria-label="Regenerate"><RotateCcw className="h-3.5 w-3.5" /></button>}
            {m.source && <span className="ml-1 text-[11px]">{m.source === "claude" ? "Claude" : "Offline engine"}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function Composer({ onSubmit, streaming, onStop, status, large }: { onSubmit: (t: string) => void; streaming: boolean; onStop?: () => void; status: AIStatus | null; large?: boolean }) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 220) + "px";
  }, [text]);

  const go = () => {
    const t = text.trim();
    if (!t || streaming) return;
    onSubmit(t);
    setText("");
  };

  return (
    <div className={cn("card relative flex flex-col shadow-[0_8px_30px_rgb(0_0_0/0.12)] transition focus-within:border-accent/50", large ? "p-3" : "p-2")}>
      <textarea
        ref={ref}
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); go(); }
        }}
        placeholder="Ask Equidy about stocks, markets, or your portfolio…"
        className={cn("w-full resize-none bg-transparent px-2 leading-relaxed outline-none placeholder:text-muted/70", large ? "min-h-[56px] py-2 text-base" : "py-1.5 text-[15px]")}
        aria-label="Message Equidy"
      />
      <div className="flex items-center justify-between pl-1 pt-1">
        <div className="text-[11px] text-muted">{large && status && (status.ai ? `Powered by Claude · ${status.model}` : "Offline analysis engine")}</div>
        {streaming ? (
          <button onClick={onStop} className="grid h-9 w-9 place-items-center rounded-full bg-fg text-bg transition hover:opacity-90" aria-label="Stop generating">
            <Square className="h-3.5 w-3.5 fill-current" />
          </button>
        ) : (
          <button onClick={go} disabled={!text.trim()} className="grid h-9 w-9 place-items-center rounded-full bg-fg text-bg transition hover:bg-fg/85 disabled:bg-line disabled:text-muted" aria-label="Send message">
            <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  );
}

export function askEquidy(navigate: (to: string) => void, prompt: string) {
  navigate(`/c/${startConversation(prompt)}`);
}
