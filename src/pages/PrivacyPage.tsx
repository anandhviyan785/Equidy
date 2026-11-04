import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/ui";
import { useThemeSync } from "@/hooks";

// Contact address shown in the policy. App Store and Google Play reviewers check that it works.
export const PRIVACY_CONTACT = "privacy@equidy.website";
const UPDATED = "4 November 2026";

export function PrivacyPage() {
  useThemeSync();
  return (
    <div className="min-h-full bg-bg px-4 pb-16 pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="mx-auto max-w-2xl">
        <div className="mb-10 flex items-center justify-between">
          <Logo />
          <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg"><ArrowLeft className="h-4 w-4" /> Back</Link>
        </div>
        <article className="prose-equidy">
          <h1>Privacy Policy</h1>
          <p>Last updated: {UPDATED}</p>
          <p>Equidy ("we", "us") provides financial information, education and portfolio analytics through the website equidy.website and the Equidy apps. This policy explains what we collect and why.</p>

          <h2>What we collect</h2>
          <ul>
            <li><strong>Account details.</strong> When you create an account: your name, email address and password. Passwords are stored only as a salted one-way hash; we can never see them.</li>
            <li><strong>Sign-in with Google, Microsoft or Apple.</strong> If you use one of these, we receive your name, email address and, where provided, profile photo. We do not receive your password for those services.</li>
            <li><strong>Your portfolio, watchlist, chats and settings.</strong> These are stored in your browser and, when you are signed in, saved to your account in our database so they are available on your other devices.</li>
            <li><strong>Bank and brokerage connections.</strong> If you choose to link an account, we use Plaid to connect to your bank. We receive account names, the last digits of account numbers, balances, recent transactions and investment holdings. We never see your bank password. The access key Plaid gives us is stored encrypted, and you can disconnect at any time from the Banking page.</li>
            <li><strong>Questions you ask the assistant.</strong> When the AI assistant is on, your message, the conversation so far and a summary of your portfolio (and of linked bank balances and spending, if you have connected a bank) are sent to our AI provider, Google (Gemini), to generate a reply. While Equidy uses Gemini's free tier, Google may use this content to improve its products and human reviewers may read it, so avoid including details you consider private.</li>
            <li><strong>Technical data.</strong> Our hosting provider keeps standard server logs, such as IP address, browser type and the time of each request, for security and reliability.</li>
          </ul>

          <h2>How we use it</h2>
          <ul>
            <li>To create and secure your account and keep you signed in, using a session cookie.</li>
            <li>To answer your questions and personalise the assistant, for example by greeting you by name.</li>
            <li>To protect the service against abuse, such as repeated failed sign-ins.</li>
          </ul>
          <p>We do not sell your personal information, show advertising, or use third-party tracking or analytics.</p>

          <h2>Who we share it with</h2>
          <ul>
            <li><strong>Vercel</strong>, which hosts the service.</li>
            <li><strong>Neon</strong>, which hosts the database where your account and saved data are stored.</li>
            <li><strong>Google</strong>, which provides the AI assistant (Gemini), for the messages described above.</li>
            <li><strong>Plaid</strong>, only if you choose to connect a bank or brokerage account.</li>
            <li><strong>Alpha Vantage and Finnhub</strong>, which supply market data. We request prices and news by ticker symbol only; no personal information is sent to them.</li>
            <li><strong>Google, Microsoft or Apple</strong>, only if you choose to sign in with them.</li>
          </ul>

          <h2>How long we keep it</h2>
          <p>We keep your account details until you delete your account. Data on your device stays there until you clear it or delete your account. Bank connections are kept until you disconnect them or delete your account.</p>

          <h2>Deleting your account</h2>
          <p>You can delete your account at any time from <strong>Profile → Delete account</strong> in the app. This permanently removes your account and saved data from our database, disconnects any linked banks, and clears the Equidy data saved on that device. You can also email us to ask for deletion.</p>

          <h2>Children</h2>
          <p>Equidy is not intended for children under 13, and we do not knowingly collect their personal information.</p>

          <h2>Not financial advice</h2>
          <p>Equidy provides information and education only. Nothing in the service is personalised investment, tax or legal advice. Market data comes from third-party providers and may be delayed or incomplete; where no provider is available, the app shows simulated prices, which it labels as simulated.</p>

          <h2>Changes and contact</h2>
          <p>If we change this policy, we will update the date above. For questions or requests, contact us at <strong>{PRIVACY_CONTACT}</strong>.</p>
        </article>
      </div>
    </div>
  );
}
