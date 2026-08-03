const express = require("express");
const { z } = require("zod");
const crypto = require("crypto");
const prisma = require("../lib/prisma");
const { hashPassword } = require("../lib/auth");
const { requireStaffAuth } = require("../middleware/auth");
const { logAction } = require("../lib/audit");
const { computeClientSummary, SUBSCRIPTION_FEE_DESTINATION, PERFORMANCE_FEE_DESTINATION } = require("../lib/ledger");
const { generateUniqueDepositReference } = require("../lib/depositReference");
const { getActiveSubscription } = require("../lib/subscriptions");

const router = express.Router();
router.use(requireStaffAuth); // every route below requires a staff/owner session

const createClientSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  contact: z.string().optional(),
  walletRef: z.string().optional(),
});

// POST /api/clients — create a new client account. Staff or Owner can do this.
// This is a fallback path alongside client self-signup (POST /auth/client/signup) —
// useful for onboarding a client who isn't comfortable signing up themselves, or
// migrating an existing relationship into the system. Generates a temporary
// password the client must change on first login.
router.post("/", async (req, res) => {
  const parsed = createClientSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const existing = await prisma.client.findUnique({ where: { email: parsed.data.email } });
  if (existing) return res.status(409).json({ error: "A client with this email already exists" });

  const tempPassword = crypto.randomBytes(9).toString("base64url"); // ~12 chars, url-safe
  const passwordHash = await hashPassword(tempPassword);
  const depositReference = await generateUniqueDepositReference();

  const client = await prisma.client.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      contact: parsed.data.contact,
      walletRef: parsed.data.walletRef,
      passwordHash,
      mustChangePassword: true,
      depositReference,
    },
  });

  await logAction({ userId: req.user.id, action: "client.created", targetId: client.id, detail: client.email });

  res.status(201).json({
    id: client.id,
    name: client.name,
    email: client.email,
    depositReference: client.depositReference,
    tempPassword, // shown once — relay this to the client through a secure channel, not email/SMS in plaintext
  });
});

// GET /api/clients — list all clients with summary balances
router.get("/", async (req, res) => {
  const clients = await prisma.client.findMany({
    include: { deposits: true, withdrawals: true, trades: true, subscriptions: true },
    orderBy: { createdAt: "desc" },
  });

  const summaries = clients.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    contact: c.contact,
    walletRef: c.walletRef,
    depositReference: c.depositReference,
    createdAt: c.createdAt,
    activeSubscription: getActiveSubscription(c.subscriptions),
    ...computeClientSummary(c),
  }));

  res.json(summaries);
});

// GET /api/clients/by-reference/:code — quick lookup for staff matching an
// incoming deposit to a client from the reference code the client provided.
// Mounted before /:id below so "by-reference" isn't swallowed as an id lookup.
router.get("/by-reference/:code", async (req, res) => {
  const client = await prisma.client.findUnique({
    where: { depositReference: req.params.code.toUpperCase() },
  });
  if (!client) return res.status(404).json({ error: "No client found with that deposit reference" });
  res.json({ id: client.id, name: client.name, email: client.email, depositReference: client.depositReference });
});

// GET /api/clients/revenue/summary — total fees earned across all clients,
// broken into subscription revenue vs performance-fee revenue. Mounted before
// /:id below for the same reason as by-reference — otherwise "revenue" would
// be swallowed as a client id lookup.
router.get("/revenue/summary", async (req, res) => {
  const withdrawals = await prisma.withdrawal.findMany({
    where: {
      status: "PROCESSED",
      destination: { in: [SUBSCRIPTION_FEE_DESTINATION, PERFORMANCE_FEE_DESTINATION] },
    },
  });

  let subscriptionRevenue = 0;
  let performanceFeeRevenue = 0;
  for (const w of withdrawals) {
    const amount = Number(w.amountUsd);
    if (w.destination === SUBSCRIPTION_FEE_DESTINATION) subscriptionRevenue += amount;
    else performanceFeeRevenue += amount;
  }

  res.json({
    subscriptionRevenue,
    performanceFeeRevenue,
    totalRevenue: subscriptionRevenue + performanceFeeRevenue,
  });
});

// GET /api/clients/:id — full detail for one client, including transaction history
router.get("/:id", async (req, res) => {
  const client = await prisma.client.findUnique({
    where: { id: req.params.id },
    include: {
      deposits: { orderBy: { date: "desc" } },
      withdrawals: { orderBy: { requestedAt: "desc" } },
      trades: { orderBy: { date: "desc" } },
      subscriptions: { orderBy: { endDate: "desc" } },
    },
  });
  if (!client) return res.status(404).json({ error: "Client not found" });

  res.json({
    id: client.id,
    name: client.name,
    email: client.email,
    contact: client.contact,
    walletRef: client.walletRef,
    depositReference: client.depositReference,
    createdAt: client.createdAt,
    deposits: client.deposits,
    withdrawals: client.withdrawals,
    trades: client.trades,
    activeSubscription: getActiveSubscription(client.subscriptions),
    subscriptionHistory: client.subscriptions,
    ...computeClientSummary(client),
  });
});

module.exports = router;
