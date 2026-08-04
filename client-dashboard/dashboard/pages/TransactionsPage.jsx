import React, { useMemo, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Repeat2 } from "lucide-react";
import { useAccount, tradePnL } from "../AccountContext.jsx";
import { COLORS, fmtUSD, PageHeader, EmptyState, LoadingPage, ErrorPage } from "../shared.jsx";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "deposit", label: "Deposits" },
  { key: "withdrawal", label: "Withdrawals" },
  { key: "trade", label: "Trades" },
];

export default function TransactionsPage() {
  const { client, loadError } = useAccount();
  const [filter, setFilter] = useState("all");

  if (loadError) return <ErrorPage message={loadError} />;
  if (!client) return <LoadingPage />;

  const rows = useMemo(() => {
    const all = [
      ...client.deposits.map((d) => ({ type: "deposit", id: `d-${d.id}`, date: d.date, amount: d.amount })),
      ...client.withdrawals.map((w) => ({
        type: "withdrawal",
        id: `w-${w.id}`,
        date: w.date,
        amount: w.amount,
        status: w.status,
        destination: w.destination,
      })),
      ...client.trades.map((t) => ({
        type: "trade",
        id: `t-${t.id}`,
        date: t.date,
        amount: tradePnL(t),
        asset: t.asset,
        side: t.side,
      })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));
    return filter === "all" ? all : all.filter((r) => r.type === filter);
  }, [client, filter]);

  return (
    <div>
      <PageHeader title="Transactions" subtitle="Every deposit, withdrawal, and closed trade on your account." />

      <div style={{ display: "flex", gap: 4, marginBottom: 18, flexWrap: "wrap" }}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              background: filter === f.key ? COLORS.panel : "transparent",
              border: `1px solid ${filter === f.key ? COLORS.panelBorder : "transparent"}`,
              color: filter === f.key ? COLORS.bone : COLORS.boneDim,
              borderRadius: 7,
              padding: "6px 14px",
              fontSize: 12.5,
              fontWeight: 500,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState>Nothing here yet.</EmptyState>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {rows.map((r) => {
            const positive = r.type === "deposit" || (r.type === "trade" && r.amount >= 0);
            const Icon = r.type === "deposit" ? ArrowDownToLine : r.type === "withdrawal" ? ArrowUpFromLine : Repeat2;
            return (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: COLORS.panel,
                  border: `1px solid ${COLORS.panelBorder}`,
                  borderRadius: 8,
                  padding: "10px 14px",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 6,
                      flexShrink: 0,
                      background: positive ? "rgba(63,226,142,0.12)" : "rgba(232,96,76,0.12)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon size={13} color={positive ? COLORS.gain : COLORS.loss} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, textTransform: "capitalize" }}>
                      {r.type === "trade" ? `${r.asset} · ${r.side}` : r.type}
                      {r.type === "withdrawal" && (
                        <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, color: COLORS.boneDim, textTransform: "capitalize" }}>
                          {r.status}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: COLORS.boneDim }}>{new Date(r.date).toLocaleString()}</div>
                  </div>
                </div>
                <div className="mono" style={{ fontSize: 13.5, color: positive ? COLORS.gain : COLORS.loss, flexShrink: 0 }}>
                  {positive ? "+" : r.type === "withdrawal" ? "-" : ""}
                  {fmtUSD(Math.abs(r.amount))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
