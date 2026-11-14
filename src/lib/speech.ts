import { useCallback, useEffect, useRef, useState } from "react";

/** The parts of the browser's Web Speech API that Equidy uses. Not in TypeScript's DOM types. */
interface RecognitionAlternative { transcript: string }
interface RecognitionResult { isFinal: boolean; 0: RecognitionAlternative }
interface RecognitionEvent { resultIndex: number; results: ArrayLike<RecognitionResult> }
interface RecognitionErrorEvent { error: string }
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/** Adds spoken words after whatever was already typed, with one space between. */
export function joinTranscript(typed: string, spoken: string): string {
  const s = spoken.replace(/\s+/g, " ").trim();
  if (!s) return typed;
  const t = typed.replace(/\s+$/, "");
  return t ? `${t} ${s}` : s;
}

/** Turns a speech-recognition error code into a message people can act on, or null when it isn't worth showing. */
export function speechErrorMessage(code: string): string | null {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access is blocked. Allow it in your browser's site settings to talk to Equidy.";
    case "audio-capture":
      return "No microphone was found.";
    case "network":
      return "Voice input needs an internet connection.";
    case "no-speech":
    case "aborted":
      return null;
    default:
      return "Voice input stopped. Try again.";
  }
}

/**
 * Speech-to-text for the message box. While listening, `onText` receives the typed text
 * plus everything said so far, so words appear as they are spoken.
 */
export function useSpeechInput(onText: (text: string) => void) {
  const [supported] = useState(() => !!recognitionCtor());
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const stop = useCallback(() => { rec.current?.stop(); }, []);

  const start = useCallback((typed: string) => {
    const Ctor = recognitionCtor();
    if (!Ctor || rec.current) return;
    const r = new Ctor();
    r.lang = navigator.language || "en-US";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let spoken = "";
      for (let i = 0; i < e.results.length; i++) spoken += e.results[i][0].transcript + " ";
      onTextRef.current(joinTranscript(typed, spoken));
    };
    r.onerror = (e) => setError(speechErrorMessage(e.error));
    r.onend = () => { rec.current = null; setListening(false); };
    rec.current = r;
    setError(null);
    try {
      r.start();
      setListening(true);
    } catch {
      rec.current = null;
      setError("Voice input couldn't start. Try again.");
    }
  }, []);

  useEffect(() => () => rec.current?.abort(), []);

  return { supported, listening, error, start, stop };
}
