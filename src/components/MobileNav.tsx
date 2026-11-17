import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BarChart3, BookOpen, Briefcase, LineChart, MessageSquare, MoreHorizontal, Settings, Star, UserRound, LogOut } from "lucide-react";
import LiquidGlass from "liquid-glass-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { signOut } from "@/lib/auth";
import { cn } from "@/lib/format";

const TABS = [
  { to: "/", label: "Chat", icon: MessageSquare, end: true },
  { to: "/portfolio", label: "Portfolio", icon: Briefcase },
  { to: "/markets", label: "Markets", icon: LineChart },
  { to: "/watchlist", label: "Watchlist", icon: Star },
];

const MORE = [
  { to: "/statistics", label: "Statistics", icon: BarChart3 },
  { to: "/research", label: "Research", icon: BookOpen },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/profile", label: "Profile", icon: UserRound },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const activeMore = MORE.some(({ to }) => location.pathname.startsWith(to));

  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <LiquidGlass
      className="z-50 w-fit px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-auto lg:hidden"
      displacementScale={14}
      blurAmount={0.04}
      saturation={130}
      aberrationIntensity={0}
      elasticity={0}
      cornerRadius={26}
      padding="6px"
      style={{ position: "fixed", left: "50%", top: "calc(100% - 54px)", bottom: "auto", maxWidth: "100%" }}
    >
      <nav className="relative flex w-[min(calc(100vw-1.5rem),30rem)] items-center justify-around rounded-[22px] border border-line/70 bg-surface/[0.92] p-1.5 shadow-2xl backdrop-blur-md" aria-label="Main navigation">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            aria-label={label}
            className={({ isActive }) => cn("flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-medium transition-colors", isActive || (to === "/" && location.pathname.startsWith("/c/")) || (to === "/markets" && location.pathname.startsWith("/symbol/")) ? "bg-white/15 text-fg" : "text-muted hover:text-fg")}
          >
            <Icon className="h-[19px] w-[19px]" strokeWidth={1.8} />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          aria-label="More navigation options"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className={cn("flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-medium transition-colors", open || activeMore ? "bg-white/15 text-fg" : "text-muted hover:text-fg")}
        >
          <MoreHorizontal className="h-[19px] w-[19px]" strokeWidth={1.8} />
          <span>More</span>
        </button>
        {open && createPortal(
          <div className="fixed right-3 z-[60] mb-3 w-48 overflow-hidden rounded-2xl border border-line bg-surface/95 p-1.5 shadow-2xl backdrop-blur-xl" style={{ bottom: "calc(max(0.75rem, env(safe-area-inset-bottom)) + 5.5rem)" }}>
            {MORE.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} className={({ isActive }) => cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm", isActive ? "bg-elevated text-fg" : "text-muted hover:bg-elevated hover:text-fg")}>
                <Icon className="h-4 w-4" />{label}
              </NavLink>
            ))}
            <button type="button" onClick={async () => { await signOut(); navigate("/login", { replace: true }); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-muted hover:bg-elevated hover:text-fg">
              <LogOut className="h-4 w-4" />Sign out
            </button>
          </div>,
          document.body,
        )}
      </nav>
    </LiquidGlass>
  );
}
