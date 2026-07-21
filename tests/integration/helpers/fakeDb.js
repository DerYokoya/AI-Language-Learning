/**
 * A small in-memory stand-in for src/db/connection.js.
 *
 * Integration tests care about how routes, middleware, and controllers work
 * together over real HTTP requests (via supertest). The actual Postgres
 * server is the one boundary we can't bring into a test run, so it's the one
 * thing we fake — everything else in the app (express app, routers,
 * middleware, controllers, jwt/hash utils) runs for real.
 *
 * This module recognizes the exact queries issued by the controllers and
 * maintains simple in-memory tables so that multi-request flows (signup ->
 * login -> create a chat -> list chats -> ...) behave the way they would
 * against a real database, including uniqueness constraints and per-user
 * scoping.
 */

let state;

function reset() {
  state = {
    users: [],
    nextUserId: 1,
    refreshTokens: [],
    nextRefreshId: 1,
    chats: [],
    nextChatId: 1,
    chatMessages: [],
    nextMessageId: 1,
    flashcards: [],
    nextFlashcardId: 1,
    userStorage: [],
    userSettings: [],
  };
}
reset();

function norm(text) {
  return text.replace(/\s+/g, " ").trim();
}

async function query(text, params = []) {
  const q = norm(text);

  // ── users / auth ──────────────────────────────────────────────────────
  if (q === "SELECT id FROM users WHERE email=$1") {
    const [email] = params;
    return { rows: state.users.filter(u => u.email === email).map(u => ({ id: u.id })) };
  }

  if (q.startsWith("INSERT INTO users")) {
    const [email, password_hash, display_name] = params;
    if (state.users.some(u => u.email === email)) {
      const err = new Error('duplicate key value violates unique constraint "idx_users_email_lower"');
      err.code = "23505";
      throw err;
    }
    const user = { id: state.nextUserId++, email, password_hash, display_name: display_name ?? null };
    state.users.push(user);
    return { rows: [{ id: user.id, email: user.email, display_name: user.display_name }] };
  }

  if (q === "SELECT * FROM users WHERE email=$1") {
    const [email] = params;
    return { rows: state.users.filter(u => u.email === email) };
  }

  if (q === "SELECT id, email, display_name FROM users WHERE id=$1") {
    const [id] = params;
    return { rows: state.users.filter(u => u.id === id).map(u => ({ id: u.id, email: u.email, display_name: u.display_name })) };
  }

  if (q === "SELECT email FROM users WHERE id=$1") {
    const [id] = params;
    return { rows: state.users.filter(u => u.id === id).map(u => ({ email: u.email })) };
  }

  // ── refresh tokens ─────────────────────────────────────────────────────
  if (q.startsWith("INSERT INTO refresh_tokens")) {
    const [user_id, token, expires_at] = params;
    state.refreshTokens.push({ id: state.nextRefreshId++, user_id, token, expires_at });
    return { rows: [] };
  }

  if (q === "SELECT * FROM refresh_tokens WHERE token=$1 AND expires_at > NOW()") {
    const [token] = params;
    const now = new Date();
    return { rows: state.refreshTokens.filter(r => r.token === token && new Date(r.expires_at) > now) };
  }

  if (q === "DELETE FROM refresh_tokens WHERE token=$1") {
    const [token] = params;
    state.refreshTokens = state.refreshTokens.filter(r => r.token !== token);
    return { rows: [] };
  }

  // ── user_settings ──────────────────────────────────────────────────────
  if (q.startsWith("INSERT INTO user_settings")) {
    const [user_id, theme, language, difficulty, auto_read_enabled] = params;
    const existing = state.userSettings.find(s => s.user_id === user_id);
    if (existing) {
      Object.assign(existing, { theme, language, difficulty, auto_read_enabled });
    } else {
      state.userSettings.push({ user_id, theme, language, difficulty, auto_read_enabled });
    }
    return { rows: [] };
  }

  // ── chats ──────────────────────────────────────────────────────────────
  if (q === "SELECT * FROM chats WHERE user_id=$1 ORDER BY updated_at DESC") {
    const [user_id] = params;
    return {
      rows: state.chats
        .filter(c => c.user_id === user_id)
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)),
    };
  }

  if (q === "SELECT * FROM chats WHERE id=$1 AND user_id=$2") {
    const [id, user_id] = params;
    return { rows: state.chats.filter(c => String(c.id) === String(id) && c.user_id === user_id) };
  }

  if (q === "SELECT * FROM chat_messages WHERE chat_id=$1 ORDER BY created_at ASC") {
    const [chat_id] = params;
    return {
      rows: state.chatMessages
        .filter(m => String(m.chat_id) === String(chat_id))
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    };
  }

  if (q.startsWith("INSERT INTO chats")) {
    const [user_id, title, mode, language, difficulty, scenario, auto_read_enabled] = params;
    const now = new Date().toISOString();
    const chat = {
      id: state.nextChatId++,
      user_id,
      title,
      mode,
      language,
      difficulty,
      scenario: scenario ?? null,
      auto_read_enabled: auto_read_enabled ?? null,
      created_at: now,
      updated_at: now,
    };
    state.chats.push(chat);
    return { rows: [chat] };
  }

  if (q.includes("UPDATE chats SET title=$1")) {
    const [title, mode, language, difficulty, scenario, auto_read_enabled, id, user_id] = params;
    const chat = state.chats.find(c => String(c.id) === String(id) && c.user_id === user_id);
    if (chat) {
      Object.assign(chat, { title, mode, language, difficulty, scenario, auto_read_enabled, updated_at: new Date().toISOString() });
    }
    return { rows: [] };
  }

  if (q === "DELETE FROM chat_messages WHERE chat_id=$1") {
    const [chat_id] = params;
    state.chatMessages = state.chatMessages.filter(m => String(m.chat_id) !== String(chat_id));
    return { rows: [] };
  }

  if (q === "DELETE FROM chats WHERE id=$1 AND user_id=$2") {
    const [id, user_id] = params;
    state.chats = state.chats.filter(c => !(String(c.id) === String(id) && c.user_id === user_id));
    return { rows: [] };
  }

  if (q.startsWith("INSERT INTO chat_messages")) {
    const [chat_id, sender, text, html] = params;
    state.chatMessages.push({
      id: state.nextMessageId++,
      chat_id,
      sender,
      text,
      html,
      created_at: new Date().toISOString(),
    });
    return { rows: [] };
  }

  if (q === "UPDATE chats SET updated_at=NOW() WHERE id=$1") {
    const [id] = params;
    const chat = state.chats.find(c => String(c.id) === String(id));
    if (chat) chat.updated_at = new Date().toISOString();
    return { rows: [] };
  }

  // ── flashcards ─────────────────────────────────────────────────────────
  if (q === "SELECT * FROM flashcards WHERE user_id=$1 ORDER BY added_at DESC") {
    const [user_id] = params;
    return {
      rows: state.flashcards
        .filter(c => c.user_id === user_id)
        .sort((a, b) => new Date(b.added_at) - new Date(a.added_at)),
    };
  }

  if (q.startsWith("INSERT INTO flashcards")) {
    const [user_id, language, difficulty, front, back] = params;
    state.flashcards.push({
      id: state.nextFlashcardId++,
      user_id,
      language,
      difficulty,
      front,
      back,
      known: false,
      review_count: 0,
      added_at: new Date().toISOString(),
    });
    return { rows: [] };
  }

  if (q.includes("UPDATE flashcards SET known=$1")) {
    const [known, id, user_id] = params;
    const card = state.flashcards.find(c => String(c.id) === String(id) && c.user_id === user_id);
    if (card) {
      card.known = known;
      card.review_count += 1;
    }
    return { rows: [] };
  }

  if (q === "DELETE FROM flashcards WHERE user_id=$1") {
    const [user_id] = params;
    state.flashcards = state.flashcards.filter(c => c.user_id !== user_id);
    return { rows: [] };
  }

  // ── user_storage ───────────────────────────────────────────────────────
  if (q === "SELECT value FROM user_storage WHERE user_id=$1 AND key=$2") {
    const [user_id, key] = params;
    const row = state.userStorage.find(s => s.user_id === user_id && s.key === key);
    return { rows: row ? [{ value: row.value }] : [] };
  }

  if (q.startsWith("INSERT INTO user_storage")) {
    const [user_id, key, value] = params;
    const existing = state.userStorage.find(s => s.user_id === user_id && s.key === key);
    if (existing) {
      existing.value = value;
      existing.updated_at = new Date().toISOString();
    } else {
      state.userStorage.push({ user_id, key, value, updated_at: new Date().toISOString() });
    }
    return { rows: [] };
  }

  if (q === "DELETE FROM user_storage WHERE user_id=$1 AND key=$2") {
    const [user_id, key] = params;
    state.userStorage = state.userStorage.filter(s => !(s.user_id === user_id && s.key === key));
    return { rows: [] };
  }

  if (q === "SELECT key, value FROM user_storage WHERE user_id=$1 AND key=ANY($2)") {
    const [user_id, keys] = params;
    return {
      rows: state.userStorage
        .filter(s => s.user_id === user_id && keys.includes(s.key))
        .map(s => ({ key: s.key, value: s.value })),
    };
  }

  throw new Error(`fakeDb: unrecognized query -> ${q}`);
}

module.exports = { query, reset, _state: () => state };
