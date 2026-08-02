const express = require("express");
const prisma = require("../lib/prisma");
const { requireClientAuth } = require("../middleware/auth");
const { computeClientSummary, pnlSince } = require("../lib/ledger");

const router = express.Router();
router.use(requireClientAuth);

// Every route below uses req.client.id from the verified token — never a param
// or query value — so a client can never request another client's data by
// guessing or editing an id in the URL.

// GET /api/me — account summary + full transaction history for the logged-in client.
router.get("/", async (req, res) => {
  const client = await prisma.client.findUnique({
    where: { id: req.client.id },
    include: {
      deposits: { orderBy: { date: "desc" } },
      withdrawals: { orderBy: { requestedAt: "desc" } },
      trades: { orderBy: { date: "desc" } },
    },
  });
  if (!client) return res.status(404).json({ error: "Account not found" });

  res.json({
    name: client.name,
    email: client.email,
    deposits: client.deposits,
    withdrawals: client.withdrawals,
    trades: client.trades,
    ...computeClientSummary(client),
  });
});

const RANGE_DAYS = { "7d": 7, "30d": 30, "90d": 90, "180d": 180, "365d": 365 };

// GET /api/me/performance?range=30d — P&L realized within the given window.
// Powers the 1W/1M/3M/6M/1Y toggle on the client dashboard.
router.get("/performance", async (req, res) => {
  const range = req.query.range;
  const days = RANGE_DAYS[range];
  if (!days) {
    return res.status(400).json({ error: `range must be one of: ${Object.keys(RANGE_DAYS).join(", ")}` });
  }

  const client = await prisma.client.findUnique({
    where: { id: req.client.id },
    include: { deposits: true, withdrawals: true, trades: true },
  });
  if (!client) return res.status(404).json({ error: "Account not found" });

  const summary = computeClientSummary(client);
  const rangePnl = pnlSince(client, days);

  res.json({
    range,
    rangePnl,
    rangeReturnPct: summary.totalDeposited ? (rangePnl / summary.totalDeposited) * 100 : 0,
    balance: summary.balance,
  });
});

module.exports = router;
