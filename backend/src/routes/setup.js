// TEMPORARY, ONE-TIME SETUP ROUTE — creates the first Owner account without
// needing a computer/terminal. Guarded by SETUP_SECRET (an env var you set
// yourself) and self-disables the moment any Owner exists, so it can't be
// reused or abused once you're done with it.
//
// After you've used this once successfully:
//   1. Remove SETUP_SECRET from your Railway environment variables, AND
//   2. Delete this file and its require() line in index.js, then redeploy.
// Leaving this route reachable indefinitely — even with the secret required —
// is a bigger attack surface than the app needs long-term. It's meant to get
// you unblocked once, not to stay in the codebase.

const express = require("express");
const rateLimit = require("express-rate-limit");
const prisma = require("../lib/prisma");
const {
  hashPassword,
  verifyPassword,
  generateTotpSecret,
  totpKeyUri,
  totpQrCodeDataUrl,
  verifyTotp,
} = require("../lib/auth");

const router = express.Router();

// Deliberately tight — this endpoint creates a privileged account, so it
// gets a stricter limit than even the login endpoints.
const setupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: "Too many attempts. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /setup/create-owner?secret=...&email=...&name=...&password=...
// Visiting this URL directly in a phone browser is enough to trigger it —
// no app, no terminal, no request-building tool needed.
router.get("/create-owner", setupLimiter, async (req, res) => {
  const configuredSecret = process.env.SETUP_SECRET;
  if (!configuredSecret) {
    return res
      .status(503)
      .send("SETUP_SECRET is not set on this deployment. Add it in Railway's Variables tab, then reload this page.");
  }

  const { secret, email, name, password } = req.query;

  if (!secret || secret !== configuredSecret) {
    return res.status(403).send("Incorrect or missing setup secret.");
  }
  if (!email || !name || !password) {
    return res
      .status(400)
      .send(
        "Missing required fields. Visit this URL with all four query parameters filled in: " +
          "?secret=...&email=...&name=...&password=..."
      );
  }
  if (String(password).length < 10) {
    return res.status(400).send("Password must be at least 10 characters.");
  }

  const existingOwner = await prisma.user.findFirst({ where: { role: "OWNER" } });
  if (existingOwner) {
    return res
      .status(409)
      .send(
        "An Owner account already exists — this setup route only works once and is now disabled. " +
          "If you need to reset access, that requires direct database access, not this route."
      );
  }

  const existingEmail = await prisma.user.findUnique({ where: { email: String(email) } });
  if (existingEmail) {
    return res.status(409).send(`A staff account with email ${email} already exists.`);
  }

  const passwordHash = await hashPassword(String(password));
  const user = await prisma.user.create({
    data: { email: String(email), name: String(name), passwordHash, role: "OWNER" },
  });

  res.send(`
    <html>
      <body style="font-family: sans-serif; max-width: 600px; margin: 40px auto; line-height: 1.6;">
        <h2>Owner account created</h2>
        <p><strong>Email:</strong> ${user.email}</p>
        <p>Next, tap this link to start 2FA setup (do this now, on the same phone you'll use your
        authenticator app on):</p>
        <p>
          <a href="/setup/totp-start?secret=${encodeURIComponent(configuredSecret)}&email=${encodeURIComponent(user.email)}&password=${encodeURIComponent(String(password))}">
            Start 2FA setup →
          </a>
        </p>
      </body>
    </html>
  `);
});

// GET /setup/totp-start?secret=...&email=...&password=...
// Shows a QR code to scan with an authenticator app (Google Authenticator,
// Authy, etc.), then a link to the confirm step below.
router.get("/totp-start", setupLimiter, async (req, res) => {
  const configuredSecret = process.env.SETUP_SECRET;
  const { secret, email, password } = req.query;

  if (!configuredSecret || !secret || secret !== configuredSecret) {
    return res.status(403).send("Incorrect or missing setup secret.");
  }
  if (!email || !password) {
    return res.status(400).send("Missing email or password.");
  }

  const user = await prisma.user.findUnique({ where: { email: String(email) } });
  if (!user) return res.status(404).send("No account with that email.");

  const validPassword = await verifyPassword(String(password), user.passwordHash);
  if (!validPassword) return res.status(401).send("Incorrect password.");

  if (user.totpEnabled) {
    return res.send("2FA is already enabled on this account. You can log in normally now.");
  }

  const totpSecret = generateTotpSecret();
  const uri = totpKeyUri(user.email, totpSecret);
  const qr = await totpQrCodeDataUrl(uri);

  await prisma.user.update({ where: { id: user.id }, data: { totpSecret, totpEnabled: false } });

  res.send(`
    <html>
      <body style="font-family: sans-serif; max-width: 600px; margin: 40px auto; line-height: 1.6; text-align: center;">
        <h2>Scan this with your authenticator app</h2>
        <p>Google Authenticator, Authy, or any TOTP app will work.</p>
        <img src="${qr}" alt="2FA QR code" style="max-width: 260px;" />
        <p style="margin-top: 24px;">Once you've scanned it, enter the 6-digit code it shows you:</p>
        <form action="/setup/totp-confirm" method="get" style="display: flex; flex-direction: column; gap: 10px; align-items: center;">
          <input type="hidden" name="secret" value="${configuredSecret}" />
          <input type="hidden" name="email" value="${user.email}" />
          <input type="hidden" name="password" value="${password}" />
          <input type="text" name="token" placeholder="123456" inputmode="numeric" maxlength="6"
                 style="font-size: 20px; text-align: center; padding: 10px; width: 140px;" required />
          <button type="submit" style="font-size: 16px; padding: 10px 24px;">Confirm</button>
        </form>
      </body>
    </html>
  `);
});

// GET /setup/totp-confirm?secret=...&email=...&password=...&token=...
router.get("/totp-confirm", setupLimiter, async (req, res) => {
  const configuredSecret = process.env.SETUP_SECRET;
  const { secret, email, password, token } = req.query;

  if (!configuredSecret || !secret || secret !== configuredSecret) {
    return res.status(403).send("Incorrect or missing setup secret.");
  }
  if (!email || !password || !token) {
    return res.status(400).send("Missing email, password, or code.");
  }

  const user = await prisma.user.findUnique({ where: { email: String(email) } });
  if (!user) return res.status(404).send("No account with that email.");

  const validPassword = await verifyPassword(String(password), user.passwordHash);
  if (!validPassword) return res.status(401).send("Incorrect password.");

  if (user.totpEnabled) {
    return res.send("2FA is already enabled on this account. You can log in normally now.");
  }
  if (!user.totpSecret) {
    return res.status(400).send("No 2FA setup in progress — go back and tap 'Start 2FA setup' again.");
  }

  const valid = verifyTotp(String(token), user.totpSecret);
  if (!valid) return res.status(401).send("Incorrect code. Go back and try again with a fresh code.");

  await prisma.user.update({ where: { id: user.id }, data: { totpEnabled: true } });

  res.send(`
    <html>
      <body style="font-family: sans-serif; max-width: 600px; margin: 40px auto; line-height: 1.6;">
        <h2>2FA enabled — you're all set</h2>
        <p>Go to <code>/admin</code> and log in normally with your email, password, and the 6-digit code
        from your authenticator app.</p>
        <p><strong>Now remove this route:</strong> delete <code>SETUP_SECRET</code> from Railway's
        Variables tab, delete <code>backend/src/routes/setup.js</code>, remove its two lines in
        <code>index.js</code>, and redeploy. This setup route should not stay reachable long-term.</p>
      </body>
    </html>
  `);
});

module.exports = router;
