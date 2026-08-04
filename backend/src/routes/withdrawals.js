const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { requireStaffAuth, requireOwner } = require("../middleware/auth");
const { logAction } = require("../lib/audit");
const { isWithdrawalLocked } = require("../lib/subscriptions");

const router = express.Router();
router.use(requireStaffAuth);

const createWithdrawalSchema = z.object({
  clientId: z.string().min(1),
  amountUsd: z.number().positive(),
  destination: z.string().min(1, "Destination wallet address is required"),
});

// POST /api/withdrawals — create a PENDING withdrawal request. Any staff member
// can log that a client asked for money out — this does not move funds and does
// not require Owner privileges.
router.post("/", async (req, res) => {
  const parsed = createWithdrawalSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const client = await prisma.client.findUnique({
    where: { id: parsed.data.clientId },
    include: { subscriptions: true },
  });
  if (!client) return res.status(404).json({ error: "Client not found" });

  if (isWithdrawalLocked(client.subscriptions)) {
    return res.status(409).json({
      error: "This client has an active trading subscription and their funds are locked until it ends.",
    });
  }

  const withdrawal = await prisma.withdrawal.create({
    data: {
      clientId: parsed.data.clientId,
      amountUsd: parsed.data.amountUsd,
      destination: parsed.data.destination,
      requestedBy: req.user.id,
      status: "PENDING",
    },
  });

  await logAction({
    userId: req.user.id,
    action: "withdrawal.requested",
    targetId: withdrawal.id,
    detail: `client=${client.id} amount=${parsed.data.amountUsd}`,
  });

  res.status(201).json(withdrawal);
});

const processSchema = z.object({
  txHash: z.string().min(1, "Transaction hash is required to mark a withdrawal processed"),
});

// POST /api/withdrawals/:id/process — the money-moving step. Owner-only, 2FA already
// enforced at login for Owner accounts. Requires an outgoing tx hash as proof funds
// actually left the wallet — this is not a checkbox, it's evidence.
router.post("/:id/process", requireOwner, async (req, res) => {
  const parsed = processSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const withdrawal = await prisma.withdrawal.findUnique({ where: { id: req.params.id } });
  if (!withdrawal) return res.status(404).json({ error: "Withdrawal not found" });
  if (withdrawal.status !== "PENDING") {
    return res.status(409).json({ error: `Withdrawal is already ${withdrawal.status.toLowerCase()}` });
  }

  const updated = await prisma.withdrawal.update({
    where: { id: req.params.id },
    data: {
      status: "PROCESSED",
      processedAt: new Date(),
      processedBy: req.user.id,
      txHash: parsed.data.txHash,
    },
  });

  await logAction({
    userId: req.user.id,
    action: "withdrawal.processed",
    targetId: withdrawal.id,
    detail: `amount=${withdrawal.amountUsd} txHash=${parsed.data.txHash}`,
    clientId: withdrawal.clientId,
  });

  res.json(updated);
});

// POST /api/withdrawals/:id/cancel — Owner-only. For a pending request that shouldn't
// go out (client changed their mind, request was made in error, etc).
router.post("/:id/cancel", requireOwner, async (req, res) => {
  const withdrawal = await prisma.withdrawal.findUnique({ where: { id: req.params.id } });
  if (!withdrawal) return res.status(404).json({ error: "Withdrawal not found" });
  if (withdrawal.status !== "PENDING") {
    return res.status(409).json({ error: `Withdrawal is already ${withdrawal.status.toLowerCase()}` });
  }

  const updated = await prisma.withdrawal.update({
    where: { id: req.params.id },
    data: { status: "CANCELLED" },
  });

  await logAction({ userId: req.user.id, action: "withdrawal.cancelled", targetId: withdrawal.id });

  res.json(updated);
});

module.exports = router;
