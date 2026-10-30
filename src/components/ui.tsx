import { useEffect, useRef, type ReactNode } from "react";
import { X, TrendingUp, TrendingDown } from "lucide-react";
import { cn, pct, tone } from "@/lib/format";
import wordmarkUrl from "@/assets/wordmark.png";
import markUrl from "@/assets/mark.png";

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  // Assets are white-on-transparent; invert them to black in light mode.
  return compact ? (
    <img src={markUrl} alt="Equidy" className={cn("h-7 w-7 select-none invert dark:invert-0", className)} draggable={false} />
  ) : (
    <img src={wordmarkUrl} alt="Equidy" className={cn("h-5 w-auto select-none invert dark:invert-0", className)} draggable={false} />
  );
}

export function Change({ value, className, icon = false, decimals = 2 }: { value: number; className?: string; icon?: boolean; decimals?: number }) {
  const Icon = value >= 0 ? TrendingUp : TrendingDown;
  return (
    <span className={cn("num inline-flex items-center gap-1", tone(value), className)}>
      {icon && <Icon className="h-3.5 w-3.5" />}
      {pct(value, decimals)}
    </span>
  );
}

export function ChangePill({ value }: { value: number }) {
  return (
    <span className={cn("num rounded-md px-1.5 py-0.5 text-xs font-medium", value >= 0 ? "bg-up/10 text-up" : "bg-down/10 text-down")}>
      {pct(value)}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Page({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <div className={cn("mx-auto w-full px-4 py-6 sm:px-6 lg:py-8 animate-fade-up", wide ? "max-w-7xl" : "max-w-6xl")}>{children}</div>;
}

export function Stat({ label, value, sub, className }: { label: string; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn("card p-4", className)}>
      <div className="label">{label}</div>
      <div className="num mt-2 text-xl font-semibold tracking-tight">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, size = "sm" }: { value: T; options: readonly T[]; onChange: (v: T) => void; size?: "sm" | "xs" }) {
  return (
    <div className="inline-flex rounded-xl border border-line bg-surface p-0.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={cn(
            "rounded-[10px] font-medium transition-colors",
            size === "sm" ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-[11px]",
            value === o ? "bg-elevated text-fg" : "text-muted hover:text-fg",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLElement>("input,select,button")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      <div ref={ref} role="dialog" aria-modal className="card relative w-full max-w-md p-5 shadow-2xl animate-fade-up">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button className="btn-ghost -mr-2 p-1.5" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Empty({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-3 rounded-2xl bg-elevated p-3 text-muted">{icon}</div>
      <div className="font-medium">{title}</div>
      <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-6 w-10 rounded-full transition-colors", checked ? "bg-accent" : "bg-line")}
    >
      <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[18px]" : "translate-x-0.5")} />
    </button>
  );
}
