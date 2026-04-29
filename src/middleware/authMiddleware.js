const jwt = require("../utils/jwt");

module.exports = function requireAuth(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  try {
    const decoded = jwt.verify(token);
    req.userId = decoded.id;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
};
