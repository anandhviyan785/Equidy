import { useState } from "react";
import { Link } from "react-router-dom";
import { analyticsAvailable, getConsent, setConsent } from "@/lib/analytics";

/** Asks before any analytics run. Shown only when analytics are configured and no choice has been made. */
export function ConsentBanner() {
  const [open, setOpen] = useState(() => analyticsAvailable() && getConsent() === null);
  if (!open) return null;
  const choose = (choice: "yes" | "no") => {
    setConsent(choice);
    setOpen(false);
  };
  return (
    <div role="region" aria-label="Analytics choice" className="card glass glass-thick fixed bottom-4 left-4 right-4 z-50 p-4 sm:left-auto sm:max-w-sm">
      <p className="text-sm">Can we count which pages are used to improve Equidy? We never collect your portfolio or chats. <Link to="/privacy" className="underline">Privacy Policy</Link></p>
      <div className="mt-3 flex justify-end gap-2">
        <button className="btn-ghost" onClick={() => choose("no")}>No thanks</button>
        <button className="btn-primary" onClick={() => choose("yes")}>Allow</button>
      </div>
    </div>
  );
}
