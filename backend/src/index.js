require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");

const authStaffRoutes = require("./routes/auth-staff");
const authClientRoutes = require("./routes/auth-client");
const clientsRoutes = require("./routes/clients");
const depositsRoutes = require("./routes/deposits");
const withdrawalsRoutes = require("./routes/withdrawals");
const tradesRoutes = require("./routes/trades");
const reconciliationRoutes = require("./routes/reconciliation");
const meRoutes = require("./routes/me");

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || "*", // set this to your real frontend URL(s) in production
    credentials: true,
  })
);
app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/auth/staff", authStaffRoutes);
app.use("/auth/client", authClientRoutes);

// Staff-facing (admin tool)
app.use("/api/clients", clientsRoutes);
app.use("/api/deposits", depositsRoutes);
app.use("/api/withdrawals", withdrawalsRoutes);
app.use("/api/trades", tradesRoutes);
app.use("/api/reconciliation", reconciliationRoutes);

// Client-facing (client dashboard) — scoped entirely to the logged-in client's own data
app.use("/api/me", meRoutes);

app.use((req, res) => res.status(404).json({ error: "Not found" }));

// Centralized error handler — never leak stack traces or raw error messages to clients.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`GenesisX API listening on port ${PORT}`));
