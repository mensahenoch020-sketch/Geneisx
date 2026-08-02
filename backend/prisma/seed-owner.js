// Creates the first Owner account. Run once after your first deploy:
//   node prisma/seed-owner.js
//
// You'll be asked to set OWNER_EMAIL, OWNER_NAME, and OWNER_PASSWORD as env vars
// before running this — never hardcode real credentials into a file that might
// end up committed to git.

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  const email = process.env.OWNER_EMAIL;
  const name = process.env.OWNER_NAME;
  const password = process.env.OWNER_PASSWORD;

  if (!email || !name || !password) {
    console.error("Set OWNER_EMAIL, OWNER_NAME, and OWNER_PASSWORD env vars before running this script.");
    process.exit(1);
  }
  if (password.length < 10) {
    console.error("OWNER_PASSWORD must be at least 10 characters.");
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`A user with email ${email} already exists — nothing to do.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, name, passwordHash, role: "OWNER" },
  });

  console.log(`Owner account created: ${user.email} (id: ${user.id})`);
  console.log(`Next: log in via POST /auth/staff/login, then call POST /auth/staff/totp/setup`);
  console.log(`to enable 2FA — required before this account can log in again.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
