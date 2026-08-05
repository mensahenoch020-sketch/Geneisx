import React, { useState } from "react";

// Light/white theme — dark text on white/light-gray, matching the new
// .dash-* CSS variables in theme.css. Every dashboard page reads its colors
// from here, so changing this file re-themes the whole logged-in app.
export const COLORS = {
  ink: "#FFFFFF",        // surface / card background (kept the name "ink" so
                          // existing calls like COLORS.ink for backgrounds
                          // still work after the light-mode flip)
  panel: "#FFFFFF",
  panelBorder: "#E4E9E6",
  bone: "#121815",        // primary text
  boneDim: "#68766F",     // secondary/dim text
  gain: "#0F9D63",
  gainBg: "#E7F7EF",
  loss: "#DC4C3F",
  lossBg: "#FDEEEC",
  signal: "#B8790F",
  signalBg: "#FBF1E1",
  page: "#F6F8F7",
};

export const fmtUSD = (n, opts = {}) =>
  n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2, ...opts });

export function PageHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.7, color: COLORS.bone }}>{title}</div>
      {subtitle && <div style={{ fontSize: 15, color: COLORS.boneDim, marginTop: 8 }}>{subtitle}</div>}
    </div>
  );
}

export function Card({ children, style }) {
  return (
    <div
      style={{
        background: COLORS.panel,
        border: `1px solid ${COLORS.panelBorder}`,
        borderRadius: 14,
        padding: 22,
        boxShadow: "0 1px 2px rgba(18,24,21,0.04), 0 8px 24px rgba(18,24,21,0.05)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function SummaryCard({ label, value, accent, icon: Icon }) {
  const barColor = accent || COLORS.gain;
  return (
    <Card style={{ padding: "18px 20px", borderLeft: `3px solid ${barColor}`, position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 11.5, color: COLORS.boneDim, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>
          {label}
        </div>
        {Icon && (
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: `${barColor}1a`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Icon size={14} color={barColor} />
          </div>
        )}
      </div>
      <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: accent || COLORS.bone }}>
        {value}
      </div>
    </Card>
  );
}

export function EmptyState({ children }) {
  return (
    <div
      style={{
        color: COLORS.boneDim,
        fontSize: 14.5,
        padding: "36px 20px",
        textAlign: "center",
        border: `1.5px dashed ${COLORS.panelBorder}`,
        borderRadius: 12,
        background: COLORS.page,
      }}
    >
      {children}
    </div>
  );
}

// Small pill used for status labels — "Delayed" price badge, onboarding
// step states, subscription status, etc.
export function Badge({ children, tone = "dim" }) {
  const tones = {
    dim: { bg: COLORS.page, fg: COLORS.boneDim, border: COLORS.panelBorder },
    gain: { bg: COLORS.gainBg, fg: COLORS.gain, border: "transparent" },
    loss: { bg: COLORS.lossBg, fg: COLORS.loss, border: "transparent" },
    signal: { bg: COLORS.signalBg, fg: COLORS.signal, border: "transparent" },
  };
  const t = tones[tone] || tones.dim;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11.5,
        fontWeight: 600,
        color: t.fg,
        background: t.bg,
        border: `1px solid ${t.border}`,
        borderRadius: 999,
        padding: "3px 9px",
      }}
    >
      {children}
    </span>
  );
}

export function CopyField({ label, value, mono }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — user can still select and copy manually
    }
  }
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11.5, color: COLORS.boneDim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, fontWeight: 600 }}>
        {label}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: COLORS.page,
          border: `1px solid ${COLORS.panelBorder}`,
          borderRadius: 10,
          padding: "11px 13px",
        }}
      >
        <span className={mono ? "mono" : undefined} style={{ fontSize: 14, wordBreak: "break-all", paddingRight: 10, color: COLORS.bone }}>
          {value || "—"}
        </span>
        <button
          onClick={copy}
          style={{
            flexShrink: 0,
            background: COLORS.panel,
            border: `1px solid ${COLORS.panelBorder}`,
            borderRadius: 7,
            color: COLORS.bone,
            padding: "6px 11px",
            fontSize: 12.5,
            fontWeight: 500,
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export function LoadingPage() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", color: COLORS.boneDim, fontSize: 15 }}>
      Loading your account…
    </div>
  );
}

export function ErrorPage({ message }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", color: COLORS.loss, textAlign: "center", padding: 20, fontSize: 15 }}>
      {message}
    </div>
  );
}
