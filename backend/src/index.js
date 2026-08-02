require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const path = require("path");

const authStaffRoutes = require("./routes/auth-staff");
const authClientRoutes = require("./routes/auth-client");
const clientsRoutes = require("./routes/clients");
const depositsRoutes = require("./routes/deposits");
const withdrawalsRoutes = require("./routes/withdrawals");
const tradesRoutes = require("./routes/trades");
const reconciliationRoutes = require("./routes/reconciliation");
const meRoutes = require("./routes/me");

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.static(path.join(__dirname, "..", "public")));

// CORS configuration
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || "*",
    credentials: true,
  })
);

app.use(express.json());

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

// Client-facing (client dashboard)
app.use("/api/me", meRoutes);

// ========== Frontend Routing ==========
// Serve landing page at root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "..", "landing-page", "index.html"));
});

// Serve admin dashboard at /admin
app.use("/admin", express.static(path.join(__dirname, "..", "..", "admin-tool", "dist")));
app.get("/admin/*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "..", "admin-tool", "dist", "index.html"));
});

// Serve client dashboard at /dashboard
app.use("/dashboard", express.static(path.join(__dirname, "..", "..", "client-dashboard", "dist")));
app.get("/dashboard/*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "..", "client-dashboard", "dist", "index.html"));
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