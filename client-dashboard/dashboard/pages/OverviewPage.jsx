import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, TrendingDown, ShieldCheck, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { useAccount, useLivePrice, useMarketData, balance, totalDeposited, totalWithdrawn, totalPnL, pnlSince, tradePnL } from "../AccountContext.jsx";
import { COLORS, fmtUSD, PageHeader, SummaryCard, EmptyState, LoadingPage, ErrorPage } from "../shared.jsx";
import { buildEquityCurve, EquityChart, PriceTicker } from "../EquityChart.jsx";
import { CoinCard } from "../CoinCard.jsx";
import SubscriptionCard from "../SubscriptionCard.jsx";

const RANGES = [
  { key: "7d", label: "1W", days: 7 },
  { key: "30d", label: "1M", days: 30 },
  { key: "90d", label: "3M", days: 90 },
  { key: "180d", label: "6M", days: 180 },
  { key: "365d", label: "1Y", days: 365 },
];

export default function OverviewPage() {
  const { client, loadError } = useAccount();
  const { price: btcPrice, change: btcChange, status: priceStatus } = useLivePrice("bitcoin");
  const { coins: marketCoins, status: marketStatus } = useMarketData(["bitcoin", "ethereum", "solana"]);
  const [range, setRange] = useState("30d");

  const rangeDays = RANGES.find((r) => r.key === range).days;
  const chartData = useMemo(() => (client ? buildEquityCurve(client, rangeDays) : []), [client, rangeDays]);

  if (loadError) return <ErrorPage message={loadError} />;
  if (!client) return <LoadingPage />;

  const bal = balance(client);
  const deposited = totalDeposited(client);
  const withdrawn = totalWithdrawn(client);
  const pnl = totalPnL(client);
  const rangePnl = pnlSince(client, rangeDays);
  const rangePnlPct = deposited ? (rangePnl / deposited) * 100 : 0;
  const isNewAccount = client.deposits.length === 0 && client.trades.length === 0;

  const recentTrades = [...client.trades]
    .filter((t) => new Date(t.date).getTime() >= Date.now() - rangeDays * 86400000)
    .reverse()
    .slice(0, 6);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <PageHeader title="Dashboard" subtitle={`Welcome back${client.name ? `, ${client.name.split(" ")[0]}` : ""}.`} />
        <PriceTicker price={btcPrice} change={btcChange} status={priceStatus} />
      </div>

      <div style={{ fontSize: 11, color: COLORS.boneDim, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 }}>
        Live crypto updates
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 28 }}>
        {marketStatus === "error" && <EmptyState>Couldn't load live prices right now.</EmptyState>}
        {marketCoins && marketCoins.map((c) => <CoinCard key={c.id} coin={c} />)}
      </div>

      <div style={{ marginBottom: 28 }}>
        <SubscriptionCard />
      </div>

      {isNewAccount && (
        <div
          style={{
            background: "rgba(63,226,142,0.06)",
            border: `1px solid rgba(63,226,142,0.25)`,
            borderRadius: 12,
            padding: 18,
            marginBottom: 28,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Welcome — one step to get started</div>
          <div style={{ fontSize: 13, color: COLORS.boneDim, lineHeight: 1.6, marginBottom: 12 }}>
            Your account is ready, but there's nothing in it yet. Head to Wallet for your deposit address, then let
            us know so we can match it to your account.
          </div>
          <Link
            to="/dashboard/wallet"
            style={{ display: "inline-block", background: COLORS.gain, color: COLORS.ink, fontWeight: 600, fontSize: 13, padding: "9px 16px", borderRadius: 8 }}
          >
            Go to Wallet
          </Link>
        </div>
      )}

      {!isNewAccount && (
        <>
          <div style={{ textAlign: "center", padding: "12px 0 8px" }}>
            <div style={{ fontSize: 12, color: COLORS.boneDim, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>
              Account balance
            </div>
            <div className="mono" style={{ fontSize: 42, fontWeight: 700, letterSpacing: -1 }}>
              {fmtUSD(bal)}
            </div>
            <div
              className="mono"
              style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 10, fontSize: 13.5, color: pnl >= 0 ? COLORS.gain : COLORS.loss }}
            >
              {pnl >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {pnl >= 0 ? "+" : ""}
              {fmtUSD(pnl)} all-time P&amp;L
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "center", gap: 4, marginTop: 24, marginBottom: 18, flexWrap: "wrap" }}>
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

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: COLORS.boneDim, textTransform: "uppercase", letterSpacing: 0.5 }}>
                {RANGES.find((r) => r.key === range).label} P&amp;L
              </div>
              <div className="mono" style={{ fontSize: 18, fontWeight: 600, color: rangePnl >= 0 ? COLORS.gain : COLORS.loss }}>
                {rangePnl >= 0 ? "+" : ""}
                {fmtUSD(rangePnl)}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: COLORS.boneDim, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Return on deposits
              </div>
              <div className="mono" style={{ fontSize: 18, fontWeight: 600, color: rangePnl >= 0 ? COLORS.gain : COLORS.loss }}>
                {rangePnl >= 0 ? "+" : ""}
                {rangePnlPct.toFixed(2)}%
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              background: "rgba(255,255,255,0.03)",
              border: `1px solid ${COLORS.panelBorder}`,
              borderRadius: 10,
              padding: 14,
              marginBottom: 28,
              fontSize: 12,
              color: COLORS.boneDim,
              lineHeight: 1.6,
            }}
          >
            <ShieldCheck size={15} color={COLORS.boneDim} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              This reflects actual trade performance on your account, not a projected or guaranteed rate. Past
              results don't predict future performance — your balance can go down as well as up.
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 28 }}>
            <SummaryCard label="Total deposited" value={fmtUSD(deposited)} icon={ArrowDownToLine} accent="#4C9BE8" />
            <SummaryCard label="Total withdrawn" value={fmtUSD(withdrawn)} icon={ArrowUpFromLine} accent="#E8B84C" />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: COLORS.boneDim, textTransform: "uppercase", letterSpacing: 0.6 }}>
              Recent activity
            </div>
            <Link to="/dashboard/transactions" style={{ fontSize: 12.5, color: COLORS.gain }}>
              View all
            </Link>
          </div>
          {recentTrades.length === 0 ? (
            <EmptyState>No closed trades in this period.</EmptyState>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {recentTrades.map((t) => {
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
                          background: p >= 0 ? "rgba(63,226,142,0.12)" : "rgba(232,96,76,0.12)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {p >= 0 ? <TrendingUp size={13} color={COLORS.gain} /> : <TrendingDown size={13} color={COLORS.loss} />}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>
                          {t.asset} · {t.side}
                        </div>
                        <div style={{ fontSize: 11, color: COLORS.boneDim }}>{new Date(t.date).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className="mono" style={{ fontSize: 13.5, color: p >= 0 ? COLORS.gain : COLORS.loss }}>
                      {p >= 0 ? "+" : ""}
                      {fmtUSD(p)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
