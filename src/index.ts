import { meResponse, requireAuth } from './auth';
import { migrate, openDB } from './db';
import { handleApi } from './routes/api';
import { renderAppShell } from './routes/pages';

type Config = {
  port?: number;
  dbPath?: string;
  staticDir?: string;
};

async function readConfig(): Promise<Config> {
  try {
    const f = Bun.file('./config.json');
    if (!(await f.exists())) return {};
    const txt = await f.text();
    const obj = JSON.parse(txt);
    return (obj && typeof obj === 'object') ? obj : {};
  } catch {
    return {};
  }
}

async function loadDotEnv(path = './.env'){
  try {
    const f = Bun.file(path);
    if (!(await f.exists())) return;
    const txt = await f.text();
    const lines = txt.split(/\r?\n/);
    for (const line of lines) {
      const s = line.trim();
      if (!s || s.startsWith('#')) continue;
      const i = s.indexOf('=');
      if (i === -1) continue;
      const key = s.slice(0, i).trim();
      let val = s.slice(i + 1).trim();
      if (!key) continue;
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      const cur = process.env[key];
      if (cur == null || cur === '') {
        process.env[key] = val;
      }
    }
  } catch {
  }
}

await loadDotEnv();

const cfg = await readConfig();

const db = openDB(process.env.PARITER_DB || cfg.dbPath || './pariter.db');
migrate(db);

const staticDir = process.env.PARITER_STATIC || cfg.staticDir || './static';

const SECURE = process.env.PARITER_SECURE_COOKIE === '1';
const SECURITY_HEADERS: Record<string,string> = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'permissions-policy': 'geolocation=(), microphone=(), camera=()'
};
if (SECURE) SECURITY_HEADERS['strict-transport-security'] = 'max-age=31536000; includeSubDomains';

function withSecurityHeaders(res: Response){
  const h = new Headers(res.headers);
  for (const [k,v] of Object.entries(SECURITY_HEADERS)) {
    if (!h.has(k)) h.set(k, v);
  }
  return new Response(res.body, { status: res.status, headers: h });
}

function contentTypeFor(pathname: string){
  if (pathname.endsWith('.css')) return 'text/css; charset=utf-8';
  if (pathname.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (pathname.endsWith('.webmanifest')) return 'application/manifest+json; charset=utf-8';
  if (pathname.endsWith('.webmanifest')) return 'application/manifest+json; charset=utf-8';
  if (pathname.endsWith('.ico')) return 'image/x-icon';
  if (pathname.endsWith('.svg')) return 'image/svg+xml; charset=utf-8';
  if (pathname.endsWith('.png')) return 'image/png';
  if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

function safeStaticPath(pathname: string){
  const rel = pathname.replace(/^\/static\//, '');
  const clean = rel.split('/').filter(p => p && p !== '.' && p !== '..').join('/');
  return staticDir.replace(/\/$/,'') + '/' + clean;
}

async function serveFile(pathname: string){
  const filePath = safeStaticPath(pathname);
  const f = Bun.file(filePath);
  if (!(await f.exists())) return new Response('not found', { status: 404 });

  const hot = (pathname.endsWith('.js') || pathname.endsWith('.css'));

  const headers: Record<string,string> = {
    'content-type': contentTypeFor(pathname),
  };

  if (hot) {
    headers['cache-control'] = 'no-cache, no-store, must-revalidate';
    headers['pragma'] = 'no-cache';
    headers['expires'] = '0';
  } else {
    headers['cache-control'] = 'public, max-age=86400';
  }

  return new Response(f, { headers });
}

function isStatic(pathname: string){
  return pathname.startsWith('/static/') || pathname === '/favicon.ico' || pathname === '/sw.js';
}

function isPushPath(pathname: string){
  return pathname.startsWith('/api/push/');
}

const server = Bun.serve({
  port: Number(process.env.PORT || cfg.port || 8080),
  async fetch(req){
    const url = new URL(req.url);
    const path = url.pathname;

    if (isStatic(path)) {
      if (path === '/favicon.ico') {
        const ico = Bun.file(staticDir.replace(/\/$/,'') + '/favicon.ico');
        if (await ico.exists()) {
          return withSecurityHeaders(new Response(ico, {
            headers: { 'content-type': 'image/x-icon', 'cache-control': 'public, max-age=86400' }
          }));
        }
        const svg = Bun.file(staticDir.replace(/\/$/,'') + '/favicon.svg');
        if (await svg.exists()) {
          return withSecurityHeaders(new Response(svg, {
            headers: { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'public, max-age=86400' }
          }));
        }
        return withSecurityHeaders(new Response('not found', { status: 404 }));
      }

      return withSecurityHeaders(await serveFile(path));
    }

    if (path.startsWith('/api/')) {
      if (isPushPath(path) && (req.method === 'GET' || req.method === 'HEAD')) {
        const auth = String(req.headers.get('authorization') || '').trim();
        if (auth.toLowerCase().startsWith('bearer ')) {
          return withSecurityHeaders(await handleApi(db, req));
        }
      }

      if (path === '/api/me' && req.method === 'GET') return withSecurityHeaders(meResponse(db, req));
      return withSecurityHeaders(await handleApi(db, req));
    }

    let themeId: string | undefined = undefined;
    let authed = false;
    let bootstrap: any = undefined;
    try {
      const { user, team } = requireAuth(db, req);
      themeId = user?.theme || undefined;
      authed = true;

      const users = db.query(
        'SELECT id, team_id, email, name, login, role, theme, is_admin, created_at FROM users WHERE team_id = ? ORDER BY datetime(created_at) ASC'
      ).all(user.team_id) as any[];

      const safeUser = { ...user };
      delete (safeUser as any).password_hash;
      bootstrap = { user: safeUser, team, teamUsers: users };
    } catch {}

    if (authed && (path === '/' || path === '/login' || path === '/register' || path.startsWith('/join/'))) {
      return withSecurityHeaders(Response.redirect('/path', 302));
    }

    if (!authed && (path === '/path' || path === '/settings' || path === '/invite')) {
      return withSecurityHeaders(Response.redirect('/login', 302));
    }

    const allowed = new Set(['/', '/login', '/register', '/path', '/settings', '/invite']);
    if (allowed.has(path) || path.startsWith('/join/')) {
      return withSecurityHeaders(new Response(renderAppShell(path, themeId, bootstrap), {
        headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }
      }));
    }

    return withSecurityHeaders(new Response(renderAppShell(path, themeId, bootstrap), {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }
    }));
  }
});

console.log(`PARITER running on http://localhost:${server.port}`);
