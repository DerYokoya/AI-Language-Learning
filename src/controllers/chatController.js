const db = require("../db/connection");

module.exports = {
  async listChats(req, res) {
    const result = await db.query(
      "SELECT * FROM chats WHERE user_id=$1 ORDER BY updated_at DESC",
      [req.userId]
    );
    res.json(result.rows);
  },

  async getChat(req, res) {
    const chat = await db.query(
      "SELECT * FROM chats WHERE id=$1 AND user_id=$2",
      [req.params.id, req.userId]
    );

    const messages = await db.query(
      "SELECT * FROM chat_messages WHERE chat_id=$1 ORDER BY created_at ASC",
      [req.params.id]
    );

    res.json({ ...chat.rows[0], messages: messages.rows });
  },

  async createChat(req, res) {
    const { title, mode, language, difficulty, scenario, autoReadEnabled } = req.body;

    const result = await db.query(
      `INSERT INTO chats (user_id, title, mode, language, difficulty, scenario, auto_read_enabled)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [req.userId, title, mode, language, difficulty, scenario, autoReadEnabled]
    );

    res.json(result.rows[0]);
  },

  async updateChat(req, res) {
    const { title, mode, language, difficulty, scenario, autoReadEnabled } = req.body;

    await db.query(
      `UPDATE chats SET title=$1, mode=$2, language=$3, difficulty=$4, scenario=$5, auto_read_enabled=$6, updated_at=NOW()
       WHERE id=$7 AND user_id=$8`,
      [title, mode, language, difficulty, scenario, autoReadEnabled, req.params.id, req.userId]
    );

    res.json({ success: true });
  },

  async deleteChat(req, res) {
    await db.query("DELETE FROM chat_messages WHERE chat_id=$1", [req.params.id]);
    await db.query("DELETE FROM chats WHERE id=$1 AND user_id=$2", [req.params.id, req.userId]);
    res.json({ success: true });
  },

  async addMessage(req, res) {
    const { sender, text, html } = req.body;

    await db.query(
      `INSERT INTO chat_messages (chat_id, sender, text, html)
       VALUES ($1,$2,$3,$4)`,
      [req.params.id, sender, text, html]
    );

    await db.query(
      "UPDATE chats SET updated_at=NOW() WHERE id=$1",
      [req.params.id]
    );

    res.json({ success: true });
  }
};
