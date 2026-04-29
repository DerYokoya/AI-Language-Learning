const db = require("../db/connection");
const hash = require("../utils/hash");
const jwt = require("../utils/jwt");

module.exports = {
  async signup(req, res) {
    const { email, password } = req.body;

    const existing = await db.query("SELECT id FROM users WHERE email=$1", [email]);
    if (existing.rows.length > 0)
      return res.status(400).json({ error: "Email already exists" });

    const passwordHash = await hash.hashPassword(password);

    const result = await db.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id",
      [email, passwordHash]
    );

    const token = jwt.sign({ id: result.rows[0].id });
    res.cookie("token", token, { httpOnly: true });

    res.json({ id: result.rows[0].id, email });
  },

  async login(req, res) {
    const { email, password } = req.body;

    const result = await db.query("SELECT * FROM users WHERE email=$1", [email]);
    if (result.rows.length === 0)
      return res.status(400).json({ error: "Invalid credentials" });

    const user = result.rows[0];
    const valid = await hash.comparePassword(password, user.password_hash);
    if (!valid) return res.status(400).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user.id });
    res.cookie("token", token, { httpOnly: true });

    res.json({ id: user.id, email });
  },

  logout(req, res) {
    res.clearCookie("token");
    res.json({ success: true });
  }
};
