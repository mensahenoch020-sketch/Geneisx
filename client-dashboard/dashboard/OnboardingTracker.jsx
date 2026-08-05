import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { getVerificationStatus } from "../api.js";
import { useAccount } from "./AccountContext.jsx";
import { COLORS } from "./shared.jsx";

// Signed up ✓ — KYC — Deposit. Every step reflects real state: "Signed up"
// is always true once the client can see the dashboard at all, "KYC" comes
// from the real verification status endpoint, and "Deposit" comes from
// whether the account actually has any deposits. Hides itself once both
// remaining steps are done, so it doesn't linger for established clients.
export default function OnboardingTracker() {
  const { client } = useAccount();
  const [kycStatus, setKycStatus] = useState(null); // null while loading

  useEffect(() => {
    let mounted = true;
    getVerificationStatus()
      .then((data) => {
        if (mounted) setKycStatus(data.status || "UNVERIFIED");
      })
      .catch(() => {
        if (mounted) setKycStatus("UNVERIFIED");
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!client || kycStatus === null) return null;

  const hasDeposited = client.deposits.length > 0;
  const kycDone = kycStatus === "VERIFIED" || kycStatus === "PENDING";

  if (kycDone && hasDeposited) return null; // fully onboarded, nothing to show

  const steps = [
    { key: "signup", label: "Signed up", done: true },
    {
      key: "kyc",
      label: kycStatus === "PENDING" ? "KYC — in review" : "KYC",
      done: kycDone,
      to: "/settings",
    },
    { key: "deposit", label: "Deposit", done: hasDeposited, to: "/dashboard/wallet" },
  ];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 8,
        background: COLORS.panel,
        border: `1px solid ${COLORS.panelBorder}`,
        borderRadius: 14,
        padding: "14px 18px",
        marginBottom: 28,
        boxShadow: "0 1px 2px rgba(18,24,21,0.04), 0 8px 20px rgba(18,24,21,0.05)",
      }}
    >
      {steps.map((step, i) => {
        const content = (
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                flexShrink: 0,
                background: step.done ? COLORS.gainBg : COLORS.page,
                border: `1.5px solid ${step.done ? COLORS.gain : COLORS.panelBorder}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {step.done && <Check size={12} color={COLORS.gain} strokeWidth={3} />}
            </div>
            <span
              style={{
                fontSize: 13.5,
                fontWeight: step.done ? 500 : 600,
                color: step.done ? COLORS.boneDim : COLORS.bone,
              }}
            >
              {step.label}
            </span>
          </div>
        );
        return (
          <React.Fragment key={step.key}>
            {i > 0 && <div style={{ width: 20, height: 1, background: COLORS.panelBorder, flexShrink: 0 }} />}
            {!step.done && step.to ? (
              <Link to={step.to} style={{ textDecoration: "none" }}>
                {content}
              </Link>
            ) : (
              content
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
