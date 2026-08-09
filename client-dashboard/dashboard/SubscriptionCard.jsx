import React, { useState } from "react";
import { Lock, Zap, CheckCircle2, ArrowRight, Wallet as WalletIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { useAccount, balance } from "./AccountContext.jsx";
import { COLORS, Card, Badge, fmtUSD } from "./shared.jsx";
import Confetti from "./Confetti.jsx";

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
// Each tier represents an investment amount range — the client types in
// exactly how much of their balance to put into that plan, anywhere within
// the tier's min/max. Tiers stack full-width on mobile with large tap
// targets. Every tier stays genuinely clickable even at $0 balance — an
// account with nothing deposited yet can still open a tier and see what it
// needs; the balance check only blocks at the final Confirm step, with a
// clear message and a direct link to Wallet, instead of disabling the whole
// flow up front with just a hover tooltip (which never shows on mobile).
export default function SubscriptionCard() {
  const { client, handleSubscribe } = useAccount();
  const [openTier, setOpenTier] = useState(null); // tier.key currently expanded for input
  const [amountDrafts, setAmountDrafts] = useState({}); // tier.key -> string
  const [pendingTier, setPendingTier] = useState(null); // tier.key awaiting confirm tap
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeError, setSubscribeError] = useState("");
  const [justSubscribed, setJustSubscribed] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const bal = balance(client);

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

  const insufficientForOpenTier = openTier
    ? bal < (client.subscriptionTiers.find((t) => t.key === openTier)?.minUsd ?? Infinity)
    : false;

  async function confirmSubscribe(tier) {
    const amountUsd = Number(draftFor(tier));
    setSubscribeError("");
    setSubscribing(true);
    try {
      await handleSubscribe(tier.key, amountUsd);
      setPendingTier(null);
      setOpenTier(null);
      setJustSubscribed(true);
      setShowConfetti(true);
    } catch (err) {
      setSubscribeError(err.message || "Could not start subscription");
    } finally {
      setSubscribing(false);
    }
  }

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Zap size={16} color={COLORS.gain} />
          <span style={{ fontSize: 16, fontWeight: 700 }}>Trading plan</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: COLORS.boneDim }}>
          <WalletIcon size={13} />
          Balance:
          <span className="mono" style={{ fontWeight: 700, color: COLORS.bone }}>
            {fmtUSD(bal)}
          </span>
        </div>
      </div>

      {showConfetti && <Confetti onDone={() => setShowConfetti(false)} />}

      {client.activeSubscription ? (
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
                fontWeight: 700,
              }}
            >
              <CheckCircle2 size={17} />
              Congratulations — your plan is active! Your balance and chart above will track real performance from
              here.
            </div>
          )}
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
          <div style={{ fontSize: 13.5, color: COLORS.boneDim, lineHeight: 1.65, marginBottom: 16 }}>
            Choose a plan and how much to invest — it comes out of your balance, no separate BTC payment needed.
            Tap any plan below to see the amount field, even before you've deposited.
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {client.subscriptionTiers.map((tier, i) => {
              const accent = TIER_COLORS[i % TIER_COLORS.length];
              const isOpen = openTier === tier.key;
              const isPending = pendingTier === tier.key;
              const amountOk = validAmount(tier);

              return (
                <div
                  key={tier.key}
                  style={{
                    background: isOpen ? `linear-gradient(160deg, ${accent}12, ${COLORS.panel})` : COLORS.panel,
                    border: `1.5px solid ${isOpen ? accent : COLORS.panelBorder}`,
                    borderRadius: 14,
                    padding: "16px 18px",
                    transition: "border-color 0.15s ease",
                  }}
                >
                  {!isOpen ? (
                    <button
                      onClick={() => setOpenTier(tier.key)}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        background: "transparent",
                        border: "none",
                        padding: 0,
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 15.5, color: accent, marginBottom: 3 }}>{tier.name}</div>
                        <div className="mono" style={{ fontSize: 14, fontWeight: 600, color: COLORS.bone }}>
                          {fmtUsdShort(tier.minUsd)}–{fmtUsdShort(tier.maxUsd)}
                        </div>
                        <div style={{ fontSize: 11.5, color: COLORS.boneDim, marginTop: 2 }}>
                          {tier.tierMonths} month{tier.tierMonths > 1 ? "s" : ""} lock-up
                        </div>
                        {tier.returnEstimate && (
                          <div style={{ fontSize: 11.5, color: accent, marginTop: 4, fontWeight: 600 }}>{tier.returnEstimate}</div>
                        )}
                      </div>
                      <div
                        style={{
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          background: accent,
                          color: "#FFFFFF",
                          fontWeight: 700,
                          fontSize: 13,
                          padding: "10px 16px",
                          borderRadius: 8,
                        }}
                      >
                        Buy plan <ArrowRight size={14} />
                      </div>
                    </button>
                  ) : (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 15.5, color: accent }}>{tier.name}</div>
                          <div style={{ fontSize: 11.5, color: COLORS.boneDim, marginTop: 2 }}>
                            {tier.tierMonths} month{tier.tierMonths > 1 ? "s" : ""} lock-up
                          </div>
                        </div>
                        <button
                          onClick={() => setOpenTier(null)}
                          style={{ background: "transparent", border: "none", color: COLORS.boneDim, fontSize: 12.5, fontWeight: 600 }}
                        >
                          Close
                        </button>
                      </div>
                      {tier.description && (
                        <div style={{ fontSize: 12.5, color: COLORS.boneDim, marginBottom: 12, lineHeight: 1.5 }}>
                          {tier.description}
                        </div>
                      )}
                      {tier.returnEstimate && (
                        <div
                          style={{
                            fontSize: 12,
                            color: COLORS.bone,
                            background: `${accent}12`,
                            border: `1px solid ${accent}33`,
                            borderRadius: 8,
                            padding: "8px 10px",
                            marginBottom: 12,
                            lineHeight: 1.5,
                          }}
                        >
                          <span style={{ fontWeight: 700, color: accent }}>{tier.returnEstimate}</span>
                          <div style={{ fontSize: 10.5, color: COLORS.boneDim, marginTop: 3 }}>
                            Based on past performance — not a guarantee of future results. Your balance can go down as well as up.
                          </div>
                        </div>
                      )}

                      {insufficientForOpenTier ? (
                        <div>
                          <div style={{ fontSize: 12.5, color: COLORS.loss, marginBottom: 10, lineHeight: 1.5 }}>
                            Your balance ({fmtUSD(bal)}) is below this plan's {fmtUsdShort(tier.minUsd)} minimum.
                            Deposit first, then come back to buy this plan.
                          </div>
                          <Link
                            to="/dashboard/wallet"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              background: accent,
                              color: "#FFFFFF",
                              fontWeight: 700,
                              fontSize: 13,
                              padding: "10px 16px",
                              borderRadius: 8,
                            }}
                          >
                            Go to Wallet <ArrowRight size={14} />
                          </Link>
                        </div>
                      ) : isPending ? (
                        <div>
                          <div style={{ fontSize: 12.5, color: COLORS.bone, marginBottom: 10, fontWeight: 600 }}>
                            Confirm {fmtUsdShort(draftFor(tier))} from your balance?
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              onClick={() => confirmSubscribe(tier)}
                              disabled={subscribing}
                              style={{
                                flex: 1,
                                background: accent,
                                color: "#FFFFFF",
                                border: "none",
                                borderRadius: 8,
                                padding: "12px 10px",
                                fontSize: 13.5,
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
                                padding: "12px 14px",
                                fontSize: 13.5,
                                fontWeight: 600,
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <label style={{ display: "block", fontSize: 12, color: COLORS.boneDim, marginBottom: 6 }}>
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
                              padding: "12px 12px",
                              fontSize: 15,
                              marginBottom: 10,
                              color: COLORS.bone,
                            }}
                          />
                          <button
                            onClick={() => setPendingTier(tier.key)}
                            disabled={!amountOk}
                            style={{
                              width: "100%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 6,
                              background: amountOk ? accent : COLORS.page,
                              color: amountOk ? "#FFFFFF" : COLORS.boneDim,
                              border: "none",
                              borderRadius: 8,
                              padding: "12px 10px",
                              fontSize: 13.5,
                              fontWeight: 700,
                              cursor: amountOk ? "pointer" : "not-allowed",
                            }}
                          >
                            Continue <ArrowRight size={14} />
                          </button>
                        </div>
                      )}
                    </div>
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
