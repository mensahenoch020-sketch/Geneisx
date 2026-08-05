import React from "react";
import { TrendingUp, TrendingDown, Clock } from "lucide-react";
import { COLORS, Badge } from "./shared.jsx";

// Per-coin accent so cards read as distinct/colorful instead of every card
// being the same green-on-black panel — colors approximate each coin's real
// brand color (BTC orange, ETH blue-violet, SOL green/purple, etc).
const COIN_ACCENTS = {
  bitcoin: "#F7931A",
  ethereum: "#8C8CFF",
  solana: "#9945FF",
  tether: "#26A17B",
  litecoin: "#B0B4C0",
  ripple: "#3AA1E0",
  cardano: "#3468D1",
  dogecoin: "#C2A633",
  polkadot: "#E6007A",
  chainlink: "#2A5ADA",
};

function accentFor(id) {
  return COIN_ACCENTS[id] || COLORS.gain;
}

// Draws a real line from the coin's actual 7-day sparkline price array — no
// synthetic/randomized data, just a lightweight SVG polyline over the real
// numbers CoinGecko returns.
export function Sparkline({ prices, color, width = 120, height = 40 }) {
  if (!prices || prices.length < 2) {
    return <div style={{ width, height }} />;
  }
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const step = width / (prices.length - 1);
  const points = prices.map((p, i) => `${(i * step).toFixed(1)},${(height - ((p - min) / range) * height).toFixed(1)}`);
  const areaPoints = `0,${height} ${points.join(" ")} ${width},${height}`;
  const gradId = `spark-${color.replace("#", "")}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height, display: "block" }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#${gradId})`} />
      <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function CoinLogo({ coin, size = 34 }) {
  const accent = accentFor(coin.id);
  if (coin.image) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          overflow: "hidden",
          flexShrink: 0,
          background: `${accent}1a`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img src={coin.image} alt={coin.symbol} width={size - 8} height={size - 8} style={{ borderRadius: "50%" }} />
      </div>
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `${accent}1a`,
        color: accent,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: size * 0.4,
        flexShrink: 0,
      }}
      className="mono"
    >
      {coin.symbol?.slice(0, 1).toUpperCase()}
    </div>
  );
}

// Full card version — logo, real price, real 24h %, real sparkline. Used on
// the Dashboard's "Live Crypto Updates" row and the Watchlist grid. Pass
// `stale` when this card is showing the last-known prices because the most
// recent poll failed — keeps the numbers visible instead of hiding them
// behind an error, with a small badge so it's clear they may be a bit old.
export function CoinCard({ coin, stale }) {
  const accent = accentFor(coin.id);
  const up = (coin.price_change_percentage_24h ?? 0) >= 0;
  const sparkline = coin.sparkline_in_7d?.price;

  return (
    <div
      style={{
        background: `linear-gradient(160deg, ${accent}10, ${COLORS.panel})`,
        border: `1px solid ${accent}40`,
        borderRadius: 16,
        padding: 20,
        minWidth: 220,
        flex: "1 1 220px",
        boxShadow: "0 1px 2px rgba(18,24,21,0.04), 0 8px 20px rgba(18,24,21,0.05)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <CoinLogo coin={coin} />
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 700 }}>{coin.symbol?.toUpperCase()}/USDT</div>
            <div style={{ fontSize: 12, color: COLORS.boneDim }}>{coin.name}</div>
          </div>
        </div>
        {stale && (
          <Badge tone="signal">
            <Clock size={10} /> Delayed
          </Badge>
        )}
      </div>

      <div className="mono" style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, marginBottom: 6 }}>
        {coin.current_price?.toLocaleString("en-US", { style: "currency", currency: "USD" })}
      </div>
      <div
        className="mono"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 12.5,
          fontWeight: 600,
          color: up ? COLORS.gain : COLORS.loss,
          background: up ? COLORS.gainBg : COLORS.lossBg,
          borderRadius: 7,
          padding: "3px 9px",
          marginBottom: 12,
        }}
      >
        {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
        {up ? "+" : ""}
        {coin.price_change_percentage_24h?.toFixed(2)}%
      </div>

      <Sparkline prices={sparkline} color={accent} />
    </div>
  );
}

// Compact row version — used in list-style contexts (Watchlist table rows).
export function CoinRow({ coin }) {
  const accent = accentFor(coin.id);
  const up = (coin.price_change_percentage_24h ?? 0) >= 0;
  const sparkline = coin.sparkline_in_7d?.price;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        background: COLORS.panel,
        border: `1px solid ${COLORS.panelBorder}`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: 10,
        padding: "12px 16px",
      }}
    >
      <CoinLogo coin={coin} size={30} />
      <div style={{ minWidth: 90 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{coin.symbol?.toUpperCase()}/USDT</div>
        <div style={{ fontSize: 11, color: COLORS.boneDim }}>{coin.name}</div>
      </div>
      <div style={{ flex: 1, minWidth: 80, maxWidth: 160, display: "none" }} className="coin-row-spark">
        <Sparkline prices={sparkline} color={accent} height={32} />
      </div>
      <div style={{ marginLeft: "auto", textAlign: "right" }}>
        <div className="mono" style={{ fontSize: 14, fontWeight: 600 }}>
          {coin.current_price?.toLocaleString("en-US", { style: "currency", currency: "USD" })}
        </div>
        <div
          className="mono"
          style={{ display: "flex", alignItems: "center", gap: 3, justifyContent: "flex-end", fontSize: 11.5, color: up ? COLORS.gain : COLORS.loss }}
        >
          {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {up ? "+" : ""}
          {coin.price_change_percentage_24h?.toFixed(2)}%
        </div>
      </div>
    </div>
  );
}
