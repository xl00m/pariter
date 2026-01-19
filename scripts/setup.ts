import { openDB, migrate } from '../src/db';
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
    console.log('config.json не найден. Создай config.json в корне проекта.');
    process.exit(1);
  }
  const txt = await f.text();
  try { return JSON.parse(txt); } catch {
    console.log('config.json повреждён: невалидный JSON.');
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
    console.log('Администратор уже существует. setup.ts ничего не менял.');
    process.exit(0);
  }

  const email = String(cfg.adminEmail || '').trim();
  const name = String(cfg.adminName || 'Admin').trim();
  const login = sanitizeLogin(cfg.adminLogin || 'admin');
  const password = String(cfg.adminPassword || '');
  const role = (cfg.adminRole || 'warrior') as any;
  const theme = String(cfg.adminTheme || defaultThemeForRole(role));

  if (!validateEmail(email)) {
    console.log('adminEmail в config.json должен быть корректным email.');
    process.exit(1);
  }
  if (!name || name.length < 2) {
    console.log('adminName слишком короткое.');
    process.exit(1);
  }
  if (!validateLogin(login)) {
    console.log('adminLogin: 3–32 символа (a-z, 0-9, _ . -).');
    process.exit(1);
  }
  if (!validatePassword(password)) {
    console.log('adminPassword: минимум 6 символов.');
    process.exit(1);
  }
  if (!(role in ROLE_META)) {
    console.log('adminRole должен быть warrior или amazon.');
    process.exit(1);
  }

  db.run('INSERT INTO teams (created_at) VALUES (?)', [nowISO()]);
  const teamRow = db.query('SELECT last_insert_rowid() AS id').get() as any;
  const teamId = Number(teamRow.id);

  const exists = db.query('SELECT id FROM users WHERE login = ?').get(login);
  if (exists) {
    console.log('Пользователь с таким login уже существует.');
    process.exit(1);
  }

  const password_hash = await Bun.password.hash(password);
  db.run(
    'INSERT INTO users (team_id, email, name, login, password_hash, role, theme, is_admin, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
    [teamId, email, name, login, password_hash, role, theme, 1, nowISO()]
  );

  console.log('Готово: создана команда и администратор.');
  console.log(`Login: ${login}`);
  console.log(`Role:  ${role}`);
  console.log(`Theme: ${theme}`);
  console.log(`DB:    ${dbPath}`);
}

main();
