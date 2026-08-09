const express = require("express");
const prisma = require("../lib/prisma");
const asyncHandler = require("../lib/asyncHandler");

const router = express.Router();

// GET /api/public-stats — real, live-computed numbers for the landing page
// (total clients, total processed deposit volume, total closed trades).
// Deliberately public/no-auth (nothing sensitive — aggregate counts only,
// no client names or amounts) and deliberately NOT hardcoded marketing
// copy — every number here is a real COUNT/SUM query against the actual
// database, so it can never drift out of sync with reality the way a
// manually-typed "$19B+" claim could.
router.get("/", asyncHandler(async (req, res) => {
  const [clientCount, depositAgg, tradeCount] = await Promise.all([
    prisma.client.count(),
    prisma.deposit.aggregate({ _sum: { amountUsd: true } }),
    prisma.trade.count({ where: { status: "CLOSED" } }),
  ]);

  res.json({
    clientCount,
    totalDepositedUsd: Number(depositAgg._sum.amountUsd || 0),
    closedTradeCount: tradeCount,
  });
}));

module.exports = router;
