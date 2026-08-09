import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpFromLine, CheckCircle2, ArrowRight, Lock } from "lucide-react";
import { useAccount, balance } from "./AccountContext.jsx";
import { COLORS, Card, fmtUSD } from "./shared.jsx";

// A withdrawal request never moves money by itself — it creates a PENDING
// record that staff review and actually send, with a real on-chain tx hash
// once processed (see backend/src/routes/withdrawals.js). This panel is the
// client-facing "ask for money out" step; nothing here can move funds on
// its own.
export default function WithdrawPanel({ onClose }) {
  const { client, handleWithdraw } = useAccount();
  const [amount, setAmount] = useState("");
  const [destination, setDestination] = useState("");
  const [pending, setPending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const bal = balance(client);
  const locked = !!client.activeSubscription;
  const amountNum = Number(amount);
  const amountOk = Number.isFinite(amountNum) && amountNum > 0 && amountNum <= bal;
  const destinationOk = destination.trim().length >= 6;

  async function submit() {
    setError("");
    setSubmitting(true);
    try {
      const result = await handleWithdraw(amountNum, destination.trim());
      if (result.ok) setSubmitted(true);
    } catch (err) {
      setError(err.message || "Could not submit withdrawal request");
    } finally {
      setSubmitting(false);
    }
  }

  if (locked) {
    return (
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Lock size={16} color={COLORS.boneDim} />
          <span style={{ fontSize: 15, fontWeight: 700 }}>Withdrawals locked</span>
        </div>
        <div style={{ fontSize: 13, color: COLORS.boneDim, lineHeight: 1.6 }}>
          Your funds are locked while your trading plan is active. Withdrawals reopen once it ends on{" "}
          {new Date(client.activeSubscription.endDate).toLocaleDateString()}.
        </div>
      </Card>
    );
  }

  if (submitted) {
    return (
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: COLORS.gain, marginBottom: 8 }}>
          <CheckCircle2 size={18} />
          <span style={{ fontSize: 15, fontWeight: 700 }}>Withdrawal request submitted</span>
        </div>
        <div style={{ fontSize: 13, color: COLORS.boneDim, lineHeight: 1.6, marginBottom: 12 }}>
          We'll review and send it out, then mark it processed with an on-chain transaction hash. You'll see it
          reflected in Transactions once it's sent.
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{ background: "transparent", border: `1px solid ${COLORS.panelBorder}`, color: COLORS.bone, borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600 }}
          >
            Done
          </button>
        )}
      </Card>
    );
  }

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ArrowUpFromLine size={16} color={COLORS.gain} />
          <span style={{ fontSize: 16, fontWeight: 700 }}>Request a withdrawal</span>
        </div>
        <div className="mono" style={{ fontSize: 12.5, color: COLORS.boneDim }}>
          Balance: <span style={{ fontWeight: 700, color: COLORS.bone }}>{fmtUSD(bal)}</span>
        </div>
      </div>

      {bal <= 0 ? (
        <div style={{ fontSize: 13, color: COLORS.boneDim, lineHeight: 1.6 }}>
          Your balance is $0, so there's nothing to withdraw yet.{" "}
          <Link to="/dashboard/wallet" style={{ color: COLORS.gain, fontWeight: 600 }}>
            Deposit first
          </Link>
          .
        </div>
      ) : pending ? (
        <div>
          <div style={{ fontSize: 12.5, color: COLORS.bone, marginBottom: 10, fontWeight: 600 }}>
            Confirm request to withdraw {fmtUSD(amountNum)} to:
            <div className="mono" style={{ fontSize: 12, color: COLORS.boneDim, marginTop: 4, wordBreak: "break-all" }}>
              {destination}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={submit}
              disabled={submitting}
              style={{
                flex: 1,
                background: COLORS.gain,
                color: "#FFFFFF",
                border: "none",
                borderRadius: 8,
                padding: "12px 10px",
                fontSize: 13.5,
                fontWeight: 700,
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? "Submitting…" : "Confirm request"}
            </button>
            <button
              onClick={() => setPending(false)}
              disabled={submitting}
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
              Back
            </button>
          </div>
        </div>
      ) : (
        <div>
          <label style={{ display: "block", fontSize: 12, color: COLORS.boneDim, marginBottom: 6 }}>
            Amount to withdraw (up to {fmtUSD(bal)})
          </label>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={bal}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            style={{
              width: "100%",
              background: COLORS.page,
              border: `1px solid ${COLORS.panelBorder}`,
              borderRadius: 8,
              padding: "12px 12px",
              fontSize: 15,
              marginBottom: 12,
              color: COLORS.bone,
            }}
          />
          <label style={{ display: "block", fontSize: 12, color: COLORS.boneDim, marginBottom: 6 }}>
            Destination wallet address
          </label>
          <input
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Paste the address you want funds sent to"
            style={{
              width: "100%",
              background: COLORS.page,
              border: `1px solid ${COLORS.panelBorder}`,
              borderRadius: 8,
              padding: "12px 12px",
              fontSize: 13.5,
              marginBottom: 14,
              color: COLORS.bone,
            }}
          />
          <button
            onClick={() => setPending(true)}
            disabled={!amountOk || !destinationOk}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              background: amountOk && destinationOk ? COLORS.gain : COLORS.page,
              color: amountOk && destinationOk ? "#FFFFFF" : COLORS.boneDim,
              border: "none",
              borderRadius: 8,
              padding: "12px 10px",
              fontSize: 13.5,
              fontWeight: 700,
              cursor: amountOk && destinationOk ? "pointer" : "not-allowed",
            }}
          >
            Continue <ArrowRight size={14} />
          </button>
        </div>
      )}
      {error && <div style={{ color: COLORS.loss, fontSize: 12.5, marginTop: 12 }}>{error}</div>}
    </Card>
  );
}
