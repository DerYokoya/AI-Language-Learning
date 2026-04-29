const db = require("../db/connection");

module.exports = {
  async getMe(req, res) {
    const user = await db.query(
      "SELECT email FROM users WHERE id=$1",
      [req.userId]
    );
    res.json(user.rows[0]);
  },

  async updateSettings(req, res) {
    const { theme, language, difficulty, autoReadEnabled } = req.body;

    await db.query(
      `INSERT INTO user_settings (user_id, theme, language, difficulty, auto_read_enabled)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id)
       DO UPDATE SET theme=$2, language=$3, difficulty=$4, auto_read_enabled=$5`,
      [req.userId, theme, language, difficulty, autoReadEnabled]
    );

    res.json({ success: true });
  }
};
