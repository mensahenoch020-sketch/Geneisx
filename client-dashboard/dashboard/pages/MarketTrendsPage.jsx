import React from "react";
import { useMarketData } from "../AccountContext.jsx";
import { PageHeader, EmptyState } from "../shared.jsx";
import { CoinCard } from "../CoinCard.jsx";

export default function MarketTrendsPage() {
  const { coins, status } = useMarketData(["bitcoin", "ethereum", "solana", "ripple", "litecoin", "cardano"]);

  return (
    <div>
      <PageHeader title="Market Trends" subtitle="7-day price movement across major assets, live from the market." />

      {status === "error" && <EmptyState>Couldn't load live prices right now.</EmptyState>}
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
