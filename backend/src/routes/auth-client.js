const express = require("express");
const { z } = require("zod");
const rateLimit = require("express-rate-limit");
const prisma = require("../lib/prisma");
const { verifyPassword, signToken } = require("../lib/auth");

const router = express.Router();

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
});

// POST /auth/client/login
router.post("/login", loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request" });
  const { email, password } = parsed.data;

  const client = await prisma.client.findUnique({ where: { email } });
  if (!client) return res.status(401).json({ error: "Invalid email or password" });

  const validPassword = await verifyPassword(password, client.passwordHash);
  if (!validPassword) return res.status(401).json({ error: "Invalid email or password" });

  // Client tokens are typed "client" and carry only their own id — never a role,
  // never access to any other client's data. Routes must still re-check this
  // server-side on every query, not just trust the token shape.
  const token = signToken({ id: client.id, email: client.email, type: "client" }, "24h");

  res.json({ token, client: { id: client.id, name: client.name, email: client.email } });
});

module.exports = router;
