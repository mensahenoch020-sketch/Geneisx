const prisma = require("./prisma");

/**
 * Records a sensitive action performed by a staff/owner user. Call this from
 * inside the same route that performs the action, after it succeeds. Never skip
 * this for withdrawal/client-creation/role-change type actions — this log is the
 * paper trail if a client or regulator ever asks "who did what, when."
 */
async function logAction({ userId, action, targetId = null, detail = null }) {
  await prisma.auditLog.create({
    data: { actorType: "STAFF", userId, action, targetId, detail },
  });
}

/**
 * Records a sensitive action performed by a client against their own account
 * (e.g. changing their password). Kept separate from logAction so a client id
 * can never accidentally satisfy the staff-only userId field.
 */
async function logClientAction({ clientId, action, targetId = null, detail = null }) {
  await prisma.auditLog.create({
    data: { actorType: "CLIENT", clientId, action, targetId, detail },
  });
}

module.exports = { logAction, logClientAction };
