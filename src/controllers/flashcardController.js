const db = require("../db/connection");

module.exports = {
  async list(req, res) {
    const result = await db.query(
      "SELECT * FROM flashcards WHERE user_id=$1 ORDER BY added_at DESC",
      [req.userId]
    );
    res.json(result.rows);
  },

  async bulkAdd(req, res) {
    const cards = req.body;

    for (const c of cards) {
      await db.query(
        `INSERT INTO flashcards (user_id, language, difficulty, front, back, known, review_count)
         VALUES ($1,$2,$3,$4,$5,false,0)`,
        [req.userId, c.language, c.difficulty, c.front, c.back]
      );
    }

    res.json({ success: true });
  },

  async update(req, res) {
    const { known } = req.body;

    await db.query(
      `UPDATE flashcards SET known=$1, review_count=review_count+1
       WHERE id=$2 AND user_id=$3`,
      [known, req.params.id, req.userId]
    );

    res.json({ success: true });
  },

  async clear(req, res) {
    await db.query("DELETE FROM flashcards WHERE user_id=$1", [req.userId]);
    res.json({ success: true });
  }
};
