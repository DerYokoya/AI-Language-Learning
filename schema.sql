-- AI Language Learning — Full Database Schema
-- Run once: psql $DATABASE_URL -f src/db/schema.sql

-- ─── Users ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT        NOT NULL,
  display_name  TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Refresh Tokens ──────────────────────────────────────────────────────────
-- Used for silent token renewal (access token = 15 min, refresh = 30 days)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

-- ─── User Settings ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_settings (
  user_id          INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme            TEXT    DEFAULT 'light',
  language         TEXT    DEFAULT 'Spanish',
  difficulty       TEXT    DEFAULT 'Beginner',
  auto_read_enabled BOOLEAN DEFAULT TRUE,
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Key–Value Storage ───────────────────────────────────────────────────────
-- Generic per-user persistence (replaces localStorage for logged-in users)
CREATE TABLE IF NOT EXISTS user_storage (
  user_id    INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key        TEXT NOT NULL,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, key)
);

-- ─── Chat Sessions ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chats (
  id                SERIAL PRIMARY KEY,
  user_id           INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title             TEXT NOT NULL DEFAULT 'New Chat',
  mode              TEXT NOT NULL DEFAULT 'conversation',
  language          TEXT NOT NULL DEFAULT 'Spanish',
  difficulty        TEXT NOT NULL DEFAULT 'Beginner',
  scenario          TEXT          DEFAULT 'restaurant',
  auto_read_enabled BOOLEAN       DEFAULT TRUE,
  created_at        TIMESTAMPTZ   DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chats_user ON chats(user_id);

-- ─── Chat Messages ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id         SERIAL PRIMARY KEY,
  chat_id    INT  NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender     TEXT NOT NULL,          -- 'user' | 'ai' | 'system-success' | 'system-error'
  text       TEXT,
  html       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat ON chat_messages(chat_id);

-- ─── Flashcards ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS flashcards (
  id           SERIAL PRIMARY KEY,
  user_id      INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  language     TEXT NOT NULL,
  difficulty   TEXT NOT NULL,
  front        TEXT NOT NULL,
  back         TEXT NOT NULL,
  known        BOOLEAN     DEFAULT FALSE,
  review_count INT         DEFAULT 0,
  added_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_flashcards_user ON flashcards(user_id);