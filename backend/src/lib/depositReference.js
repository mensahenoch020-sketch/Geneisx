const crypto = require("crypto");
const prisma = require("./prisma");

/**
 * Generates a short, human-typeable deposit reference code (e.g. "GX-7K3F9Q").
 * Clients include this when notifying staff of a deposit, so staff can match
 * an incoming payment on the shared deposit address to the right account.
 * Retries on the rare collision since it's stored as a unique column.
 */
async function generateUniqueDepositReference() {
  const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — avoids read-aloud ambiguity
  for (let attempt = 0; attempt < 10; attempt++) {
    let code = "GX-";
    const bytes = crypto.randomBytes(6);
    for (let i = 0; i < 6; i++) {
      code += ALPHABET[bytes[i] % ALPHABET.length];
    }
    const existing = await prisma.client.findUnique({ where: { depositReference: code } });
    if (!existing) return code;
  }
  throw new Error("Could not generate a unique deposit reference — try again");
}

module.exports = { generateUniqueDepositReference };
