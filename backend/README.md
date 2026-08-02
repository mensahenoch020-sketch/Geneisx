# GenesisX Backend — Phase 1 + 2 (Foundation + Real API)

This is the real backend the admin tool and client dashboard talk to. Phase 1 covers
the database and authentication; Phase 2 adds the actual client/deposit/withdrawal/
trade/reconciliation API.

## What's here

- **prisma/schema.prisma** — full database schema: users (staff/owner), clients,
  deposits, withdrawals, trades, reconciliation checks, and an audit log that records
  every sensitive action.
- **src/lib/auth.js** — password hashing (bcrypt), session tokens (JWT), and TOTP 2FA
  (Google Authenticator-compatible).
- **src/lib/ledger.js** — the single source of truth for balance/P&L math. Both staff
  and client routes call this — it's deliberately not duplicated anywhere, so the two
  sides can never show different numbers for the same account.
- **src/middleware/auth.js** — route guards. `requireStaffAuth` / `requireOwner` for
  the admin side, `requireClientAuth` for the client side. Staff and client tokens are
  typed separately and can never be used interchangeably.
- **src/routes/auth-staff.js** — staff/owner login, 2FA enrollment, creating new staff
  accounts (Owner-only). **Owner accounts cannot log in without 2FA enabled.**
- **src/routes/auth-client.js** — client login (separate system from staff).
- **src/routes/clients.js** — create/list/view clients (staff-facing).
- **src/routes/deposits.js** — log a deposit; tx hash required, not optional.
- **src/routes/withdrawals.js** — create a pending withdrawal (any staff), process or
  cancel it (**Owner-only**, tx hash required to process).
- **src/routes/trades.js** — log/close trades.
- **src/routes/reconciliation.js** — check the ledger's expected total against what
  you actually hold; keeps history of every check.
- **src/routes/me.js** — client-facing "my account" routes. Scoped entirely to
  `req.client.id` from the verified token — a client can never request another
  client's data, even by editing an id in the URL.
- **prisma/seed-owner.js** — one-time script to create your first Owner account.

## API surface

All `/api/*` routes require `Authorization: Bearer <token>`.

**Staff/Owner** (`requireStaffAuth`):
- `POST /api/clients` — create client, returns a one-time temp password to relay
- `GET /api/clients` — list all clients with balances
- `GET /api/clients/:id` — full detail + transaction history
- `POST /api/deposits` — log a deposit (`clientId`, `amountUsd`, `txHash`)
- `POST /api/withdrawals` — create pending withdrawal (`clientId`, `amountUsd`, `destination`)
- `POST /api/withdrawals/:id/process` — **Owner-only**, requires `txHash`
- `POST /api/withdrawals/:id/cancel` — **Owner-only**
- `POST /api/trades` — log a trade, open or closed
- `POST /api/trades/:id/close` — close an open trade (`exit`)
- `GET /api/reconciliation/expected` — current expected total across all clients
- `POST /api/reconciliation/check` — record a check (`actualUsd`, optional `note`)
- `GET /api/reconciliation/history`

**Client** (`requireClientAuth`):
- `GET /api/me` — own account summary + full history
- `GET /api/me/performance?range=7d|30d|90d|180d|365d` — realized P&L for that window

## What's NOT in Phase 2

- No endpoint to update/delete records — intentional for now. Financial ledgers
  should generally be append-only; corrections should be new offsetting entries, not
  edits to history. If you need this, it deserves its own careful design rather than
  a quick add.
- Reconciliation's "actual" wallet balance is still manual entry — pulling a live
  balance from a block explorer or exchange API is a good Phase 4/5 candidate once
  your custody tooling is finalized.
- No client self-service password reset yet (Phase 3).
- Fixed-term/APR/lock-up logic is still intentionally excluded, as discussed.



## Setting this up on Railway

1. **Create a new Railway project**, add a **Postgres** plugin — Railway will set
   `DATABASE_URL` for you automatically.
2. **Push this code to a GitHub repo**, connect it to a Railway service.
3. In the Railway service's **Variables** tab, set:
   - `JWT_SECRET` — generate one with:
     `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
   - `ALLOWED_ORIGIN` — your frontend's real URL once it's deployed (don't leave this
     as `*` once real clients are involved)
   - `NODE_ENV=production`
4. **Run migrations** — either via Railway's deploy hook or manually:
   ```
   npx prisma migrate deploy
   ```
5. **Create your Owner account** — run once, with real values:
   ```
   OWNER_EMAIL="you@yourdomain.com" OWNER_NAME="Your Name" OWNER_PASSWORD="a-long-real-password" node prisma/seed-owner.js
   ```
6. **Log in and enable 2FA** — the Owner account cannot log in via the normal endpoint
   until this is done. Because a brand-new Owner has no session token yet, use the
   one-time bootstrap routes (email+password only, no token) instead of the normal
   `/totp/setup` / `/totp/verify`:
   - `POST /auth/staff/totp/bootstrap-setup` with `{ email, password }` — returns a QR
     code. Scan it with Google Authenticator / Authy.
   - `POST /auth/staff/totp/bootstrap-verify` with `{ email, password, token }` (the
     6-digit code from your app) — confirms enrollment.
   - These two routes refuse to run again once `totpEnabled` is true for that account,
     so they can't be used to silently re-enroll 2FA on an already-secured account.
   - From then on, use normal `POST /auth/staff/login`, which requires `totpToken`
     every time.

## Local development

```
npm install
cp .env.example .env   # fill in real values
npx prisma migrate dev
npm run dev
```

