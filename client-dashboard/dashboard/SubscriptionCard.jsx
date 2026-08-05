import React, { useState } from "react";
import { Lock, Zap, CheckCircle2, ArrowRight } from "lucide-react";
import { useAccount } from "./AccountContext.jsx";
import { COLORS, Card, Badge } from "./shared.jsx";

const TIER_COLORS = ["#0F9D63", "#2E7BC4", "#B8790F", "#7A3FE0", "#C0392B"];

function fmtUsdShort(n) {
  return `$${Number(n).toLocaleString("en-US")}`;
}

// The subscription/activation flow used to live on its own /dashboard/trade
// page, one click deep and easy to miss. It's now embedded directly on the
// Dashboard so both new clients (who need to deposit + activate) and active
// clients (who want to see their plan status) see it without navigating
// anywhere else.
//
// Each tier now represents an investment amount range (not a flat fee) —
// the client types in exactly how much of their balance they want to put
// into that plan, anywhere within the tier's min/max. Each tier is its own
// card with an explicit "Buy plan" button, an amount field, and one confirm
// tap before charging, since this moves real money. After it succeeds, the
// balance and chart just above already reflect the new subscription (via
// the shared account reload), so the success message points there directly.
export default function SubscriptionCard() {
  const { client, handleSubscribe } = useAccount();
  const [openTier, setOpenTier] = useState(null); // tier.key currently expanded for input
  const [amountDrafts, setAmountDrafts] = useState({}); // tier.key -> string
  const [pendingTier, setPendingTier] = useState(null); // tier.key awaiting confirm tap
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeError, setSubscribeError] = useState("");
  const [justSubscribed, setJustSubscribed] = useState(false);

  const isNewAccount = client.deposits.length === 0 && client.trades.length === 0;

  // The active subscription (from the backend) only carries tierMonths, not
  // a name — look the display name up from the tier list by matching
  // tierMonths, since each tier has a unique lock-up length.
  const activeTierName = client.activeSubscription
    ? client.subscriptionTiers.find((t) => t.tierMonths === client.activeSubscription.tierMonths)?.name
    : null;

  function draftFor(tier) {
    return amountDrafts[tier.key] ?? "";
  }

  function setDraft(tier, value) {
    setAmountDrafts((d) => ({ ...d, [tier.key]: value }));
  }

  function validAmount(tier) {
    const n = Number(draftFor(tier));
    return Number.isFinite(n) && n >= tier.minUsd && n <= tier.maxUsd;
  }

  async function confirmSubscribe(tier) {
    const amountUsd = Number(draftFor(tier));
    setSubscribeError("");
    setSubscribing(true);
    try {
      await handleSubscribe(tier.key, amountUsd);
      setPendingTier(null);
      setOpenTier(null);
      setJustSubscribed(true);
    } catch (err) {
      setSubscribeError(err.message || "Could not start subscription");
    } finally {
      setSubscribing(false);
    }
  }

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <Zap size={16} color={COLORS.gain} />
        <span style={{ fontSize: 16, fontWeight: 700 }}>Trading plan</span>
      </div>

      {client.activeSubscription ? (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <Lock size={15} color={COLORS.gain} />
            <span style={{ fontSize: 15, fontWeight: 700 }}>
              Active — {activeTierName || `${client.activeSubscription.tierMonths} month plan`}
            </span>
            <Badge tone="gain">Trading</Badge>
          </div>
          <div className="mono" style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
            {fmtUsdShort(client.activeSubscription.amountUsd)} invested
          </div>
          <div style={{ fontSize: 13.5, color: COLORS.boneDim, lineHeight: 1.65 }}>
            Runs until {new Date(client.activeSubscription.endDate).toLocaleDateString()}. Your balance and chart
            above reflect real trade performance while this is active. Withdrawals are locked until this plan
            ends, since your BTC is being actively traded.
          </div>
        </div>
      ) : (
        <div>
          {justSubscribed && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: COLORS.gainBg,
                border: "1px solid #B9E8D2",
                borderRadius: 10,
                padding: "12px 14px",
                marginBottom: 14,
                fontSize: 13.5,
                color: COLORS.gain,
                fontWeight: 600,
              }}
            >
              <CheckCircle2 size={16} />
              Plan activated — your balance and chart above will track performance from here.
            </div>
          )}

          <div style={{ fontSize: 13.5, color: COLORS.boneDim, lineHeight: 1.65, marginBottom: 16 }}>
            {isNewAccount
              ? "Once you've deposited, choose a plan below and how much to invest — it comes out of your balance, no separate BTC payment needed."
              : "No active plan — your funds aren't locked, but no new trades will open until you buy one. The amount you choose is deducted from your balance immediately."}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {client.subscriptionTiers.map((tier, i) => {
              const accent = TIER_COLORS[i % TIER_COLORS.length];
              const isOpen = openTier === tier.key;
              const isPending = pendingTier === tier.key;
              const amountOk = validAmount(tier);

              return (
                <div
                  key={tier.key}
                  style={{
                    background: `linear-gradient(160deg, ${accent}0f, ${COLORS.panel})`,
                    border: `1.5px solid ${isOpen ? accent : accent + "40"}`,
                    borderRadius: 14,
                    padding: "16px 18px",
                    minWidth: 200,
                    maxWidth: 240,
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 15.5, color: accent, marginBottom: 2 }}>{tier.name}</div>
                  <div className="mono" style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                    {fmtUsdShort(tier.minUsd)}–{fmtUsdShort(tier.maxUsd)}
                  </div>
                  <div style={{ fontSize: 11.5, color: COLORS.boneDim, marginBottom: 8 }}>
                    {tier.tierMonths} month{tier.tierMonths > 1 ? "s" : ""} lock-up
                  </div>
                  {tier.description && (
                    <div style={{ fontSize: 12.5, color: COLORS.boneDim, marginBottom: 14, lineHeight: 1.5 }}>
                      {tier.description}
                    </div>
                  )}

                  {isPending ? (
                    <div>
                      <div style={{ fontSize: 12, color: COLORS.bone, marginBottom: 8, fontWeight: 600 }}>
                        Confirm {fmtUsdShort(draftFor(tier))} from your balance?
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => confirmSubscribe(tier)}
                          disabled={subscribing}
                          style={{
                            flex: 1,
                            background: accent,
                            color: "#FFFFFF",
                            border: "none",
                            borderRadius: 8,
                            padding: "9px 10px",
                            fontSize: 12.5,
                            fontWeight: 700,
                            opacity: subscribing ? 0.7 : 1,
                          }}
                        >
                          {subscribing ? "Processing…" : "Confirm"}
                        </button>
                        <button
                          onClick={() => setPendingTier(null)}
                          disabled={subscribing}
                          style={{
                            background: "transparent",
                            border: `1px solid ${COLORS.panelBorder}`,
                            color: COLORS.boneDim,
                            borderRadius: 8,
                            padding: "9px 10px",
                            fontSize: 12.5,
                            fontWeight: 600,
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : isOpen ? (
                    <div>
                      <label style={{ display: "block", fontSize: 11.5, color: COLORS.boneDim, marginBottom: 5 }}>
                        Amount to invest ({fmtUsdShort(tier.minUsd)}–{fmtUsdShort(tier.maxUsd)})
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={tier.minUsd}
                        max={tier.maxUsd}
                        value={draftFor(tier)}
                        onChange={(e) => setDraft(tier, e.target.value)}
                        placeholder={String(tier.minUsd)}
                        style={{
                          width: "100%",
                          background: COLORS.page,
                          border: `1px solid ${COLORS.panelBorder}`,
                          borderRadius: 8,
                          padding: "9px 10px",
                          fontSize: 13.5,
                          marginBottom: 8,
                          color: COLORS.bone,
                        }}
                      />
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => setPendingTier(tier.key)}
                          disabled={!amountOk || isNewAccount}
                          style={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            background: amountOk && !isNewAccount ? accent : COLORS.page,
                            color: amountOk && !isNewAccount ? "#FFFFFF" : COLORS.boneDim,
                            border: "none",
                            borderRadius: 8,
                            padding: "9px 10px",
                            fontSize: 12.5,
                            fontWeight: 700,
                            cursor: amountOk && !isNewAccount ? "pointer" : "not-allowed",
                          }}
                        >
                          Continue <ArrowRight size={13} />
                        </button>
                        <button
                          onClick={() => setOpenTier(null)}
                          style={{
                            background: "transparent",
                            border: `1px solid ${COLORS.panelBorder}`,
                            color: COLORS.boneDim,
                            borderRadius: 8,
                            padding: "9px 10px",
                            fontSize: 12.5,
                            fontWeight: 600,
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setOpenTier(tier.key)}
                      disabled={isNewAccount}
                      title={isNewAccount ? "Deposit first to buy a plan" : undefined}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        background: isNewAccount ? COLORS.page : accent,
                        color: isNewAccount ? COLORS.boneDim : "#FFFFFF",
                        border: "none",
                        borderRadius: 8,
                        padding: "10px 10px",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: isNewAccount ? "not-allowed" : "pointer",
                      }}
                    >
                      Buy plan <ArrowRight size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {subscribeError && <div style={{ color: COLORS.loss, fontSize: 12.5, marginTop: 12 }}>{subscribeError}</div>}
    </Card>
  );
}
