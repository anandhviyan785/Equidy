import { Link } from "react-router-dom";
import { INDICES } from "@/data/securities";
import { useMarket } from "@/store";
import { price } from "@/lib/format";
import { Change } from "./ui";

export function TickerTape() {
  const prices = useMarket((s) => s.prices);
  return (
    <div className="flex shrink-0 items-center gap-6 overflow-x-auto border-b border-line bg-surface/60 px-4 py-2 text-xs [scrollbar-width:none]">
      {INDICES.map((i) => {
        const p = prices[i.symbol];
        return (
          <Link to="/markets" key={i.symbol} className="flex shrink-0 items-center gap-2 hover:opacity-80">
            <span className="text-muted">{i.name}</span>
            <span className="num font-medium">{price(p.price)}</span>
            <Change value={p.price / p.prevClose - 1} />
          </Link>
        );
      })}
      <span className="ml-auto flex shrink-0 items-center gap-1.5 text-muted">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" /> Simulated feed
      </span>
    </div>
  );
}
