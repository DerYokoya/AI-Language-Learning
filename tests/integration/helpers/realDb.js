/**
 * Real Postgres for integration tests. Uses the app's actual connection module
 * against TEST_DATABASE_URL (load src/db/schema.sql into it first).
 * reset() wipes every table between tests; count() reads real row counts.
 */
const db = require("../../../src/db/connection");

const TABLES = ["chat_messages", "chats", "flashcards", "user_storage", "user_settings", "refresh_tokens", "users"];

async function reset() {
  await db.query(`TRUNCATE ${TABLES.join(", ")} RESTART IDENTITY CASCADE`);
}

async function count(table) {
  if (!TABLES.includes(table)) throw new Error(`unknown table ${table}`);
  const { rows } = await db.query(`SELECT COUNT(*)::int AS n FROM ${table}`);
  return rows[0].n;
}

async function rows(table) {
  if (!TABLES.includes(table)) throw new Error(`unknown table ${table}`);
  return (await db.query(`SELECT * FROM ${table}`)).rows;
}

module.exports = { reset, count, rows, end: () => db.end() };
