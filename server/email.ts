import { appUrl, getEnv } from "./env.js";

// Transactional email through Resend. Optional: needs RESEND_API_KEY and EMAIL_FROM.
// A failed email is logged and never blocks sign-up or anything else.

const SEND_TIMEOUT_MS = 2500;

export const emailEnabled = () => !!(getEnv("RESEND_API_KEY") && getEnv("EMAIL_FROM"));

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export function welcomeEmail(name: string) {
  const first = name.trim().split(/\s+/)[0] || "there";
  return {
    subject: "Welcome to Equidy",
    text: `Hi ${first},\n\nWelcome to Equidy. Ask a question, add your portfolio and explore the markets:\n${appUrl()}\n\nEquidy provides education and analysis, not personalised financial advice.`,
    html: `<p>Hi ${escapeHtml(first)},</p><p>Welcome to Equidy. Ask a question, add your portfolio and explore the markets:</p><p><a href="${escapeHtml(appUrl())}">Open Equidy</a></p><p>Equidy provides education and analysis, not personalised financial advice.</p>`,
  };
}

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  if (!emailEnabled()) return;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${getEnv("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: getEnv("EMAIL_FROM"), to: [to], ...welcomeEmail(name) }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (!res.ok) console.warn(`[equidy] welcome email failed with status ${res.status}`);
  } catch (err) {
    console.warn("[equidy] welcome email failed:", (err as Error).message);
  }
}
