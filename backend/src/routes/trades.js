const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { requireStaffAuth } = require("../middleware/auth");
const { logAction } = require("../lib/audit");

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

// POST /api/trades — log a trade, open or already-closed. Staff or Owner can do this —
// trading itself isn't withdrawal-sensitive, so it's not Owner-gated.
router.post("/", async (req, res) => {
  const parsed = createTradeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const client = await prisma.client.findUnique({ where: { id: parsed.data.clientId } });
  if (!client) return res.status(404).json({ error: "Client not found" });

  const trade = await prisma.trade.create({
    data: {
      clientId: parsed.data.clientId,
      asset: parsed.data.asset,
      side: parsed.data.side,
      size: parsed.data.size,
      entry: parsed.data.entry,
      exit: parsed.data.exit ?? null,
      status: parsed.data.exit ? "CLOSED" : "OPEN",
      closedAt: parsed.data.exit ? new Date() : null,
      loggedBy: req.user.id,
    },
  });

  await logAction({
    userId: req.user.id,
    action: "trade.logged",
    targetId: trade.id,
    detail: `client=${client.id} ${trade.side} ${trade.size} ${trade.asset}`,
  });

  res.status(201).json(trade);
});

const closeTradeSchema = z.object({ exit: z.number().positive() });

// POST /api/trades/:id/close — close an open trade with an exit price.
router.post("/:id/close", async (req, res) => {
  const parsed = closeTradeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const trade = await prisma.trade.findUnique({ where: { id: req.params.id } });
  if (!trade) return res.status(404).json({ error: "Trade not found" });
  if (trade.status !== "OPEN") return res.status(409).json({ error: "Trade is already closed" });

  const updated = await prisma.trade.update({
    where: { id: req.params.id },
    data: { exit: parsed.data.exit, status: "CLOSED", closedAt: new Date() },
  });

  await logAction({ userId: req.user.id, action: "trade.closed", targetId: trade.id, detail: `exit=${parsed.data.exit}` });

  res.json(updated);
});

module.exports = router;
