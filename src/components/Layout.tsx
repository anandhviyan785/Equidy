import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Menu, SquarePen } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { Logo } from "./ui";
import { TickerTape } from "./TickerTape";
import { useLiveTicks, useThemeSync } from "@/hooks";
import { useAuth } from "@/store";
import { loadAuth } from "@/lib/auth";

function readCollapsed() {
  try { return localStorage.getItem("equidy.sidebar") === "1"; } catch { return false; }
}

export function Layout() {
  useThemeSync();
  useLiveTicks();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isChat = location.pathname === "/" || location.pathname.startsWith("/c/");
  const user = useAuth((s) => s.user);
  const checked = useAuth((s) => s.checked);
  useEffect(() => { void loadAuth(); }, []);

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
    if (checked) return <Navigate to="/login" replace />;
    return <div className="grid h-full place-items-center"><Logo /></div>;
  }

  return (
    <div className="flex h-full overflow-hidden pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)]">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-line px-3 lg:hidden">
          <button className="btn-ghost p-2" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <Logo />
          <button className="btn-ghost p-2" onClick={() => navigate("/")} aria-label="New chat"><SquarePen className="h-5 w-5" /></button>
        </header>
        {!isChat && <TickerTape />}
        <main className="min-h-0 flex-1 overflow-y-auto" id="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
