import React from "react";
import { useMarketData } from "../AccountContext.jsx";
import { PageHeader, EmptyState } from "../shared.jsx";
import { CoinCard } from "../CoinCard.jsx";

export default function WatchlistPage() {
  const { coins, status } = useMarketData();

  return (
    <div>
      <PageHeader title="Watchlist" subtitle="Live market prices and 7-day trend, refreshed every 45 seconds." />

      {status === "error" && <EmptyState>Couldn't load live prices right now. Try again shortly.</EmptyState>}

      {status === "loading" && !coins && <EmptyState>Loading live prices…</EmptyState>}

      {coins && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
          {coins.map((c) => (
            <CoinCard key={c.id} coin={c} />
          ))}
        </div>
      )}
    </div>
  );
}
