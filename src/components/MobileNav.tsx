import { useEffect, useState } from "react";
import { BarChart3, BookOpen, Briefcase, LineChart, LogOut, Menu, MessageSquare, Settings, SquarePen, Star, UserRound, X } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { signOut } from "@/lib/auth";
import { cn } from "@/lib/format";
import { Logo } from "./ui";

const ITEMS = [
  { to: "/", label: "Chat", icon: MessageSquare, end: true },
  { to: "/portfolio", label: "Portfolio", icon: Briefcase },
  { to: "/markets", label: "Markets", icon: LineChart },
  { to: "/watchlist", label: "Watchlist", icon: Star },
  { to: "/statistics", label: "Statistics", icon: BarChart3 },
  { to: "/research", label: "Research", icon: BookOpen },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/profile", label: "Profile", icon: UserRound },
];

/** Chat also covers saved conversations, and Markets covers individual symbol pages. */
function isItemActive(to: string, pathname: string, active: boolean) {
  if (active) return true;
  if (to === "/") return pathname.startsWith("/c/");
  if (to === "/markets") return pathname.startsWith("/symbol/");
  return false;
}

/** Top menu bar for phones and tablets: menu button, logo and new chat, with a drop-down listing every page. */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => { setOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const handleSignOut = async () => {
    setOpen(false);
    try {
      await signOut();
    } catch (e) {
      console.error("[equidy] sign out failed:", e);
    } finally {
      navigate("/login", { replace: true });
    }
  };

  return (
    <div className="relative z-40 shrink-0 lg:hidden">
      <header className="flex h-12 items-center justify-between border-b border-line bg-bg px-2">
        <button
          type="button"
          className="btn-ghost p-2"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <Logo compact />
        <button type="button" className="btn-ghost p-2" onClick={() => navigate("/")} aria-label="New chat">
          <SquarePen className="h-5 w-5" />
        </button>
      </header>

      {open && (
        <>
          <div className="fixed inset-x-0 bottom-0 top-[calc(3rem+env(safe-area-inset-top))] bg-black/50" onClick={() => setOpen(false)} aria-hidden="true" />
          <div id="mobile-menu" className="absolute inset-x-0 top-12 border-b border-line bg-surface p-2 shadow-2xl">
            <nav className="grid grid-cols-2 gap-1" aria-label="Main navigation">
              {ITEMS.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) => cn(
                    "flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors",
                    isItemActive(to, location.pathname, isActive) ? "bg-elevated text-fg" : "text-muted hover:bg-elevated hover:text-fg",
                  )}
                >
                  <Icon className="h-4 w-4" />{label}
                </NavLink>
              ))}
            </nav>
            <button
              type="button"
              onClick={handleSignOut}
              className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-muted hover:bg-elevated hover:text-fg"
            >
              <LogOut className="h-4 w-4" />Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
