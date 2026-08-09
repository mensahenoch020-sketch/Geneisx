import React from "react";
import { TrendingUp, TrendingDown, Flame } from "lucide-react";
import { useMarketData } from "./AccountContext.jsx";
import { COLORS, Card } from "./shared.jsx";
import { CoinLogo } from "./CoinCard.jsx";

const MOVER_COINS = ["bitcoin", "ethereum", "solana", "ripple", "cardano", "litecoin", "dogecoin", "polkadot", "chainlink", "tron"];

export default function TopMovers() {
  const { coins, status } = useMarketData(MOVER_COINS);

  if (status === "error") return null;
  if (!coins) {
    return (
      <Card>
        <div style={{ fontSize: 13, color: COLORS.boneDim }}>Loading top movers…</div>
      </Card>
    );
  }

  const sorted = [...coins].sort(
    (a, b) => Math.abs(b.price_change_percentage_24h ?? 0) - Math.abs(a.price_change_percentage_24h ?? 0)
  );
  const top = sorted.slice(0, 5);

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Flame size={16} color="#B8790F" />
        <span style={{ fontSize: 15, fontWeight: 700 }}>Top movers (24h)</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {top.map((c) => {
          const up = (c.price_change_percentage_24h ?? 0) >= 0;
          return (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <CoinLogo coin={c} size={26} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{c.symbol.toUpperCase()}</div>
              </div>
              <div className="mono" style={{ fontSize: 12.5, color: COLORS.boneDim }}>
                {c.current_price.toLocaleString("en-US", { style: "currency", currency: "USD" })}
              </div>
              <div
                className="mono"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: up ? COLORS.gain : COLORS.loss,
                  minWidth: 62,
                  justifyContent: "flex-end",
                }}
              >
                {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {up ? "+" : ""}
                {c.price_change_percentage_24h?.toFixed(1)}%
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
