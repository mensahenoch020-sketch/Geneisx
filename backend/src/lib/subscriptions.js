// Subscription tiers: a client-chosen investment amount within a named
// tier's range, locked up for that tier's fixed duration. The amount they
// choose (anywhere in [minUsd, maxUsd]) is deducted from their balance —
// see prisma/schema.prisma "Subscription" model for the enforcement rules
// (blocks withdrawal while active, blocks new trades once expired). It's
// stored in the same `priceUsd` column as before; only the meaning changed
// (client-chosen investment amount, not a fixed activation fee), so no
// migration was needed.
//
// EDIT THESE — they're your real tier config. Change name/tierMonths/minUsd/
// maxUsd here and both the client dashboard and admin tool reflect the new
// values automatically; nothing else needs to change.
const SUBSCRIPTION_TIERS = [
  { key: "starter", name: "Starter", tierMonths: 1, minUsd: 500, maxUsd: 1000, description: "Try it out before committing to a longer lock-up." },
  { key: "growth", name: "Growth", tierMonths: 3, minUsd: 1000, maxUsd: 5000, description: "A modest commitment with more room to grow." },
  { key: "pro", name: "Pro", tierMonths: 6, minUsd: 10000, maxUsd: 25000, description: "Half a year in, for clients scaling up their position." },
  { key: "premium", name: "Premium", tierMonths: 9, minUsd: 30000, maxUsd: 50000, description: "For clients settling in for the longer haul." },
  { key: "elite", name: "Elite", tierMonths: 12, minUsd: 70000, maxUsd: 150000, description: "Our largest tier, for a full year commitment." },
];

function findTier(key) {
  return SUBSCRIPTION_TIERS.find((t) => t.key === key);
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Given a client's subscriptions (any order), returns the one currently
 * covering "now" if any exists — i.e. the most recent subscription whose
 * endDate is still in the future. A client can have many past subscriptions;
 * only the most recent one matters for lock/enforcement purposes.
 */
function getActiveSubscription(subscriptions, now = new Date()) {
  if (!subscriptions || subscriptions.length === 0) return null;
  const sorted = [...subscriptions].sort((a, b) => new Date(b.endDate) - new Date(a.endDate));
  const latest = sorted[0];
  return new Date(latest.endDate) > now ? latest : null;
}

function isWithdrawalLocked(subscriptions, now = new Date()) {
  return getActiveSubscription(subscriptions, now) !== null;
}

function canOpenNewTrades(subscriptions, now = new Date()) {
  return getActiveSubscription(subscriptions, now) !== null;
}

module.exports = {
  SUBSCRIPTION_TIERS,
  findTier,
  addMonths,
  getActiveSubscription,
  isWithdrawalLocked,
  canOpenNewTrades,
};
