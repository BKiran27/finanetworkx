'use strict';

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'finanetwork.db');

// Ensure the data directory exists
const fs = require('fs');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ──────────────────────────────────────────────
// Table Creation
// ──────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    email         TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    title         TEXT    DEFAULT '',
    bio           TEXT    DEFAULT '',
    avatar_url    TEXT    DEFAULT '',
    created_at    TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS portfolios (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id   INTEGER NOT NULL,
    coin_id   TEXT    NOT NULL,
    coin_name TEXT    NOT NULL,
    symbol    TEXT    NOT NULL,
    amount    REAL    NOT NULL DEFAULT 0,
    buy_price REAL    NOT NULL DEFAULT 0,
    added_at  TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS connections (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id   INTEGER NOT NULL,
    receiver_id INTEGER NOT NULL,
    status      TEXT    NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected')),
    created_at  TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (sender_id)   REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(sender_id, receiver_id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    type       TEXT    NOT NULL,
    message    TEXT    NOT NULL,
    read       INTEGER NOT NULL DEFAULT 0,
    data_json  TEXT    DEFAULT '{}',
    created_at TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// ──────────────────────────────────────────────
// Indexes for Performance
// ──────────────────────────────────────────────

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_portfolios_user    ON portfolios(user_id);
  CREATE INDEX IF NOT EXISTS idx_connections_sender  ON connections(sender_id);
  CREATE INDEX IF NOT EXISTS idx_connections_receiver ON connections(receiver_id);
  CREATE INDEX IF NOT EXISTS idx_connections_status   ON connections(status);
  CREATE INDEX IF NOT EXISTS idx_notifications_user   ON notifications(user_id);
  CREATE INDEX IF NOT EXISTS idx_notifications_read   ON notifications(read);
  CREATE INDEX IF NOT EXISTS idx_users_email          ON users(email);
`);

// ──────────────────────────────────────────────
// Graceful shutdown — close DB on process exit
// ──────────────────────────────────────────────

process.on('exit', () => db.close());
process.on('SIGHUP', () => process.exit(128 + 1));
process.on('SIGINT', () => process.exit(128 + 2));
process.on('SIGTERM', () => process.exit(128 + 15));

module.exports = db;
