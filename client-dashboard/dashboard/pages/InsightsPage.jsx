import React from "react";
import { CalendarClock, TrendingUp, TrendingDown } from "lucide-react";
import { useAccount, totalPnL, pnlSince, tradePnL } from "../AccountContext.jsx";
import { COLORS, fmtUSD, PageHeader, Card, SummaryCard, EmptyState, LoadingPage, ErrorPage } from "../shared.jsx";

export default function InsightsPage() {
  const { client, loadError } = useAccount();

  if (loadError) return <ErrorPage message={loadError} />;
  if (!client) return <LoadingPage />;

  const trades = client.trades;
  const pnl30 = pnlSince(client, 30);
  const wins = trades.filter((t) => tradePnL(t) >= 0);
  const losses = trades.filter((t) => tradePnL(t) < 0);
  const avgWin = wins.length ? wins.reduce((s, t) => s + tradePnL(t), 0) / wins.length : 0;
  const avgLoss = losses.length ? losses.reduce((s, t) => s + tradePnL(t), 0) / losses.length : 0;
  const best = trades.length ? trades.reduce((a, b) => (tradePnL(a) > tradePnL(b) ? a : b)) : null;

  return (
    <div>
      <PageHeader title="Insights" subtitle="Patterns from your closed trade history." />

      {trades.length === 0 ? (
        <EmptyState>No closed trades yet — insights will appear once you have trading history.</EmptyState>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 24 }}>
            <SummaryCard label="30-day P&L" value={`${pnl30 >= 0 ? "+" : ""}${fmtUSD(pnl30)}`} icon={CalendarClock} accent={pnl30 >= 0 ? COLORS.gain : COLORS.loss} />
            <SummaryCard label="Avg win" value={fmtUSD(avgWin)} icon={TrendingUp} accent={COLORS.gain} />
            <SummaryCard label="Avg loss" value={fmtUSD(avgLoss)} icon={TrendingDown} accent={COLORS.loss} />
          </div>
          {best && (
            <Card>
              <div style={{ fontSize: 11, color: COLORS.boneDim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                Best trade
              </div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>
                {best.asset} · {best.side}
              </div>
              <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: COLORS.gain, marginTop: 4 }}>
                +{fmtUSD(tradePnL(best))}
              </div>
              <div style={{ fontSize: 12, color: COLORS.boneDim, marginTop: 6 }}>
                {new Date(best.date).toLocaleDateString()}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
