# GenesisX — Railway Deployment Guide

This covers everything needed to deploy this repo to Railway from a clean
project, plus the hardening steps worth doing before real client funds touch it.

## 1. Project layout (read this first)

This is a monorepo, but it deploys as **one Railway service**. The root
`package.json` build step compiles `admin-tool` and `client-dashboard` (React/
Vite apps) and copies their output — along with the static `landing-page` — into
`backend/public/{admin,dashboard,landing}`. The backend Express server then
serves all three from inside its own folder, plus the API, on one port.

**Railway service settings should be:**
- Root Directory: `/` (repo root) — **not** `backend`
- Build command: uses root `railway.json` → `npm run build` → runs `scripts/build.sh`
- Start command: uses root `railway.json` → runs a safe Prisma deploy step, then `npm start`

If Root Directory is ever set to `backend` instead, the build will still run
(the backend's own `npm install` succeeds), but `/admin` and `/dashboard` will
404 because the frontend build never happens and `backend/public/{admin,dashboard}`
won't exist. `/` will still partially work only if a stray `backend/public/index.html`
happens to be present. If you see this, set Root Directory back to `/`.

## 2. First-time setup on Railway

1. **Create the project** → Deploy from GitHub repo → select this repo.
2. **Add PostgreSQL** in the *same* Railway project (New → Database →
   PostgreSQL). Railway's private networking (`postgres.railway.internal`) only
   works between services in the same project — a database in a different
   project is unreachable no matter how the URL is set.
3. **Set environment variables** on the backend service (Variables tab):

   | Variable | Value | Notes |
   |---|---|---|
   | `DATABASE_URL` | *(reference)* | Add as a **variable reference** pointing at the Postgres plugin's `DATABASE_URL` — don't type it manually |
   | `PORT` | `3000` | Must match the port Railway's networking is configured to hit |
   | `JWT_SECRET` | *(random, ≥32 bytes)* | Generate with `openssl rand -hex 32` locally, or any long random string. Treat like a password. |
   | `ALLOWED_ORIGIN` | `https://<your-service>.up.railway.app` | Your Railway-assigned domain, found under Settings → Networking |
   | `TOTP_WINDOW` | `1` | Optional — 2FA time-drift tolerance |
   | `SHARED_DEPOSIT_ADDRESS` | *(your BTC address)* | Shown to every client as where to send deposits. See §6 for how this ties to client-specific reference codes. |

4. **Deploy.** Watch the build logs for `scripts/build.sh` running through
   `npm install --workspaces`, both Vite builds, and the `backend/public`
   assembly step.

5. **Create the first Owner account.** There's no UI for this — it's
   intentionally not exposed over HTTP without an existing session, since
   that would be a way to self-escalate. Instead, run the seed script once
   via Railway's CLI:

   ```bash
   railway login
   railway link
   railway run --service <your-backend-service> \
     bash -c "cd backend && OWNER_EMAIL=you@example.com OWNER_NAME='Your Name' OWNER_PASSWORD='a-strong-password-here' node prisma/seed-owner.js"
   ```

   This creates an Owner user with no 2FA yet. Follow the printed instructions:
   log in via `POST /auth/staff/login` (no `totpToken` needed on this one first
   call — the server allows it only until 2FA is confirmed), or use the
   bootstrap flow described below.

6. **Enable 2FA on the Owner account.** Owner accounts *cannot* log in again
   after the first login until 2FA is enabled — this is enforced in
   `auth-staff.js` deliberately. Two ways to do it:
   - **Via a logged-in session:** `POST /auth/staff/totp/setup` (returns a QR
     code + secret), scan it in an authenticator app, then confirm with
     `POST /auth/staff/totp/verify` and the 6-digit code.
   - **Via bootstrap (no session needed, for the very first login):**
     `POST /auth/staff/totp/bootstrap-setup` with `{ email, password }`, then
     `POST /auth/staff/totp/bootstrap-verify` with `{ email, password, token }`.
     This path only works once — it refuses to run again once `totpEnabled`
     is true on that account.

## 3. Database schema and migrations — important caveat

**This repo does not yet have a committed `prisma/migrations` folder.** That
means `prisma migrate deploy` (Prisma's normal production migration command)
would run successfully but do *nothing* on a brand-new database — it has no
migration history to apply. To avoid silently deploying against an empty,
table-less database, the deploy step uses a wrapper script
(`backend/scripts/prisma-deploy-safe.js`, invoked via
`npm run prisma:deploy-safe`) that:

- Runs `prisma migrate deploy` if `prisma/migrations` exists and has content
- Otherwise falls back to `prisma db push` (syncs the schema directly, no
  migration history) so the database actually gets its tables on first deploy

**Before your next schema change**, generate a real migration once against a
real database and commit it:

```bash
# locally, with DATABASE_URL pointed at a real (dev) Postgres instance:
cd backend
npx prisma migrate dev --name init
git add prisma/migrations
git commit -m "Add initial Prisma migration"
```

Once `prisma/migrations` exists and is committed, the deploy script will
automatically prefer `migrate deploy` on all future deploys — which is the
right tool for reviewable, versioned schema history in production. Continuing
to rely on `db push` long-term means schema changes aren't tracked or
reversible the way migrations are.

## 4. Environment variable reference (full list)

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string (use a Railway reference, not a literal value) |
| `PORT` | Yes | Port the server listens on; must match Railway's configured target port |
| `JWT_SECRET` | Yes | Signs/verifies all staff and client session tokens. Rotating this invalidates every existing session. |
| `ALLOWED_ORIGIN` | Yes | CORS allow-list — set to your actual deployed domain, not `*`, once you're past initial testing |
| `TOTP_WINDOW` | No | 2FA code time-drift tolerance (in 30s steps). Defaults are usually fine. |
| `SHARED_DEPOSIT_ADDRESS` | No, but recommended | The one BTC address shown to every client for deposits. Without it, the client dashboard shows a blank deposit address field. |
| `OWNER_EMAIL` / `OWNER_NAME` / `OWNER_PASSWORD` | No (one-time) | Only used when running `prisma/seed-owner.js` manually — not needed at runtime, don't leave these set as permanent service variables |

## 5. Hardening checklist before handling real client funds

- [ ] `JWT_SECRET` is a real random value, not a placeholder — rotate it if it
      was ever shared in chat, a doc, or committed to git
- [ ] `ALLOWED_ORIGIN` is set to your actual domain, not left as `*`
- [ ] Owner account has 2FA enabled (enforced by the app, but verify — an
      Owner account stuck at `totpEnabled: false` cannot process withdrawals)
- [ ] Confirm rate limiting is active: login endpoints are capped at 8
      attempts / 15 minutes; all other `/api` and `/auth` traffic is capped at
      120 requests / minute per IP (see `backend/src/index.js`)
- [ ] Run a reconciliation check (Reconciliation tab in the admin tool) after
      your first real deposits, to establish a baseline
- [ ] Set up **database backups** — Railway's Postgres plugin supports
      scheduled backups; enable this from the Postgres service's Settings tab.
      This is not automatic by default.
- [ ] Decide on a log retention/monitoring approach — the `audit_logs` table
      records every sensitive action (logins, deposits, withdrawals,
      reconciliation checks, staff creation) but nothing currently ships
      those logs anywhere external. Consider Railway's log export or a
      dedicated logging service for anything beyond casual review.
- [ ] Review who has Owner vs Staff role — only Owner can process/cancel
      withdrawals or create new staff accounts; Staff can log deposits,
      trades, and create client accounts but cannot move money out.

## 6. Deposits: shared address + reference code (important — read before launch)

Clients can now sign themselves up (`POST /auth/client/signup`, or the "Create
account" link on the client dashboard's login screen) — no staff step required.
Staff can still manually add a client as a fallback (same as before).

There is **no unique BTC address generated per client**. Bitcoin has no native
memo/payment-ID field the way some other chains do, so instead:

- Every client is shown one shared deposit address (`SHARED_DEPOSIT_ADDRESS`)
  on their dashboard, alongside a unique, auto-generated **reference code**
  (e.g. `GX-7K3F9Q`).
- Clients are instructed to send BTC to that shared address, then notify staff
  (outside the app — email, message, whatever channel you use) with the amount
  and their reference code.
- Staff use `GET /api/clients/by-reference/:code` to quickly look up which
  client a given deposit belongs to, then log it the same way as before —
  `POST /api/deposits` with the on-chain tx hash as proof.

**This does not change the trust model** — every deposit still requires a
staff member to verify it on-chain and log a real tx hash before it's credited
to any client's balance. The reference code is purely a bookkeeping aid to
match an incoming payment to the right account; it carries no cryptographic
or on-chain guarantee by itself. If you outgrow this (e.g. deposit volume gets
hard to track manually, or you want zero staff involvement in deposit
matching), the next step up is real per-client HD wallet addresses with
automated chain monitoring — a meaningfully bigger project involving actual
key custody, which is worth scoping separately when you're ready for it.

## 7. Trading subscriptions and the performance fee

**Subscriptions (lock-up periods).** Clients can pick a subscription tier
right from their dashboard (`POST /api/me/subscribe`). Five tiers are defined
in `backend/src/lib/subscriptions.js` — edit the `SUBSCRIPTION_TIERS` array
there to change lengths or prices, nothing else needs to change:

| Tier | Length | Price (placeholder — edit this) |
|---|---|---|
| 1 | 1 month | $49 |
| 2 | 3 months | $129 |
| 3 | 6 months | $229 |
| 4 | 9 months | $319 |
| 5 | 12 months | $399 |

The price is deducted immediately from the client's existing account balance
— there's no separate BTC payment flow for this, it just reduces balance the
same way a withdrawal would (recorded internally with a reserved
`SUBSCRIPTION_FEE` marker so it's clearly labeled as a fee, not a real
withdrawal, everywhere it's displayed). If their balance is too low, the
request is rejected with a clear error — no partial or negative-balance
subscriptions are possible.

**What being "subscribed" actually controls:**
- **While active:** the client's withdrawals are locked (`POST /api/withdrawals`
  will reject a new withdrawal request for that client), and staff can open new
  trades for them.
- **Once it expires:** withdrawals unlock automatically (no cron job needed —
  it's just checked live against the current date), and staff can no longer
  open *new* trades for that client (`POST /api/trades` will reject) until they
  start another subscription. Any trade that was already open when the
  subscription lapsed can still be closed normally — nothing is force-closed.

**The 10% performance fee.** This is separate from subscriptions and always
active — it's not something a client opts into. Every time staff closes a
trade in profit (`POST /api/trades/:id/close`, or a trade logged as
already-closed via `POST /api/trades`), 10% of that trade's profit is
automatically deducted from the client's balance as its own recorded fee
entry (reserved `PERFORMANCE_FEE` marker, same display treatment as the
subscription fee). A trade that closes flat or at a loss generates no fee.
The rate is defined once, at the top of `backend/src/routes/trades.js`
(`PERFORMANCE_FEE_RATE = 0.10`) — change it there if the percentage changes.

**Revenue visibility.** The admin tool's Overview screen shows running totals
for subscription revenue, performance-fee revenue, and combined total —
pulled from `GET /api/clients/revenue/summary`.

## 8. What's still manual / not automated

- **Reconciliation** is a manual entry — you type in what the wallet/exchange
  actually shows, and the system diffs it against the ledger. There's no live
  wallet or block-explorer API integration. That's a reasonable next step once
  you've settled on which custody/wallet tooling you're actually using long-term.
- **Deposit matching** relies on the client telling staff their reference code
  — see §6. There's no automatic chain-watching yet.
- **Client invites (staff-created path)**: creating a client generates a
  temporary password shown once in the admin tool. Relay it to the client
  through a secure channel — it is not emailed automatically. The client is
  forced to set their own password on first login. (Self-signup clients set
  their own password immediately and skip this.)
- **Statement exports** (PDF/CSV) are generated on-demand per request — there's
  no scheduled/automatic statement emailing.
- **Closing an open trade has no button in the admin tool yet.** The backend
  route exists (`POST /api/trades/:id/close`, exported from the frontend as
  `closeTrade()` in `admin-tool/api.js`), but nothing in `dashboard.jsx` calls
  it — so right now, once a trade is logged as "open," there's no UI path to
  close it. This predates the subscription/fee work in this pass; worth adding
  a "close trade" action to the client panel's open-trades view as a follow-up.
- **No renewal reminders.** When a subscription is about to lapse or has
  lapsed, nothing notifies the client or staff proactively — they'd only see
  it by checking the dashboard. An email/notification nudge would be a
  reasonable follow-up once you have an email-sending setup in place.
