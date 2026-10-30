import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { app, hasKey, MODEL } from "./app.js";
import { authEnabled, providers } from "./auth.js";
import { accountsEnabled } from "./accounts.js";

const PORT = Number(process.env.PORT ?? 8787);

// Serve the built frontend in production.
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.listen(PORT, () => {
  console.log(`[equidy] API on http://localhost:${PORT} — ${hasKey ? `Claude enabled (${MODEL})` : "offline engine (set ANTHROPIC_API_KEY to enable Claude)"}`);
  const on = Object.entries(providers).filter(([, v]) => v).map(([k]) => k);
  if (accountsEnabled) on.unshift("email accounts");
  console.log(`[equidy] sign-in: ${authEnabled ? on.join(", ") : "not configured (set DATABASE_URL for email accounts)"}`);
});
