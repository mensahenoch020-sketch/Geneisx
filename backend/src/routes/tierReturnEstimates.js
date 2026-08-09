const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { requireOwner } = require("../middleware/auth");
const { logAction } = require("../lib/audit");
const asyncHandler = require("../lib/asyncHandler");
const { SUBSCRIPTION_TIERS } = require("../lib/subscriptions");

const router = express.Router();
router.use(requireOwner);

// GET /api/tier-return-estimates — every tier alongside its current text
// (null if never set), so the admin UI can show one editable field per tier
// even before any of them have been filled in.
router.get("/", asyncHandler(async (req, res) => {
  const estimates = await prisma.tierReturnEstimate.findMany();
  const byKey = Object.fromEntries(estimates.map((e) => [e.tierKey, e]));

  res.json({
    tiers: SUBSCRIPTION_TIERS.map((t) => ({
      key: t.key,
      name: t.name,
      minUsd: t.minUsd,
      maxUsd: t.maxUsd,
      tierMonths: t.tierMonths,
      returnEstimate: byKey[t.key]?.text || null,
      updatedAt: byKey[t.key]?.updatedAt || null,
    })),
  });
}));

const setSchema = z.object({
  text: z.string().trim().max(300).nullable(),
});

// PUT /api/tier-return-estimates/:tierKey — set or clear the text for one
// tier. Owner only, since this is a real claim shown to clients about what
// they might get back. Pass text: null to clear it (nothing shown on that
// tier's card).
router.put("/:tierKey", asyncHandler(async (req, res) => {
  const tier = SUBSCRIPTION_TIERS.find((t) => t.key === req.params.tierKey);
  if (!tier) return res.status(404).json({ error: "Unknown tier" });

  const parsed = setSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const text = parsed.data.text?.trim() || null;

  const updated = await prisma.tierReturnEstimate.upsert({
    where: { tierKey: tier.key },
    create: { tierKey: tier.key, text, updatedBy: req.user.id },
    update: { text, updatedBy: req.user.id },
  });

  await logAction({
    userId: req.user.id,
    action: "tier_return_estimate.set",
    targetId: tier.key,
    detail: text ? `"${text}"` : "(cleared)",
  });

  res.json({ tierKey: updated.tierKey, returnEstimate: updated.text });
}));

module.exports = router;
