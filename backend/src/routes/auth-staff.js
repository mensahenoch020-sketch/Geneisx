const express = require("express");
const { z } = require("zod");
const rateLimit = require("express-rate-limit");
const prisma = require("../lib/prisma");
const {
  verifyPassword,
  signToken,
  generateTotpSecret,
  totpKeyUri,
  totpQrCodeDataUrl,
  verifyTotp,
} = require("../lib/auth");
const { requireStaffAuth, requireOwner } = require("../middleware/auth");
const { logAction } = require("../lib/audit");

const router = express.Router();

// Login attempts are rate-limited hard — this endpoint guards access to a system
// that can move client Bitcoin, so brute-forcing it needs to be slow and noisy.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: { error: "Too many login attempts. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totpToken: z.string().optional(), // required only if the account has 2FA enabled
});

// POST /auth/staff/login
router.post("/login", loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request" });
  const { email, password, totpToken } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  // Deliberately vague error message — don't reveal whether the email exists.
  if (!user) return res.status(401).json({ error: "Invalid email or password" });

  const validPassword = await verifyPassword(password, user.passwordHash);
  if (!validPassword) return res.status(401).json({ error: "Invalid email or password" });

  // Owners MUST have 2FA enabled and pass it at login — no bypass, no exceptions.
  // This is the one control standing between a compromised password and a real
  // client withdrawal being processed.
  if (user.role === "OWNER") {
    if (!user.totpEnabled) {
      return res.status(403).json({
        error: "2FA setup required before Owner login is allowed",
        code: "TOTP_SETUP_REQUIRED",
      });
    }
    if (!totpToken) {
      return res.status(401).json({ error: "2FA code required", code: "TOTP_REQUIRED" });
    }
    const valid = verifyTotp(totpToken, user.totpSecret);
    if (!valid) return res.status(401).json({ error: "Invalid 2FA code" });
  }

  const token = signToken({ id: user.id, role: user.role, email: user.email, type: "staff" });
  await logAction({ userId: user.id, action: "auth.login" });

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

// POST /auth/staff/totp/setup  — begin 2FA enrollment (Owner-only in practice, but
// any staff member is allowed to enable it voluntarily for their own account).
router.post("/totp/setup", requireStaffAuth, async (req, res) => {
  const secret = generateTotpSecret();
  const uri = totpKeyUri(req.user.email, secret);
  const qr = await totpQrCodeDataUrl(uri);

  // Store the secret but don't mark totpEnabled yet — that happens only after
  // the user proves they can generate a valid code with it.
  await prisma.user.update({
    where: { id: req.user.id },
    data: { totpSecret: secret, totpEnabled: false },
  });

  res.json({ qrCodeDataUrl: qr, secret });
});

const bootstrapSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /auth/staff/totp/bootstrap-setup — one-time path for a freshly seeded Owner
// account that has no 2FA yet and therefore can't get a normal session token.
// Authenticates with email+password only (no token needed), but ONLY works for
// accounts where totpEnabled is still false — once 2FA is confirmed via
// /totp/verify, this route refuses to touch that account again.
router.post("/totp/bootstrap-setup", loginLimiter, async (req, res) => {
  const parsed = bootstrapSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request" });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) return res.status(401).json({ error: "Invalid email or password" });

  const validPassword = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!validPassword) return res.status(401).json({ error: "Invalid email or password" });

  if (user.totpEnabled) {
    return res.status(403).json({ error: "2FA is already enabled on this account — use normal login." });
  }

  const secret = generateTotpSecret();
  const uri = totpKeyUri(user.email, secret);
  const qr = await totpQrCodeDataUrl(uri);

  await prisma.user.update({ where: { id: user.id }, data: { totpSecret: secret, totpEnabled: false } });

  res.json({ qrCodeDataUrl: qr, secret, userId: user.id });
});

// POST /auth/staff/totp/bootstrap-verify — confirms the bootstrap enrollment above,
// same email+password re-check, no session token required. After this succeeds,
// totpEnabled flips to true and bootstrap-setup refuses to run again for this account.
router.post("/totp/bootstrap-verify", loginLimiter, async (req, res) => {
  const parsed = z
    .object({ email: z.string().email(), password: z.string().min(1), token: z.string().min(6).max(6) })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request" });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) return res.status(401).json({ error: "Invalid email or password" });

  const validPassword = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!validPassword) return res.status(401).json({ error: "Invalid email or password" });

  if (user.totpEnabled) {
    return res.status(403).json({ error: "2FA is already enabled on this account." });
  }
  if (!user.totpSecret) {
    return res.status(400).json({ error: "No 2FA setup in progress — call bootstrap-setup first." });
  }

  const valid = verifyTotp(parsed.data.token, user.totpSecret);
  if (!valid) return res.status(401).json({ error: "Invalid code" });

  await prisma.user.update({ where: { id: user.id }, data: { totpEnabled: true } });
  await logAction({ userId: user.id, action: "auth.totp_enabled_via_bootstrap" });

  res.json({ ok: true, message: "2FA enabled. Use normal /auth/staff/login from now on." });
});

const totpVerifySchema = z.object({ token: z.string().min(6).max(6) });

// POST /auth/staff/totp/verify — confirm enrollment
router.post("/totp/verify", requireStaffAuth, async (req, res) => {
  const parsed = totpVerifySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid code format" });

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user.totpSecret) return res.status(400).json({ error: "No 2FA setup in progress" });

  const valid = verifyTotp(parsed.data.token, user.totpSecret);
  if (!valid) return res.status(401).json({ error: "Invalid code" });

  await prisma.user.update({ where: { id: user.id }, data: { totpEnabled: true } });
  await logAction({ userId: user.id, action: "auth.totp_enabled" });

  res.json({ ok: true });
});

const createStaffSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(10, "Password must be at least 10 characters"),
  role: z.enum(["OWNER", "STAFF"]),
});

// POST /auth/staff/create — Owner-only, creates additional staff/owner accounts.
router.post("/create", requireStaffAuth, requireOwner, async (req, res) => {
  const parsed = createStaffSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { hashPassword } = require("../lib/auth");
  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return res.status(409).json({ error: "An account with this email already exists" });

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await prisma.user.create({
    data: { email: parsed.data.email, name: parsed.data.name, passwordHash, role: parsed.data.role },
  });

  await logAction({ userId: req.user.id, action: "staff.created", targetId: user.id, detail: `role=${user.role}` });

  res.status(201).json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

module.exports = router;
