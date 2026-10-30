import { useNavigate } from "react-router-dom";
import { Star, Sparkles } from "lucide-react";
import { BY_SYMBOL } from "@/data/securities";
import { useMarket, usePortfolio } from "@/store";
import { Empty, Page, PageHeader } from "@/components/ui";
import { SymbolSearch } from "@/components/SymbolSearch";
import { SecurityTable } from "./MarketsPage";
import { askEquidy } from "./ChatPage";

export function WatchlistPage() {
  const watchlist = usePortfolio((s) => s.watchlist);
  const toggleWatch = usePortfolio((s) => s.toggleWatch);
  const prices = useMarket((s) => s.prices);
  const navigate = useNavigate();
  const items = watchlist.filter((w) => BY_SYMBOL[w]).map((w) => ({ s: BY_SYMBOL[w], p: prices[w], ch: prices[w].price / prices[w].prevClose - 1 }));

  return (
    <Page wide>
      <PageHeader
        title="Watchlist"
        subtitle="Securities you're following, with live prices and trends."
        actions={items.length > 1 && (
          <button className="btn-outline" onClick={() => askEquidy(navigate, `Give me a quick briefing on my watchlist: ${watchlist.join(", ")}. Compare ${watchlist.slice(0, 2).join(" vs ")}.`)}>
            <Sparkles className="h-4 w-4 text-accent" /> Brief me
          </button>
        )}
      />
      <div className="mb-4 max-w-md">
        <SymbolSearch exclude={watchlist} onPick={(s) => toggleWatch(s.symbol)} placeholder="Add a symbol to your watchlist…" />
      </div>
      {items.length ? (
        <div className="card overflow-hidden"><SecurityTable items={items} /></div>
      ) : (
        <Empty icon={<Star className="h-6 w-6" />} title="Your watchlist is empty" body="Search above or tap the star next to any security in Markets to start tracking it." />
      )}
    </Page>
  );
}
