# GenesisX — Bitcoin Fund Management

A full-stack application for managing Bitcoin accounts with complete transparency, per-client segregated accounts, and on-chain proof for every deposit and withdrawal.

> **Deploying this to Railway?** See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for
> the full setup guide, including environment variables, first-owner-account
> bootstrap, and a pre-launch hardening checklist.

## Project Structure

```
genesisx/
├── backend/              # Express API server + Prisma ORM
│   ├── src/
│   │   ├── index.js      # Main server (serves both frontends)
│   │   ├── routes/       # API endpoints (auth, clients, trades, etc.)
│   │   └── ...
│   ├── prisma/
│   │   └── schema.prisma # Database schema
│   └── package.json
├── admin-tool/           # React admin app (staff tool)
│   ├── dashboard.jsx     # Main component
│   ├── main.jsx          # Entry point
│   ├── index.html        # Vite entry
│   ├── vite.config.js    # Vite configuration
│   └── package.json
├── client-dashboard/     # React client app — marketing site + login +
│   │                     # dashboard, all merged into one app (see App.jsx)
│   ├── App.jsx           # Top-level shell: nav + routes between marketing/
│   │                     # login/dashboard views based on auth state
│   ├── MarketingSite.jsx # Public marketing content (hero, fees, risk, etc.)
│   ├── SiteNav.jsx       # Shared nav bar, adapts to logged-in state
│   ├── client-dashboard.jsx # The authenticated dashboard itself
│   ├── LoginScreen.jsx   # Login / signup
│   ├── VerificationPanel.jsx # ID verification upload
│   ├── theme.css         # Shared visual theme for the whole client app
│   ├── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── package.json          # Root workspace config
├── railway.json          # Railway deployment config
└── README.md
```

## Features

### Backend (`backend/`)
- **Express.js** API server with security middleware (Helmet, CORS, rate-limiting)
- **Prisma ORM** for PostgreSQL database management
- **Authentication**: Separate login flows for staff and clients
- **2FA support**: TOTP-based two-factor authentication
- **Endpoints**:
  - `/auth/staff` — Staff login & TOTP management
  - `/auth/client` — Client login & signup
  - `/api/clients` — Manage clients (staff only)
  - `/api/deposits` — Log deposits with on-chain proof
  - `/api/withdrawals` — Request & process withdrawals
  - `/api/trades` — Log trades (long/short)
  - `/api/reconciliation` — Verify ledger vs. wallet balance
  - `/api/verification` — Staff review of client-submitted ID documents
  - `/api/me` — Client's own data (client-facing)

### Frontend: Client site (`client-dashboard/`)
One React app covering both the public marketing site and the authenticated
client dashboard — not two separate apps. `App.jsx` decides which to show
based on login state, and the nav bar (`SiteNav.jsx`) stays visible and
adapts either way, so it behaves like one continuous website rather than
handing off to a different app after signing in.

- **Logged out**: hero, "how it works," live market prices, crypto news
  links, fee structure, risk disclosure, contact — plus sign in / sign up
- **Logged in**: account balance, P&L over various time ranges, equity curve
  chart, transaction history, deposit instructions with QR code, trading
  subscription tiers, identity verification upload, statement export
  (PDF/CSV) — marketing sections (Markets, Fees) stay reachable via the nav

**Served at:** `/`

### Frontend: Admin app (`admin-tool/`)
- React app (Vite + JSX)
- Staff tool for managing clients and trades
- Features:
  - Client management (add, view, filter, search by deposit reference)
  - Deposit logging with on-chain proof
  - Withdrawal request + approval workflow
  - Trade logging (long/short, open/closed) and closing open positions
  - Real-time BTC price ticker
  - Reconciliation panel (compare ledger vs. wallet)
  - Identity verification review queue (approve/reject client documents)
  - Revenue summary (subscription + performance fee totals)
  - Audit trail

**Served at:** `/admin`

## Setup

### Prerequisites
- **Node.js** 18+
- **PostgreSQL** database (local or Railway)

