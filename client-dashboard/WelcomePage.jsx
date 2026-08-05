import React from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, ArrowRight } from "lucide-react";

const COLORS = {
  ink: "#070A08",
  panel: "#0E1510",
  panelBorder: "#1C2A20",
  bone: "#E7EFE9",
  boneDim: "#8CA294",
  gain: "#3FE28E",
};

// Shown once, right after sign-up, before the client ever sees the
// dashboard. Both buttons lead somewhere real: "Start verification" takes
// them into Settings where VerificationPanel's actual upload form lives;
// "Skip for now" goes straight to the dashboard, which then shows an
// onboarding tracker (OnboardingTracker.jsx) reminding them KYC is still
// open until they come back to it.
export default function WelcomePage() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        background: COLORS.ink,
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: COLORS.bone,
        fontFamily: "'Space Grotesk', -apple-system, sans-serif",
        padding: "40px 20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: COLORS.panel,
          border: `1px solid ${COLORS.panelBorder}`,
          borderRadius: 16,
          padding: 32,
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: "rgba(63,226,142,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
          }}
        >
          <ShieldCheck size={26} color={COLORS.gain} />
        </div>

        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 10 }}>Verify your identity</div>
        <div style={{ fontSize: 14, color: COLORS.boneDim, lineHeight: 1.65, marginBottom: 28 }}>
          Your account is created. Verifying your identity now speeds up withdrawals later — it takes a couple of
          minutes and is reviewed by our staff directly. You can also do this later from Settings.
        </div>

        <button
          onClick={() => navigate("/settings")}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            background: COLORS.gain,
            color: "#0E1114",
            border: "none",
            borderRadius: 10,
            padding: "13px 16px",
            fontSize: 14.5,
            fontWeight: 700,
            marginBottom: 10,
          }}
        >
          Start verification <ArrowRight size={16} />
        </button>
        <button
          onClick={() => navigate("/dashboard")}
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            color: COLORS.boneDim,
            fontSize: 13.5,
            padding: "10px 4px",
          }}
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
