import React, { useState } from "react";

export const COLORS = {
  ink: "#070A08",
  panel: "#0E1510",
  panelBorder: "#1C2A20",
  bone: "#E7EFE9",
  boneDim: "#8CA294",
  gain: "#3FE28E",
  loss: "#e8604c",
  signal: "#E8B84C",
};

export const fmtUSD = (n, opts = {}) =>
  n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2, ...opts });

export function PageHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 13.5, color: COLORS.boneDim, marginTop: 6 }}>{subtitle}</div>}
    </div>
  );
}

export function Card({ children, style }) {
  return (
    <div
      style={{
        background: COLORS.panel,
        border: `1px solid ${COLORS.panelBorder}`,
        borderRadius: 12,
        padding: 20,
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
    <Card style={{ padding: "16px 18px", borderLeft: `3px solid ${barColor}`, position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 10.5, color: COLORS.boneDim, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {label}
        </div>
        {Icon && (
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 7,
              background: `${barColor}1f`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Icon size={13} color={barColor} />
          </div>
        )}
      </div>
      <div className="mono" style={{ fontSize: 19, fontWeight: 600, color: accent || COLORS.bone }}>
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
        fontSize: 13.5,
        padding: "32px 20px",
        textAlign: "center",
        border: `1px dashed ${COLORS.panelBorder}`,
        borderRadius: 10,
      }}
    >
      {children}
    </div>
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
      <div style={{ fontSize: 11, color: COLORS.boneDim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
        {label}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: COLORS.ink,
          border: `1px solid ${COLORS.panelBorder}`,
          borderRadius: 8,
          padding: "10px 12px",
        }}
      >
        <span className={mono ? "mono" : undefined} style={{ fontSize: 13.5, wordBreak: "break-all", paddingRight: 10 }}>
          {value || "—"}
        </span>
        <button
          onClick={copy}
          style={{
            flexShrink: 0,
            background: "transparent",
            border: `1px solid ${COLORS.panelBorder}`,
            borderRadius: 6,
            color: COLORS.bone,
            padding: "5px 10px",
            fontSize: 11.5,
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
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", color: COLORS.boneDim }}>
      Loading your account…
    </div>
  );
}

export function ErrorPage({ message }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", color: COLORS.loss, textAlign: "center", padding: 20 }}>
      {message}
    </div>
  );
}
