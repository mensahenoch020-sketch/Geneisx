import React, { useState } from "react";
import { X, ArrowRight, ArrowLeft, Wallet, Copy, Zap, TrendingUp } from "lucide-react";
import { COLORS } from "./shared.jsx";

const STEPS = [
  {
    icon: Wallet,
    title: "1. Go to Wallet",
    body: "Open Wallet from the sidebar (or tap Deposit on the Dashboard). You'll see a real deposit address and QR code for each supported coin.",
  },
  {
    icon: Copy,
    title: "2. Send funds & note your reference",
    body: "Send from your own wallet or exchange to that address. Copy your account's reference code too — include it when you message support so your deposit gets matched quickly.",
  },
  {
    icon: TrendingUp,
    title: "3. Wait for confirmation",
    body: "Deposits are confirmed on-chain, then logged to your account — usually within a few hours. Your balance updates automatically once it's in.",
  },
  {
    icon: Zap,
    title: "4. Choose a trading plan",
    body: "Back on the Dashboard, open the Trading plan card, pick a tier, and enter how much of your balance to invest. Confirm, and you're active.",
  },
];

export default function Tutorial({ onClose }) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(18,24,21,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 500,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: COLORS.panel,
          borderRadius: 16,
          maxWidth: 380,
          width: "100%",
          padding: 24,
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ position: "absolute", top: 16, right: 16, background: "transparent", border: "none", color: COLORS.boneDim }}
        >
          <X size={18} />
        </button>

        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: COLORS.gainBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <Icon size={22} color={COLORS.gain} />
        </div>

        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 8 }}>{current.title}</div>
        <div style={{ fontSize: 13.5, color: COLORS.boneDim, lineHeight: 1.65, marginBottom: 24 }}>{current.body}</div>

        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 20 }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? 18 : 6,
                height: 6,
                borderRadius: 3,
                background: i === step ? COLORS.gain : COLORS.panelBorder,
                transition: "all 0.2s ease",
              }}
            />
          ))}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "transparent",
                border: `1px solid ${COLORS.panelBorder}`,
                color: COLORS.bone,
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <ArrowLeft size={14} /> Back
            </button>
          )}
          <button
            onClick={() => (isLast ? onClose() : setStep((s) => s + 1))}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              background: COLORS.gain,
              color: "#FFFFFF",
              border: "none",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {isLast ? "Got it" : "Next"} {!isLast && <ArrowRight size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}
