const prisma = require("./prisma");

/**
 * Records a sensitive action. Call this from inside the same route that performs
 * the action, after it succeeds. Never skip this for withdrawal/client-creation/
 * role-change type actions — this log is the paper trail if a client or regulator
 * ever asks "who did what, when."
 */
async function logAction({ userId, action, targetId = null, detail = null }) {
  await prisma.auditLog.create({
    data: { userId, action, targetId, detail },
  });
}

module.exports = { logAction };
