import React from "react";
import ReactDOM from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import App from "./App";
import { getConsent } from "./lib/analytics";
import { startMonitoring } from "./lib/monitoring";
import "./index.css";

startMonitoring();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <Analytics beforeSend={(event) => (getConsent() === "yes" ? event : null)} />
  </React.StrictMode>,
);
