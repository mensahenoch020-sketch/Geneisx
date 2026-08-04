import React, { useMemo, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useAccount, balance, totalDeposited, totalPnL, tradePnL } from "../AccountContext.jsx";
import { COLORS, fmtUSD, PageHeader, SummaryCard, EmptyState, LoadingPage, ErrorPage } from "../shared.jsx";
import { buildEquityCurve, EquityChart } from "../EquityChart.jsx";

const RANGES = [
  { key: "30d", label: "1M", days: 30 },
  { key: "90d", label: "3M", days: 90 },
  { key: "180d", label: "6M", days: 180 },
  { key: "365d", label: "1Y", days: 365 },
  { key: "3650d", label: "All", days: 3650 },
];

export default function PortfolioPage() {
  const { client, loadError } = useAccount();
  const [range, setRange] = useState("3650d");

  const rangeDays = RANGES.find((r) => r.key === range).days;
  const chartData = useMemo(() => (client ? buildEquityCurve(client, rangeDays) : []), [client, rangeDays]);

  if (loadError) return <ErrorPage message={loadError} />;
  if (!client) return <LoadingPage />;

  const bal = balance(client);
  const deposited = totalDeposited(client);
  const pnl = totalPnL(client);
  const pnlPct = deposited ? (pnl / deposited) * 100 : 0;

  const wins = client.trades.filter((t) => tradePnL(t) >= 0).length;
  const winRate = client.trades.length ? (wins / client.trades.length) * 100 : 0;

  const byAsset = {};
  for (const t of client.trades) {
    byAsset[t.asset] = byAsset[t.asset] || { asset: t.asset, count: 0, pnl: 0 };
    byAsset[t.asset].count += 1;
    byAsset[t.asset].pnl += tradePnL(t);
  }
  const assetRows = Object.values(byAsset).sort((a, b) => b.pnl - a.pnl);

  const allTrades = [...client.trades].reverse();

  return (
    <div>
      <PageHeader title="Portfolio" subtitle="Full performance breakdown across your trading history." />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 24 }}>
        <SummaryCard label="Balance" value={fmtUSD(bal)} />
        <SummaryCard label="All-time P&L" value={`${pnl >= 0 ? "+" : ""}${fmtUSD(pnl)}`} accent={pnl >= 0 ? COLORS.gain : COLORS.loss} />
        <SummaryCard label="Return" value={`${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%`} accent={pnlPct >= 0 ? COLORS.gain : COLORS.loss} />
        <SummaryCard label="Win rate" value={`${winRate.toFixed(0)}%`} />
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 14, flexWrap: "wrap" }}>
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            style={{
              background: range === r.key ? COLORS.panel : "transparent",
              border: `1px solid ${range === r.key ? COLORS.panelBorder : "transparent"}`,
              color: range === r.key ? COLORS.bone : COLORS.boneDim,
              borderRadius: 7,
              padding: "6px 14px",
              fontSize: 12.5,
              fontWeight: 500,
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      <EquityChart data={chartData} />

      {assetRows.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: COLORS.boneDim, textTransform: "uppercase", letterSpacing: 0.6, margin: "28px 0 12px" }}>
            By asset
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 28 }}>
            {assetRows.map((a) => (
              <div
                key={a.asset}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: COLORS.panel,
                  border: `1px solid ${COLORS.panelBorder}`,
                  borderRadius: 8,
                  padding: "10px 14px",
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{a.asset}</div>
                  <div style={{ fontSize: 11, color: COLORS.boneDim }}>{a.count} closed trade{a.count > 1 ? "s" : ""}</div>
                </div>
                <div className="mono" style={{ fontSize: 13.5, color: a.pnl >= 0 ? COLORS.gain : COLORS.loss }}>
                  {a.pnl >= 0 ? "+" : ""}
                  {fmtUSD(a.pnl)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ fontSize: 11, color: COLORS.boneDim, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 }}>
        All closed trades
      </div>
      {allTrades.length === 0 ? (
        <EmptyState>No closed trades yet.</EmptyState>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {allTrades.map((t) => {
            const p = tradePnL(t);
            return (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: COLORS.panel,
                  border: `1px solid ${COLORS.panelBorder}`,
                  borderRadius: 8,
                  padding: "10px 14px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 6,
                      background: p >= 0 ? "rgba(63,220,142,0.12)" : "rgba(232,96,76,0.12)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {p >= 0 ? <TrendingUp size={13} color={COLORS.gain} /> : <TrendingDown size={13} color={COLORS.loss} />}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>
                      {t.asset} · {t.side} · {t.size}
                    </div>
                    <div style={{ fontSize: 11, color: COLORS.boneDim }}>
                      {new Date(t.date).toLocaleDateString()} · entry {fmtUSD(t.entry)} → exit {fmtUSD(t.exit)}
                    </div>
                  </div>
                </div>
                <div className="mono" style={{ fontSize: 13.5, color: p >= 0 ? COLORS.gain : COLORS.loss, flexShrink: 0 }}>
                  {p >= 0 ? "+" : ""}
                  {fmtUSD(p)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
