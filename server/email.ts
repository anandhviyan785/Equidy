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

export function passwordResetEmail(link: string) {
  return {
    subject: "Reset your Equidy password",
    text: `Someone asked to reset the password for your Equidy account.\n\nChoose a new password here (the link works once and expires in 1 hour):\n${link}\n\nIf this wasn't you, ignore this email and your password stays the same.`,
    html: `<p>Someone asked to reset the password for your Equidy account.</p><p><a href="${escapeHtml(link)}">Choose a new password</a></p><p>The link works once and expires in 1 hour. If this wasn't you, ignore this email and your password stays the same.</p>`,
  };
}

/** Sends one email through Resend. Returns false (and logs) on failure; never throws. */
async function send(kind: string, to: string, message: { subject: string; text: string; html: string }): Promise<boolean> {
  if (!emailEnabled()) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${getEnv("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: getEnv("EMAIL_FROM"), to: [to], ...message }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (!res.ok) console.warn(`[equidy] ${kind} email failed with status ${res.status}`);
    return res.ok;
  } catch (err) {
    console.warn(`[equidy] ${kind} email failed:`, (err as Error).message);
    return false;
  }
}

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  await send("welcome", to, welcomeEmail(name));
}

export const sendPasswordResetEmail = (to: string, link: string): Promise<boolean> => send("password reset", to, passwordResetEmail(link));
