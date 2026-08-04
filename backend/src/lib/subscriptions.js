// Subscription tiers: a client-chosen lock-up commitment, paid out of their
// existing account balance. See prisma/schema.prisma "Subscription" model for
// the enforcement rules (blocks withdrawal while active, blocks new trades
// once expired).
//
// EDIT THESE PRICES — they're placeholders. Change tierMonths/priceUsd here
// and both the client dashboard and admin tool will reflect the new values
// automatically; nothing else needs to change.
const SUBSCRIPTION_TIERS = [
  { tierMonths: 1, priceUsd: 49, description: "Try it out before committing to a longer lock-up." },
  { tierMonths: 3, priceUsd: 129, description: "A modest commitment with a lower monthly cost than going month-to-month." },
  { tierMonths: 6, priceUsd: 229, description: "Half a year in — monthly cost drops further." },
  { tierMonths: 9, priceUsd: 319, description: "For clients settling in for the longer haul." },
  { tierMonths: 12, priceUsd: 399, description: "Our lowest monthly cost, for clients committing for a full year." },
];

function findTier(tierMonths) {
  return SUBSCRIPTION_TIERS.find((t) => t.tierMonths === Number(tierMonths));
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
