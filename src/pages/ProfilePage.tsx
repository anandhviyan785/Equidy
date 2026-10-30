import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { signOut, providerLabel } from "@/lib/auth";
import { useAuth, useChats, useMarket, usePortfolio, useSettings } from "@/store";
import { positions, summarize } from "@/lib/finance";
import { money } from "@/lib/format";
import { Page, PageHeader, Stat } from "@/components/ui";

export function ProfilePage() {
  const { profile, riskProfile, set } = useSettings();
  const user = useAuth((s) => s.user);
  const navigate = useNavigate();
  const holdings = usePortfolio((s) => s.holdings);
  const watch = usePortfolio((s) => s.watchlist);
  const prices = useMarket((s) => s.prices);
  const chats = useChats((s) => s.conversations);
  const total = useMemo(() => summarize(positions(holdings, prices)), [holdings, prices]);
  const initials = profile.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

  return (
    <Page>
      <PageHeader title="Profile" subtitle="Your account and investing preferences." />
      <div className="card flex flex-wrap items-center gap-5 p-6">
        {user?.avatar ? (
          <img src={user.avatar} alt="" referrerPolicy="no-referrer" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <div className="grid h-16 w-16 place-items-center rounded-full bg-accent/15 text-xl font-semibold text-accent">{initials}</div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold">{profile.name}</div>
          <div className="text-sm text-muted">{profile.email}</div>
          {user && <div className="mt-1 text-xs text-muted">Signed in with {providerLabel(user.provider)}{user.demo ? " · demo account" : ""}</div>}
        </div>
        <span className="chip border-accent/40 text-accent">{profile.plan} plan</span>
        <button className="btn-outline" onClick={async () => { await signOut(); navigate("/login", { replace: true }); }}>
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Portfolio value" value={money(total.value, { compact: true })} />
        <Stat label="Holdings" value={holdings.length} />
        <Stat label="Watching" value={watch.length} />
        <Stat label="Conversations" value={chats.length} />
      </div>
      <div className="card mt-4 grid gap-4 p-6 sm:grid-cols-2">
        <div>
          <label className="label mb-1.5 block" htmlFor="pname">Display name</label>
          <input id="pname" className="input" value={profile.name} onChange={(e) => set({ profile: { ...profile, name: e.target.value } })} />
        </div>
        <div>
          <label className="label mb-1.5 block" htmlFor="pemail">Email</label>
          <input id="pemail" className="input" type="email" value={profile.email} onChange={(e) => set({ profile: { ...profile, email: e.target.value } })} />
        </div>
        <div className="sm:col-span-2">
          <div className="label mb-2">Risk profile</div>
          <div className="grid gap-2 sm:grid-cols-3">
            {(["conservative", "moderate", "aggressive"] as const).map((r) => (
              <button key={r} onClick={() => set({ riskProfile: r })} className={`card p-3 text-left text-sm capitalize transition-colors ${riskProfile === r ? "border-accent/60 bg-accent/5" : "hover:bg-elevated"}`}>
                <div className="font-medium">{r}</div>
                <div className="mt-0.5 text-xs normal-case text-muted">{{ conservative: "Capital preservation, ~40% bonds", moderate: "Balanced growth, ~20% bonds", aggressive: "Max growth, high volatility" }[r]}</div>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">Equidy uses your risk profile to tailor portfolio analysis. Manage more in <Link to="/settings" className="text-accent">Settings</Link>.</p>
        </div>
      </div>
    </Page>
  );
}
