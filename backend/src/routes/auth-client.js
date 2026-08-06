const express = require("express");
const { z } = require("zod");
const rateLimit = require("express-rate-limit");
const prisma = require("../lib/prisma");
const {
  verifyPassword,
  hashPassword,
  signToken,
  generateTotpSecret,
  totpKeyUri,
  totpQrCodeDataUrl,
  verifyTotp,
} = require("../lib/auth");
const { requireClientAuth } = require("../middleware/auth");
const { logClientAction } = require("../lib/audit");
const { generateUniqueDepositReference } = require("../lib/depositReference");

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: { error: "Too many login attempts. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Signup is public (no auth required to call it), so it needs its own tight
// limiter — otherwise it's an easy way to mass-create accounts or hammer the
// unique-email check. Deliberately stricter than login.
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: "Too many signup attempts from this network. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const signupSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email(),
  password: z.string().min(10, "Password must be at least 10 characters"),
  contact: z.string().max(200).optional(),
});

// POST /auth/client/signup — public self-signup. No staff involved. Creates the
// account, generates a unique deposit reference code (see lib/depositReference.js),
// and logs the client straight in. There is no wallet address generated per client
// here — deposits go to one shared address (see GET /api/me for how it's returned),
// and the deposit reference is how a client identifies which deposit is theirs when
// they notify staff. Staff still verify every deposit against the chain before it's
// logged — self-signup only removes the account-creation step, not deposit trust.
router.post("/signup", signupLimiter, async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const existing = await prisma.client.findUnique({ where: { email: parsed.data.email } });
  if (existing) return res.status(409).json({ error: "An account with this email already exists" });

  const passwordHash = await hashPassword(parsed.data.password);
  const depositReference = await generateUniqueDepositReference();

  const client = await prisma.client.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      contact: parsed.data.contact,
      passwordHash,
      mustChangePassword: false, // they just chose their own password — no forced change needed
      depositReference,
    },
  });

  // Not tied to a staff user — logged with no userId/clientId actor other than
  // the new client itself, recorded via logClientAction for consistency with
  // other client-initiated actions.
  await logClientAction({ clientId: client.id, action: "client.signup", targetId: client.id });

  const token = signToken({ id: client.id, email: client.email, type: "client" }, "24h");

  res.status(201).json({
    token,
    client: { id: client.id, name: client.name, email: client.email },
    mustChangePassword: false,
  });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totpToken: z.string().optional(), // required only if the client has 2FA enabled
});

// POST /auth/client/login
router.post("/login", loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request" });
  const { email, password, totpToken } = parsed.data;

  const client = await prisma.client.findUnique({ where: { email } });
  if (!client) return res.status(401).json({ error: "Invalid email or password" });

  const validPassword = await verifyPassword(password, client.passwordHash);
  if (!validPassword) return res.status(401).json({ error: "Invalid email or password" });

  // 2FA is opt-in for clients (unlike Owner, where it's mandatory) — only
  // enforced if this specific client has turned it on for their own account.
  if (client.totpEnabled) {
    if (!totpToken) {
      return res.status(401).json({ error: "2FA code required", code: "TOTP_REQUIRED" });
    }
    const valid = verifyTotp(totpToken, client.totpSecret);
    if (!valid) return res.status(401).json({ error: "Invalid 2FA code" });
  }

  // Client tokens are typed "client" and carry only their own id — never a role,
  // never access to any other client's data. Routes must still re-check this
  // server-side on every query, not just trust the token shape.
  const token = signToken({ id: client.id, email: client.email, type: "client" }, "24h");

  res.json({
    token,
    client: { id: client.id, name: client.name, email: client.email },
    mustChangePassword: client.mustChangePassword,
  });
});

// POST /auth/client/totp/setup — begin 2FA enrollment. Stores the secret but
// doesn't mark totpEnabled until /totp/verify proves the client can generate
// a valid code with it (same two-step pattern as staff 2FA).
router.post("/totp/setup", requireClientAuth, async (req, res) => {
  const secret = generateTotpSecret();
  const uri = totpKeyUri(req.client.email, secret);
  const qr = await totpQrCodeDataUrl(uri);

  await prisma.client.update({
    where: { id: req.client.id },
    data: { totpSecret: secret, totpEnabled: false },
  });

  res.json({ qrCodeDataUrl: qr, secret });
});

const totpVerifySchema = z.object({ token: z.string().min(6).max(6) });

// POST /auth/client/totp/verify — confirm enrollment; flips totpEnabled to true.
router.post("/totp/verify", requireClientAuth, async (req, res) => {
  const parsed = totpVerifySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Enter the 6-digit code" });

  const client = await prisma.client.findUnique({ where: { id: req.client.id } });
  if (!client.totpSecret) return res.status(400).json({ error: "No 2FA setup in progress" });

  const valid = verifyTotp(parsed.data.token, client.totpSecret);
  if (!valid) return res.status(401).json({ error: "Invalid code — try again" });

  await prisma.client.update({ where: { id: client.id }, data: { totpEnabled: true } });
  await logClientAction({ clientId: client.id, action: "client.totp_enabled", targetId: client.id });

  res.json({ ok: true });
});

const totpDisableSchema = z.object({ password: z.string().min(1) });

// POST /auth/client/totp/disable — requires re-entering the current password,
// since turning off 2FA is a security-lowering action.
router.post("/totp/disable", requireClientAuth, async (req, res) => {
  const parsed = totpDisableSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Password is required" });

  const client = await prisma.client.findUnique({ where: { id: req.client.id } });
  const validPassword = await verifyPassword(parsed.data.password, client.passwordHash);
  if (!validPassword) return res.status(401).json({ error: "Incorrect password" });

  await prisma.client.update({
    where: { id: client.id },
    data: { totpSecret: null, totpEnabled: false },
  });
  await logClientAction({ clientId: client.id, action: "client.totp_disabled", targetId: client.id });

  res.json({ ok: true });
});

const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: { error: "Too many attempts. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(10, "New password must be at least 10 characters"),
});

// POST /auth/client/change-password — required after first login with a staff-issued
// temp password, and available any time after. Always re-verifies the current
// password server-side; never trust the client to only call this when it should.
router.post("/change-password", requireClientAuth, changePasswordLimiter, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const client = await prisma.client.findUnique({ where: { id: req.client.id } });
  if (!client) return res.status(404).json({ error: "Account not found" });

  const validCurrent = await verifyPassword(parsed.data.currentPassword, client.passwordHash);
  if (!validCurrent) return res.status(401).json({ error: "Current password is incorrect" });

  const newHash = await hashPassword(parsed.data.newPassword);
  await prisma.client.update({
    where: { id: client.id },
    data: { passwordHash: newHash, mustChangePassword: false },
  });

  await logClientAction({ clientId: client.id, action: "client.password_changed", targetId: client.id });

  res.json({ ok: true });
});

module.exports = router;
