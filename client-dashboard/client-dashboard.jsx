import React, { useState, useEffect, useMemo } from "react";
import { TrendingUp, TrendingDown, Activity, ArrowDown, ArrowUp, Clock, ShieldCheck } from "lucide-react";

// Same palette as the admin tool, for visual consistency across the product.
const COLORS = {
  ink: "#0E1114",
  panel: "#161A1F",
  panelBorder: "#262B32",
  bone: "#E8E4DA",
  boneDim: "#9A9689",
  gain: "#3DDC97",
  loss: "#E8604C",
  signal: "#F2B84B",
};

function useLivePrice(symbol = "bitcoin") {
  const [price, setPrice] = useState(null);
  const [change, setChange] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let mounted = true;
    async function fetchPrice() {
      try {
        const res = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${symbol}&vs_currencies=usd&include_24hr_change=true`
        );
        if (!res.ok) throw new Error("bad response");
        const data = await res.json();
        if (mounted && data[symbol]) {
          setPrice(data[symbol].usd);
          setChange(data[symbol].usd_24h_change);
          setStatus("live");
        }
      } catch (e) {
        if (mounted) setStatus("error");
      }
    }
    fetchPrice();
    const interval = setInterval(fetchPrice, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [symbol]);

  return { price, change, status };
}

const fmtUSD = (n, opts = {}) =>
  n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2, ...opts });

// ---------- Demo account data ----------
// This represents what a real backend would serve for a logged-in client.
// It is illustrative only — actual production data would come from the trade ledger.
const demoClient = {
  name: "Client Account",
  deposits: [
    { id: "d1", amount: 25000, date: daysAgo(210) },
    { id: "d2", amount: 10000, date: daysAgo(90) },
  ],
  withdrawals: [{ id: "w1", amount: 4000, status: "processed", date: daysAgo(45) }],
  trades: generateTradeHistory(),
};

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// Generates a plausible-looking history of closed trades over the last year for demo purposes.
function generateTradeHistory() {
  const trades = [];
  let cursor = 220;
  let seed = 42;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  while (cursor > 0) {
    const gap = 3 + Math.floor(rand() * 9);
    cursor -= gap;
    if (cursor < 0) break;
    const size = 0.05 + rand() * 0.3;
    const entry = 60000 + rand() * 40000;
    const side = rand() > 0.4 ? "long" : "short";
    const moveFactor = (rand() - 0.42) * 0.08; // slight positive skew, still can lose
    const exit = side === "long" ? entry * (1 + moveFactor) : entry * (1 - moveFactor);
    trades.push({
      id: `t${cursor}`,
      asset: "BTC",
      side,
      size: parseFloat(size.toFixed(3)),
      entry: parseFloat(entry.toFixed(2)),
      exit: parseFloat(exit.toFixed(2)),
      date: daysAgo(cursor),
    });
  }
  return trades.reverse();
}

function tradePnL(t) {
  const diff = t.side === "long" ? t.exit - t.entry : t.entry - t.exit;
  return diff * t.size;
}

function totalDeposited(client) {
  return client.deposits.reduce((s, d) => s + d.amount, 0);
}
function totalWithdrawn(client) {
  return client.withdrawals.filter((w) => w.status === "processed").reduce((s, w) => s + w.amount, 0);
}
function totalPnL(client) {
  return client.trades.reduce((s, t) => s + tradePnL(t), 0);
}
function balance(client) {
  return totalDeposited(client) - totalWithdrawn(client) + totalPnL(client);
}

// P&L realized within the last N days
function pnlSince(client, days) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return client.trades.filter((t) => new Date(t.date).getTime() >= cutoff).reduce((s, t) => s + tradePnL(t), 0);
}

const RANGES = [
  { key: "7d", label: "1W", days: 7 },
  { key: "30d", label: "1M", days: 30 },
  { key: "90d", label: "3M", days: 90 },
  { key: "180d", label: "6M", days: 180 },
  { key: "365d", label: "1Y", days: 365 },
];

export default function ClientDashboard() {
  const { price: btcPrice, change: btcChange, status: priceStatus } = useLivePrice("bitcoin");
  const [range, setRange] = useState("30d");
  const client = demoClient;

  const bal = balance(client);
  const deposited = totalDeposited(client);
  const withdrawn = totalWithdrawn(client);
  const pnl = totalPnL(client);
  const rangeDays = RANGES.find((r) => r.key === range).days;
  const rangePnl = pnlSince(client, rangeDays);
  const rangePnlPct = deposited ? (rangePnl / deposited) * 100 : 0;

  const chartData = useMemo(() => buildEquityCurve(client, rangeDays), [client, rangeDays]);

  const recentTrades = [...client.trades].filter((t) => new Date(t.date).getTime() >= Date.now() - rangeDays * 86400000).reverse();

  return (
    <div style={{ background: COLORS.ink, minHeight: "100vh", color: COLORS.bone, fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        button { font-family: inherit; cursor: pointer; }
      `}</style>

      {/* Header */}
      <header
        style={{
          borderBottom: `1px solid ${COLORS.panelBorder}`,
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          background: COLORS.ink,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              border: `1.5px solid ${COLORS.gain}`,
              borderRadius: 7,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700,
              color: COLORS.gain,
            }}
            className="mono"
          >
            ₿
          </div>
          <div style={{ fontSize: 14.5, fontWeight: 600 }}>GenesisX</div>
        </div>
        <PriceTicker price={btcPrice} change={btcChange} status={priceStatus} />
      </header>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "28px 18px 60px" }}>
        {/* Balance hero */}
        <div style={{ textAlign: "center", padding: "20px 0 8px" }}>
          <div style={{ fontSize: 12, color: COLORS.boneDim, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>
            Account balance
          </div>
          <div className="mono" style={{ fontSize: 42, fontWeight: 700, letterSpacing: -1 }}>
            {fmtUSD(bal)}
          </div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              marginTop: 10,
              fontSize: 13.5,
              color: pnl >= 0 ? COLORS.gain : COLORS.loss,
            }}
            className="mono"
          >
            {pnl >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {pnl >= 0 ? "+" : ""}
            {fmtUSD(pnl)} all-time P&amp;L
          </div>
        </div>

        {/* Range selector */}
        <div style={{ display: "flex", justifyContent: "center", gap: 4, marginTop: 28, marginBottom: 18 }}>
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

        {/* Chart */}
        <EquityChart data={chartData} />

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, marginBottom: 32 }}>
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
            marginBottom: 32,
            fontSize: 12,
            color: COLORS.boneDim,
            lineHeight: 1.6,
          }}
        >
          <ShieldCheck size={15} color={COLORS.boneDim} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            This reflects actual trade performance on your account, not a projected or guaranteed rate. Past results don't
            predict future performance — your balance can go down as well as up.
          </div>
        </div>

        {/* Account summary */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 32 }}>
          <SummaryCard label="Total deposited" value={fmtUSD(deposited)} />
          <SummaryCard label="Total withdrawn" value={fmtUSD(withdrawn)} />
        </div>

        {/* Recent activity */}
        <div style={{ fontSize: 11, color: COLORS.boneDim, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 }}>
          Activity — {RANGES.find((r) => r.key === range).label}
        </div>
        {recentTrades.length === 0 ? (
          <div style={{ color: COLORS.boneDim, fontSize: 13.5, padding: "16px 0" }}>No closed trades in this period.</div>
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
                        background: p >= 0 ? "rgba(61,220,151,0.12)" : "rgba(232,96,76,0.12)",
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
      </main>
    </div>
  );
}

