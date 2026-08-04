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
- No client self-service password reset yet — clients set their own password
  on first login (replacing the staff-issued temp password) via
  `POST /auth/client/change-password`, but there's no "forgot password" email
  flow if they lose access entirely. A staff member would need to reset via
  direct database access or a future admin-triggered reset endpoint.
- Fixed-term/APR/lock-up logic is still intentionally excluded, as discussed.



## Setting this up on Railway

See [`../DEPLOYMENT.md`](../DEPLOYMENT.md) for the full setup guide (this repo
deploys as a single Railway service from the repo root, not from `backend/`
alone — see that doc for why, and for the correct migration command).

## Local development

```
npm install
cp .env.example .env   # fill in real values
npx prisma migrate dev
npm run dev
```

