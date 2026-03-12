/**
 * SQLite database para Web Job Finder.
 * Tablas: users, posibles_clientes (por usuario).
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, '..', 'data', 'wjf.db');

function ensureDataDir() {
  const fs = require('fs');
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

let db = null;

function getDb() {
  if (!db) {
    ensureDataDir();
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    initSchema(db);
  }
  return db;
}

function initSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS posibles_clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      place_id TEXT NOT NULL,
      name TEXT NOT NULL,
      address TEXT DEFAULT '',
      formatted_phone_number TEXT DEFAULT '',
      website TEXT DEFAULT '',
      note TEXT DEFAULT '',
      added_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, place_id)
    );

    CREATE INDEX IF NOT EXISTS idx_posibles_user ON posibles_clientes(user_id);
  `);
  try {
    database.exec(`ALTER TABLE posibles_clientes ADD COLUMN custom_message TEXT DEFAULT ''`);
  } catch (e) {
    if (!/duplicate column name/i.test(e.message)) throw e;
  }
  try {
    database.exec(`ALTER TABLE posibles_clientes ADD COLUMN place_description TEXT DEFAULT ''`);
  } catch (e) {
    if (!/duplicate column name/i.test(e.message)) throw e;
  }
}

module.exports = { getDb, initSchema };
