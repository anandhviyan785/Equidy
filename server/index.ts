import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { app, hasKey, MODEL } from "./app.js";
import { authEnabled, getProviders } from "./auth.js";
import { accountsEnabled } from "./accounts.js";
import { servicesStatus } from "./api.js";

const PORT = Number(process.env.PORT ?? 8787);

// Serve the built frontend in production.
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.listen(PORT, async () => {
  console.log(`[equidy] API on http://localhost:${PORT} — ${hasKey ? `Gemini enabled (${MODEL})` : "offline engine (set GEMINI_API_KEY to enable Gemini)"}`);
  const on = Object.entries(await getProviders()).filter(([, v]) => v).map(([k]) => k);
  if (accountsEnabled()) on.unshift("email accounts");
  console.log(`[equidy] sign-in: ${authEnabled() ? on.join(", ") : "not configured (set DATABASE_URL for email accounts)"}`);
  const s = servicesStatus();
  const flag = (b: boolean) => (b ? "on" : "off");
  console.log(`[equidy] quotes ${flag(s.quotes)} · history ${flag(s.history)} · intelligence ${flag(s.intel)} · cloud sync ${flag(s.sync)} · banking ${flag(s.banking)}`);
});
