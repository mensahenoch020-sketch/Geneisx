#!/usr/bin/env bash
# Root build script for Railway (and local use).
# Builds the admin-tool and client-dashboard React apps, generates the Prisma
# client, and assembles everything the backend needs to serve into
# backend/public/{admin,client} so backend/src/index.js only ever reads from
# inside its own directory — this makes the deploy work regardless of whether
# Railway's root directory is set to the repo root or to backend/.
#
# NOTE: landing-page/ is no longer built or copied — its content was ported
# into client-dashboard/MarketingSite.jsx, so the marketing site and the
# client dashboard are now one merged React app (see client-dashboard/App.jsx).
# The landing-page/ folder in this repo is now unused; safe to delete later.
set -euo pipefail

echo "==> Installing workspace dependencies"
npm install --workspaces --if-present

echo "==> Generating Prisma client"
npm run prisma:generate --workspace=backend

echo "==> Building admin-tool"
npm run build --workspace=admin-tool

echo "==> Building client-dashboard (marketing + dashboard, merged)"
npm run build --workspace=client-dashboard

echo "==> Assembling backend/public"
rm -rf backend/public/admin backend/public/client
mkdir -p backend/public/admin backend/public/client

cp -r admin-tool/dist/. backend/public/admin/
cp -r client-dashboard/dist/. backend/public/client/

echo "==> Build complete"
