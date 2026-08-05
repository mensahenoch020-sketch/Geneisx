import React, { useState } from "react";
import { Lock, Zap } from "lucide-react";
import { useAccount } from "./AccountContext.jsx";
import { COLORS, Card } from "./shared.jsx";

const TIER_COLORS = ["#3FE28E", "#4C9BE8", "#E8B84C", "#9945FF"];

// The subscription/activation flow used to live on its own /dashboard/trade
// page, one click deep and easy to miss. It's now embedded directly on the
// Dashboard so both new clients (who need to deposit + activate) and active
// clients (who want to see their plan status) see it without navigating
// anywhere else.
export default function SubscriptionCard() {
  const { client, handleSubscribe } = useAccount();
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeError, setSubscribeError] = useState("");

  const isNewAccount = client.deposits.length === 0 && client.trades.length === 0;

  async function onSubscribe(tierMonths) {
    setSubscribeError("");
    setSubscribing(true);
    try {
      await handleSubscribe(tierMonths);
    } catch (err) {
      setSubscribeError(err.message || "Could not start subscription");
    } finally {
      setSubscribing(false);
    }
  }

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Zap size={15} color={COLORS.gain} />
        <span style={{ fontSize: 14, fontWeight: 700 }}>Trading plan</span>
      </div>

      {client.activeSubscription ? (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Lock size={14} color={COLORS.gain} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>
              Active — {client.activeSubscription.tierMonths} month{client.activeSubscription.tierMonths > 1 ? "s" : ""}
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: COLORS.boneDim, lineHeight: 1.6 }}>
            Runs until {new Date(client.activeSubscription.endDate).toLocaleDateString()}. Withdrawals are
            locked while this is active, since your BTC is being actively traded. You can pick a new tier once
            this one ends.
          </div>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 12.5, color: COLORS.boneDim, lineHeight: 1.6, marginBottom: 14 }}>
            {isNewAccount
              ? "Once you've deposited, choose a plan below to start trading — the fee comes out of your balance, no separate BTC payment needed."
              : "No active subscription — your funds aren't currently locked, but new trades won't be opened for your account until you choose a plan. The fee is deducted from your account balance immediately, no separate BTC payment needed."}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {client.subscriptionTiers.map((tier, i) => {
              const accent = TIER_COLORS[i % TIER_COLORS.length];
              return (
                <button
                  key={tier.tierMonths}
                  onClick={() => onSubscribe(tier.tierMonths)}
                  disabled={subscribing || isNewAccount}
                  style={{
                    background: `linear-gradient(160deg, ${accent}1a, ${COLORS.ink})`,
                    border: `1px solid ${accent}44`,
                    borderRadius: 10,
                    padding: "12px 16px",
                    color: COLORS.bone,
                    fontSize: 13,
                    textAlign: "left",
                    opacity: subscribing || isNewAccount ? 0.5 : 1,
                    minWidth: 160,
                    maxWidth: 200,
                  }}
                >
                  <div style={{ fontWeight: 700, color: accent }}>
                    {tier.tierMonths} mo{tier.tierMonths > 1 ? "s" : ""}
                  </div>
                  <div className="mono" style={{ fontSize: 13.5, fontWeight: 600, marginTop: 2 }}>
                    ${tier.priceUsd}
                  </div>
                  {tier.description && (
                    <div style={{ fontSize: 11.5, color: COLORS.boneDim, marginTop: 6, lineHeight: 1.4, fontWeight: 400 }}>
                      {tier.description}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {subscribeError && <div style={{ color: COLORS.loss, fontSize: 12, marginTop: 12 }}>{subscribeError}</div>}
    </Card>
  );
}
