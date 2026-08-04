import React from "react";
import { useAccount, tradePnL } from "../AccountContext.jsx";
import { COLORS, fmtUSD, PageHeader, EmptyState, LoadingPage, ErrorPage } from "../shared.jsx";

function monthKey(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

export default function AnalyticsPage() {
  const { client, loadError } = useAccount();

  if (loadError) return <ErrorPage message={loadError} />;
  if (!client) return <LoadingPage />;

  const byMonth = {};
  for (const t of client.trades) {
    const k = monthKey(t.date);
    byMonth[k] = (byMonth[k] || 0) + tradePnL(t);
  }
  const months = Object.keys(byMonth).sort();

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <PageHeader title="Analytics" />
        <span
          style={{
            background: "rgba(63,226,142,0.12)",
            color: COLORS.gain,
            fontSize: 11,
            fontWeight: 600,
            padding: "3px 8px",
            borderRadius: 5,
            marginTop: -20,
          }}
        >
          Beta
        </span>
      </div>
      <div style={{ fontSize: 13.5, color: COLORS.boneDim, marginTop: -20, marginBottom: 28 }}>
        Monthly P&amp;L breakdown. This section is early — more views are coming.
      </div>

      {months.length === 0 ? (
        <EmptyState>No trade history yet to analyze.</EmptyState>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {months.map((m) => {
            const v = byMonth[m];
            const label = new Date(`${m}-01T00:00:00`).toLocaleDateString(undefined, { year: "numeric", month: "long" });
            return (
              <div
                key={m}
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
                <div style={{ fontSize: 13 }}>{label}</div>
                <div className="mono" style={{ fontSize: 13.5, color: v >= 0 ? COLORS.gain : COLORS.loss }}>
                  {v >= 0 ? "+" : ""}
                  {fmtUSD(v)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
