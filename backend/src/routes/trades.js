const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { requireStaffAuth } = require("../middleware/auth");
const { logAction } = require("../lib/audit");
const { canOpenNewTrades } = require("../lib/subscriptions");
const { tradePnL, PERFORMANCE_FEE_DESTINATION } = require("../lib/ledger");

// EDIT THIS to change the performance fee rate. Applied only to a single trade's
// profit at the moment it closes — never to a loss, and never to the client's
// deposited principal. $0 fee if the trade closes flat or at a loss.
const PERFORMANCE_FEE_RATE = 0.10;

const router = express.Router();
router.use(requireStaffAuth);

const createTradeSchema = z.object({
  clientId: z.string().min(1),
  asset: z.string().default("BTC"),
  side: z.enum(["LONG", "SHORT"]),
  size: z.number().positive(),
  entry: z.number().positive(),
  exit: z.number().positive().optional(), // omit to log an open trade
});

// POST /api/trades — log a new trade, open or already-closed. Staff or Owner can
// do this — trading itself isn't withdrawal-sensitive, so it's not Owner-gated.
// Blocked entirely once the client has no active subscription — see
// lib/subscriptions.js. This only blocks *new* trade records; closing an
// already-open trade (POST /:id/close below) is never blocked, since finishing
// something already in motion shouldn't be held hostage by a lapsed renewal.
router.post("/", async (req, res) => {
  const parsed = createTradeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const client = await prisma.client.findUnique({
    where: { id: parsed.data.clientId },
    include: { subscriptions: true },
  });
  if (!client) return res.status(404).json({ error: "Client not found" });

  if (!canOpenNewTrades(client.subscriptions)) {
    return res.status(409).json({
      error: "This client has no active trading subscription. Ask them to renew before logging new trades.",
    });
  }

  const closedAt = parsed.data.exit ? new Date() : null;
  const grossPnl = parsed.data.exit
    ? tradePnL({ status: "CLOSED", exit: parsed.data.exit, entry: parsed.data.entry, size: parsed.data.size, side: parsed.data.side })
    : null;
  const fee = grossPnl != null && grossPnl > 0 ? grossPnl * PERFORMANCE_FEE_RATE : 0;

  const result = await prisma.$transaction(async (tx) => {
    const trade = await tx.trade.create({
      data: {
        clientId: parsed.data.clientId,
        asset: parsed.data.asset,
        side: parsed.data.side,
        size: parsed.data.size,
        entry: parsed.data.entry,
        exit: parsed.data.exit ?? null,
        status: parsed.data.exit ? "CLOSED" : "OPEN",
        closedAt,
        loggedBy: req.user.id,
      },
    });

    if (fee > 0) {
      await tx.withdrawal.create({
        data: {
          clientId: parsed.data.clientId,
          amountUsd: fee,
          destination: PERFORMANCE_FEE_DESTINATION,
          status: "PROCESSED",
          requestedBy: req.user.id,
          processedAt: closedAt,
          processedBy: req.user.id,
        },
      });
    }

    return trade;
  });

  const trade = result;

  await logAction({
    userId: req.user.id,
    action: "trade.logged",
    targetId: trade.id,
    detail: `client=${client.id} ${trade.side} ${trade.size} ${trade.asset}${fee > 0 ? ` fee=${fee.toFixed(2)}` : ""}`,
  });

  res.status(201).json({ ...trade, performanceFee: fee });
});

const closeTradeSchema = z.object({ exit: z.number().positive() });

// POST /api/trades/:id/close — close an open trade with an exit price. If the
// trade closes in profit, a 10% performance fee is automatically recorded as
// its own withdrawal-shaped entry (see lib/ledger.js PERFORMANCE_FEE_DESTINATION)
// so it actually reduces the client's balance — not just a number shown
// somewhere. Both the trade-close and the fee record happen in one database
// transaction: a trade can never end up closed without its fee (if any) being
// correctly recorded, or vice versa. No fee is charged on a flat or losing trade.
router.post("/:id/close", async (req, res) => {
  const parsed = closeTradeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const trade = await prisma.trade.findUnique({ where: { id: req.params.id } });
  if (!trade) return res.status(404).json({ error: "Trade not found" });
  if (trade.status !== "OPEN") return res.status(409).json({ error: "Trade is already closed" });

  const closedAt = new Date();
  const provisional = { ...trade, exit: parsed.data.exit, status: "CLOSED" };
  const grossPnl = tradePnL(provisional) || 0;
  const fee = grossPnl > 0 ? grossPnl * PERFORMANCE_FEE_RATE : 0;

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.trade.update({
      where: { id: req.params.id },
      data: { exit: parsed.data.exit, status: "CLOSED", closedAt },
    });

    let feeWithdrawal = null;
    if (fee > 0) {
      feeWithdrawal = await tx.withdrawal.create({
        data: {
          clientId: trade.clientId,
          amountUsd: fee,
          destination: PERFORMANCE_FEE_DESTINATION,
          status: "PROCESSED",
          requestedBy: req.user.id,
          processedAt: closedAt,
          processedBy: req.user.id,
        },
      });
    }

    return { updated, feeWithdrawal };
  });

  await logAction({
    userId: req.user.id,
    action: "trade.closed",
    targetId: trade.id,
    detail: `exit=${parsed.data.exit} grossPnl=${grossPnl.toFixed(2)}${fee > 0 ? ` fee=${fee.toFixed(2)}` : ""}`,
  });

  res.json({ ...result.updated, performanceFee: fee });
});

module.exports = router;
