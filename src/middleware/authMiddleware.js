const jwt = require("../utils/jwt");
const AppError = require("../utils/AppError");

/**
 * requireAuth — blocks unauthenticated requests.
 * Tries the access token first; if expired it sends 401 with code "TOKEN_EXPIRED"
 * so the client can call /api/auth/refresh and retry.
 */
module.exports = function requireAuth(req, res, next) {
  const token = req.cookies.token;
  if (!token) return next(new AppError("Not authenticated", 401));

  try {
    const decoded = jwt.verify(token);
    req.userId = decoded.id;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return next(new AppError("Token expired", 401));
    }
    return next(new AppError("Invalid token", 401));
  }
};