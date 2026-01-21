import { migrate, openDB } from '../src/db';
import { defaultThemeForRole, ROLE_META } from '../src/themes';
import { nowISO, sanitizeLogin, validateEmail, validateLogin, validatePassword } from '../src/utils';

type Config = {
  domain?: string;
  adminEmail?: string;
  adminName?: string;
  adminLogin?: string;
  adminPassword?: string;
  adminRole?: 'warrior' | 'amazon';
  adminTheme?: string;
  port?: number;
  dbPath?: string;
  staticDir?: string;
};

async function readConfigAsync(): Promise<Config> {
  const f = Bun.file('./config.json');
  if (!(await f.exists())) {
    process.exit(1);
  }
  const txt = await f.text();
  try {
    return JSON.parse(txt);
  } catch {
    process.exit(1);
  }
}

async function main(){
  const cfg = await readConfigAsync();

  const dbPath = cfg.dbPath || process.env.PARITER_DB || './pariter.db';
  const db = openDB(dbPath);
  migrate(db);

  const admins = db.query('SELECT id FROM users WHERE is_admin = 1 LIMIT 1').all() as any[];
  if (admins.length) {
    process.exit(0);
  }

  const email = String(cfg.adminEmail || '').trim();
  const name = String(cfg.adminName || 'Admin').trim();
  const login = sanitizeLogin(cfg.adminLogin || 'admin');
  const password = String(cfg.adminPassword || '');
  const role = (cfg.adminRole || 'warrior') as any;
  const theme = String(cfg.adminTheme || defaultThemeForRole(role));

  if (!validateEmail(email)) {
    process.exit(1);
  }
  if (!name || name.length < 2) {
    process.exit(1);
  }
  if (!validateLogin(login)) {
    process.exit(1);
  }
  if (!validatePassword(password)) {
    process.exit(1);
  }
  if (!(role in ROLE_META)) {
    process.exit(1);
  }

  db.run('INSERT INTO teams (created_at) VALUES (?)', [nowISO()]);
  const teamRow = db.query('SELECT last_insert_rowid() AS id').get() as any;
  const teamId = Number(teamRow.id);

  const exists = db.query('SELECT id FROM users WHERE login = ?').get(login);
  if (exists) {
    process.exit(1);
  }

  const password_hash = await Bun.password.hash(password);
  db.run(
    'INSERT INTO users (team_id, email, name, login, password_hash, role, theme, is_admin, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
    [teamId, email, name, login, password_hash, role, theme, 1, nowISO()]
  );
}

main();
