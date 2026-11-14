import { describe, expect, it } from "vitest";
import { joinTranscript, speechErrorMessage } from "@/lib/speech";

describe("joinTranscript", () => {
  it("uses the spoken words alone when nothing was typed", () => {
    expect(joinTranscript("", "how is apple doing")).toBe("how is apple doing");
  });

  it("adds spoken words after typed text with a single space", () => {
    expect(joinTranscript("Compare ", " Microsoft  and   Alphabet ")).toBe("Compare Microsoft and Alphabet");
  });

  it("keeps the typed text unchanged when nothing was heard", () => {
    expect(joinTranscript("Hello", "   ")).toBe("Hello");
  });
});

describe("speechErrorMessage", () => {
  it("explains a blocked microphone", () => {
    expect(speechErrorMessage("not-allowed")).toMatch(/blocked/i);
  });

  it("stays quiet when the user simply said nothing or cancelled", () => {
    expect(speechErrorMessage("no-speech")).toBeNull();
    expect(speechErrorMessage("aborted")).toBeNull();
  });

  it("falls back to a generic retry message for unknown errors", () => {
    expect(speechErrorMessage("something-new")).toMatch(/try again/i);
  });
});
