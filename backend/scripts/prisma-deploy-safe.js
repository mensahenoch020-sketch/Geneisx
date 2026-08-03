#!/usr/bin/env node
/**
 * `prisma migrate deploy` is a no-op if no migrations have ever been generated
 * and committed — it will exit 0 without creating a single table, which would
 * otherwise fail silently on a brand new database. This wrapper checks whether
 * a migrations directory exists and falls back to `prisma db push` (schema sync,
 * no migration history) if not, so a fresh deploy actually gets a working schema.
 *
 * Once you've run `npx prisma migrate dev --name init` locally against a real
 * Postgres instance and committed the resulting prisma/migrations folder, this
 * script will automatically prefer `migrate deploy` going forward, which is the
 * correct tool for tracked, reviewable schema history in production.
 */
const { existsSync, readdirSync } = require("fs");
const { execSync } = require("child_process");
const path = require("path");

const migrationsDir = path.join(__dirname, "..", "prisma", "migrations");

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

const hasMigrations = existsSync(migrationsDir) && readdirSync(migrationsDir).length > 0;

if (hasMigrations) {
  console.log("Found existing prisma/migrations — running `prisma migrate deploy`.");
  run("npx prisma migrate deploy");
} else {
  console.log(
    "No prisma/migrations found yet — running `prisma db push` instead so the " +
      "database schema gets created. Generate a real migration with " +
      "`npx prisma migrate dev --name init` locally and commit it when you can, " +
      "so future schema changes go through reviewable migrations instead."
  );
  run("npx prisma db push --accept-data-loss=false");
}
