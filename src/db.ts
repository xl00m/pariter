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

  // Web Push subscriptions
  // token is used for service-worker driven resubscribe (pushsubscriptionchange) without cookies.
  db.run(`CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    token TEXT,
    created_at TEXT,
    last_seen_at TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );`);

  // Backward compatible migration: ensure missing columns exist if table existed previously.
  // Some older installs may have push_subscriptions without token/last_seen_at.
  let psCols: any[] = [];
  try { psCols = db.query('PRAGMA table_info(push_subscriptions)').all() as any[]; } catch { psCols = []; }
  const hasCol = (name: string)=> psCols.some(c => String((c as any)?.name || '') === name);
  if (!hasCol('token')) {
    try { db.run('ALTER TABLE push_subscriptions ADD COLUMN token TEXT;'); } catch {}
  }
  if (!hasCol('last_seen_at')) {
    try { db.run('ALTER TABLE push_subscriptions ADD COLUMN last_seen_at TEXT;'); } catch {}
  }

  // AI memory: persistent compressed context per user (to keep context under 100KB)
  // last_entry_id tracks up to which entry the compressed summary includes.
  db.run(`CREATE TABLE IF NOT EXISTS ai_memory (
    user_id INTEGER PRIMARY KEY,
    compressed TEXT,
    updated_at TEXT,
    last_entry_id INTEGER,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );`);

  // Backward compatible migration: add last_entry_id if table existed without it.
  try { db.run('ALTER TABLE ai_memory ADD COLUMN last_entry_id INTEGER;'); } catch {}

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
  db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_push_endpoint_unique ON push_subscriptions(endpoint);');
  db.run('CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);');

  // Backfill token for existing rows that might have been created before token was introduced.
  try {
    const rows = db.query('SELECT id, token FROM push_subscriptions').all() as any[];
    for (const r of rows) {
      const t = String(r?.token || '').trim();
      if (t) continue;
      // token: 32 url-safe chars
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      const buf = crypto.getRandomValues(new Uint8Array(32));
      let tok = '';
      for (let i=0;i<32;i++) tok += chars[buf[i] % chars.length];
      db.run('UPDATE push_subscriptions SET token = ? WHERE id = ?', [tok, Number(r.id)]);
    }
  } catch {}

  // Unique token index (best-effort). Must run after token column exists + backfill.
  // On very old DBs token column may be missing; do not crash.
  try {
    const cols2 = db.query('PRAGMA table_info(push_subscriptions)').all() as any[];
    const hasToken = cols2.some(c => String((c as any)?.name || '') === 'token');
    if (hasToken) {
      // If this DB existed before token was added, the CREATE TABLE statement above does not
      // retroactively add the column; so we guard index creation.
      db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_push_token_unique ON push_subscriptions(token);');
    }
  } catch {}

  // ensure created_at for existing nulls
  const ts = nowISO();
  db.run('UPDATE teams SET created_at = COALESCE(created_at, ?) WHERE created_at IS NULL;', [ts]);
  db.run('UPDATE users SET created_at = COALESCE(created_at, ?) WHERE created_at IS NULL;', [ts]);
  db.run('UPDATE invites SET created_at = COALESCE(created_at, ?) WHERE created_at IS NULL;', [ts]);
  db.run('UPDATE entries SET created_at = COALESCE(created_at, ?) WHERE created_at IS NULL;', [ts]);
}
