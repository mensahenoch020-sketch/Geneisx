import React, { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useMarketData } from "./AccountContext.jsx";
import { COLORS } from "./shared.jsx";
import { Sparkline } from "./CoinCard.jsx";

const SLIDE_COINS = ["bitcoin", "ethereum", "solana", "ripple", "cardano", "litecoin"];
const ACCENTS = {
  bitcoin: "#F7931A",
  ethereum: "#8C8CFF",
  solana: "#9945FF",
  ripple: "#3AA1E0",
  cardano: "#3468D1",
  litecoin: "#B0B4C0",
};

// A rotating, colorful "hero" slideshow — big coin logo, live price, 7-day
// trend line — instead of a static row of small cards. Every number and
// image comes from the same CoinGecko market data already used elsewhere on
// the dashboard (useMarketData), so it stays real and live rather than
// decorative stock imagery.
export default function CryptoCarousel() {
  const { coins, status } = useMarketData(SLIDE_COINS);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!coins || coins.length === 0) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % coins.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [coins]);

  if (status === "error" || !coins || coins.length === 0) return null;

  const safeIndex = index % coins.length;
  const coin = coins[safeIndex];
  const accent = ACCENTS[coin.id] || COLORS.gain;
  const up = (coin.price_change_percentage_24h ?? 0) >= 0;

  return (
    <div
      style={{
        position: "relative",
        background: `linear-gradient(135deg, ${accent}14, ${COLORS.panel} 60%)`,
        border: `1px solid ${accent}33`,
        borderRadius: 16,
        padding: "22px 24px",
        marginBottom: 28,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          {coin.image && (
            <img
              src={coin.image}
              alt={coin.name}
              width={52}
              height={52}
              style={{ borderRadius: "50%", flexShrink: 0, background: `${accent}1a`, padding: 6 }}
            />
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, color: COLORS.boneDim, fontWeight: 600 }}>
              {coin.name} · {coin.symbol?.toUpperCase()}
            </div>
            <div className="mono" style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>
              {coin.current_price?.toLocaleString("en-US", { style: "currency", currency: "USD" })}
            </div>
            <div
              className="mono"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 12.5,
                fontWeight: 700,
                color: up ? COLORS.gain : COLORS.loss,
                marginTop: 2,
              }}
            >
              {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {up ? "+" : ""}
              {coin.price_change_percentage_24h?.toFixed(2)}% (24h)
            </div>
          </div>
        </div>

        <div style={{ width: 160, flexShrink: 0 }}>
          <Sparkline prices={coin.sparkline_in_7d?.price} color={accent} width={160} height={56} />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16 }}>
        <button
          onClick={() => setIndex((i) => (i - 1 + coins.length) % coins.length)}
          aria-label="Previous"
          style={{ background: "transparent", border: "none", color: COLORS.boneDim, padding: 4, display: "flex" }}
        >
          <ChevronLeft size={16} />
        </button>
        {coins.map((c, i) => (
          <button
            key={c.id}
            onClick={() => setIndex(i)}
            aria-label={`Show ${c.name}`}
            style={{
              width: i === safeIndex ? 18 : 6,
              height: 6,
              borderRadius: 3,
              background: i === safeIndex ? accent : COLORS.panelBorder,
              border: "none",
              transition: "all 0.2s ease",
              padding: 0,
            }}
          />
        ))}
        <button
          onClick={() => setIndex((i) => (i + 1) % coins.length)}
          aria-label="Next"
          style={{ background: "transparent", border: "none", color: COLORS.boneDim, padding: 4, display: "flex" }}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
