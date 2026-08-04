const express = require("express");
const prisma = require("../lib/prisma");
const { requireClientAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireClientAuth);

// Notifications are derived from AuditLog rather than a separate table —
// every event worth notifying a client about (deposit logged, verification
// reviewed, subscription started, withdrawal processed, password changed)
// is already recorded there. This route just reads and reshapes it. See
// lib/audit-additions.js in this patch for the clientId tagging this relies on.

const ACTION_LABELS = {
  "deposit.logged": (log) => ({
    title: "Deposit confirmed",
    body: log.detail ? `Your deposit has been credited.` : "A deposit has been credited to your account.",
    kind: "deposit",
  }),
  "verification.approved": () => ({
    title: "Identity verified",
    body: "Your identity document was reviewed and approved.",
    kind: "verification",
  }),
  "verification.rejected": (log) => ({
    title: "Verification needs another look",
    body: log.detail ? `Your document was not approved: ${log.detail}` : "Your document was not approved. You can resubmit.",
    kind: "verification",
  }),
  "withdrawal.processed": () => ({
    title: "Withdrawal processed",
    body: "Your withdrawal has been sent.",
    kind: "withdrawal",
  }),
  "subscription.started": (log) => ({
    title: "Subscription active",
    body: log.detail ? `Your subscription is active: ${log.detail}` : "Your subscription is now active.",
    kind: "subscription",
  }),
  "client.password_changed": () => ({
    title: "Password changed",
    body: "Your password was changed successfully.",
    kind: "account",
  }),
};

// GET /api/notifications — recent notification-worthy events for the logged-in client.
router.get("/", async (req, res) => {
  const logs = await prisma.auditLog.findMany({
    where: {
      clientId: req.client.id,
      action: { in: Object.keys(ACTION_LABELS) },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const notifications = logs.map((log) => {
    const shape = ACTION_LABELS[log.action](log);
    return {
      id: log.id,
      action: log.action,
      createdAt: log.createdAt,
      ...shape,
    };
  });

  res.json({ notifications });
});

module.exports = router;
