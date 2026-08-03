#!/usr/bin/env bash
# Root build script for Railway (and local use).
# Builds the admin-tool and client-dashboard React apps, generates the Prisma
# client, and assembles everything the backend needs to serve into
# backend/public/{landing,admin,dashboard} so backend/src/index.js only ever
# reads from inside its own directory — this makes the deploy work regardless
# of whether Railway's root directory is set to the repo root or to backend/.
set -euo pipefail

echo "==> Installing workspace dependencies"
npm install --workspaces --if-present

echo "==> Generating Prisma client"
npm run prisma:generate --workspace=backend

echo "==> Building admin-tool"
npm run build --workspace=admin-tool

echo "==> Building client-dashboard"
npm run build --workspace=client-dashboard

echo "==> Assembling backend/public"
rm -rf backend/public/landing backend/public/admin backend/public/dashboard
mkdir -p backend/public/landing backend/public/admin backend/public/dashboard

cp -r landing-page/. backend/public/landing/
cp -r admin-tool/dist/. backend/public/admin/
cp -r client-dashboard/dist/. backend/public/dashboard/

echo "==> Build complete"
