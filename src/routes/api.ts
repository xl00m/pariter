import type { DB } from '../db';
import { ROLE_META, THEMES, defaultThemeForRole } from '../themes';
import { authErrorToResponse, clearSessionCookieHeaders, createSession, requireAuth, setSessionCookieHeaders } from '../auth';
import { error, json, nowISO, randomInviteCode, readJson, sanitizeLogin, todayYMD, validateEmail, validateLogin, validatePassword } from '../utils';
import { getVapidPublicKeyB64Url, sendWebPush } from '../push';

function themeAllowed(role: string, theme: string){
  return THEMES.some(t => t.id === theme && t.role === role);
}

function errorWithReason(msg: string, reason: string, status=400){
  return json({ error: msg, reason }, status);
}

function safeUser(u: any){
  const out = { ...u };
  delete out.password_hash;
  return out;
}

function gzipText(text: string){
  // Bun.gzipSync returns Buffer/Uint8Array
  // @ts-ignore
  const bytes = Bun.gzipSync(new TextEncoder().encode(text || ''));
  return bytes;
}

function gunzipText(blob: Uint8Array | null | undefined){
  if (!blob) return '';
  // @ts-ignore
  const out = Bun.gunzipSync(blob);
  return new TextDecoder().decode(out);
}

function clampUTF8(text: string, maxBytes: number){
  const enc = new TextEncoder();
  const bytes = enc.encode(text);
  if (bytes.length <= maxBytes) return text;
  // truncate by bytes
  const sliced = bytes.slice(0, maxBytes);
  return new TextDecoder().decode(sliced);
}

function dropFirstUTF8Bytes(text: string, dropBytes: number){
  const enc = new TextEncoder();
  const bytes = enc.encode(text);
  if (bytes.length <= dropBytes) return '';
  return new TextDecoder().decode(bytes.slice(dropBytes));
}

function normalizeNoYoNoDash(text: string){
  // Enforce project style: no "ё" and no long dashes.
  return String(text || '')
    .replaceAll('ё', 'е')
    .replaceAll('Ё', 'Е')
    .replaceAll('—', '-')
    .replaceAll('–', '-');
}

async function callPariterAI({ apiKey, messages, temperature=1, model='qwen3-coder-plus' }:{
  apiKey: string;
  messages: Array<{ role: 'system'|'user'|'assistant'; content: string }>;
  temperature?: number;
  model?: string;
}){
  const res = await fetch('https://l00m.ru/pariterai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, temperature, messages }),
  });
  const data = await res.json().catch(()=> ({}));
  if (!res.ok) {
    const msg = (data && typeof data === 'object' && 'error' in data)
      ? String((data as any).error || 'AI error')
      : (data && typeof data === 'object' && 'message' in data)
        ? String((data as any).message || 'AI error')
        : 'AI error';
    throw new Error(msg);
  }
  const out = data?.choices?.[0]?.message?.content;
  return String(out || '').trim();
}

