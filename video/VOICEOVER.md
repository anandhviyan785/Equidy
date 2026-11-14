# Voiceover script (record with a human voice)

Direction: low, slow, unhurried. Short sentences, a beat of silence after each full stop. Calm authority, never shouting. Don't speed up.
Record as one file, **25 s long**, and save it as `public/voiceover.mp3`. Timings below match the scenes.

| Time | Scene | Line |
|---|---|---|
| 0:00–0:04 | Intro | "Money doesn't wait. Neither should you. Equidy. Your financial intelligence, reimagined." |
| 0:04–0:11 | Chat | "Ask why your portfolio is down. Get the answer. The working shown. The bull case. The bear case. The risks." |
| 0:11–0:17 | Features | "Track every holding. Measure your risk against the S&P five hundred. Learn how markets really work." |
| 0:17–0:21 | Steps | "Three steps. Sign in. Add your holdings. Ask." |
| 0:21–0:25 | Outro | "Start understanding your money. Equidy. Analysis, not advice." |

Tips: record in a quiet room, mic close, a pop filter if you have one. Dropping the pitch slightly and a touch of low-end EQ adds weight.
Then set `voiceover: true` in `src/Root.tsx` (or pass `--props='{"voiceover":true}'` when rendering).
