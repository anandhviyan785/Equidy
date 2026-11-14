import { NavLink, useLocation } from "react-router-dom";
import { MessageSquare, Briefcase, LineChart, Star, Settings } from "lucide-react";
import { cn } from "@/lib/format";

const TABS = [
  { to: "/", label: "Chat", icon: MessageSquare, match: (p: string) => p === "/" || p.startsWith("/c/") },
  { to: "/portfolio", label: "Portfolio", icon: Briefcase },
  { to: "/markets", label: "Markets", icon: LineChart },
  { to: "/watchlist", label: "Watchlist", icon: Star },
  { to: "/settings", label: "Settings", icon: Settings },
];

/** Bottom tab bar for phones, after the kit's "Tab Bar" component. Hidden from lg up, where the sidebar takes over. */
export function TabBar() {
  const { pathname } = useLocation();
  return (
    <nav aria-label="Primary" className="shrink-0 border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      <ul className="flex h-[60px] items-stretch">
        {TABS.map((t) => {
          const active = t.match ? t.match(pathname) : pathname.startsWith(t.to);
          return (
            <li key={t.to} className="flex-1">
              <NavLink
                to={t.to}
                aria-current={active ? "page" : undefined}
                className={cn("flex h-full flex-col items-center justify-center gap-1 text-[10px] transition-colors", active ? "font-bold text-fg" : "font-medium text-muted")}
              >
                <t.icon className={cn("h-5 w-5", active ? "text-accent" : "text-field")} strokeWidth={active ? 2.4 : 2} />
                {t.label}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
