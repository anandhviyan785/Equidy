import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { SquarePen } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { Logo } from "./ui";
import { TickerTape } from "./TickerTape";
import { ConsentBanner } from "./ConsentBanner";
import { LandingRoute } from "@/pages/LandingRoute";
import { trackPage } from "@/lib/analytics";
import { useLiveTicks, useThemeSync } from "@/hooks";
import { useAuth } from "@/store";
import { loadAuth } from "@/lib/auth";
import { retitleExisting } from "@/lib/chatRunner";
import { useLiveMarket } from "@/lib/live";
import { useCloudSync } from "@/lib/sync";

function readCollapsed() {
  try { return localStorage.getItem("equidy.sidebar") === "1"; } catch { return false; }
}

export function Layout() {
  useThemeSync();
  useLiveTicks();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const location = useLocation();
  const navigate = useNavigate();
  const isChat = location.pathname === "/" || location.pathname.startsWith("/c/");
  const user = useAuth((s) => s.user);
  const checked = useAuth((s) => s.checked);
  useLiveMarket();
  useCloudSync(user);
  useEffect(() => { void loadAuth(); retitleExisting(); }, []);
  useEffect(() => { trackPage(location.pathname); }, [location.pathname]);

  useEffect(() => {
    try { localStorage.setItem("equidy.sidebar", collapsed ? "1" : "0"); } catch { /* storage unavailable */ }
  }, [collapsed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") { e.preventDefault(); setCollapsed((c) => !c); }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "o") { e.preventDefault(); navigate("/"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  if (!user) {
    if (checked) return location.pathname === "/" ? <LandingRoute /> : <Navigate to="/login" replace />;
    return <div className="grid h-full place-items-center"><Logo /></div>;
  }

  return (
    <div className="flex h-full overflow-hidden pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)]">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-line px-3 lg:hidden">
          <Logo compact />
          <button type="button" className="btn-ghost p-2" onClick={() => navigate("/")} aria-label="New chat">
            <SquarePen className="h-5 w-5" />
          </button>
        </div>
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain pb-24 lg:pb-0" id="main">
          {!isChat && <TickerTape />}
          <Outlet />
        </main>
      </div>
      <MobileNav />
      <ConsentBanner />
    </div>
  );
}