function PriceTicker({ price, change, status }) {
  const up = change != null && change >= 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Activity size={12} color={status === "live" ? COLORS.gain : COLORS.boneDim} />
      <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>
        {status === "loading" ? "…" : status === "error" ? "—" : fmtUSD(price, { maximumFractionDigits: 0 })}
      </div>
      {status === "live" && change != null && (
        <div className="mono" style={{ fontSize: 11, color: up ? COLORS.gain : COLORS.loss }}>
          {up ? "+" : ""}
          {change.toFixed(1)}%
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`, borderRadius: 10, padding: "14px 16px" }}>
      <div style={{ fontSize: 10.5, color: COLORS.boneDim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
        {label}
      </div>
      <div className="mono" style={{ fontSize: 16, fontWeight: 600 }}>
        {value}
      </div>
    </div>
  );
}

// Builds a running balance curve over the selected range from deposits/withdrawals/trades.
function buildEquityCurve(client, days) {
  const now = Date.now();
  const start = now - days * 86400000;
  const events = [
    ...client.deposits.map((d) => ({ date: d.date, delta: d.amount })),
    ...client.withdrawals.filter((w) => w.status === "processed").map((w) => ({ date: w.date, delta: -w.amount })),
    ...client.trades.map((t) => ({ date: t.date, delta: tradePnL(t) })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date));

  // running balance at `start`
  let runningBalance = 0;
  for (const e of events) {
    if (new Date(e.date).getTime() < start) runningBalance += e.delta;
  }

  const points = [{ t: start, v: runningBalance }];
  for (const e of events) {
    const t = new Date(e.date).getTime();
    if (t >= start) {
      runningBalance += e.delta;
      points.push({ t, v: runningBalance });
    }
  }
  points.push({ t: now, v: runningBalance });
  return points;
}

function EquityChart({ data }) {
  const width = 680;
  const height = 200;
  const padding = 12;

  if (data.length < 2) {
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: COLORS.boneDim,
          fontSize: 13,
          border: `1px solid ${COLORS.panelBorder}`,
          borderRadius: 10,
        }}
      >
        Not enough activity yet to chart this period.
      </div>
    );
  }

  const values = data.map((d) => d.v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const tMin = data[0].t;
  const tMax = data[data.length - 1].t;
  const tRange = tMax - tMin || 1;

  const points = data.map((d) => {
    const x = padding + ((d.t - tMin) / tRange) * (width - padding * 2);
    const y = padding + (1 - (d.v - min) / range) * (height - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const isUp = values[values.length - 1] >= values[0];
  const lineColor = isUp ? COLORS.gain : COLORS.loss;
  const areaPoints = `${padding},${height - padding} ${points.join(" ")} ${width - padding},${height - padding}`;

  return (
    <div style={{ border: `1px solid ${COLORS.panelBorder}`, borderRadius: 10, background: COLORS.panel, padding: "16px 8px" }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }}>
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={areaPoints} fill="url(#areaFill)" />
        <polyline points={points.join(" ")} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </div>
  );
}
