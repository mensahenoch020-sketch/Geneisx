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
│   │   ├── index.js      # Main server (serves all frontends)
│   │   ├── routes/       # API endpoints (auth, clients, trades, etc.)
│   │   └── ...
│   ├── prisma/
│   │   └── schema.prisma # Database schema
│   └── package.json
├── landing-page/         # Static HTML landing page
│   ├── index.html        # Main page
│   └── package.json
├── admin-tool/           # React admin dashboard (staff tool)
│   ├── dashboard.jsx     # Main component
│   ├── main.jsx          # Entry point
│   ├── index.html        # Vite entry
│   ├── vite.config.js    # Vite configuration
│   └── package.json
├── client-dashboard/     # React client dashboard (client-facing)
│   ├── client-dashboard.jsx
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
  - `/auth/client` — Client login
  - `/api/clients` — Manage clients (staff only)
  - `/api/deposits` — Log deposits with on-chain proof
  - `/api/withdrawals` — Request & process withdrawals
  - `/api/trades` — Log trades (long/short)
  - `/api/reconciliation` — Verify ledger vs. wallet balance
  - `/api/me` — Client's own data (client-facing)

### Frontend: Landing Page (`landing-page/`)
- Static HTML5 + CSS landing page
- Responsive design with smooth animations
- How we operate (custody model, fees, contact)
- Risk disclosure
- Email contact CTA

**Served at:** `/`

### Frontend: Admin Dashboard (`admin-tool/`)
- React app (Vite + JSX)
- Staff tool for managing clients and trades
- Features:
  - Client management (add, view, filter)
  - Deposit logging with on-chain proof
  - Withdrawal request + approval workflow
  - Trade logging (long/short, open/closed)
  - Real-time BTC price ticker
  - Reconciliation panel (compare ledger vs. wallet)
  - Audit trail

**Served at:** `/admin`

### Frontend: Client Dashboard (`client-dashboard/`)
- React app (Vite + JSX)
- Client-facing dashboard
- Features:
  - Account balance display
  - P&L over various time ranges (1W, 1M, 3M, 6M, 1Y)
  - Equity curve chart
  - Transaction history
  - Real-time BTC price
  - Read-only view of own account data

**Served at:** `/dashboard`

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
   # Landing page served on http://localhost:3001/
   # Admin dashboard on http://localhost:3001/admin (after build)
   # Client dashboard on http://localhost:3001/dashboard (after build)
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