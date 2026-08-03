const express = require("express");
const PDFDocument = require("pdfkit");
const prisma = require("../lib/prisma");
const { requireStaffAuth, requireClientAuth } = require("../middleware/auth");
const { computeClientSummary } = require("../lib/ledger");

const router = express.Router();

// Both staff and clients can pull statements — staff for any client (by id),
// clients only for themselves (no id in the URL, always their own token).
// This file intentionally has two mount points in index.js:
//   /api/statements/:clientId   (staff-only)
//   /api/me/statement           (client-only, self)

function buildRows(client) {
  const rows = [];
  for (const d of client.deposits) {
    rows.push({ date: d.date, type: "Deposit", detail: `tx ${d.txHash}`, amount: Number(d.amountUsd) });
  }
  for (const w of client.withdrawals) {
    if (w.status !== "PROCESSED") continue;
    const isSubscriptionFee = w.destination === "SUBSCRIPTION_FEE";
    rows.push({
      date: w.processedAt || w.requestedAt,
      type: isSubscriptionFee ? "Subscription fee" : "Withdrawal",
      detail: isSubscriptionFee
        ? "Trading subscription renewal"
        : `to ${w.destination}${w.txHash ? ` · tx ${w.txHash}` : ""}`,
      amount: -Number(w.amountUsd),
    });
  }
  for (const t of client.trades) {
    if (t.status !== "CLOSED" || t.exit == null) continue;
    const entry = Number(t.entry);
    const exit = Number(t.exit);
    const size = Number(t.size);
    const diff = t.side === "LONG" ? exit - entry : entry - exit;
    const pnl = diff * size;
    rows.push({
      date: t.closedAt || t.date,
      type: "Trade",
      detail: `${t.side} ${size} ${t.asset} @ ${entry} → ${exit}`,
      amount: pnl,
    });
  }
  rows.sort((a, b) => new Date(a.date) - new Date(b.date));

  // running balance
  let running = 0;
  return rows.map((r) => {
    running += r.amount;
    return { ...r, balanceAfter: running };
  });
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function sendCsv(res, client, rows) {
  const header = ["Date", "Type", "Detail", "Amount USD", "Balance After USD"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        new Date(r.date).toISOString(),
        r.type,
        csvEscape(r.detail),
        r.amount.toFixed(2),
        r.balanceAfter.toFixed(2),
      ].join(",")
    );
  }
  const filename = `statement-${client.id}.csv`;
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(lines.join("\n"));
}

function sendPdf(res, client, rows, summary) {
  const filename = `statement-${client.id}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const doc = new PDFDocument({ margin: 40, size: "A4" });
  doc.pipe(res);

  doc.fontSize(18).text("GenesisX — Account Statement", { align: "left" });
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor("#555").text(`Generated ${new Date().toISOString()}`);
  doc.moveDown();

  doc.fillColor("#000").fontSize(12).text(`Client: ${client.name}`);
  doc.fontSize(10).fillColor("#555").text(`Email: ${client.email}`);
  doc.moveDown();

  doc.fillColor("#000").fontSize(11);
  doc.text(`Total deposited: $${summary.totalDeposited.toFixed(2)}`);
  doc.text(`Total withdrawn: $${summary.totalWithdrawn.toFixed(2)}`);
  doc.text(`Pending withdrawal: $${summary.pendingWithdrawal.toFixed(2)}`);
  doc.text(`Realized P&L: $${summary.pnl.toFixed(2)}`);
  doc.font("Helvetica-Bold").text(`Current balance: $${summary.balance.toFixed(2)}`);
  doc.font("Helvetica");
  doc.moveDown();

  doc.fontSize(12).text("Transaction History", { underline: true });
  doc.moveDown(0.5);

  const colX = { date: 40, type: 130, detail: 210, amount: 430, bal: 500 };
  const startY = doc.y;
  doc.fontSize(9).fillColor("#555");
  doc.text("Date", colX.date, startY);
  doc.text("Type", colX.type, startY);
  doc.text("Detail", colX.detail, startY);
  doc.text("Amount", colX.amount, startY);
  doc.text("Balance", colX.bal, startY);
  doc.moveDown(0.5);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor("#ccc").stroke();
  doc.moveDown(0.3);

  doc.fillColor("#000").fontSize(9);
  if (rows.length === 0) {
    doc.text("No transactions recorded.", 40);
  }
  for (const r of rows) {
    if (doc.y > 760) doc.addPage();
    const y = doc.y;
    doc.text(new Date(r.date).toLocaleDateString(), colX.date, y, { width: 85 });
    doc.text(r.type, colX.type, y, { width: 75 });
    doc.text(r.detail, colX.detail, y, { width: 215 });
    doc.text(`$${r.amount.toFixed(2)}`, colX.amount, y, { width: 65 });
    doc.text(`$${r.balanceAfter.toFixed(2)}`, colX.bal, y, { width: 65 });
    doc.moveDown(0.6);
  }

  doc.moveDown();
  doc.fontSize(8).fillColor("#888").text(
    "This statement reflects GenesisX's internal ledger records at time of generation and is provided for informational purposes.",
    { width: 515 }
  );

  doc.end();
}

async function loadClientWithHistory(clientId) {
  return prisma.client.findUnique({
    where: { id: clientId },
    include: {
      deposits: { orderBy: { date: "asc" } },
      withdrawals: { orderBy: { requestedAt: "asc" } },
      trades: { orderBy: { date: "asc" } },
    },
  });
}

// GET /api/statements/:clientId?format=csv|pdf — staff only, any client.
router.get("/:clientId", requireStaffAuth, async (req, res) => {
  const client = await loadClientWithHistory(req.params.clientId);
  if (!client) return res.status(404).json({ error: "Client not found" });

  const rows = buildRows(client);
  const summary = computeClientSummary(client);
  const format = (req.query.format || "pdf").toLowerCase();

  if (format === "csv") return sendCsv(res, client, rows);
  if (format === "pdf") return sendPdf(res, client, rows, summary);
  return res.status(400).json({ error: "format must be 'pdf' or 'csv'" });
});

// GET /api/me/statement?format=csv|pdf — client-only, self.
// Mounted separately in index.js under /api/me so it inherits requireClientAuth
// and req.client.id, never trusting a clientId from the URL.
const selfRouter = express.Router();
selfRouter.use(requireClientAuth);
selfRouter.get("/", async (req, res) => {
  const client = await loadClientWithHistory(req.client.id);
  if (!client) return res.status(404).json({ error: "Account not found" });

  const rows = buildRows(client);
  const summary = computeClientSummary(client);
  const format = (req.query.format || "pdf").toLowerCase();

  if (format === "csv") return sendCsv(res, client, rows);
  if (format === "pdf") return sendPdf(res, client, rows, summary);
  return res.status(400).json({ error: "format must be 'pdf' or 'csv'" });
});

module.exports = { staffRouter: router, selfRouter };
