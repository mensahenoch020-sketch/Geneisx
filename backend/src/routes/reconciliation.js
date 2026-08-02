const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { requireStaffAuth } = require("../middleware/auth");
const { logAction } = require("../lib/audit");
const { computeClientSummary } = require("../lib/ledger");

const router = express.Router();
router.use(requireStaffAuth);

// GET /api/reconciliation/expected — total the ledger says you should be holding
// across all client accounts right now.
router.get("/expected", async (req, res) => {
  const clients = await prisma.client.findMany({
    include: { deposits: true, withdrawals: true, trades: true },
  });
  const expected = clients.reduce((sum, c) => sum + computeClientSummary(c).balance, 0);
  res.json({ expectedHoldingsUsd: expected, clientCount: clients.length });
});

const runCheckSchema = z.object({
  actualUsd: z.number(),
  note: z.string().optional(),
});

// POST /api/reconciliation/check — record a reconciliation check. This is a manual
// entry (you type in what the wallet/exchange actually shows) — it doesn't pull a
// live wallet balance automatically. Wiring a real block-explorer or exchange API
// integration is a good Phase 4/5 candidate once you've settled on final custody
// tooling, since that choice affects which API you'd integrate against.
router.post("/check", async (req, res) => {
  const parsed = runCheckSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const clients = await prisma.client.findMany({
    include: { deposits: true, withdrawals: true, trades: true },
  });
  const expected = clients.reduce((sum, c) => sum + computeClientSummary(c).balance, 0);
  const diff = parsed.data.actualUsd - expected;

  const record = await prisma.reconciliation.create({
    data: {
      expectedUsd: expected,
      actualUsd: parsed.data.actualUsd,
      diffUsd: diff,
      note: parsed.data.note,
      checkedBy: req.user.id,
    },
  });

  await logAction({
    userId: req.user.id,
    action: "reconciliation.checked",
    targetId: record.id,
    detail: `expected=${expected} actual=${parsed.data.actualUsd} diff=${diff}`,
  });

  res.status(201).json(record);
});

// GET /api/reconciliation/history
router.get("/history", async (req, res) => {
  const records = await prisma.reconciliation.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  res.json(records);
});

module.exports = router;
