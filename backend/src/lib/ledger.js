// Single source of truth for balance/P&L math. Both the staff-facing and
// client-facing routes call this — never duplicate this logic elsewhere,
// or the two sides can silently drift and show different numbers for the
// same account, which is exactly the kind of discrepancy that erodes trust
// (or worse, looks like manipulation) if a client ever compares notes with staff.

function tradePnL(trade) {
  if (trade.status !== "CLOSED" || trade.exit == null) return null;
  const entry = Number(trade.entry);
  const exit = Number(trade.exit);
  const size = Number(trade.size);
  const diff = trade.side === "LONG" ? exit - entry : entry - exit;
  return diff * size;
}

function totalDeposited(client) {
  return client.deposits.reduce((s, d) => s + Number(d.amountUsd), 0);
}

function totalProcessedWithdrawn(client) {
  return client.withdrawals
    .filter((w) => w.status === "PROCESSED")
    .reduce((s, w) => s + Number(w.amountUsd), 0);
}

function totalPendingWithdrawal(client) {
  return client.withdrawals
    .filter((w) => w.status === "PENDING")
    .reduce((s, w) => s + Number(w.amountUsd), 0);
}

function totalPnL(client) {
  return client.trades.reduce((s, t) => s + (tradePnL(t) || 0), 0);
}

function clientBalance(client) {
  return totalDeposited(client) - totalProcessedWithdrawn(client) + totalPnL(client);
}

function computeClientSummary(client) {
  return {
    totalDeposited: totalDeposited(client),
    totalWithdrawn: totalProcessedWithdrawn(client),
    pendingWithdrawal: totalPendingWithdrawal(client),
    pnl: totalPnL(client),
    balance: clientBalance(client),
  };
}

// P&L realized within the last N days — used for the client dashboard's 1W/1M/3M/6M/1Y views.
function pnlSince(client, days) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return client.trades
    .filter((t) => t.status === "CLOSED" && new Date(t.closedAt || t.date).getTime() >= cutoff)
    .reduce((s, t) => s + (tradePnL(t) || 0), 0);
}

module.exports = {
  tradePnL,
  totalDeposited,
  totalProcessedWithdrawn,
  totalPendingWithdrawal,
  totalPnL,
  clientBalance,
  computeClientSummary,
  pnlSince,
};
