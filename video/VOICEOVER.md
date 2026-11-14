# Voiceover

`public/voiceover.wav` (31 s) is generated with [Kokoro](https://github.com/thewh1teagle/kokoro-onnx), an open-source text-to-speech model that runs locally. It uses the `am_onyx` voice, pitched down 1.5 semitones and warmed with EQ and compression, over a low sub-bass bed with a hit on each scene cut.

Rebuild it (needs Python with `kokoro-onnx soundfile`, ffmpeg, and the model files from the kokoro-onnx `model-files-v1.0` release):

```bash
tools/build_audio.sh <python> kokoro-v1.0.int8.onnx voices-v1.0.bin [voice]
```

## Script

| Time | Scene | Line |
|---|---|---|
| 0:00–0:04.5 | Intro | "Money doesn't wait. Neither should you." |
| 0:04.5–0:13 | Chat | "Ask why your portfolio is down. Get the answer, with the working shown. The bull case. The bear case. The risks." |
| 0:13–0:21 | Features | "Track every holding. Measure your risk against the S&P 500. Learn how markets really work." |
| 0:21–0:26 | Steps | "Three steps. Sign in. Add your holdings. Ask." |
| 0:26–0:31 | Outro | "Start understanding your money. Equidy." |

Scene lengths live in `SCENES` (`src/theme.ts`) and line timings in `tools/make_voiceover.py`; change both together.

## Using a human voice instead

Record the script as one 31 s file (low, slow, a beat after each full stop), timed to the table above, and save it over `public/voiceover.wav`. Render with `--props='{"voiceover":false}'` for a silent cut.
