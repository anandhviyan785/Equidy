"""Generate public/voiceover.wav with Kokoro TTS (open-source, runs locally).

Usage: python make_voiceover.py <model.onnx> <voices.bin> <out.wav> [voice]
Also writes <out>.bed.wav, a low cinematic bed (sub drone plus a hit on each scene cut).
tools/build_audio.sh runs this and mixes the final public/voiceover.wav.
Model files: https://github.com/thewh1teagle/kokoro-onnx/releases (model-files-v1.0).
Each line starts at its scene's start time (see src/theme.ts) and must end before the next scene.
"""
import sys

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

SAMPLE_RATE = 24000
TOTAL_SECONDS = 31.0
SPEED = 0.88  # slower reads as calmer and heavier
CUTS = [4.5, 13.0, 21.0, 26.0]  # scene boundaries in seconds, from SCENES in src/theme.ts

# (start second, end second, text), one line per scene.
LINES = [
    (0.6, 4.5, "Money doesn't wait. Neither should you."),
    (4.8, 13.0, "Ask why your portfolio is down. Get the answer, with the working shown. The bull case. The bear case. The risks."),
    (13.3, 21.0, "Track every holding. Measure your risk against the S and P five hundred. Learn how markets really work."),
    (21.3, 26.0, "Three steps. Sign in. Add your holdings. Ask."),
    (26.4, 31.0, "Start understanding your money. Equidy."),
]


def main() -> None:
    model, voices, out = sys.argv[1:4]
    voice = sys.argv[4] if len(sys.argv) > 4 else "am_onyx"
    kokoro = Kokoro(model, voices)
    track = np.zeros(int(TOTAL_SECONDS * SAMPLE_RATE), dtype=np.float32)
    for start, end, text in LINES:
        audio, sr = kokoro.create(text, voice=voice, speed=SPEED, lang="en-us")
        assert sr == SAMPLE_RATE, sr
        length = len(audio) / sr
        if start + length > end:
            print(f"WARNING: {length:.2f}s line overruns its {end - start:.2f}s slot: {text!r}", file=sys.stderr)
        i = int(start * sr)
        clip = audio[: len(track) - i]
        track[i : i + len(clip)] += clip
        print(f"{start:5.1f}s  {length:4.2f}s / {end - start:4.2f}s  {text}")
    sf.write(out, track, SAMPLE_RATE)
    sf.write(out.replace(".wav", ".bed.wav"), make_bed(), SAMPLE_RATE)


def make_bed() -> np.ndarray:
    """A dark sub drone that swells in, with a decaying low boom on every scene cut."""
    t = np.arange(int(TOTAL_SECONDS * SAMPLE_RATE)) / SAMPLE_RATE
    swell = np.clip(t / 3, 0, 1) * np.clip((TOTAL_SECONDS - t) / 2.5, 0, 1)
    drone = (0.5 * np.sin(2 * np.pi * 55 * t) + 0.25 * np.sin(2 * np.pi * 82.4 * t)) * (0.85 + 0.15 * np.sin(2 * np.pi * 0.25 * t))
    bed = 0.05 * drone * swell
    for cut in [0.0, *CUTS]:
        dt = t - cut
        hit = dt >= 0
        freq = 38 + 50 * np.exp(-dt[hit] * 12)  # pitch drops quickly: a cinematic "boom"
        phase = 2 * np.pi * np.cumsum(freq) / SAMPLE_RATE
        bed[hit] += 0.22 * np.sin(phase) * np.exp(-dt[hit] * 2.2)
    return bed.astype(np.float32)


if __name__ == "__main__":
    main()
