// Transactional email via Resend (https://resend.com) — chosen for its
// permanent free tier (3,000 emails/month) and a plain HTTP API, so no new
// npm dependency is needed; this uses Node's built-in fetch (Node 18+).
//
// Set these on the backend service:
//   RESEND_API_KEY     → from your Resend dashboard
//   RESEND_FROM_EMAIL   → e.g. "GenesisX <notifications@yourdomain.com>" —
//                          must be a domain you've verified with Resend
//
// If either is missing, sendEmail() logs a warning and resolves without
// sending — every call site treats email as best-effort, never something
// that can block or fail the real action (a deposit still gets recorded
// even if the confirmation email fails to send).
async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    console.warn("[email] RESEND_API_KEY or RESEND_FROM_EMAIL not set — skipping email:", subject);
    return { sent: false, reason: "not_configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[email] Resend API error", res.status, body);
      return { sent: false, reason: "api_error" };
    }
    return { sent: true };
  } catch (err) {
    console.error("[email] send failed", err);
    return { sent: false, reason: "network_error" };
  }
}

function wrapEmail(title, bodyHtml) {
  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <div style="font-size: 18px; font-weight: 700; color: #121815; margin-bottom: 16px;">${title}</div>
      <div style="font-size: 14px; color: #333; line-height: 1.6;">${bodyHtml}</div>
      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #E4E9E6; font-size: 12px; color: #68766F;">
        GenesisX — this is an automated notification.
      </div>
    </div>
  `;
}

async function sendDepositConfirmedEmail(client, amountUsd) {
  return sendEmail({
    to: client.email,
    subject: "Deposit confirmed",
    html: wrapEmail(
      "Deposit confirmed",
      `Hi ${client.name}, we've confirmed a deposit of $${Number(amountUsd).toLocaleString()} on your GenesisX account. It's now reflected in your balance.`
    ),
  });
}

async function sendWithdrawalProcessedEmail(client, amountUsd, txHash) {
  return sendEmail({
    to: client.email,
    subject: "Withdrawal processed",
    html: wrapEmail(
      "Withdrawal processed",
      `Hi ${client.name}, your withdrawal of $${Number(amountUsd).toLocaleString()} has been sent.${
        txHash ? ` Transaction hash: <code>${txHash}</code>` : ""
      }`
    ),
  });
}

async function sendSubscriptionStartedEmail(client, tierName, amountUsd, endDate) {
  return sendEmail({
    to: client.email,
    subject: `${tierName} plan activated`,
    html: wrapEmail(
      `${tierName} plan activated`,
      `Hi ${client.name}, your ${tierName} plan is now active with $${Number(amountUsd).toLocaleString()} invested. It runs until ${new Date(
        endDate
      ).toLocaleDateString()}.`
    ),
  });
}

module.exports = {
  sendEmail,
  sendDepositConfirmedEmail,
  sendWithdrawalProcessedEmail,
  sendSubscriptionStartedEmail,
};
