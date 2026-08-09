import React from "react";
import { BarChart3 } from "lucide-react";
import { useAccount } from "./AccountContext.jsx";
import { COLORS, Card } from "./shared.jsx";

const TIER_COLORS = ["#0F9D63", "#2E7BC4", "#B8790F", "#7A3FE0", "#C0392B"];

export default function TierComparisonChart() {
  const { client } = useAccount();
  if (!client || client.subscriptionTiers.length === 0) return null;

  const maxAmount = Math.max(...client.subscriptionTiers.map((t) => t.maxUsd));

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <BarChart3 size={16} color={COLORS.gain} />
        <span style={{ fontSize: 15, fontWeight: 700 }}>Compare plans</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {client.subscriptionTiers.map((tier, i) => {
          const accent = TIER_COLORS[i % TIER_COLORS.length];
          const widthPct = Math.max((tier.maxUsd / maxAmount) * 100, 8);
          return (
            <div key={tier.key}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: accent }}>{tier.name}</span>
                <span className="mono" style={{ fontSize: 11.5, color: COLORS.boneDim }}>
                  ${tier.minUsd.toLocaleString()}–${tier.maxUsd.toLocaleString()} · {tier.tierMonths}mo
                </span>
              </div>
              <div style={{ background: COLORS.page, borderRadius: 6, height: 10, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${widthPct}%`,
                    height: "100%",
                    background: accent,
                    borderRadius: 6,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 10.5, color: COLORS.boneDim, marginTop: 14 }}>
        Bar length reflects each plan's maximum investable amount, for a quick visual comparison.
      </div>
    </Card>
  );
}
