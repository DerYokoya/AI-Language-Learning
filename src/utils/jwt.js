const jwt = require("jsonwebtoken");

const ACCESS_EXPIRY  = "15m";
const REFRESH_EXPIRY = "30d";

module.exports = {
  /** Short-lived access token stored in an httpOnly cookie */
  // Used to authenticate requests to protected routes.
  // Expires quickly to reduce the risk of token theft.
  signAccess(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: ACCESS_EXPIRY });
  },

  /** Long-lived refresh token stored in a separate httpOnly cookie */
  // Used to obtain a new access token when the old one expires.
  signRefresh(payload) {
    const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + "_refresh";
    return jwt.sign(payload, secret, { expiresIn: REFRESH_EXPIRY });
  },

  // Future prospect: using RS256 with a public/private keypair,
  // which would require a different verify() call.

  // Facilitates algorithms changes. Also reduces the risk of "alg": "none"
  // attacks by explicitly specifying the algorithm(s) to use.
  verify(token) {
    return jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
  },

  verifyRefresh(token) {
    const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + "_refresh";
    return jwt.verify(token, secret, {
      algorithms: ["HS256"],
    });
  },
};