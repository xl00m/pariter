import { Database } from 'bun:sqlite';
import { nowISO } from './utils';

export type DB = Database;

export function openDB(path = './pariter.db'){
  const db = new Database(path);
  db.run('PRAGMA journal_mode = WAL;');
  db.run('PRAGMA foreign_keys = ON;');
  return db;
}

export function migrate(db: DB){
  // schema
  db.run(`CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL,
    email TEXT,
    name TEXT NOT NULL,
    login TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    theme TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    created_at TEXT,
    FOREIGN KEY(team_id) REFERENCES teams(id)
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL,
    code TEXT UNIQUE NOT NULL,
    created_by INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER DEFAULT 0,
    created_at TEXT,
    FOREIGN KEY(team_id) REFERENCES teams(id),
    FOREIGN KEY(created_by) REFERENCES users(id)
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    victory BLOB,
    lesson BLOB,
    created_at TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );`);

  // indices
  // Allow multiple entries per day: remove legacy UNIQUE(user_id, date) constraint if present.
  db.run('DROP INDEX IF EXISTS idx_entries_user_date_unique;');

  // Replace legacy indices with (.., id DESC) variants to support stable pagination within the same date.
  db.run('DROP INDEX IF EXISTS idx_entries_user_date;');
  db.run('DROP INDEX IF EXISTS idx_entries_date;');
  db.run('CREATE INDEX IF NOT EXISTS idx_entries_user_date_id ON entries(user_id, date DESC, id DESC);');
  db.run('CREATE INDEX IF NOT EXISTS idx_entries_date_id ON entries(date DESC, id DESC);');

  db.run('CREATE INDEX IF NOT EXISTS idx_invites_code ON invites(code);');
  db.run('CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);');

  // ensure created_at for existing nulls
  const ts = nowISO();
  db.run('UPDATE teams SET created_at = COALESCE(created_at, ?) WHERE created_at IS NULL;', [ts]);
  db.run('UPDATE users SET created_at = COALESCE(created_at, ?) WHERE created_at IS NULL;', [ts]);
  db.run('UPDATE invites SET created_at = COALESCE(created_at, ?) WHERE created_at IS NULL;', [ts]);
  db.run('UPDATE entries SET created_at = COALESCE(created_at, ?) WHERE created_at IS NULL;', [ts]);
}
