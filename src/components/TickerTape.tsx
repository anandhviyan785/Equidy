import { Link } from "react-router-dom";
import { INDICES } from "@/data/securities";
import { useMarket } from "@/store";
import { price } from "@/lib/format";
import { Change } from "./ui";

export function TickerTape() {
  const prices = useMarket((s) => s.prices);
  const anyLive = useMarket((s) => Object.keys(s.sources).length > 0);
  return (
    <div className="sticky bg-surface border-line top-2 z-20 mx-3 mt-2 flex items-center gap-6 overflow-x-auto rounded-full border px-4 py-2 text-xs [scrollbar-width:none]">
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
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" /> {anyLive ? "Indices simulated · stock prices live" : "Simulated feed"}
      </span>
    </div>
  );
}
