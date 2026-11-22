import React from "react";
import ReactDOM from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import App from "./App";
import { getConsent, sanitizeEventUrl } from "./lib/analytics";
import { startMonitoring } from "./lib/monitoring";
import { listenForInstallPrompt, registerServiceWorker } from "./lib/pwa";
import "./index.css";

startMonitoring();
listenForInstallPrompt();
registerServiceWorker();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <Analytics beforeSend={(event) => (getConsent() === "yes" ? { ...event, url: sanitizeEventUrl(event.url) } : null)} />
  </React.StrictMode>,
);
