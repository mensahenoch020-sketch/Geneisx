# GenesisX patch — routing, settings, notifications, subscription tier copy

Every file in this zip is a COMPLETE, ready-to-drop-in replacement (or new
file) — not a diff, not instructions to merge by hand. Copy each one over
the matching path in your project and you're done. All files were syntax
verified (esbuild for JSX, node --check for backend) before packaging.

## Copy these files over your existing ones at the same path:

client-dashboard/
  App.jsx              — real routes (/, /signin, /dashboard, /settings)
  SiteNav.jsx           — Link-based nav, Settings link added
  SettingsPage.jsx      — NEW: profile edit + password change + notifications
  NotificationsPanel.jsx — NEW: notification list (display-only)
  MarketingSite.jsx     — hash-based section scroll (was prop-based)
  client-dashboard.jsx  — subscription tier buttons now show a description
  api.js                — added updateProfile(), fetchNotifications()
  theme.css             — nav-cta/brand anchor styling fix
  package.json          — added react-router-dom dependency

backend/src/
  index.js              — mounts the new /api/notifications route
  routes/notifications.js — NEW: GET /api/notifications
  routes/me.js           — added PATCH /api/me/profile
  routes/deposits.js     — deposit.logged audit entries now tagged with clientId
  routes/verification.js — verification review audit entries tagged with clientId
  routes/withdrawals.js  — withdrawal.processed audit entries tagged with clientId
  lib/audit.js           — logAction() accepts optional clientId
  lib/subscriptions.js   — each tier now has a description string

## What did NOT change

- No Prisma migration needed (AuditLog.clientId already existed in your schema)
- No changes to wallet, deposit-crediting, or verification review logic
- Password change itself was already fully working server-side — it just had
  no UI outside the forced first-login screen. Only the frontend changed there.
- admin-tool/ untouched entirely

## After copying files in

cd client-dashboard && npm install && npm run build
cd ../backend && npm run dev   # or however you normally run it
