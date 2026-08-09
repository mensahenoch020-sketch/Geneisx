import React, { useState } from "react";
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

// Builds a smooth cubic-bezier path through the real data points (Catmull-Rom
// style tangents) instead of straight polyline segments — this is what makes
// the curve look like a real market chart rather than a jagged line, while
// every point plotted is still exactly the same real balance data as before.
function smoothPath(points) {
  if (points.length < 2) return "";
  if (points.length === 2) {
    return `M${points[0].x},${points[0].y} L${points[1].x},${points[1].y}`;
  }
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

export function EquityChart({ data }) {
  const width = 680;
  const height = 220;
  const padding = 12;
  const [hoverIndex, setHoverIndex] = useState(null);

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
    return { x, y, t: d.t, v: d.v };
  });
  const pathD = smoothPath(points);
  const last = points[points.length - 1];
  const active = hoverIndex != null ? points[hoverIndex] : last;

  const isUp = values[values.length - 1] >= values[0];
  const lineColor = isUp ? COLORS.gain : COLORS.loss;
  const areaPoints = `${padding},${height - padding} ${points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} ${width - padding},${height - padding}`;

  // Faint horizontal gridlines at 25/50/75%, plus light vertical time
  // markers — purely visual scaffolding (not derived data), giving the chart
  // a real trading-terminal grid instead of a bare line.
  const hGridLines = [0.25, 0.5, 0.75].map((f) => padding + f * (height - padding * 2));
  const vGridLines = [0.25, 0.5, 0.75].map((f) => padding + f * (width - padding * 2));

  function handleMove(e) {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * width;
    let nearest = 0;
    let nearestDist = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(p.x - svgX);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  }

  return (
    <div style={{ border: `1px solid ${COLORS.panelBorder}`, borderRadius: 14, background: COLORS.panel, padding: "20px 10px 12px", boxShadow: "0 1px 2px rgba(18,24,21,0.04), 0 8px 24px rgba(18,24,21,0.05)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "0 14px 12px", fontSize: 12.5, color: COLORS.boneDim, fontWeight: 500 }}>
        <span>{fmtUSD(max, { maximumFractionDigits: 0 })}</span>
        <span>{fmtUSD(min, { maximumFractionDigits: 0 })}</span>
      </div>
      <div style={{ position: "relative" }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: "100%", height: "auto", display: "block", cursor: "crosshair" }}
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.3" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
            </linearGradient>
          </defs>
          {hGridLines.map((y, i) => (
            <line key={`h${i}`} x1={padding} x2={width - padding} y1={y} y2={y} stroke={COLORS.panelBorder} strokeWidth="1" />
          ))}
          {vGridLines.map((x, i) => (
            <line key={`v${i}`} x1={x} x2={x} y1={padding} y2={height - padding} stroke={COLORS.panelBorder} strokeWidth="1" strokeDasharray="3,4" opacity="0.6" />
          ))}
          <polygon points={areaPoints} fill="url(#areaFill)" />
          <path d={pathD} fill="none" stroke={lineColor} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />

          {active && (
            <line x1={active.x} x2={active.x} y1={padding} y2={height - padding} stroke={COLORS.boneDim} strokeWidth="1" strokeDasharray="2,3" opacity="0.7" />
          )}
          {last && hoverIndex == null && (
            <>
              <circle cx={last.x} cy={last.y} r="5" fill={COLORS.panel} stroke={lineColor} strokeWidth="2.5" />
              <circle cx={last.x} cy={last.y} r="2" fill={lineColor} />
            </>
          )}
          {active && hoverIndex != null && (
            <>
              <circle cx={active.x} cy={active.y} r="5" fill={COLORS.panel} stroke={lineColor} strokeWidth="2.5" />
              <circle cx={active.x} cy={active.y} r="2" fill={lineColor} />
            </>
          )}
        </svg>

        {hoverIndex != null && active && (
          <div
            className="mono"
            style={{
              position: "absolute",
              top: 4,
              left: `${Math.min(Math.max((active.x / width) * 100, 12), 88)}%`,
              transform: "translateX(-50%)",
              background: COLORS.bone,
              color: "#FFFFFF",
              fontSize: 11.5,
              fontWeight: 700,
              padding: "5px 9px",
              borderRadius: 6,
              whiteSpace: "nowrap",
              pointerEvents: "none",
              boxShadow: "0 4px 12px rgba(18,24,21,0.18)",
            }}
          >
            {fmtUSD(active.v)}
            <span style={{ fontWeight: 400, opacity: 0.75, marginLeft: 6 }}>
              {new Date(active.t).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
          </div>
        )}
      </div>
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
