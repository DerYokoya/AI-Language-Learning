const jwt = require("jsonwebtoken");

const ACCESS_EXPIRY  = "15m";
const REFRESH_EXPIRY = "30d";

module.exports = {
  /** Short-lived access token stored in an httpOnly cookie */
  signAccess(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: ACCESS_EXPIRY });
  },

  /** Long-lived refresh token stored in a separate httpOnly cookie */
  signRefresh(payload) {
    const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + "_refresh";
    return jwt.sign(payload, secret, { expiresIn: REFRESH_EXPIRY });
  },

  verify(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
  },

  verifyRefresh(token) {
    const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + "_refresh";
    return jwt.verify(token, secret);
  },
};