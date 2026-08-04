import React, { useState } from "react";
import { Lock } from "lucide-react";
import { useAccount, useLivePrice } from "../AccountContext.jsx";
import { COLORS, PageHeader, Card, LoadingPage, ErrorPage } from "../shared.jsx";
import { PriceTicker } from "../EquityChart.jsx";

export default function TradePage() {
  const { client, loadError, handleSubscribe } = useAccount();
  const { price, change, status } = useLivePrice("bitcoin");
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeError, setSubscribeError] = useState("");

  if (loadError) return <ErrorPage message={loadError} />;
  if (!client) return <LoadingPage />;

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
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <PageHeader title="Trade" subtitle="Activate or manage your trading subscription." />
        <PriceTicker price={price} change={change} status={status} />
      </div>

      <Card>
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
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {client.subscriptionTiers.map((tier) => (
                <button
                  key={tier.tierMonths}
                  onClick={() => onSubscribe(tier.tierMonths)}
                  disabled={subscribing || isNewAccount}
                  style={{
                    background: COLORS.ink,
                    border: `1px solid ${COLORS.panelBorder}`,
                    borderRadius: 8,
                    padding: "10px 14px",
                    color: COLORS.bone,
                    fontSize: 13,
                    textAlign: "left",
                    opacity: subscribing || isNewAccount ? 0.5 : 1,
                    minWidth: 160,
                    maxWidth: 200,
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {tier.tierMonths} mo{tier.tierMonths > 1 ? "s" : ""}
                  </div>
                  <div className="mono" style={{ fontSize: 12.5, color: COLORS.boneDim, marginTop: 2 }}>
                    ${tier.priceUsd}
                  </div>
                  {tier.description && (
                    <div style={{ fontSize: 11.5, color: COLORS.boneDim, marginTop: 6, lineHeight: 1.4, fontWeight: 400 }}>
                      {tier.description}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
        {subscribeError && <div style={{ color: COLORS.loss, fontSize: 12, marginTop: 12 }}>{subscribeError}</div>}
      </Card>
    </div>
  );
}
