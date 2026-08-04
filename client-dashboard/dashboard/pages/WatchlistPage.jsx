import React, { useEffect, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { COLORS, PageHeader, EmptyState } from "../shared.jsx";

const COINS = [
  { id: "bitcoin", symbol: "BTC" },
  { id: "ethereum", symbol: "ETH" },
  { id: "solana", symbol: "SOL" },
  { id: "tether", symbol: "USDT" },
  { id: "litecoin", symbol: "LTC" },
  { id: "ripple", symbol: "XRP" },
];

function useWatchlist(coins) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const ids = coins.map((c) => c.id).join(",");
        const res = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`
        );
        if (!res.ok) throw new Error("bad response");
        const json = await res.json();
        if (mounted) {
          setData(json);
          setStatus("live");
        }
      } catch {
        if (mounted) setStatus("error");
      }
    }
    load();
    const interval = setInterval(load, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [coins]);

  return { data, status };
}

export default function WatchlistPage() {
  const { data, status } = useWatchlist(COINS);

  return (
    <div>
      <PageHeader title="Watchlist" subtitle="Live market prices, refreshed every 30 seconds." />

      {status === "error" && <EmptyState>Couldn't load live prices right now. Try again shortly.</EmptyState>}

      {status !== "error" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {COINS.map((c) => {
            const row = data?.[c.id];
            const price = row?.usd;
            const change = row?.usd_24h_change;
            const up = change != null && change >= 0;
            return (
              <div
                key={c.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: COLORS.panel,
                  border: `1px solid ${COLORS.panelBorder}`,
                  borderRadius: 8,
                  padding: "12px 16px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: "50%",
                      background: "rgba(63,226,142,0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: COLORS.gain,
                    }}
                    className="mono"
                  >
                    {c.symbol.slice(0, 1)}
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{c.symbol}/USDT</div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="mono" style={{ fontSize: 14, fontWeight: 600 }}>
                    {price == null ? "…" : price.toLocaleString("en-US", { style: "currency", currency: "USD" })}
                  </div>
                  {change != null && (
                    <div
                      className="mono"
                      style={{ display: "flex", alignItems: "center", gap: 3, justifyContent: "flex-end", fontSize: 11.5, color: up ? COLORS.gain : COLORS.loss }}
                    >
                      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                      {up ? "+" : ""}
                      {change.toFixed(2)}%
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
