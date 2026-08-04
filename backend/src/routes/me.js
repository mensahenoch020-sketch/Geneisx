const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { requireClientAuth } = require("../middleware/auth");
const { computeClientSummary, pnlSince, SUBSCRIPTION_FEE_DESTINATION } = require("../lib/ledger");
const { logClientAction } = require("../lib/audit");
const {
  SUBSCRIPTION_TIERS,
  findTier,
  addMonths,
  getActiveSubscription,
} = require("../lib/subscriptions");

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
      subscriptions: { orderBy: { endDate: "desc" } },
    },
  });
  if (!client) return res.status(404).json({ error: "Account not found" });

  const activeSubscription = getActiveSubscription(client.subscriptions);

  res.json({
    name: client.name,
    email: client.email,
    depositReference: client.depositReference,
    depositAddress: process.env.SHARED_DEPOSIT_ADDRESS || null,
    deposits: client.deposits,
    withdrawals: client.withdrawals,
    trades: client.trades,
    subscriptionTiers: SUBSCRIPTION_TIERS,
    activeSubscription,
    subscriptionHistory: client.subscriptions,
    ...computeClientSummary(client),
  });
});

const subscribeSchema = z.object({
  tierMonths: z.number().int(),
});

const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  contact: z.string().trim().max(200).optional(),
});

// POST /api/me/subscribe — client picks a tier; price is deducted from their
// current balance immediately (no separate BTC payment — see lib/subscriptions.js
// for why). Fails cleanly if balance is too low; never allows a negative balance.
router.post("/subscribe", async (req, res) => {
  const parsed = subscribeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request" });

  const tier = findTier(parsed.data.tierMonths);
  if (!tier) {
    return res.status(400).json({
      error: `tierMonths must be one of: ${SUBSCRIPTION_TIERS.map((t) => t.tierMonths).join(", ")}`,
    });
  }

  const client = await prisma.client.findUnique({
    where: { id: req.client.id },
    include: { deposits: true, withdrawals: true, trades: true },
  });
  if (!client) return res.status(404).json({ error: "Account not found" });

  const summary = computeClientSummary(client);
  if (summary.balance < tier.priceUsd) {
    return res.status(400).json({
      error: `Insufficient balance. This tier costs $${tier.priceUsd}, your current balance is $${summary.balance.toFixed(2)}.`,
    });
  }

  const now = new Date();
  const subscription = await prisma.$transaction(async (tx) => {
    const created = await tx.subscription.create({
      data: {
        clientId: client.id,
        tierMonths: tier.tierMonths,
        priceUsd: tier.priceUsd,
        startDate: now,
        endDate: addMonths(now, tier.tierMonths),
        createdBy: "client",
      },
    });
    // The subscription price is recorded as its own withdrawal-shaped ledger
    // entry so it shows up distinctly on statements — see statements.js, which
    // labels any withdrawal whose destination is "SUBSCRIPTION_FEE" accordingly,
    // rather than looking like a real BTC withdrawal to an external address.
    await tx.withdrawal.create({
      data: {
        clientId: client.id,
        amountUsd: tier.priceUsd,
        destination: SUBSCRIPTION_FEE_DESTINATION,
        status: "PROCESSED",
        requestedBy: "client",
        processedAt: now,
        processedBy: "client",
      },
    });
    return created;
  });

  await logClientAction({
    clientId: client.id,
    action: "subscription.started",
    targetId: subscription.id,
    detail: `${tier.tierMonths}mo tier, $${tier.priceUsd}`,
  });

  res.status(201).json({ subscription });
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

// PATCH /api/me/profile — client edits their own name/contact info.
// Email isn't editable here — it's the login identifier, tied to auth.
router.patch("/profile", async (req, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request" });

  const { name, contact } = parsed.data;
  if (name === undefined && contact === undefined) {
    return res.status(400).json({ error: "Nothing to update" });
  }

  const client = await prisma.client.update({
    where: { id: req.client.id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(contact !== undefined ? { contact } : {}),
    },
  });

  await logClientAction({
    clientId: client.id,
    action: "profile.updated",
    detail: [name !== undefined ? "name" : null, contact !== undefined ? "contact" : null]
      .filter(Boolean)
      .join(", "),
  });

  res.json({ name: client.name, contact: client.contact, email: client.email });
});

module.exports = router;
