const { verifyToken } = require("../lib/auth");

/**
 * Requires a valid staff/owner session token. Attaches req.user = { id, role, email }.
 * Rejects client-type tokens even if otherwise valid — staff and client tokens are
 * never interchangeable.
 */
function requireStaffAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed authorization header" });
  }
  try {
    const payload = verifyToken(header.slice(7));
    if (payload.type !== "staff") {
      return res.status(403).json({ error: "This session is not authorized for staff routes" });
    }
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

/** Requires the OWNER role specifically — used for withdrawal processing, staff management. */
function requireOwner(req, res, next) {
  if (!req.user || req.user.role !== "OWNER") {
    return res.status(403).json({ error: "This action requires the Owner role" });
  }
  next();
}

/**
 * Requires a valid client session token. Attaches req.client = { id, email }.
 * A client token can only ever be used to access that client's own data —
 * routes must additionally filter every query by req.client.id, never trust
 * a clientId passed in the request body/params for a client-authenticated route.
 */
function requireClientAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed authorization header" });
  }
  try {
    const payload = verifyToken(header.slice(7));
    if (payload.type !== "client") {
      return res.status(403).json({ error: "This session is not authorized for client routes" });
    }
    req.client = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

module.exports = { requireStaffAuth, requireOwner, requireClientAuth };
