require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const path = require("path");
const rateLimit = require("express-rate-limit");

const authStaffRoutes = require("./routes/auth-staff");
const authClientRoutes = require("./routes/auth-client");
const clientsRoutes = require("./routes/clients");
const depositsRoutes = require("./routes/deposits");
const withdrawalsRoutes = require("./routes/withdrawals");
const tradesRoutes = require("./routes/trades");
const reconciliationRoutes = require("./routes/reconciliation");
const meRoutes = require("./routes/me");
const { staffRouter: statementsStaffRoutes, selfRouter: statementsSelfRoutes } = require("./routes/statements");

const app = express();

// Railway sits in front of this app behind a proxy — trust it so req.ip/rate
// limiting reflects the real client IP instead of Railway's proxy IP.
app.set("trust proxy", 1);

app.use(helmet({ contentSecurityPolicy: false }));

// CORS configuration
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || "*",
    credentials: true,
  })
);

app.use(express.json());

// Global rate limit — a broad safety net in addition to the tighter, dedicated
// limiters on the login endpoints. This caps overall abuse/scraping of the API
// without being so tight it interferes with normal dashboard usage.
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
});
app.use("/api", globalLimiter);
app.use("/auth", globalLimiter);

// ========== API Routes ==========
app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/auth/staff", authStaffRoutes);
app.use("/auth/client", authClientRoutes);

// Staff-facing (admin tool)
app.use("/api/clients", clientsRoutes);
app.use("/api/deposits", depositsRoutes);
app.use("/api/withdrawals", withdrawalsRoutes);
app.use("/api/trades", tradesRoutes);
app.use("/api/reconciliation", reconciliationRoutes);
app.use("/api/statements", statementsStaffRoutes);

// Client-facing (client dashboard)
// IMPORTANT: /api/me/statement must be mounted BEFORE /api/me — Express matches
// mount prefixes in registration order, so if the broader /api/me mount came
// first, any request to /api/me/statement would be swallowed by meRoutes
// (which only defines "/" and "/performance") and 404 before ever reaching
// the statements router.
app.use("/api/me/statement", statementsSelfRoutes);
app.use("/api/me", meRoutes);

// ========== Frontend Routing ==========
// All three frontends are copied into backend/public/<name> by the root build
// script (see package.json "build" at repo root) BEFORE this server starts.
// This means index.js only ever reads from inside backend/, so it works
// correctly no matter what Railway's configured root directory is.
const PUBLIC_DIR = path.join(__dirname, "..", "public");

// Serve landing page at root
app.use("/", express.static(path.join(PUBLIC_DIR, "landing")));
app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "landing", "index.html"));
});

// Serve admin dashboard at /admin
app.use("/admin", express.static(path.join(PUBLIC_DIR, "admin")));
app.get("/admin/*", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "admin", "index.html"));
});

// Serve client dashboard at /dashboard
app.use("/dashboard", express.static(path.join(PUBLIC_DIR, "dashboard")));
app.get("/dashboard/*", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "dashboard", "index.html"));
});

// 404 handler
app.use((req, res) => res.status(404).json({ error: "Not found" }));

// Centralized error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`GenesisX API listening on port ${PORT}`));