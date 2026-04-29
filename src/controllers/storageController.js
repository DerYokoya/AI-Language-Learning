const db = require("../db/connection");

module.exports = {
  async get(req, res) {
    const { key } = req.params;
    const result = await db.query(
      "SELECT value FROM user_storage WHERE user_id=$1 AND key=$2",
      [req.userId, key]
    );
    if (!result.rows.length) return res.json({ value: null });
    res.json({ value: result.rows[0].value });
  },

  async set(req, res) {
    const { key } = req.params;
    const { value } = req.body;
    await db.query(
      `INSERT INTO user_storage (user_id, key, value, updated_at)
       VALUES ($1,$2,$3,NOW())
       ON CONFLICT (user_id, key)
       DO UPDATE SET value=$3, updated_at=NOW()`,
      [req.userId, key, value]
    );
    res.json({ success: true });
  },

  async del(req, res) {
    const { key } = req.params;
    await db.query("DELETE FROM user_storage WHERE user_id=$1 AND key=$2", [req.userId, key]);
    res.json({ success: true });
  },

  /** Bulk-get multiple keys at once */
  async bulkGet(req, res) {
    const { keys } = req.body; // array of strings
    if (!Array.isArray(keys) || !keys.length) return res.json({});
    const result = await db.query(
      "SELECT key, value FROM user_storage WHERE user_id=$1 AND key=ANY($2)",
      [req.userId, keys]
    );
    const out = {};
    result.rows.forEach(r => { out[r.key] = r.value; });
    res.json(out);
  },
};