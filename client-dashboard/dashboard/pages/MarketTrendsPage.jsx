import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useLivePrice } from "../AccountContext.jsx";
import { COLORS, PageHeader, Card } from "../shared.jsx";

function TrendRow({ label, symbol }) {
  const { price, change, status } = useLivePrice(symbol);
  const up = change != null && change >= 0;
  return (
    <Card style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
      <div style={{ textAlign: "right" }}>
        <div className="mono" style={{ fontSize: 16, fontWeight: 700 }}>
          {status === "loading" ? "…" : status === "error" ? "—" : price.toLocaleString("en-US", { style: "currency", currency: "USD" })}
        </div>
        {status === "live" && change != null && (
          <div
            className="mono"
            style={{ display: "flex", alignItems: "center", gap: 3, justifyContent: "flex-end", fontSize: 12, color: up ? COLORS.gain : COLORS.loss }}
          >
            {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {up ? "+" : ""}
            {change.toFixed(2)}% (24h)
          </div>
        )}
      </div>
    </Card>
  );
}

export default function MarketTrendsPage() {
  return (
    <div>
      <PageHeader title="Market Trends" subtitle="24-hour price movement for major assets." />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <TrendRow label="Bitcoin (BTC)" symbol="bitcoin" />
        <TrendRow label="Ethereum (ETH)" symbol="ethereum" />
        <TrendRow label="Solana (SOL)" symbol="solana" />
      </div>
    </div>
  );
}
