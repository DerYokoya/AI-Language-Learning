const crypto = require("crypto");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const CSRF_COOKIE = "csrf_token";
const CSRF_HEADER = "x-csrf-token";

function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

function sameOrigin(req, value) {
  if (!value || value === "null") return false;
  try {
    const url = new URL(value);
    return url.origin === `${req.protocol}://${req.get("host")}`;
  } catch {
    return false;
  }
}

function csrfProtection(req, res, next) {
  let token = req.cookies[CSRF_COOKIE];
  if (!token) {
    token = createToken();
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }

  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.get("origin");
  const referer = req.get("referer");
  const hasBrowserContext = origin !== undefined || referer !== undefined;
  if (!hasBrowserContext) return next();

  if ((origin && !sameOrigin(req, origin)) || (referer && !sameOrigin(req, referer))) {
    return res.status(403).json({ error: "Invalid request origin" });
  }

  const submittedToken = req.get(CSRF_HEADER);
  if (!submittedToken || submittedToken.length !== token.length) {
    return res.status(403).json({ error: "Invalid CSRF token" });
  }

  const valid = crypto.timingSafeEqual(
    Buffer.from(submittedToken),
    Buffer.from(token),
  );
  if (!valid) return res.status(403).json({ error: "Invalid CSRF token" });

  next();
}

module.exports = csrfProtection;
