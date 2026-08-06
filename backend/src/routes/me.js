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
  isWithdrawalLocked,
} = require("../lib/subscriptions");
const { getDepositWallets } = require("../lib/depositWallets");
const { sendSubscriptionStartedEmail } = require("../lib/email");

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
    depositWallets: getDepositWallets(),
    totpEnabled: client.totpEnabled,
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
  tierKey: z.string().min(1),
  amountUsd: z.number().positive(),
});

const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  contact: z.string().trim().max(200).optional(),
});

// POST /api/me/subscribe — client picks a tier and an exact amount within
// that tier's [minUsd, maxUsd] range; the amount is deducted from their
// current balance immediately (no separate BTC payment — see
// lib/subscriptions.js for why). Fails cleanly if the amount is out of
// range for the tier or balance is too low; never allows a negative balance.
router.post("/subscribe", async (req, res) => {
  const parsed = subscribeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request" });

  const { tierKey, amountUsd } = parsed.data;
  const tier = findTier(tierKey);
  if (!tier) {
    return res.status(400).json({
      error: `tierKey must be one of: ${SUBSCRIPTION_TIERS.map((t) => t.key).join(", ")}`,
    });
  }
  if (amountUsd < tier.minUsd || amountUsd > tier.maxUsd) {
    return res.status(400).json({
      error: `${tier.name} accepts amounts between $${tier.minUsd} and $${tier.maxUsd}.`,
    });
  }

  const client = await prisma.client.findUnique({
    where: { id: req.client.id },
    include: { deposits: true, withdrawals: true, trades: true },
  });
  if (!client) return res.status(404).json({ error: "Account not found" });

  const summary = computeClientSummary(client);
  if (summary.balance < amountUsd) {
    return res.status(400).json({
      error: `Insufficient balance. You chose $${amountUsd}, your current balance is $${summary.balance.toFixed(2)}.`,
    });
  }

  const now = new Date();
  const subscription = await prisma.$transaction(async (tx) => {
    const created = await tx.subscription.create({
      data: {
        clientId: client.id,
        tierMonths: tier.tierMonths,
        priceUsd: amountUsd,
        startDate: now,
        endDate: addMonths(now, tier.tierMonths),
        createdBy: "client",
      },
    });
    // The invested amount is recorded as its own withdrawal-shaped ledger
    // entry so it shows up distinctly on statements — see statements.js, which
    // labels any withdrawal whose destination is "SUBSCRIPTION_FEE" accordingly,
    // rather than looking like a real BTC withdrawal to an external address.
    await tx.withdrawal.create({
      data: {
        clientId: client.id,
        amountUsd,
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
    detail: `${tier.name} (${tier.tierMonths}mo), $${amountUsd}`,
  });

  // Best-effort — never blocks the response (see lib/email.js).
  sendSubscriptionStartedEmail(client, tier.name, amountUsd, subscription.endDate).catch(() => {});

  res.status(201).json({ subscription });
});

const withdrawSchema = z.object({
  amountUsd: z.number().positive(),
  destination: z.string().trim().min(6, "Enter a valid destination wallet address"),
});

// POST /api/me/withdraw — client requests money out. This only creates a
// PENDING withdrawal for staff to review and actually send — it never moves
// funds itself. Blocked while an active subscription has the balance locked,
// and blocked if the requested amount exceeds the current balance.
router.post("/withdraw", async (req, res) => {
  const parsed = withdrawSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const client = await prisma.client.findUnique({
    where: { id: req.client.id },
    include: { deposits: true, withdrawals: true, trades: true, subscriptions: true },
  });
  if (!client) return res.status(404).json({ error: "Account not found" });

  if (isWithdrawalLocked(client.subscriptions)) {
    return res.status(409).json({
      error: "Your funds are locked while a trading plan is active. Withdrawals reopen once it ends.",
    });
  }

  const { amountUsd, destination } = parsed.data;
  const summary = computeClientSummary(client);
  if (amountUsd > summary.balance) {
    return res.status(400).json({
      error: `You requested $${amountUsd}, but your current balance is $${summary.balance.toFixed(2)}.`,
    });
  }

  const withdrawal = await prisma.withdrawal.create({
    data: {
      clientId: client.id,
      amountUsd,
      destination,
      requestedBy: "client",
      status: "PENDING",
    },
  });

  await logClientAction({
    clientId: client.id,
    action: "withdrawal.requested",
    targetId: withdrawal.id,
    detail: `amount=${amountUsd} destination=${destination}`,
  });

  res.status(201).json({ withdrawal });
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
