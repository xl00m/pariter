import type { DB } from './db';
import { error, json, nowISO, parseCookies, setCookie, uuidv4 } from './utils';

export const SESSION_COOKIE = 'pariter_sid';

export function sessionTTLISO(days=30){
  const ms = days * 24*60*60*1000;
  return new Date(Date.now() + ms).toISOString();
}

export async function hashPassword(password: string){
  if (globalThis.Bun?.password?.hash) {
    return await Bun.password.hash(password);
  }
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), {name:'PBKDF2'}, false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name:'PBKDF2', salt, iterations: 120000, hash:'SHA-256' }, keyMaterial, 256);
  const b64 = (u8: Uint8Array)=> Buffer.from(u8).toString('base64');
  return JSON.stringify({ alg:'PBKDF2-SHA256', salt: b64(salt), hash: b64(new Uint8Array(bits)) });
}

export async function verifyPassword(password: string, passwordHash: string){
  if (globalThis.Bun?.password?.verify) {
    return await Bun.password.verify(password, passwordHash);
  }
  try {
    const obj = JSON.parse(passwordHash);
    const enc = new TextEncoder();
    const salt = Buffer.from(obj.salt, 'base64');
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), {name:'PBKDF2'}, false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name:'PBKDF2', salt, iterations: 120000, hash:'SHA-256' }, keyMaterial, 256);
    const hash = Buffer.from(new Uint8Array(bits)).toString('base64');
    return hash === obj.hash;
  } catch {
    return false;
  }
}

export function cleanExpiredSessions(db: DB){
  db.run('DELETE FROM sessions WHERE expires_at <= ?', [nowISO()]);
}

export function getSessionId(req: Request){
  const cookies = parseCookies(req.headers.get('cookie'));
  return cookies[SESSION_COOKIE] || null;
}

export function setSessionCookieHeaders(sessionId: string){
  const secure = process.env.PARITER_SECURE_COOKIE === '1';
  const cookie = setCookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure,
    sameSite: 'Strict',
    path: '/',
    maxAgeSec: 30*24*60*60,
  });
  return { 'set-cookie': cookie } as Record<string,string>;
}

export function clearSessionCookieHeaders(){
  const secure = process.env.PARITER_SECURE_COOKIE === '1';
  const cookie = setCookie(SESSION_COOKIE, 'deleted', {
    httpOnly: true,
    secure,
    sameSite: 'Strict',
    path: '/',
    maxAgeSec: 0,
  });
  return { 'set-cookie': cookie } as Record<string,string>;
}

export function requireAuth(db: DB, req: Request){
  cleanExpiredSessions(db);
  const sid = getSessionId(req);
  if (!sid) throw new Error('Не авторизован.');

  const sess = db.query('SELECT id, user_id, expires_at FROM sessions WHERE id = ?').get(sid) as any;
  if (!sess) throw new Error('Сессия недействительна.');
  if (new Date(sess.expires_at).getTime() <= Date.now()) {
    db.run('DELETE FROM sessions WHERE id = ?', [sid]);
    throw new Error('Сессия истекла.');
  }

  const user = db.query('SELECT * FROM users WHERE id = ?').get(sess.user_id) as any;
  if (!user) throw new Error('Пользователь не найден.');

  const team = db.query('SELECT * FROM teams WHERE id = ?').get(user.team_id) as any;
  if (!team) throw new Error('Команда не найдена.');

  return { sid, user, team };
}

export function authErrorToResponse(err: unknown){
  const msg = err instanceof Error ? err.message : 'Ошибка.';
  if (msg.includes('Не авторизован') || msg.includes('Сессия')) return error(msg, 401);
  return error(msg, 400);
}

export function meResponse(db: DB, req: Request){
  try {
    const { user, team } = requireAuth(db, req);
    const safeUser = { ...user };
    delete (safeUser as any).password_hash;
    return json({ user: safeUser, team });
  } catch {
    return json({ user: null, team: null });
  }
}

export function createSession(db: DB, userId: number){
  const sid = uuidv4();
  const expires_at = sessionTTLISO(30);
  db.run('INSERT INTO sessions (id, user_id, expires_at) VALUES (?,?,?)', [sid, userId, expires_at]);
  return { sid, expires_at };
}
