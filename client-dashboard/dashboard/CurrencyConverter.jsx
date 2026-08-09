import React, { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { useMarketData } from "./AccountContext.jsx";
import { COLORS, Card } from "./shared.jsx";

const CONVERT_COINS = ["bitcoin", "ethereum", "solana", "tether"];

export default function CurrencyConverter() {
  const { coins, status } = useMarketData(CONVERT_COINS);
  const [amount, setAmount] = useState("1000");
  const [coinId, setCoinId] = useState("bitcoin");

  const coin = coins?.find((c) => c.id === coinId);
  const amountNum = Number(amount) || 0;
  const converted = coin ? amountNum / coin.current_price : null;

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <ArrowLeftRight size={16} color={COLORS.gain} />
        <span style={{ fontSize: 15, fontWeight: 700 }}>Currency converter</span>
      </div>

      {status === "loading" && !coins ? (
        <div style={{ fontSize: 13, color: COLORS.boneDim }}>Loading live rates…</div>
      ) : (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 140px" }}>
              <label style={{ display: "block", fontSize: 11, color: COLORS.boneDim, marginBottom: 5 }}>Amount (USD)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{
                  width: "100%",
                  background: COLORS.page,
                  border: `1px solid ${COLORS.panelBorder}`,
                  borderRadius: 8,
                  padding: "10px 12px",
                  fontSize: 14,
                  color: COLORS.bone,
                }}
              />
            </div>
            <div style={{ flex: "1 1 140px" }}>
              <label style={{ display: "block", fontSize: 11, color: COLORS.boneDim, marginBottom: 5 }}>Convert to</label>
              <select
                value={coinId}
                onChange={(e) => setCoinId(e.target.value)}
                style={{
                  width: "100%",
                  background: COLORS.page,
                  border: `1px solid ${COLORS.panelBorder}`,
                  borderRadius: 8,
                  padding: "10px 12px",
                  fontSize: 14,
                  color: COLORS.bone,
                }}
              >
                {(coins || CONVERT_COINS.map((id) => ({ id, symbol: id }))).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.symbol?.toUpperCase() || c.id}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
            style={{
              background: COLORS.page,
              border: `1px solid ${COLORS.panelBorder}`,
              borderRadius: 10,
              padding: "14px 16px",
              textAlign: "center",
            }}
          >
            <div className="mono" style={{ fontSize: 24, fontWeight: 800 }}>
              {converted != null ? converted.toLocaleString("en-US", { maximumFractionDigits: 6 }) : "—"}
            </div>
            <div style={{ fontSize: 12, color: COLORS.boneDim, marginTop: 2 }}>{coin?.symbol?.toUpperCase() || ""}</div>
          </div>
          {coin && (
            <div style={{ fontSize: 11, color: COLORS.boneDim, marginTop: 8, textAlign: "center" }} className="mono">
              1 {coin.symbol.toUpperCase()} = {coin.current_price.toLocaleString("en-US", { style: "currency", currency: "USD" })}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
