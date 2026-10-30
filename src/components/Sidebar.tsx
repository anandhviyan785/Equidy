import { useMemo, useState } from "react";
import { NavLink, useMatch, useNavigate } from "react-router-dom";
import {
  PanelLeftClose, PanelLeftOpen, SquarePen, Search, Briefcase, BarChart3, LineChart, Star, BookOpen, Settings, MessageSquare,
  MoreHorizontal, Pin, Pencil, Trash2, X, LogOut,
} from "lucide-react";
import { useAuth, useChats, useSettings } from "@/store";
import { signOut } from "@/lib/auth";
import { cn } from "@/lib/format";
import { Logo } from "./ui";

const NAV = [
  { to: "/portfolio", label: "Portfolio", icon: Briefcase },
  { to: "/statistics", label: "Statistics", icon: BarChart3 },
  { to: "/markets", label: "Markets", icon: LineChart },
  { to: "/watchlist", label: "Watchlist", icon: Star },
  { to: "/research", label: "Financial Research", icon: BookOpen },
];

function groupLabel(t: number) {
  const day = 86_400_000;
  const startToday = new Date().setHours(0, 0, 0, 0);
  if (t >= startToday) return "Today";
  if (t >= startToday - day) return "Yesterday";
  if (t >= startToday - 7 * day) return "Previous 7 days";
  if (t >= startToday - 30 * day) return "Previous 30 days";
  return "Older";
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onCloseMobile }: { collapsed: boolean; onToggle: () => void; mobileOpen: boolean; onCloseMobile: () => void }) {
  const navigate = useNavigate();
  const activeId = useMatch("/c/:id")?.params.id;
  const conversations = useChats((s) => s.conversations);
  const { rename, remove, togglePin } = useChats();
  const profile = useSettings((s) => s.profile);
  const avatar = useAuth((s) => s.user?.avatar);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = conversations
      .filter((c) => !q || c.title.toLowerCase().includes(q) || c.messages.some((m) => m.content.toLowerCase().includes(q)))
      .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt - a.updatedAt);
    const out = new Map<string, typeof list>();
    for (const c of list) {
      const g = c.pinned ? "Pinned" : groupLabel(c.updatedAt);
      out.set(g, [...(out.get(g) ?? []), c]);
    }
    return [...out.entries()];
  }, [conversations, query]);

  const go = (to: string) => {
    navigate(to);
    onCloseMobile();
  };

  const isCollapsed = collapsed && !mobileOpen;

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={onCloseMobile} />}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-line bg-surface transition-[width,transform] duration-300 ease-out lg:static lg:translate-x-0",
          isCollapsed ? "w-[64px]" : "w-[272px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className={cn("flex h-14 items-center px-3", isCollapsed ? "justify-center" : "justify-between")}>
          {!isCollapsed && <button onClick={() => go("/")} className="rounded-lg px-1.5 py-1 hover:bg-elevated"><Logo /></button>}
          <button className="btn-ghost p-2 max-lg:hidden" onClick={onToggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
          </button>
          <button className="btn-ghost p-2 lg:hidden" onClick={onCloseMobile} aria-label="Close menu"><X className="h-[18px] w-[18px]" /></button>
        </div>

        <div className="space-y-0.5 px-2">
          <SideButton icon={SquarePen} label="New chat" collapsed={isCollapsed} onClick={() => go("/")} />
          <SideButton
            icon={Search}
            label="Search conversations"
            collapsed={isCollapsed}
            active={searching}
            onClick={() => {
              if (isCollapsed) onToggle();
              setSearching((s) => !s);
            }}
          />
          {searching && !isCollapsed && (
            <div className="px-1 py-1.5">
              <input autoFocus className="input h-9" placeholder="Search chats…" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Escape" && (setQuery(""), setSearching(false))} />
            </div>
          )}
        </div>

        <nav className="mt-3 space-y-0.5 px-2">
          {!isCollapsed && <div className="label px-2.5 pb-1 pt-2">Workspace</div>}
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              onClick={onCloseMobile}
              title={isCollapsed ? n.label : undefined}
              className={({ isActive }) =>
                cn("flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition-colors", isCollapsed && "justify-center", isActive ? "bg-elevated text-fg" : "text-muted hover:bg-elevated hover:text-fg")
              }
            >
              <n.icon className="h-[18px] w-[18px] shrink-0" />
              {!isCollapsed && <span className="truncate">{n.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {!isCollapsed && (
            <>
              {groups.length === 0 && (
                <p className="px-2.5 py-3 text-xs text-muted">{query ? "No conversations match your search." : "Your conversations will appear here."}</p>
              )}
              {groups.map(([label, list]) => (
                <div key={label} className="mb-2">
                  <div className="label px-2.5 pb-1 pt-3">{label === "Today" && !query ? "Recent" : label}</div>
                  {list.map((c) => (
                    <div key={c.id} className={cn("group relative flex items-center rounded-xl", activeId === c.id ? "bg-elevated" : "hover:bg-elevated")}>
                      {editing === c.id ? (
                        <input
                          autoFocus
                          defaultValue={c.title}
                          className="input mx-1 my-0.5 h-8"
                          onBlur={(e) => { rename(c.id, e.target.value.trim() || c.title); setEditing(null); }}
                          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditing(null); }}
                        />
                      ) : (
                        <button onClick={() => go(`/c/${c.id}`)} className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left text-sm">
                          {c.pinned ? <Pin className="h-3.5 w-3.5 shrink-0 text-accent" /> : <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted" />}
                          <span className={cn("truncate", activeId === c.id ? "text-fg" : "text-fg/85")}>{c.title}</span>
                        </button>
                      )}
                      {editing !== c.id && (
                        <button
                          className={cn("mr-1 rounded-lg p-1 text-muted hover:text-fg", menu === c.id ? "opacity-100" : "opacity-0 group-hover:opacity-100 max-lg:opacity-100")}
                          onClick={() => setMenu(menu === c.id ? null : c.id)}
                          aria-label="Conversation options"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      )}
                      {menu === c.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setMenu(null)} />
                          <div className="card absolute right-1 top-9 z-20 w-40 p-1 shadow-xl animate-fade-up">
                            <MenuItem icon={Pin} label={c.pinned ? "Unpin" : "Pin"} onClick={() => { togglePin(c.id); setMenu(null); }} />
                            <MenuItem icon={Pencil} label="Rename" onClick={() => { setEditing(c.id); setMenu(null); }} />
                            <MenuItem
                              icon={Trash2}
                              label="Delete"
                              danger
                              onClick={() => {
                                remove(c.id);
                                setMenu(null);
                                if (activeId === c.id) go("/");
                              }}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>

        <div className="border-t border-line p-2">
          <NavLink
            to="/settings"
            onClick={onCloseMobile}
            title={isCollapsed ? "Settings" : undefined}
            className={({ isActive }) => cn("flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition-colors", isCollapsed && "justify-center", isActive ? "bg-elevated" : "text-muted hover:bg-elevated hover:text-fg")}
          >
            <Settings className="h-[18px] w-[18px] shrink-0" />
            {!isCollapsed && "Settings"}
          </NavLink>
          <NavLink
            to="/profile"
            onClick={onCloseMobile}
            title={isCollapsed ? profile.name : undefined}
            className={({ isActive }) => cn("mt-0.5 flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-elevated", isCollapsed && "justify-center", isActive && "bg-elevated")}
          >
            {avatar ? (
              <img src={avatar} alt="" referrerPolicy="no-referrer" className="h-8 w-8 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
                {profile.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
              </span>
            )}
            {!isCollapsed && (
              <span className="min-w-0 text-left">
                <span className="block truncate text-sm font-medium">{profile.name}</span>
                <span className="block truncate text-xs text-muted">{profile.plan} plan</span>
              </span>
            )}
          </NavLink>
          <button
            onClick={async () => { await signOut(); onCloseMobile(); navigate("/login", { replace: true }); }}
            title="Sign out"
            className={cn("mt-0.5 flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-sm text-muted transition-colors hover:bg-elevated hover:text-fg", isCollapsed && "justify-center")}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            {!isCollapsed && "Sign out"}
          </button>
        </div>
      </aside>
    </>
  );
}

function SideButton({ icon: Icon, label, collapsed, onClick, active }: { icon: typeof Search; label: string; collapsed: boolean; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn("flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition-colors hover:bg-elevated", collapsed && "justify-center", active ? "bg-elevated text-fg" : "text-fg/90")}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      {!collapsed && label}
    </button>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }: { icon: typeof Pin; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm hover:bg-elevated", danger ? "text-down" : "text-fg")}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
