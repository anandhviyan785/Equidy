# Equidy promo video (Remotion)

A 31 s, 1920×1080, 30 fps promo with a voiceover (see VOICEOVER.md) built from the landing page copy and Equidy's dark theme.

```bash
cd video && npm install
npm run studio   # live preview
npm run render   # writes out/equidy-promo.mp4
```

Scenes (frame counts live in `src/theme.ts`): intro → chat demo → features → three steps → outro.
Inter is inlined in `src/interFont.ts` so rendering needs no network. The numbers in the chat demo are illustrative, as on the landing page.
