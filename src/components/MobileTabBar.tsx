import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { BarChart3, BookOpen, Briefcase, House, LineChart, LogOut, MoreHorizontal, Settings, Star, UserRound } from "lucide-react";
import { useChats } from "@/store";
import { signOut } from "@/lib/auth";
import { cn } from "@/lib/format";

const MORE = [
  { to: "/statistics", label: "Statistics", icon: BarChart3 },
  { to: "/research", label: "Research", icon: BookOpen },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/profile", label: "Profile", icon: UserRound },
];

const TABS = [
  { to: "/", label: "Chat", icon: House },
  { to: "/portfolio", label: "Portfolio", icon: Briefcase },
  { to: "/markets", label: "Markets", icon: LineChart },
  { to: "/watchlist", label: "Watchlist", icon: Star },
];

export function MobileTabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const conversations = useChats((s) => s.conversations.slice(0, 5));
  const moreActive = MORE.some((item) => location.pathname.startsWith(item.to));

  useEffect(() => { setOpen(false); }, [location.pathname]);

  return (
    <>
      {open && <button className="fixed inset-0 z-40 bg-black/10 lg:hidden" aria-label="Close navigation menu" onClick={() => setOpen(false)} />}
      <nav className="mobile-glass-tabbar fixed inset-x-3 z-50 flex items-stretch gap-1 rounded-[26px] border px-1.5 py-1.5 lg:hidden" aria-label="Main navigation">
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === "/"} aria-label={label}
            className={({ isActive }) => cn("flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[19px] px-1 py-1.5 text-[10px] leading-tight transition-colors", (isActive && to !== "/" || to === "/" && (location.pathname === "/" || location.pathname.startsWith("/c/"))) ? "bg-fg/10 text-fg" : "text-muted hover:bg-fg/5")}>
            <Icon className="h-[18px] w-[18px]" strokeWidth={2} /><span className="truncate">{label}</span>
          </NavLink>
        ))}
        <div className="relative flex min-w-0 flex-1">
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="More navigation"
            className={cn("flex w-full flex-col items-center justify-center gap-0.5 rounded-[19px] px-1 py-1.5 text-[10px] leading-tight transition-colors", moreActive || open ? "bg-fg/10 text-fg" : "text-muted hover:bg-fg/5")}>
            <MoreHorizontal className="h-[18px] w-[18px]" /><span>More</span>
          </button>
          {open && (
            <div className="card absolute bottom-[calc(100%+0.65rem)] right-0 z-[60] max-h-[min(70vh,32rem)] w-72 overflow-y-auto rounded-3xl border border-line p-2 shadow-2xl">
              <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Sections</p>
              {MORE.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} onClick={() => setOpen(false)}
                  className={({ isActive }) => cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm", isActive ? "bg-fg/10 text-fg" : "text-muted hover:bg-fg/5")}>
                  <Icon className="h-4 w-4" />{label}
                </NavLink>
              ))}
              {conversations.length > 0 && <>
                <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted">Recent chats</p>
                {conversations.map((chat) => (
                  <NavLink key={chat.id} to={`/c/${chat.id}`} onClick={() => setOpen(false)} className="block truncate rounded-xl px-3 py-2.5 text-sm text-muted hover:bg-fg/5">
                    {chat.title}
                  </NavLink>
                ))}
              </>}
              <button type="button" onClick={async () => { if (!(await signOut())) return; setOpen(false); navigate("/login", { replace: true }); }}
                className="mt-1 flex w-full items-center gap-3 rounded-xl border-t border-line px-3 py-2.5 text-left text-sm text-muted">
                <LogOut className="h-4 w-4" />Sign out
              </button>
            </div>
          )}
        </div>
      </nav>
    </>
  );
}