export async function handleApi(db: DB, req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  try {
    // --- Health
    if ((req.method === 'GET' || req.method === 'HEAD') && path === '/api/health') {
      return json({ ok: true, time: nowISO() });
    }

    // --- Auth
    if (req.method === 'POST' && path === '/api/register') {
      const body = await readJson(req);
      const email = String(body.email || '').trim();
      const name = String(body.name || '').trim();
      const login = sanitizeLogin(body.login);
      const password = String(body.password || '');
      const role = String(body.role || '');
      const theme = String(body.theme || '');

      if (!validateEmail(email)) return error('Укажи корректный email.');
      if (!name || name.length < 2) return error('Имя слишком короткое.');
      if (!validateLogin(login)) return error('Логин: 3–32 символа (a-z, 0-9, _ . -).');
      if (!validatePassword(password)) return error('Пароль: минимум 6 символов.');
      if (!(role in ROLE_META)) return error('Выбери роль.');
      if (!themeAllowed(role, theme)) return error('Выбери тему.');

      const exists = db.query('SELECT id FROM users WHERE login = ?').get(login);
      if (exists) return error('Этот логин уже занят.');

      db.run('INSERT INTO teams (created_at) VALUES (?)', [nowISO()]);
      const team = db.query('SELECT last_insert_rowid() AS id').get() as any;
      const teamId = Number(team.id);

      // @ts-ignore
      const password_hash = await Bun.password.hash(password);
      db.run(
        'INSERT INTO users (team_id, email, name, login, password_hash, role, theme, is_admin, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
        [teamId, email, name, login, password_hash, role, theme, 1, nowISO()]
      );
      const row = db.query('SELECT last_insert_rowid() AS id').get() as any;
      const userId = Number(row.id);
      const user = db.query('SELECT * FROM users WHERE id = ?').get(userId) as any;

      const { sid } = createSession(db, userId);
      const headers = setSessionCookieHeaders(sid);
      return json({ ok: true, user: safeUser(user) }, 200, headers);
    }

    if (req.method === 'POST' && path === '/api/login') {
      const body = await readJson(req);
      const login = sanitizeLogin(body.login);
      const password = String(body.password || '');

      const user = db.query('SELECT * FROM users WHERE login = ?').get(login) as any;
      if (!user) return error('Неверный логин или пароль.', 401);
      // @ts-ignore
      const ok = await Bun.password.verify(password, user.password_hash);
      if (!ok) return error('Неверный логин или пароль.', 401);

      const { sid } = createSession(db, user.id);
      const headers = setSessionCookieHeaders(sid);
      return json({ ok: true, user: safeUser(user) }, 200, headers);
    }

    if (req.method === 'POST' && path === '/api/logout') {
      try {
        const { sid } = requireAuth(db, req);
        db.run('DELETE FROM sessions WHERE id = ?', [sid]);
      } catch {}
      const headers = clearSessionCookieHeaders();
      return json({ ok: true }, 200, headers);
    }

    if (req.method === 'GET' && path === '/api/me') {
      // in auth.ts there is helper, but keep local to avoid circular
      try {
        const { user, team } = requireAuth(db, req);
        return json({ user: safeUser(user), team });
      } catch {
        return json({ user: null, team: null });
      }
    }

    // --- Join resolve
    if (req.method === 'GET' && path.startsWith('/api/invites/resolve/')) {
      const code = decodeURIComponent(path.split('/').pop() || '').trim();
      const inv = db.query('SELECT * FROM invites WHERE code = ?').get(code) as any;
      if (!inv) return json({ ok: false, reason: 'invalid' });
      if (inv.used === 1) return json({ ok: false, reason: 'used' });
      if (new Date(inv.expires_at).getTime() <= Date.now()) return json({ ok: false, reason: 'expired' });
      const inviter = db.query('SELECT id, name FROM users WHERE id = ?').get(inv.created_by) as any;
      return json({ ok: true, inviter: inviter || { id: null, name: 'Спутник' } });
    }

    if (req.method === 'POST' && path.startsWith('/api/join/')) {
      const code = decodeURIComponent(path.split('/').pop() || '').trim();
      const inv = db.query('SELECT * FROM invites WHERE code = ?').get(code) as any;
      if (!inv) return errorWithReason('Приглашение недействительно.', 'invalid', 404);
      if (inv.used === 1) return errorWithReason('Приглашение уже использовано.', 'used', 410);
      if (new Date(inv.expires_at).getTime() <= Date.now()) return errorWithReason('Срок действия приглашения истёк.', 'expired', 410);

      const body = await readJson(req);
      const name = String(body.name || '').trim();
      const login = sanitizeLogin(body.login);
      const password = String(body.password || '');
      const role = String(body.role || '');
      const theme = String(body.theme || '');

      if (!name || name.length < 2) return error('Имя слишком короткое.');
      if (!validateLogin(login)) return error('Логин: 3–32 символа (a-z, 0-9, _ . -).');
      if (!validatePassword(password)) return error('Пароль: минимум 6 символов.');
      if (!(role in ROLE_META)) return error('Выбери роль.');
      if (!themeAllowed(role, theme)) return error('Выбери тему.');

      const exists = db.query('SELECT id FROM users WHERE login = ?').get(login);
      if (exists) return error('Этот логин уже занят.');

      // @ts-ignore
      const password_hash = await Bun.password.hash(password);
      db.run(
        'INSERT INTO users (team_id, email, name, login, password_hash, role, theme, is_admin, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
        [inv.team_id, null, name, login, password_hash, role, theme, 0, nowISO()]
      );
      db.run('UPDATE invites SET used = 1 WHERE id = ?', [inv.id]);

      const row = db.query('SELECT last_insert_rowid() AS id').get() as any;
      const userId = Number(row.id);
      const user = db.query('SELECT * FROM users WHERE id = ?').get(userId) as any;

      const { sid } = createSession(db, userId);
      const headers = setSessionCookieHeaders(sid);
      return json({ ok: true, user: safeUser(user) }, 200, headers);
    }

    // --- Team
    if (req.method === 'GET' && path === '/api/team') {
      const { user, team } = requireAuth(db, req);
      const users = db.query('SELECT id, team_id, email, name, login, role, theme, is_admin, created_at FROM users WHERE team_id = ? ORDER BY datetime(created_at) ASC').all(user.team_id) as any[];
      return json({ team, users });
    }

    // --- Settings
    if (req.method === 'PUT' && path === '/api/settings') {
      const { user } = requireAuth(db, req);
      const body = await readJson(req);
      const name = String(body.name || '').trim();
      const roleIn = body.role ? String(body.role) : null;
      const themeIn = body.theme ? String(body.theme) : null;
      const password = body.password ? String(body.password) : null;

      if (!name || name.length < 2) return error('Имя слишком короткое.');

      // role/theme validation
      let nextRole = String(user.role);
      if (roleIn != null) {
        if (!(roleIn in ROLE_META)) return error('Выбери роль.');
        nextRole = roleIn;
      }

      let nextTheme = String(user.theme);
      if (roleIn != null) {
        // role is changing (or being re-sent): theme must be compatible with new role
        if (themeIn) {
          if (!themeAllowed(nextRole, themeIn)) return error('Неверная тема.');
          nextTheme = themeIn;
        } else {
          nextTheme = defaultThemeForRole(nextRole as any);
        }
      } else if (themeIn) {
        // role not changing: theme must match current role
        const t = THEMES.find(x => x.id === themeIn);
        if (!t || t.role !== user.role) return error('Неверная тема.');
        nextTheme = themeIn;
      }

      if (password) {
        if (!validatePassword(password)) return error('Пароль: минимум 6 символов.');
      }

      // build dynamic UPDATE
      const args: any[] = [name];
      let sql = 'UPDATE users SET name = ?';

      // If roleIn is provided, update role and theme (theme is recalculated above).
      if (roleIn != null) {
        sql += ', role = ?, theme = ?';
        args.push(nextRole, nextTheme);
      } else if (themeIn) {
        sql += ', theme = ?';
        args.push(nextTheme);
      }

      if (password) {
        // @ts-ignore
        const password_hash = await Bun.password.hash(password);
        sql += ', password_hash = ?';
        args.push(password_hash);
      }

      sql += ' WHERE id = ?';
      args.push(user.id);
      db.run(sql, args);

      const updated = db.query('SELECT * FROM users WHERE id = ?').get(user.id) as any;
      return json({ ok: true, user: safeUser(updated) });
    }

    // --- AI rewrite
    if (req.method === 'POST' && path === '/api/ai/rewrite') {
      const { user } = requireAuth(db, req);
      // Best-effort: load PARITER_AI_KEY from .env at runtime.
      // This is important in production where systemd may not export env vars.
      if (!String(process.env.PARITER_AI_KEY || '').trim()) {
        try {
          const f = Bun.file('./.env');
          if (await f.exists()) {
            const txt = await f.text();
            for (const line of txt.split(/\r?\n/)) {
              const s = line.trim();
              if (!s || s.startsWith('#')) continue;
              const i = s.indexOf('=');
              if (i === -1) continue;
              const k = s.slice(0, i).trim();
              let v = s.slice(i + 1).trim();
              if (!k) continue;
              if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
                v = v.slice(1, -1);
              }
              if ((process.env as any)[k] == null || String((process.env as any)[k] || '').trim() === '') {
                (process.env as any)[k] = v;
              }
            }
          }
        } catch {}
      }

      const apiKey = String(process.env.PARITER_AI_KEY || '').trim();
      if (!apiKey) return error('AI не настроен на сервере. Добавь PARITER_AI_KEY в .env и перезапусти сервис.', 503);

      const body = await readJson(req);
      const field = String(body.field || '').trim();
      const text = String(body.text || '').trim();
      if (!text) return error('Пустой текст.');
      if (!(field === 'victory' || field === 'lesson')) return error('Неверное поле.');

      const enc = new TextEncoder();
      const byteLen = (s: string)=> enc.encode(s).length;
      const MAX = 100 * 1024;

      // Load compressed memory
      const mem = db.query('SELECT compressed, last_entry_id FROM ai_memory WHERE user_id = ?').get(user.id) as any;
      let compressed = mem?.compressed ? String(mem.compressed) : '';
      let lastEntryId = Number(mem?.last_entry_id || 0);
      if (!Number.isFinite(lastEntryId) || lastEntryId < 0) lastEntryId = 0;

      // Load raw history (only NEW entries after last_entry_id if we have compressed memory).
      // If no compressed memory exists yet, we load ALL entries.
      const recent = (compressed && lastEntryId > 0)
        ? (db.query(
            'SELECT id, date, victory, lesson, created_at FROM entries WHERE user_id = ? AND id > ? ORDER BY id ASC'
          ).all(user.id, lastEntryId) as any[])
        : (db.query(
            'SELECT id, date, victory, lesson, created_at FROM entries WHERE user_id = ? ORDER BY id ASC'
          ).all(user.id) as any[]);

      const lines: string[] = [];
      let maxSeenId = lastEntryId;
      for (const e of recent) {
        const id = Number(e.id || 0);
        if (id > maxSeenId) maxSeenId = id;

        const dt = String(e.created_at || '');
        const when = dt ? dt : String(e.date || '');
        const v = gunzipText(e.victory);
        const l = gunzipText(e.lesson);
        const parts: string[] = [];
        if (v && v.trim()) parts.push(`VICTORIA: ${v.trim()}`);
        if (l && l.trim()) parts.push(`LECTIO: ${l.trim()}`);
        if (!parts.length) continue;
        lines.push(`[${when}]\n${parts.join('\n')}`);
      }

      const buildHistory = (comp: string, tailLines: string[])=> {
        const blocks: string[] = [];
        if (comp && comp.trim()) blocks.push(`СЖАТАЯ ИСТОРИЯ (для контекста, не переписывай):\n${comp.trim()}`);
        if (tailLines.length) blocks.push(`ПОСЛЕДНИЕ ШАГИ (для контекста, не переписывай):\n${tailLines.join('\n\n')}`);
        return blocks.join('\n\n');
      };

      // Build context: compressed summary (if any) + ONLY new raw steps (after last_entry_id).
      let history = buildHistory(compressed, lines);

      // If we have no compressed memory yet, and history is already under the limit, mark memory as up-to-date
      // so next time we don't resend the entire raw history.
      if (!compressed && byteLen(history) <= MAX && maxSeenId > 0) {
        db.run(
          'INSERT INTO ai_memory (user_id, compressed, updated_at, last_entry_id) VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET last_entry_id = excluded.last_entry_id, updated_at = excluded.updated_at',
          [user.id, '', nowISO(), maxSeenId]
        );
        lastEntryId = maxSeenId;
      }

      // If context too large, compress via LLM and store.
      if (byteLen(history) > MAX) {
        const sys = [
          'Ты — инструмент сжатия контекста дневника Pariter.',
          'Сожми текст истории максимально компактно, но сохрани факты, имена, важные детали и формулировки.',
          'Не добавляй новых фактов. Не выдумывай.',
          'Пиши по-русски. Формат: короткие пункты и правила.',
          'Важно: не используй букву "ё" (заменяй на "е").',
          'Важно: не используй длинное тире "—" или "–"; используй обычный дефис "-".',
          'Цель: итог должен быть короче, чтобы поместиться в лимит 100KB вместе с новыми шагами.'
        ].join('\n');

        const userMsg = `Сожми следующую историю. Это ТОЛЬКО история (контекст), её не нужно переписывать как новый текст.\n\n${history}`;
        const out = await callPariterAI({ apiKey, temperature: 0.3, messages: [
          { role: 'system', content: sys },
          { role: 'user', content: userMsg },
        ]});

        compressed = normalizeNoYoNoDash(out);

        // Determine current max entry id for the user (everything is now included in compressed summary)
        const maxRow = db.query('SELECT MAX(id) AS m FROM entries WHERE user_id = ?').get(user.id) as any;
        const maxId = Number(maxRow?.m || maxSeenId || 0);

        // Upsert memory (store last_entry_id marker)
        db.run(
          'INSERT INTO ai_memory (user_id, compressed, updated_at, last_entry_id) VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET compressed = excluded.compressed, updated_at = excluded.updated_at, last_entry_id = excluded.last_entry_id',
          [user.id, compressed, nowISO(), maxId]
        );

        // After compressing, there are no "new" raw lines yet.
        history = buildHistory(compressed, []);

        // If still too large, drop first 10KB from compressed repeatedly (as per spec)
        let drops = 0;
        while (byteLen(history) > MAX && drops < 25) {
          compressed = dropFirstUTF8Bytes(compressed, 10 * 1024);
          db.run('UPDATE ai_memory SET compressed = ?, updated_at = ? WHERE user_id = ?', [compressed, nowISO(), user.id]);
          history = buildHistory(compressed, []);
          drops++;
          if (!compressed) break;
        }

        // Final clamp to be safe
        if (byteLen(history) > MAX) {
          history = clampUTF8(history, MAX);
        }
      }

      const systemPrompt = (field === 'victory')
        ? [
            // NOTE: перед текстом пользовательского ввода будет добавлен блок "ИСТОРИЯ" (контекст).
            // Его нельзя переписывать, он только для понимания пути пользователя.
            'Перед текущим текстом будет дан блок ИСТОРИЯ (контекст). Не переписывай историю - переписывай только текущий текст.',
            'Важно: не используй букву "ё" (заменяй на "е").',
            'Важно: не используй длинное тире "—" или "–"; используй обычный дефис "-".',
            '',
            'Ты - модуль кристаллизации успеха в системе Pariter. Твоя задача - принять сырую мысль пользователя о его достижении (блока VICTORIA) и очистить ее от шума, придав форму и вес.',
            '',
            'Правила обработки:',
            '1. Тональность: Гордость, но без высокомерия. Искренняя радость. Эпичность в мелочах. Это запись в бортовой журнал космического корабля, который прошел через пояс астероидов.',
            '2. Стиль: Лаконичный, живой. Избегай канцеляризма ("было выполнено", "достигнуты показатели") и корпоративного "успешного успеха".',
            '3. Фокус: Подсвети не только результат, но и усилие, волю или красоту момента.',
            '4. Ограничения: Не используй эмодзи (или используй их крайне минималистично, как символы ✦, ★). Не меняй суть фактов.',
            '5. Язык: Русский (или язык пользователя), литературный, с легким налетом кибер-романтики, если это уместно.',
            '',
            'Пример:',
            'Ввод: "Наконец-то доделал ремонт на кухне, устал капец, но красиво."',
            'Вывод: "Кухня завершена. Шум перфоратора сменился тишиной и красотой. Усталость пройдет, а уют, созданный своими руками, останется. Важный рубеж взят."',
            '',
            'Действуй.'
          ].join('\n')
        : [
            'Перед текущим текстом будет дан блок ИСТОРИЯ (контекст). Не переписывай историю - переписывай только текущий текст.',
            'Важно: не используй букву "ё" (заменяй на "е").',
            'Важно: не используй длинное тире "—" или "–"; используй обычный дефис "-".',
            '',
            'Ты - модуль анализа опыта в системе Pariter. Твоя задача - обработать запись из блока LECTIO (Уроки/Чтения). Пользователь делится выводом, ошибкой или инсайтом. Преврати это в мудрость.',
            '',
            'Правила обработки:',
            '1. Тональность: Вдумчивая, спокойная, философская. Без нравоучений. Это голос друга, который сидит рядом у костра.',
            '2. Стиль: Глубокий, но ясный. Избегай банальностей ("век живи - век учись"). Ищи суть.',
            '3. Фокус: Трансформируй "я ошибся" в "я узнал". Помоги пользователю увидеть паттерн. Сделай акцент на том, как этот урок поможет в будущем пути.',
            '4. Метафоры: Используй образы пути, строительства, кода, сигналов, тишины, если это помогает раскрыть мысль.',
            '5. Ограничения: Не обесценивай переживания. Не используй стандартные эмодзи.',
            '',
            'Пример:',
            'Ввод: "Поссорились из-за ерунды, я зря быканул, надо было просто выслушать."',
            'Вывод: "Тишина иногда громче слов. Урок принят: сначала слушать, потом реагировать. В паузе между эмоцией и действием живет понимание. Беречь связь важнее, чем доказывать правоту."',
            '',
            'Действуй.'
          ].join('\n');

      const userPrompt = [
        'Ниже дан контекст (история). Это только для понимания стиля и контекста, НЕ переписывай его.',
        'После контекста будет текущий текст, который нужно переписать.',
        '',
        '=== ИСТОРИЯ (НЕ ПЕРЕПИСЫВАТЬ) ===',
        history || '(нет)',
        '',
        '=== ТЕКСТ ДЛЯ ПЕРЕПИСЫВАНИЯ ===',
        text,
        '',
        'Перепиши только текст для переписывания. Ответ: только переписанный текст, без пояснений.'
      ].join('\n');

      const rewrittenRaw = await callPariterAI({ apiKey, temperature: 1, messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]});

      const rewritten = normalizeNoYoNoDash(rewrittenRaw);
      return json({ ok: true, text: rewritten });
    }

    // --- Push
    if ((req.method === 'GET' || req.method === 'HEAD') && path === '/api/push/vapidPublicKey') {
      // Public key can be served without auth.
      const key = await getVapidPublicKeyB64Url();
      return json({ ok: true, publicKey: key });
    }

    if (req.method === 'POST' && path === '/api/push/subscribe') {
      const { user } = requireAuth(db, req);
      const body = await readJson(req);
      const endpoint = String(body?.endpoint || '').trim();
      const p256dh = String(body?.keys?.p256dh || '').trim();
      const auth = String(body?.keys?.auth || '').trim();
      if (!endpoint || !p256dh || !auth) return error('Неверная подписка.');

      // Upsert by endpoint
      db.run(
        'INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at, last_seen_at) VALUES (?,?,?,?,?,?) ' +
        'ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id, p256dh=excluded.p256dh, auth=excluded.auth, last_seen_at=excluded.last_seen_at',
        [user.id, endpoint, p256dh, auth, nowISO(), nowISO()]
      );

      return json({ ok: true });
    }

    if (req.method === 'POST' && path === '/api/push/unsubscribe') {
      const { user } = requireAuth(db, req);
      const body = await readJson(req);
      const endpoint = String(body?.endpoint || '').trim();
      if (endpoint) {
        db.run('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?', [user.id, endpoint]);
      } else {
        db.run('DELETE FROM push_subscriptions WHERE user_id = ?', [user.id]);
      }
      return json({ ok: true });
    }

    // --- Stats
    if (req.method === 'GET' && path === '/api/stats') {
      const { user } = requireAuth(db, req);

      const today = todayYMD();

      // DISTINCT is important for the “infinite path”: user can create many entries per day.
      // We only need unique dates to calculate streak.
      const rows = db.query('SELECT DISTINCT date FROM entries WHERE user_id = ? ORDER BY date DESC LIMIT 400').all(user.id) as any[];
      const set = new Set(rows.map(r => String(r.date)));

      const ymdShift = (ymd: string, deltaDays: number) => {
        const [y,m,d] = ymd.split('-').map(Number);
        const dt = new Date(y, m-1, d);
        dt.setDate(dt.getDate() + deltaDays);
        const yy = dt.getFullYear();
        const mm = String(dt.getMonth()+1).padStart(2,'0');
        const dd = String(dt.getDate()).padStart(2,'0');
        return `${yy}-${mm}-${dd}`;
      };

      // current streak: today if exists, otherwise yesterday if exists
      let start = today;
      if (!set.has(start)) start = ymdShift(today, -1);

      let streak = 0;
      let streakFrom: string | null = null;
      if (set.has(start)) {
        let cur = start;
        while (set.has(cur)) {
          streak++;
          streakFrom = cur;
          cur = ymdShift(cur, -1);
        }
      }

      // totals
      const userTotalRow = db.query('SELECT COUNT(*) AS c FROM entries WHERE user_id = ?').get(user.id) as any;
      const userTodayStepsRow = db.query('SELECT COUNT(*) AS c FROM entries WHERE user_id = ? AND date = ?').get(user.id, today) as any;

      // team: members active today vs total steps today
      const teamTodayRow = db.query(
        `SELECT COUNT(DISTINCT e.user_id) AS c
         FROM entries e
         JOIN users u ON u.id = e.user_id
         WHERE u.team_id = ? AND e.date = ?`
      ).get(user.team_id, today) as any;

      const teamTodayStepsRow = db.query(
        `SELECT COUNT(*) AS c
         FROM entries e
         JOIN users u ON u.id = e.user_id
         WHERE u.team_id = ? AND e.date = ?`
      ).get(user.team_id, today) as any;

      const teamTotalRow = db.query(
        `SELECT COUNT(*) AS c
         FROM entries e
         JOIN users u ON u.id = e.user_id
         WHERE u.team_id = ?`
      ).get(user.team_id) as any;

      const lastEntryDate = rows.length ? String(rows[0].date) : null;

      return json({
        ok: true,
        today,
        streak,
        streakFrom,
        lastEntryDate,
        userTodaySteps: Number(userTodayStepsRow?.c || 0),
        userTotal: Number(userTotalRow?.c || 0),
        teamToday: Number(teamTodayRow?.c || 0),
        teamTodaySteps: Number(teamTodayStepsRow?.c || 0),
        teamTotal: Number(teamTotalRow?.c || 0),
      });
    }

    // --- Invites
    if (req.method === 'GET' && path === '/api/invites') {
      const { user } = requireAuth(db, req);
      const invites = db.query('SELECT * FROM invites WHERE team_id = ? ORDER BY datetime(created_at) DESC').all(user.team_id) as any[];
      return json({ invites });
    }

    if (req.method === 'POST' && path === '/api/invites') {
      const { user } = requireAuth(db, req);

      let code = '';
      for (let n=0;n<30;n++) {
        code = randomInviteCode();
        const exists = db.query('SELECT id FROM invites WHERE code = ?').get(code);
        if (!exists) break;
      }
      if (!code) return error('Не удалось создать приглашение.');

      const expires_at = new Date(Date.now() + 7*24*60*60*1000).toISOString();
      db.run('INSERT INTO invites (team_id, code, created_by, expires_at, used, created_at) VALUES (?,?,?,?,?,?)', [
        user.team_id, code, user.id, expires_at, 0, nowISO(),
      ]);
      const row = db.query('SELECT last_insert_rowid() AS id').get() as any;
      const invite = db.query('SELECT * FROM invites WHERE id = ?').get(Number(row.id));
      return json({ invite });
    }

    if (req.method === 'DELETE' && path.startsWith('/api/invites/')) {
      const { user } = requireAuth(db, req);
      const id = Number(path.split('/').pop());
      const inv = db.query('SELECT * FROM invites WHERE id = ?').get(id) as any;
      if (!inv) return error('Приглашение не найдено.', 404);
      if (inv.team_id !== user.team_id) return error('Нет доступа.', 403);
      db.run('DELETE FROM invites WHERE id = ?', [id]);
      return json({ ok: true });
    }

    // --- Entries
    // Legacy helper: return the latest entry for today (if any).
    // The app allows multiple entries per day; client no longer relies on this endpoint.
    if (req.method === 'GET' && path === '/api/today') {
      const { user } = requireAuth(db, req);
      const date = todayYMD();
      const entry = db.query(
        'SELECT id, user_id, date, victory, lesson, created_at FROM entries WHERE user_id = ? AND date = ? ORDER BY id DESC LIMIT 1'
      ).get(user.id, date) as any;
      if (!entry) return json({ entry: null });
      return json({ entry: { ...entry, victory: entry.victory ? Buffer.from(entry.victory).toString('base64') : null, lesson: entry.lesson ? Buffer.from(entry.lesson).toString('base64') : null } });
    }

    if (req.method === 'GET' && path === '/api/entries') {
      const { user } = requireAuth(db, req);
      const limit = Math.max(1, Math.min(50, Number(url.searchParams.get('limit') || '20')));
      const legacyBefore = url.searchParams.get('before');
      const beforeDate = url.searchParams.get('beforeDate') || legacyBefore;
      const beforeId = Number(url.searchParams.get('beforeId') || '0');

      // entries within team
      let where = 'u.team_id = ?';
      const args: any[] = [user.team_id];
      if (beforeDate && beforeId) {
        where += ' AND (e.date < ? OR (e.date = ? AND e.id < ?))';
        args.push(beforeDate, beforeDate, beforeId);
      } else if (beforeDate) {
        // compatibility mode: only date cursor (less stable than date+id, but matches spec)
        where += ' AND e.date < ?';
        args.push(beforeDate);
      }

      const entries = db.query(
        `SELECT e.id, e.user_id, e.date, e.victory, e.lesson, e.created_at
         FROM entries e
         JOIN users u ON u.id = e.user_id
         WHERE ${where}
         ORDER BY e.date DESC, e.id DESC
         LIMIT ?`
      ).all(...args, limit) as any[];

      const mapped = entries.map(e => ({
        ...e,
        victory: e.victory ? Buffer.from(e.victory).toString('base64') : null,
        lesson: e.lesson ? Buffer.from(e.lesson).toString('base64') : null,
      }));

      const nextCursor = mapped.length ? { date: mapped[mapped.length-1].date, id: mapped[mapped.length-1].id } : null;
      // keep legacy alias for simpler clients
      const nextBefore = nextCursor?.date || null;
      return json({ entries: mapped, nextCursor, nextBefore });
    }

    // --- Live helper: fetch NEW entries after a cursor (date+id).
    // Returns count + newest items (limited). Excludes the requesting user's own entries.
    if (req.method === 'GET' && path === '/api/entries/new') {
      const { user } = requireAuth(db, req);
      const afterDate = String(url.searchParams.get('afterDate') || '').trim();
      const afterId = Number(url.searchParams.get('afterId') || '0');
      const limit = Math.max(1, Math.min(10, Number(url.searchParams.get('limit') || '3')));

      if (!afterDate || !afterId) {
        return json({ ok: true, count: 0, entries: [] });
      }

      const where = 'u.team_id = ? AND e.user_id != ? AND (e.date > ? OR (e.date = ? AND e.id > ?))';
      const args: any[] = [user.team_id, user.id, afterDate, afterDate, afterId];

      const countRow = db.query(
        `SELECT COUNT(*) AS c
         FROM entries e
         JOIN users u ON u.id = e.user_id
         WHERE ${where}`
      ).get(...args) as any;

      const rows = db.query(
        `SELECT e.id, e.user_id, e.date, e.victory, e.lesson, e.created_at
         FROM entries e
         JOIN users u ON u.id = e.user_id
         WHERE ${where}
         ORDER BY e.date DESC, e.id DESC
         LIMIT ?`
      ).all(...args, limit) as any[];

      const mapped = rows.map(e => ({
        ...e,
        victory: e.victory ? Buffer.from(e.victory).toString('base64') : null,
        lesson: e.lesson ? Buffer.from(e.lesson).toString('base64') : null,
      }));

      return json({ ok: true, count: Number(countRow?.c || 0), entries: mapped });
    }

    if (req.method === 'POST' && path === '/api/entries') {
      const { user } = requireAuth(db, req);
      const body = await readJson(req);
      const victory = String(body.victory || '').trim();
      const lesson = String(body.lesson || '').trim();
      if (!victory && !lesson) return error('Заполни хотя бы одну часть: победу или урок.');

      // Infinite path: allow multiple entries per day.
      const date = todayYMD();
      const createdAt = nowISO();
      const vblob = gzipText(victory);
      const lblob = gzipText(lesson);

      db.run('INSERT INTO entries (user_id, date, victory, lesson, created_at) VALUES (?,?,?,?,?)', [
        user.id, date, vblob, lblob, createdAt,
      ]);
      const row = db.query('SELECT last_insert_rowid() AS id').get() as any;
      const entryId = Number(row.id);

      // Web Push (best-effort): notify teammates (exclude author)
      try {
        const authorName = String(user.name || 'Спутник');
        const preview = (victory && victory.trim())
          ? victory.trim().split(/\r?\n/)[0].slice(0, 140)
          : (lesson && lesson.trim())
            ? lesson.trim().split(/\r?\n/)[0].slice(0, 140)
            : '';

        const subs = db.query(
          `SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth, ps.user_id
           FROM push_subscriptions ps
           JOIN users u ON u.id = ps.user_id
           WHERE u.team_id = ? AND ps.user_id != ?`
        ).all(user.team_id, user.id) as any[];

        const subject = String(process.env.PARITER_VAPID_SUBJECT || 'mailto:admin@pariter.local');
        const payloadJson = {
          type: 'entry',
          entry: { id: entryId, date, created_at: createdAt },
          author: { id: user.id, name: authorName, role: String(user.role || '') },
          preview,
        };

        const results = await Promise.allSettled(subs.map(async (s)=>{
          const res = await sendWebPush({
            subscription: { endpoint: String(s.endpoint), p256dh: String(s.p256dh), auth: String(s.auth) },
            payloadJson,
            subject,
          });
          // Remove dead or invalid subscriptions
          if (res.status === 404 || res.status === 410 || res.status === 401 || res.status === 403) {
            db.run('DELETE FROM push_subscriptions WHERE id = ?', [Number(s.id)]);
          }
          return res.status;
        }));
        // ignore results
        void results;
      } catch {
        // ignore push errors
      }

      return json({ ok: true, id: entryId, created: true });
    }

    if (req.method === 'PUT' && path.startsWith('/api/entries/')) {
      const { user } = requireAuth(db, req);
      const id = Number(path.split('/').pop());
      const e = db.query('SELECT * FROM entries WHERE id = ?').get(id) as any;
      if (!e) return error('Запись не найдена.', 404);
      if (e.user_id !== user.id) return error('Можно редактировать только свои записи.', 403);

      const body = await readJson(req);
      const victory = String(body.victory || '').trim();
      const lesson = String(body.lesson || '').trim();
      if (!victory && !lesson) return error('Заполни хотя бы одну часть.');

      db.run('UPDATE entries SET victory = ?, lesson = ? WHERE id = ?', [gzipText(victory), gzipText(lesson), id]);
      return json({ ok: true });
    }

    if (req.method === 'DELETE' && path.startsWith('/api/entries/')) {
      const { user } = requireAuth(db, req);
      const id = Number(path.split('/').pop());
      const e = db.query('SELECT * FROM entries WHERE id = ?').get(id) as any;
      if (!e) return error('Запись не найдена.', 404);
      if (e.user_id !== user.id) return error('Можно удалить только свою запись.', 403);
      db.run('DELETE FROM entries WHERE id = ?', [id]);
      return json({ ok: true });
    }

    // --- Export (backup)
    if (req.method === 'GET' && path === '/api/export') {
      const { user, team } = requireAuth(db, req);

      const users = db.query(
        'SELECT id, team_id, email, name, login, role, theme, is_admin, created_at FROM users WHERE team_id = ? ORDER BY datetime(created_at) ASC'
      ).all(user.team_id) as any[];

      const invites = db.query(
        'SELECT id, team_id, code, created_by, expires_at, used, created_at FROM invites WHERE team_id = ? ORDER BY datetime(created_at) ASC'
      ).all(user.team_id) as any[];

      const entries = db.query(
        `SELECT e.id, e.user_id, e.date, e.victory, e.lesson, e.created_at
         FROM entries e
         JOIN users u ON u.id = e.user_id
         WHERE u.team_id = ?
         ORDER BY e.date DESC, e.id DESC`
      ).all(user.team_id) as any[];

      const mappedEntries = entries.map(e => ({
        ...e,
        victory: e.victory ? Buffer.from(e.victory).toString('base64') : null,
        lesson: e.lesson ? Buffer.from(e.lesson).toString('base64') : null,
      }));

      return json({
        ok: true,
        version: 1,
        exported_at: nowISO(),
        team,
        users,
        invites,
        entries: mappedEntries,
      });
    }

    // --- Import (restore/merge)
    if (req.method === 'POST' && path === '/api/import') {
      const { user } = requireAuth(db, req);
      if (Number(user.is_admin || 0) !== 1) return error('Только администратор может делать импорт.', 403);

      const body = await readJson(req);
      const payload = (body && typeof body === 'object' && 'data' in body) ? (body as any).data : body;
      const defaultPassword = (body && typeof body === 'object' && 'defaultPassword' in body)
        ? String((body as any).defaultPassword || '').trim()
        : '';

      if (!payload || typeof payload !== 'object') return error('Неверный формат импорта.');
      const version = Number((payload as any).version || 0);
      if (version !== 1) return error('Неподдерживаемая версия бэкапа.');

      if (defaultPassword && !validatePassword(defaultPassword)) {
        return error('Пароль для импортируемых пользователей: минимум 6 символов.');
      }

      const pickTheme = (role: string) => {
        const t = THEMES.find(x => x.role === role);
        return t ? t.id : 'dark_warrior';
      };

      const usersIn: any[] = Array.isArray((payload as any).users) ? (payload as any).users : [];
      const invitesIn: any[] = Array.isArray((payload as any).invites) ? (payload as any).invites : [];
      const entriesIn: any[] = Array.isArray((payload as any).entries) ? (payload as any).entries : [];

      // map old user_id -> new user_id using login in current team
      const oldToNew = new Map<number, number>();
      let usersMapped = 0;
      let usersCreated = 0;
      const createdCreds: Array<{ login: string; password: string }> = [];

      for (const u of usersIn) {
        const oldId = Number(u?.id || 0);
        const login = sanitizeLogin(u?.login);
        const name = String(u?.name || 'Спутник').trim() || 'Спутник';
        const role = (u?.role in ROLE_META) ? String(u.role) : 'warrior';
        const theme = themeAllowed(role, String(u?.theme || '')) ? String(u.theme) : pickTheme(role);
        const is_admin = Number(u?.is_admin || 0) ? 1 : 0;
        const emailRaw = String(u?.email || '').trim();
        const email = emailRaw ? emailRaw : null;
        const created_at = String(u?.created_at || '') || nowISO();

        if (!oldId) continue;
        if (!validateLogin(login)) continue;

        const existing = db.query('SELECT id FROM users WHERE team_id = ? AND login = ?').get(user.team_id, login) as any;
        if (existing?.id) {
          oldToNew.set(oldId, Number(existing.id));
          usersMapped++;
          continue;
        }

        // create missing user
        const pass = defaultPassword || randomInviteCode() + randomInviteCode();
        // @ts-ignore
        const password_hash = await Bun.password.hash(pass);

        db.run(
          'INSERT INTO users (team_id, email, name, login, password_hash, role, theme, is_admin, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
          [user.team_id, email, name, login, password_hash, role, theme, is_admin, created_at]
        );
        const row = db.query('SELECT last_insert_rowid() AS id').get() as any;
        const newId = Number(row.id);
        oldToNew.set(oldId, newId);
        usersCreated++;
        if (!defaultPassword) createdCreds.push({ login, password: pass });
      }

      // invites
      let invitesCreated = 0;
      let invitesSkipped = 0;
      for (const inv of invitesIn) {
        const code = String(inv?.code || '').trim();
        if (!code) continue;
        const exists = db.query('SELECT id FROM invites WHERE code = ?').get(code) as any;
        if (exists?.id) { invitesSkipped++; continue; }

        const oldCreatedBy = Number(inv?.created_by || 0);
        const created_by = oldToNew.get(oldCreatedBy) || user.id;
        const expires_at = String(inv?.expires_at || '') || new Date(Date.now() + 7*24*60*60*1000).toISOString();
        const used = Number(inv?.used || 0) ? 1 : 0;
        const created_at = String(inv?.created_at || '') || nowISO();

        db.run(
          'INSERT INTO invites (team_id, code, created_by, expires_at, used, created_at) VALUES (?,?,?,?,?,?)',
          [user.team_id, code, created_by, expires_at, used, created_at]
        );
        invitesCreated++;
      }

      // entries (insert-only; allow multiple entries per day)
      // Dedupe by (user_id, date, created_at) when possible to reduce duplicates on repeated imports.
      let entriesCreated = 0;
      let entriesUpdated = 0; // kept for backward compatibility in response
      let entriesSkipped = 0;

      const empty = gzipText('');
      for (const e of entriesIn) {
        const oldUserId = Number(e?.user_id || 0);
        const newUserId = oldToNew.get(oldUserId);
        if (!newUserId) { entriesSkipped++; continue; }

        const date = String(e?.date || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { entriesSkipped++; continue; }

        const vblob = e?.victory ? Buffer.from(String(e.victory), 'base64') : empty;
        const lblob = e?.lesson ? Buffer.from(String(e.lesson), 'base64') : empty;
        const created_at = String(e?.created_at || '') || nowISO();

        const ex = db.query('SELECT id FROM entries WHERE user_id = ? AND date = ? AND created_at = ?').get(newUserId, date, created_at) as any;
        if (ex?.id) { entriesSkipped++; continue; }

        db.run('INSERT INTO entries (user_id, date, victory, lesson, created_at) VALUES (?,?,?,?,?)', [
          newUserId, date, vblob, lblob, created_at,
        ]);
        entriesCreated++;
      }

      return json({
        ok: true,
        usersMapped,
        usersCreated,
        invitesCreated,
        invitesSkipped,
        entriesCreated,
        entriesUpdated,
        entriesSkipped,
        createdCreds, // returned only if defaultPassword not provided
      });
    }

    // --- gunzip helper endpoint (optional, but keep client simple)
    if (req.method === 'POST' && path === '/api/gunzip') {
      const { } = requireAuth(db, req);
      const body = await readJson(req);
      const b64 = String(body.b64 || '');
      if (!b64) return json({ text: '' });
      const blob = Buffer.from(b64, 'base64');
      return json({ text: gunzipText(blob) });
    }

    return error('Not found', 404);

  } catch (e) {
    return authErrorToResponse(e);
  }
}
