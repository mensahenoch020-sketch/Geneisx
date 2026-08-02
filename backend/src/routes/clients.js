const express = require("express");
const { z } = require("zod");
const crypto = require("crypto");
const prisma = require("../lib/prisma");
const { hashPassword } = require("../lib/auth");
const { requireStaffAuth } = require("../middleware/auth");
const { logAction } = require("../lib/audit");
const { computeClientSummary } = require("../lib/ledger");

const router = express.Router();
router.use(requireStaffAuth); // every route below requires a staff/owner session

const createClientSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  contact: z.string().optional(),
  walletRef: z.string().optional(),
});

// POST /api/clients — create a new client account. Staff or Owner can do this.
// Generates a temporary password the client must change on first login (Phase 3
// will add a proper "set your password" invite flow — for now this returns the
// temp password once, in the response, so you can relay it to the client securely
// yourself. It is never logged or stored in plaintext anywhere.)
router.post("/", async (req, res) => {
  const parsed = createClientSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const existing = await prisma.client.findUnique({ where: { email: parsed.data.email } });
  if (existing) return res.status(409).json({ error: "A client with this email already exists" });

  const tempPassword = crypto.randomBytes(9).toString("base64url"); // ~12 chars, url-safe
  const passwordHash = await hashPassword(tempPassword);

  const client = await prisma.client.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      contact: parsed.data.contact,
      walletRef: parsed.data.walletRef,
      passwordHash,
    },
  });

  await logAction({ userId: req.user.id, action: "client.created", targetId: client.id, detail: client.email });

  res.status(201).json({
    id: client.id,
    name: client.name,
    email: client.email,
    tempPassword, // shown once — relay this to the client through a secure channel, not email/SMS in plaintext
  });
});

// GET /api/clients — list all clients with summary balances
router.get("/", async (req, res) => {
  const clients = await prisma.client.findMany({
    include: { deposits: true, withdrawals: true, trades: true },
    orderBy: { createdAt: "desc" },
  });

  const summaries = clients.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    contact: c.contact,
    walletRef: c.walletRef,
    createdAt: c.createdAt,
    ...computeClientSummary(c),
  }));

  res.json(summaries);
});

// GET /api/clients/:id — full detail for one client, including transaction history
router.get("/:id", async (req, res) => {
  const client = await prisma.client.findUnique({
    where: { id: req.params.id },
    include: {
      deposits: { orderBy: { date: "desc" } },
      withdrawals: { orderBy: { requestedAt: "desc" } },
      trades: { orderBy: { date: "desc" } },
    },
  });
  if (!client) return res.status(404).json({ error: "Client not found" });

  res.json({
    id: client.id,
    name: client.name,
    email: client.email,
    contact: client.contact,
    walletRef: client.walletRef,
    createdAt: client.createdAt,
    deposits: client.deposits,
    withdrawals: client.withdrawals,
    trades: client.trades,
    ...computeClientSummary(client),
  });
});

module.exports = router;
