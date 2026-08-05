import React from "react";
import { Activity } from "lucide-react";
import { COLORS, fmtUSD } from "./shared.jsx";
import { tradePnL } from "./AccountContext.jsx";

export function buildEquityCurve(client, days) {
  const now = Date.now();
  const start = now - days * 86400000;
  const events = [
    ...client.deposits.map((d) => ({ date: d.date, delta: d.amount })),
    ...client.withdrawals.filter((w) => w.status === "processed").map((w) => ({ date: w.date, delta: -w.amount })),
    ...client.trades.map((t) => ({ date: t.date, delta: tradePnL(t) })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date));

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

export function EquityChart({ data }) {
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
    return { x, y };
  });
  const pointsStr = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const last = points[points.length - 1];

  const isUp = values[values.length - 1] >= values[0];
  const lineColor = isUp ? COLORS.gain : COLORS.loss;
  const areaPoints = `${padding},${height - padding} ${pointsStr} ${width - padding},${height - padding}`;

  // Faint horizontal gridlines at 25/50/75% — purely visual scaffolding
  // (not derived data), same as the reference screenshot's chart grid.
  const gridLines = [0.25, 0.5, 0.75].map((f) => padding + f * (height - padding * 2));

  return (
    <div style={{ border: `1px solid ${COLORS.panelBorder}`, borderRadius: 14, background: COLORS.panel, padding: "20px 10px 12px", boxShadow: "0 1px 2px rgba(18,24,21,0.04), 0 8px 24px rgba(18,24,21,0.05)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "0 14px 12px", fontSize: 12.5, color: COLORS.boneDim, fontWeight: 500 }}>
        <span>{fmtUSD(max, { maximumFractionDigits: 0 })}</span>
        <span>{fmtUSD(min, { maximumFractionDigits: 0 })}</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }}>
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridLines.map((y, i) => (
          <line key={i} x1={padding} x2={width - padding} y1={y} y2={y} stroke={COLORS.panelBorder} strokeWidth="1" />
        ))}
        <polygon points={areaPoints} fill="url(#areaFill)" />
        <polyline points={pointsStr} fill="none" stroke={lineColor} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
        {last && (
          <>
            <circle cx={last.x} cy={last.y} r="5" fill={COLORS.ink} stroke={lineColor} strokeWidth="2.5" />
            <circle cx={last.x} cy={last.y} r="2" fill={lineColor} />
          </>
        )}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px 0", fontSize: 10.5, color: COLORS.boneDim }}>
        <span>{new Date(tMin).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
        <span>{new Date(tMax).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
      </div>
    </div>
  );
}

export function PriceTicker({ price, change, status }) {
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
