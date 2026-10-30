import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { SECURITIES, type Security } from "@/data/securities";
import { useMarket } from "@/store";
import { cn, price } from "@/lib/format";
import { Change } from "./ui";

export function SymbolSearch({ onPick, exclude = [], placeholder = "Search ticker or company…", autoFocus }: { onPick: (s: Security) => void; exclude?: string[]; placeholder?: string; autoFocus?: boolean }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const prices = useMarket((s) => s.prices);
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    return SECURITIES.filter((s) => !exclude.includes(s.symbol))
      .filter((s) => !t || s.symbol.toLowerCase().includes(t) || s.name.toLowerCase().includes(t))
      .slice(0, 8);
  }, [q, exclude]);

  const pick = (s: Security) => {
    onPick(s);
    setQ("");
    setOpen(false);
  };

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <input
        autoFocus={autoFocus}
        className="input pl-9"
        placeholder={placeholder}
        value={q}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setHi(0); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, results.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
          if (e.key === "Enter" && results[hi]) { e.preventDefault(); pick(results[hi]); }
        }}
        role="combobox"
        aria-expanded={open}
      />
      {open && q.trim() && results.length === 0 && (
        <div className="card absolute z-30 mt-1.5 w-full px-3.5 py-3 text-sm text-muted shadow-xl">No stocks match "{q.trim()}".</div>
      )}
      {open && results.length > 0 && (
        <ul className="card absolute z-30 mt-1.5 max-h-72 w-full overflow-y-auto p-1 shadow-xl">
          {results.map((s, i) => {
            const p = prices[s.symbol];
            return (
              <li key={s.symbol}>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(s)}
                  onMouseEnter={() => setHi(i)}
                  className={cn("flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left", i === hi && "bg-elevated")}
                >
                  <span className="w-14 font-mono text-xs font-semibold">{s.symbol}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{s.name}</span>
                  <span className="num text-xs">{price(p.price)}</span>
                  <Change value={p.price / p.prevClose - 1} className="w-16 text-right text-xs" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
