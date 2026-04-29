const jwt = require("../utils/jwt");

/**
 * requireAuth — blocks unauthenticated requests.
 * Tries the access token first; if expired it sends 401 with code "TOKEN_EXPIRED"
 * so the client can call /api/auth/refresh and retry.
 */
module.exports = function requireAuth(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  try {
    const decoded = jwt.verify(token);
    req.userId = decoded.id;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired", code: "TOKEN_EXPIRED" });
    }
    return res.status(401).json({ error: "Invalid token" });
  }
};