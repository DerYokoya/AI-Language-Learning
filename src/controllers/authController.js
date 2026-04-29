const crypto = require("crypto");
const db     = require("../db/connection");
const hash   = require("../utils/hash");
const jwt    = require("../utils/jwt");

const REFRESH_DAYS = 30;

function setTokenCookies(res, accessToken, refreshToken) {
  res.cookie("token", accessToken, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 15 * 60 * 1000, // 15 min
  });
  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/api/auth/refresh", // only sent to the refresh endpoint
    maxAge: REFRESH_DAYS * 24 * 60 * 60 * 1000,
  });
}

async function issueTokens(res, userId) {
  const accessToken  = jwt.signAccess({ id: userId });
  const refreshToken = jwt.signRefresh({ id: userId });

  // Persist refresh token
  const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);
  await db.query(
    "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1,$2,$3)",
    [userId, refreshToken, expiresAt]
  );

  setTokenCookies(res, accessToken, refreshToken);
  return { accessToken, refreshToken };
}

module.exports = {
  async signup(req, res) {
    try {
      const { email, password, displayName } = req.body;
      if (!email || !password)
        return res.status(400).json({ error: "Email and password are required" });

      const existing = await db.query("SELECT id FROM users WHERE email=$1", [email]);
      if (existing.rows.length > 0)
        return res.status(400).json({ error: "Email already in use" });

      const passwordHash = await hash.hashPassword(password);
      const result = await db.query(
        "INSERT INTO users (email, password_hash, display_name) VALUES ($1,$2,$3) RETURNING id, email, display_name",
        [email, passwordHash, displayName || null]
      );

      const user = result.rows[0];
      await issueTokens(res, user.id);
      res.json({ id: user.id, email: user.email, displayName: user.display_name });
    } catch (err) {
      console.error("signup error:", err);
      res.status(500).json({ error: "Server error" });
    }
  },

  async login(req, res) {
    try {
      const { email, password } = req.body;
      if (!email || !password)
        return res.status(400).json({ error: "Email and password are required" });

      const result = await db.query("SELECT * FROM users WHERE email=$1", [email]);
      if (result.rows.length === 0)
        return res.status(400).json({ error: "Invalid credentials" });

      const user = result.rows[0];
      const valid = await hash.comparePassword(password, user.password_hash);
      if (!valid)
        return res.status(400).json({ error: "Invalid credentials" });

      await issueTokens(res, user.id);
      res.json({ id: user.id, email: user.email, displayName: user.display_name });
    } catch (err) {
      console.error("login error:", err);
      res.status(500).json({ error: "Server error" });
    }
  },

  async refresh(req, res) {
    try {
      const token = req.cookies.refresh_token;
      if (!token) return res.status(401).json({ error: "No refresh token" });

      let decoded;
      try {
        decoded = jwt.verifyRefresh(token);
      } catch {
        return res.status(401).json({ error: "Invalid refresh token" });
      }

      // Check token exists in DB and isn't expired
      const row = await db.query(
        "SELECT * FROM refresh_tokens WHERE token=$1 AND expires_at > NOW()",
        [token]
      );
      if (row.rows.length === 0)
        return res.status(401).json({ error: "Refresh token revoked or expired" });

      // Rotate: delete old, issue new
      await db.query("DELETE FROM refresh_tokens WHERE token=$1", [token]);
      await issueTokens(res, decoded.id);

      // Return fresh user info
      const user = await db.query("SELECT id, email, display_name FROM users WHERE id=$1", [decoded.id]);
      res.json({ id: user.rows[0].id, email: user.rows[0].email, displayName: user.rows[0].display_name });
    } catch (err) {
      console.error("refresh error:", err);
      res.status(500).json({ error: "Server error" });
    }
  },

  async logout(req, res) {
    try {
      const token = req.cookies.refresh_token;
      if (token) {
        await db.query("DELETE FROM refresh_tokens WHERE token=$1", [token]);
      }
      res.clearCookie("token");
      res.clearCookie("refresh_token", { path: "/api/auth/refresh" });
      res.json({ success: true });
    } catch (err) {
      res.json({ success: true }); // always succeed on logout
    }
  },

  /** Returns the current user if their access token is valid */
  async me(req, res) {
    try {
      const token = req.cookies.token;
      if (!token) return res.json({ user: null });

      let decoded;
      try {
        decoded = jwt.verify(token);
      } catch {
        return res.json({ user: null });
      }

      const result = await db.query(
        "SELECT id, email, display_name FROM users WHERE id=$1",
        [decoded.id]
      );
      if (!result.rows.length) return res.json({ user: null });

      const u = result.rows[0];
      res.json({ user: { id: u.id, email: u.email, displayName: u.display_name } });
    } catch (err) {
      res.json({ user: null });
    }
  },
};