### Local Development

1. **Clone and install**:
   ```bash
   git clone <repo>
   cd genesisx
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your DATABASE_URL and other secrets
   cd ..
   ```

3. **Run database migrations**:
   ```bash
   cd backend
   npx prisma migrate dev
   npx prisma generate
   cd ..
   ```

4. **Start development**:
   ```bash
   npm run dev
   # Backend runs on http://localhost:3001
   # Client site (marketing + dashboard) served on http://localhost:3001/ (after build)
   # Admin app on http://localhost:3001/admin (after build)
   ```

## Deployment on Railway

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for the full, current setup guide —
service configuration, environment variables, first-owner-account bootstrap,
migration notes, and a pre-launch hardening checklist.

## API Examples

### Staff Login
```bash
curl -X POST http://localhost:3001/auth/staff/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@genesis.x","password":"your-password"}'
```

### Create a Client
```bash
curl -X POST http://localhost:3001/api/clients \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <staff-token>" \
  -d '{
    "name":"Alice Johnson",
    "email":"alice@example.com",
    "contact":"alice@example.com",
    "walletRef":"bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
  }'
```

### Log a Deposit
```bash
curl -X POST http://localhost:3001/api/deposits \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <staff-token>" \
  -d '{
    "clientId":"<client-id>",
    "amountUsd":25000,
    "txHash":"abc123def456..."
  }'
```

### Log a Trade
```bash
curl -X POST http://localhost:3001/api/trades \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <staff-token>" \
  -d '{
    "clientId":"<client-id>",
    "asset":"BTC",
    "side":"long",
    "size":0.5,
    "entry":65000,
    "exit":70000
  }'
```

## Database Schema

The Prisma schema (`backend/prisma/schema.prisma`) includes:
- **User** — staff accounts (with 2FA support)
- **Client** — client accounts
- **Deposit** — inbound transactions with tx hash
- **Withdrawal** — withdrawal requests + processing
- **Trade** — trade records (open/closed)
- **AuditLog** — every sensitive action logged
- **Reconciliation** — periodic ledger checks

## Security

- Passwords are bcrypt-hashed
- JWTs for session management
- CORS configured per environment
- Helmet.js security headers
- Rate limiting on auth endpoints
- 2FA (TOTP) support for staff
- Audit logging for all sensitive operations
- No sensitive data in error messages

## Development

### Add a New API Endpoint

1. Create a route file in `backend/src/routes/`:
   ```javascript
   // backend/src/routes/my-feature.js
   const express = require("express");
   const router = express.Router();

   router.get("/", (req, res) => {
     res.json({ message: "My feature" });
   });

   module.exports = router;
   ```

2. Mount it in `backend/src/index.js`:
   ```javascript
   app.use("/api/my-feature", require("./routes/my-feature"));
   ```

### Update the Database Schema

1. Edit `backend/prisma/schema.prisma`
2. Run migration:
   ```bash
   cd backend
   npx prisma migrate dev --name <descriptive-name>
   npx prisma generate
   ```

### Rebuild Admin/Client Dashboards

After making changes to React components:

```bash
cd admin-tool
npm run build
# or
cd ../client-dashboard
npm run build
```

Then restart the backend to serve the new builds.

## Troubleshooting

### "Not found" on landing page
- Ensure the backend server is running
- Check `/health` endpoint
- Verify `backend/public/` contains static files

### Admin dashboard shows 404
- Ensure `admin-tool/dist/` exists
- Run `cd admin-tool && npm run build`
- Restart backend

### Database connection fails
- Check `DATABASE_URL` environment variable
- Verify PostgreSQL is running
- Try: `psql $DATABASE_URL -c "SELECT 1"` to test connection

### JWT errors
- Ensure `JWT_SECRET` is set in environment
- Check token hasn't expired
- Verify Authorization header format: `Bearer <token>`

## License

Proprietary — GenesisX Ltd.

## Support

For issues or questions, contact: chasr1226@gmail.com