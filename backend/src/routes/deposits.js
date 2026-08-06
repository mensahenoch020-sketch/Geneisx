const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { requireStaffAuth } = require("../middleware/auth");
const { logAction } = require("../lib/audit");
const { sendDepositConfirmedEmail } = require("../lib/email");

const router = express.Router();
router.use(requireStaffAuth);

const createDepositSchema = z.object({
  clientId: z.string().min(1),
  amountUsd: z.number().positive(),
  txHash: z.string().min(1, "Transaction hash is required — deposits can't be logged without on-chain proof"),
});

// POST /api/deposits — log a deposit. Requires proof (tx hash) every time, no exceptions.
// This is deliberately not optional at the schema level, not just a UI nudge —
// a deposit record without proof is just an assertion, and assertions aren't
// what you want your client balances built on.
router.post("/", async (req, res) => {
  const parsed = createDepositSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const client = await prisma.client.findUnique({ where: { id: parsed.data.clientId } });
  if (!client) return res.status(404).json({ error: "Client not found" });

  const deposit = await prisma.deposit.create({
    data: {
      clientId: parsed.data.clientId,
      amountUsd: parsed.data.amountUsd,
      txHash: parsed.data.txHash,
      loggedBy: req.user.id,
    },
  });

  await logAction({
    userId: req.user.id,
    action: "deposit.logged",
    targetId: deposit.id,
    detail: `client=${client.id} amount=${parsed.data.amountUsd}`,
    clientId: client.id,
  });

  // Best-effort — never blocks the response if email sending fails or isn't
  // configured (see lib/email.js).
  sendDepositConfirmedEmail(client, parsed.data.amountUsd).catch(() => {});

  res.status(201).json(deposit);
});

module.exports = router;
