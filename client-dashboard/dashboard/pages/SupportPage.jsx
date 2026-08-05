import React from "react";
import { Mail, HelpCircle } from "lucide-react";
import { useAccount } from "../AccountContext.jsx";
import { COLORS, PageHeader, Card, CopyField, LoadingPage, ErrorPage } from "../shared.jsx";

const SUPPORT_EMAIL = "chasr1226@gmail.com";

// Answers here only restate things already true elsewhere in this app (the
// deposit flow, withdrawal locking during an active subscription, manual
// KYC review) — nothing new is being promised on this page.
const FAQ = [
  {
    q: "How do I deposit?",
    a: "Go to Wallet for your deposit address and QR code. Send BTC there, then message support with the amount and your reference code so it can be matched to your account — deposits are logged manually once confirmed on-chain, which usually takes a few hours.",
  },
  {
    q: "Why can't I withdraw right now?",
    a: "Withdrawals are locked while a trading subscription is active, since your BTC is being actively traded. You can withdraw once your current plan ends, or reach out if you need to discuss your situation.",
  },
  {
    q: "How long does identity verification take?",
    a: "Verification documents are reviewed manually by staff, not an automated system, so it can take a little time. You'll see your status update in Settings once it's been reviewed.",
  },
  {
    q: "How do I get a statement of my account?",
    a: "Head to Wallet and download a PDF or CSV statement any time — it covers your deposits, withdrawals, and trade history.",
  },
];

function FaqItem({ q, a }) {
  return (
    <div style={{ padding: "16px 0", borderBottom: `1px solid ${COLORS.panelBorder}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 6 }}>
        <HelpCircle size={16} color={COLORS.gain} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 15, fontWeight: 600 }}>{q}</div>
      </div>
      <div style={{ fontSize: 14, color: COLORS.boneDim, lineHeight: 1.65, paddingLeft: 26 }}>{a}</div>
    </div>
  );
}

export default function SupportPage() {
  const { client, loadError } = useAccount();

  if (loadError) return <ErrorPage message={loadError} />;
  if (!client) return <LoadingPage />;

  return (
    <div>
      <PageHeader title="Support" subtitle="Need help with a deposit, withdrawal, or your account? We're here." />

      <Card style={{ marginBottom: 24, background: `linear-gradient(160deg, ${COLORS.gainBg}, ${COLORS.panel})` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: COLORS.gainBg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Mail size={18} color={COLORS.gain} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Contact us</div>
            <div style={{ fontSize: 13, color: COLORS.boneDim }}>We reply to every message directly.</div>
          </div>
        </div>
        <a
          href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
            `Support request — ${client.depositReference || client.name || ""}`
          )}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: COLORS.gain,
            color: "#FFFFFF",
            fontWeight: 700,
            fontSize: 14.5,
            padding: "12px 20px",
            borderRadius: 10,
            marginTop: 6,
          }}
        >
          <Mail size={16} /> Email support
        </a>
      </Card>

      <div style={{ marginBottom: 24 }}>
        <CopyField label="Your reference code — include this when you contact us" value={client.depositReference} mono />
      </div>

      <div style={{ fontSize: 11.5, color: COLORS.boneDim, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 600, marginBottom: 4 }}>
        Common questions
      </div>
      <Card style={{ padding: "6px 22px" }}>
        {FAQ.map((item) => (
          <FaqItem key={item.q} {...item} />
        ))}
      </Card>
    </div>
  );
}
