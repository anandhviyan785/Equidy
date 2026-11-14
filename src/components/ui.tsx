import { useEffect, useRef, type ReactNode } from "react";
import { X, TrendingUp, TrendingDown } from "lucide-react";
import { cn, pct, tone } from "@/lib/format";
import wordmarkUrl from "@/assets/wordmark.png";
import logoUrl from "@/assets/logo-block.png";

export function Logo({ compact = false, className, alt = "Equidy" }: { compact?: boolean; className?: string; alt?: string }) {
  // Assets are white-on-transparent; invert them to black in light mode.
  return compact ? (
    <img src={logoUrl} alt={alt} className={cn("select-none invert dark:invert-0", className ?? "h-7 w-7")} draggable={false} />
  ) : (
    <img src={wordmarkUrl} alt={alt} className={cn("h-5 w-auto select-none invert dark:invert-0", className)} draggable={false} />
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
        <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-[0.01em]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[15px] text-muted">{subtitle}</p>}
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
      <div className="num mt-2 text-xl font-extrabold">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, size = "sm" }: { value: T; options: readonly T[]; onChange: (v: T) => void; size?: "sm" | "xs" }) {
  return (
    <div className="inline-flex rounded-2xl bg-elevated p-1">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          aria-pressed={value === o}
          className={cn(
            "seg-btn rounded-xl font-semibold transition-colors",
            size === "sm" ? "px-3 py-1 text-[13px]" : "px-2.5 py-0.5 text-xs",
            value === o ? "bg-[rgb(var(--seg-selected))] text-fg shadow-sm" : "text-muted hover:text-fg",
          )}
        >
          {o.charAt(0).toUpperCase() + o.slice(1)}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose; // callers pass inline handlers; keep the latest without re-running the effect
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLElement>("input,select,button")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/35" onClick={onClose} />
      <div ref={ref} role="dialog" aria-modal className="card glass glass-thick relative w-full max-w-md p-5 animate-fade-up">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-extrabold">{title}</h2>
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
      <div className="mb-4 grid h-24 w-24 place-items-center rounded-full bg-accent-soft text-accent/60">{icon}</div>
      <div className="text-lg font-extrabold">{title}</div>
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
      className={cn("relative h-6 w-[46px] rounded-full transition-colors", checked ? "bg-accent" : "bg-field/60")}
    >
      <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[23px]" : "translate-x-0.5")} />
    </button>
  );
}
