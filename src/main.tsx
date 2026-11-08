import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { startMonitoring } from "./lib/monitoring";
import "./index.css";

startMonitoring();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
