import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

const ACTIVE = ["active", "trialing", "past_due"];

/** Subscription controls. Renders nothing unless Stripe is configured on the server. */
export function BillingSection() {
  const [billing, setBilling] = useState<{ enabled: boolean; status: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/billing/status", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (live) setBilling(j); })
      .catch(() => { /* billing stays hidden */ });
    return () => { live = false; };
  }, []);

  if (!billing?.enabled) return null;
  const subscribed = ACTIVE.includes(billing.status ?? "");

  const open = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(subscribed ? "/api/billing/portal" : "/api/billing/checkout", { method: "POST", credentials: "same-origin" });
      const j = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !j.url) throw new Error(j.error || "We couldn't reach billing. Please try again.");
      window.location.assign(j.url);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <section className="card p-5">
      <h2 className="font-medium">Plan</h2>
      <p className="mt-0.5 text-sm text-muted">{subscribed ? "Your subscription is active." : "Upgrade through Stripe's secure checkout."}</p>
      {error && <p role="alert" className="mt-3 text-sm text-down">{error}</p>}
      <button className="btn-primary mt-4" onClick={() => void open()} disabled={busy}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {subscribed ? "Manage subscription" : "Upgrade"}
      </button>
    </section>
  );
}
