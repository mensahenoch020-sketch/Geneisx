const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { authenticator } = require("otplib");
const qrcode = require("qrcode");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET env var is required — refusing to start without it.");
}

const SALT_ROUNDS = 12;

async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// Short-lived session tokens. `type` distinguishes staff/owner sessions from client sessions
// so a client token can never be used against staff-only routes, or vice versa.
function signToken(payload, expiresIn = "12h") {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

// TOTP (Google Authenticator-style) helpers for Owner 2FA.
function generateTotpSecret() {
  return authenticator.generateSecret();
}

function totpKeyUri(email, secret) {
  return authenticator.keyuri(email, "GenesisX", secret);
}

async function totpQrCodeDataUrl(otpAuthUri) {
  return qrcode.toDataURL(otpAuthUri);
}

function verifyTotp(token, secret) {
  return authenticator.verify({ token, secret });
}

module.exports = {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  generateTotpSecret,
  totpKeyUri,
  totpQrCodeDataUrl,
  verifyTotp,
};
