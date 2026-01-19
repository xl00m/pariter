// PARITER client (Vanilla JS) — talks to Bun backend via /api/*

const APP = {
  _authRedirectScheduled: false,
  _rendering: false,
  _rerenderRequested: false,
  state: {
    user: null,
    team: null,
    teamUsers: [],
    teamUsersFetchedAt: 0,
    sidebarOpen: false,
    route: { path: '/', params: {} },
    feed: { cursor: null, loading: false, done: false, lastRenderedDate: null, renderedCount: 0 },
    cache: { entryText: new Map() },
  }
};

const ROLE_META = {
  warrior: { id:'warrior', emoji:'⚔️', ru:'Воин', la:'Bellātor' },
  amazon: { id:'amazon', emoji:'🏹', ru:'Амазонка', la:'Amazon' },
};

const THEMES = [
  { id:'dark_warrior', role:'warrior', emoji:'⚔️', ru:'Тёмный воин', la:'Bellātor Nocturnus', light:false, colors:{ bg:'#0b1020', bgSecondary:'#0f1730', text:'#e7eaf3', textMuted:'#9aa4c3', accent:'#7c5cff', accentHover:'#6a4ff0', border:'rgba(255,255,255,.10)', victory:'rgba(124,92,255,.12)', lesson:'rgba(46,212,167,.12)' } },
  { id:'guardian', role:'warrior', emoji:'🛡️', ru:'Несокрушимый страж', la:'Custōs Invictus', light:false, colors:{ bg:'#0a1214', bgSecondary:'#0e1d21', text:'#e9f4f4', textMuted:'#98b2b5', accent:'#2ed4a7', accentHover:'#23c39a', border:'rgba(255,255,255,.11)', victory:'rgba(46,212,167,.12)', lesson:'rgba(124,92,255,.10)' } },
  { id:'fire_heart', role:'warrior', emoji:'🔥', ru:'Огненное сердце', la:'Cor Igneum', light:false, colors:{ bg:'#140a0a', bgSecondary:'#201010', text:'#ffe9e6', textMuted:'#d2a39c', accent:'#ff4d6d', accentHover:'#ff335a', border:'rgba(255,255,255,.12)', victory:'rgba(255,77,109,.14)', lesson:'rgba(255,190,84,.12)' } },
  { id:'ocean_son', role:'warrior', emoji:'🌊', ru:'Сын океана', la:'Fīlius Ōceanī', light:false, colors:{ bg:'#071018', bgSecondary:'#0b1a26', text:'#e9f6ff', textMuted:'#9bb4c6', accent:'#2aa7ff', accentHover:'#148fe8', border:'rgba(255,255,255,.11)', victory:'rgba(42,167,255,.14)', lesson:'rgba(46,212,167,.10)' } },
  { id:'thunderer', role:'warrior', emoji:'⚡', ru:'Громовержец', la:'Domitor Fulminis', light:false, colors:{ bg:'#0f0c1b', bgSecondary:'#17112b', text:'#f0ecff', textMuted:'#b0a9d6', accent:'#ffd166', accentHover:'#f1c04e', border:'rgba(255,255,255,.12)', victory:'rgba(255,209,102,.16)', lesson:'rgba(124,92,255,.10)' } },
  { id:'forest_hunter', role:'warrior', emoji:'🌲', ru:'Лесной охотник', la:'Venātor Silvae', light:false, colors:{ bg:'#08130c', bgSecondary:'#0e2014', text:'#e9fff2', textMuted:'#9bc4aa', accent:'#41d36f', accentHover:'#2fbe5b', border:'rgba(255,255,255,.11)', victory:'rgba(65,211,111,.14)', lesson:'rgba(46,212,167,.10)' } },
  { id:'mountain_wolf', role:'warrior', emoji:'🏔️', ru:'Горный волк', la:'Lupus Montium', light:false, colors:{ bg:'#0c0f14', bgSecondary:'#141a22', text:'#eef3ff', textMuted:'#a8b4c8', accent:'#8bd3ff', accentHover:'#67c5ff', border:'rgba(255,255,255,.12)', victory:'rgba(139,211,255,.14)', lesson:'rgba(255,209,102,.10)' } },
  { id:'dark_amazon', role:'amazon', emoji:'🌙', ru:'Тёмная воительница', la:'Bellātrix Nocturna', light:false, colors:{ bg:'#0b0c16', bgSecondary:'#11142a', text:'#eef0ff', textMuted:'#a7abd6', accent:'#b392ff', accentHover:'#a47fff', border:'rgba(255,255,255,.11)', victory:'rgba(179,146,255,.14)', lesson:'rgba(46,212,167,.10)' } },
  { id:'serene_amazon', role:'amazon', emoji:'🌿', ru:'Светлая амазонка', la:'Amazon Serēna', light:true, colors:{ bg:'#f6fbf8', bgSecondary:'#ffffff', text:'#101419', textMuted:'#5f6b75', accent:'#1fb981', accentHover:'#17a874', border:'rgba(16,20,25,.12)', victory:'rgba(31,185,129,.12)', lesson:'rgba(124,92,255,.10)' } },
  { id:'tender_strength', role:'amazon', emoji:'🌸', ru:'Нежная сила', la:'Fortitūdo Tenera', light:false, colors:{ bg:'#140a12', bgSecondary:'#201020', text:'#ffeef9', textMuted:'#d3a2c0', accent:'#ff77c8', accentHover:'#ff5bbb', border:'rgba(255,255,255,.12)', victory:'rgba(255,119,200,.14)', lesson:'rgba(255,209,102,.10)' } },
  { id:'ocean_daughter', role:'amazon', emoji:'🌊', ru:'Дочь океана', la:'Fīlia Ōceanī', light:false, colors:{ bg:'#07101a', bgSecondary:'#0b1a28', text:'#eaf6ff', textMuted:'#9db4c8', accent:'#41c7ff', accentHover:'#1eb6f5', border:'rgba(255,255,255,.11)', victory:'rgba(65,199,255,.14)', lesson:'rgba(46,212,167,.10)' } },
  { id:'clear_blade', role:'amazon', emoji:'🔮', ru:'Ясный клинок', la:'Ensis Clārus', light:true, colors:{ bg:'#f7f9ff', bgSecondary:'#ffffff', text:'#101629', textMuted:'#5f6a86', accent:'#4c6fff', accentHover:'#365cff', border:'rgba(16,22,41,.12)', victory:'rgba(76,111,255,.12)', lesson:'rgba(31,185,129,.10)' } },
  { id:'dawn_guard', role:'amazon', emoji:'🌅', ru:'Рассветная стража', la:'Custōs Aurōrae', light:false, colors:{ bg:'#140c07', bgSecondary:'#21130b', text:'#fff2e8', textMuted:'#d0ad95', accent:'#ff9f43', accentHover:'#ff8a1f', border:'rgba(255,255,255,.12)', victory:'rgba(255,159,67,.16)', lesson:'rgba(255,77,109,.10)' } },
  { id:'quiet_storm', role:'amazon', emoji:'🦋', ru:'Тихая буря', la:'Tempestās Tacita', light:false, colors:{ bg:'#0b1014', bgSecondary:'#0f1a22', text:'#eef8ff', textMuted:'#9ab3c2', accent:'#7dd3fc', accentHover:'#5ec7f8', border:'rgba(255,255,255,.11)', victory:'rgba(125,211,252,.14)', lesson:'rgba(179,146,255,.10)' } },
];

const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));

function escapeHTML(s){
  return String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'", '&#039;');
}

function toast(msg){
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  el.classList.add('fade-in');
  clearTimeout(toast._t);
  toast._t = setTimeout(()=>{
    el.classList.add('hidden');
    el.classList.remove('fade-in');
  }, 2200);
}

function ensureEntryModal(){
  if ($('#entryModal')) return;
  const wrap = document.createElement('div');
  wrap.id = 'entryModal';
  wrap.className = 'hidden';
  wrap.innerHTML = `
    <div class="modalWrap">
      <div class="modalScrim" data-action="modal-close" aria-hidden="true"></div>
      <div class="modalPanel card" role="dialog" aria-modal="true" aria-label="Редактировать запись" style="padding: 16px;">
        <div class="rowBetween" style="align-items:flex-start;">
          <div>
            <div style="font-size: 18px; font-weight: 900">Редактировать</div>
            <div class="textMuted" style="font-size: 12px">Обнови победу и/или урок</div>
          </div>
          <button type="button" class="btn-ghost" style="padding: 10px 12px" data-action="modal-close" aria-label="Закрыть">✕</button>
        </div>

        <div class="grid" style="margin-top: 12px;">
          <div class="soft" style="padding: 12px; background: var(--victory)">
            <div style="font-size: 12px; font-weight: 900; letter-spacing:.16em">⚔️ VICTORIA</div>
            <textarea class="textarea" style="margin-top: 10px" id="entryModalVictory" placeholder="Текст победы"></textarea>
          </div>

          <div class="soft" style="padding: 12px; background: var(--lesson)">
            <div style="font-size: 12px; font-weight: 900; letter-spacing:.16em">🦉 LECTIO</div>
            <textarea class="textarea" style="margin-top: 10px" id="entryModalLesson" placeholder="Текст урока"></textarea>
          </div>

          <div class="rowBetween" style="flex-wrap: wrap; gap: 10px">
            <button type="button" class="btn-danger" style="padding: 10px 14px; border-radius: 999px" data-action="modal-delete">🗑️ Удалить</button>
            <div class="row" style="flex-wrap: wrap">
              <button type="button" class="btn-ghost" data-action="modal-close">Отмена</button>
              <button type="button" class="btn" data-action="modal-save">Сохранить</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  const close = ()=> closeEntryModal();
  wrap.addEventListener('click', async (e)=>{
    const t = e.target?.closest?.('[data-action]');
    const action = t?.getAttribute?.('data-action');
    if (!action) return;

    if (action === 'modal-close') return close();

    const id = Number(wrap.getAttribute('data-id') || '0');
    if (!id) return close();

    if (action === 'modal-save') {
      const v = String($('#entryModalVictory')?.value || '').trim();
      const l = String($('#entryModalLesson')?.value || '').trim();
      if (!v && !l) return toast('Заполни хотя бы одну часть.');
      try {
        await api.entryUpdate(id, { victory: v, lesson: l });
        toast('Обновлено.');
        APP.state.cache.entryText.delete(id);
        close();
        await hydratePathStats();
        await hydrateTodayForm();
        await hydrateFeed(true);
      } catch (err) {
        toast(err.message || 'Ошибка обновления.');
      }
      return;
    }

    if (action === 'modal-delete') {
      if (!confirm('Удалить запись?')) return;
      try {
        await api.entryDelete(id);
        toast('Удалено.');
        APP.state.cache.entryText.delete(id);
        close();
        await hydratePathStats();
        await hydrateTodayForm();
        await hydrateFeed(true);
      } catch (err) {
        toast(err.message || 'Ошибка удаления.');
      }
      return;
    }
  });
}

function openEntryModal(id){
  ensureEntryModal();
  const wrap = $('#entryModal');
  const cached = APP.state.cache.entryText.get(id);
  if (!wrap || !cached) return;
  wrap.setAttribute('data-id', String(id));
  $('#entryModalVictory').value = cached.victory ?? '';
  $('#entryModalLesson').value = cached.lesson ?? '';
  wrap.classList.remove('hidden');
  // prevent background scroll while modal is open
  try { document.body.style.overflow = 'hidden'; } catch {}
  setTimeout(()=>{ try { $('#entryModalVictory')?.focus?.(); } catch {} }, 0);
}

function closeEntryModal(){
  const wrap = $('#entryModal');
  if (!wrap) return;
  wrap.classList.add('hidden');
  wrap.removeAttribute('data-id');
  // restore background scroll
  try { document.body.style.overflow = ''; } catch {}
}

function setTheme(themeId){
  const t = THEMES.find(x=>x.id===themeId) || THEMES[0];
  const r = document.documentElement;
  Object.entries(t.colors).forEach(([k,v]) => r.style.setProperty(`--${k}`, v));
  if (t.light) {
    document.body.style.background = `radial-gradient(1100px 560px at 20% -10%, rgba(76,111,255,.12), transparent 55%),
                                      radial-gradient(900px 520px at 110% 10%, rgba(31,185,129,.12), transparent 60%),
                                      var(--bg)`;
  } else {
    document.body.style.background = `radial-gradient(1200px 600px at 20% -10%, rgba(124,92,255,.22), transparent 55%),
                                      radial-gradient(900px 520px at 110% 10%, rgba(46,212,167,.20), transparent 60%),
                                      var(--bg)`;
  }
}

function nowISO(){ return new Date().toISOString(); }
function todayYMD(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function ruDateLabel(ymd){
  const [y,m,d] = ymd.split('-').map(Number);
  const date = new Date(y, m-1, d);
  return new Intl.DateTimeFormat('ru-RU', { day:'numeric', month:'long' }).format(date);
}

async function apiFetch(path, { method='GET', body=null }={}){
  const headers = { 'accept': 'application/json' };
  if (body !== null) headers['content-type'] = 'application/json';

  const res = await fetch(path, {
    method,
    headers,
    body: body !== null ? JSON.stringify(body) : undefined,
    cache: 'no-store',
    credentials: 'include',
  });

  let data = null;
  try { data = await res.json(); } catch { data = {}; }

  if (!res.ok) {
    // global auth handling
    if (res.status === 401) {
      APP.state.user = null;
      APP.state.team = null;

      const path = location.pathname;
      const isAuthPage = path === '/login' || path === '/register' || path.startsWith('/join/');
      if (!isAuthPage && !APP._authRedirectScheduled) {
        APP._authRedirectScheduled = true;
        setTimeout(()=>{
          try {
            // Use replace to avoid back-button loops
            history.replaceState({}, '', '/login');
          } finally {
            APP._authRedirectScheduled = false;
            // render is safe here: it will call /api/me, which will again 401,
            // but will NOT schedule another redirect because we're already on /login.
            render();
          }
        }, 0);
      }
    }

    const err = new Error(data?.error || 'Ошибка API.');
    err.status = res.status;
    err.reason = data?.reason;
    err.data = data;
    throw err;
  }
  return data;
}

const api = {
  health: ()=> apiFetch('/api/health'),
  me: ()=> apiFetch('/api/me'),
  register: (payload)=> apiFetch('/api/register', { method:'POST', body: payload }),
  login: (payload)=> apiFetch('/api/login', { method:'POST', body: payload }),
  logout: ()=> apiFetch('/api/logout', { method:'POST', body: {} }),
  inviteResolve: (code)=> apiFetch('/api/invites/resolve/' + encodeURIComponent(code)),
  join: (code, payload)=> apiFetch('/api/join/' + encodeURIComponent(code), { method:'POST', body: payload }),
  team: ()=> apiFetch('/api/team'),
  invitesList: ()=> apiFetch('/api/invites'),
  invitesCreate: ()=> apiFetch('/api/invites', { method:'POST', body: {} }),
  invitesDelete: (id)=> apiFetch('/api/invites/' + Number(id), { method:'DELETE' }),
  today: ()=> apiFetch('/api/today'),
  entriesGet: ({limit=20, before=null}={}) => {
    const p = new URLSearchParams();
    p.set('limit', String(limit));
    if (before?.date && before?.id) {
      p.set('beforeDate', before.date);
      p.set('beforeId', String(before.id));
    } else if (before?.date) {
      // legacy cursor mode: only date
      p.set('before', before.date);
    }
    return apiFetch('/api/entries?' + p.toString());
  },
  entryUpsertToday: ({victory, lesson})=> apiFetch('/api/entries', { method:'POST', body: { victory, lesson } }),
  entryUpdate: (id, {victory, lesson})=> apiFetch('/api/entries/' + Number(id), { method:'PUT', body: { victory, lesson } }),
  entryDelete: (id)=> apiFetch('/api/entries/' + Number(id), { method:'DELETE' }),
  settingsUpdate: ({name, theme, password})=> apiFetch('/api/settings', { method:'PUT', body: { name, theme, password } }),
  export: ()=> apiFetch('/api/export'),
  import: ({data, defaultPassword})=> apiFetch('/api/import', { method:'POST', body: { data, defaultPassword } }),
  stats: ()=> apiFetch('/api/stats'),
};

// server returns base64(Bun.gzipSync(text)) in entry.victory / entry.lesson
// Prefer client-side gunzip (DecompressionStream). Fallback to /api/gunzip.
const _gunzipCache = new Map();
const GUNZIP_CACHE_MAX = 600;

function gunzipCacheSet(key, value){
  _gunzipCache.set(key, value);
  // simple FIFO cap to avoid unbounded memory growth
  while (_gunzipCache.size > GUNZIP_CACHE_MAX) {
    const first = _gunzipCache.keys().next().value;
    _gunzipCache.delete(first);
  }
}

function b64ToU8(b64){
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

async function gunzipB64(b64){
  if (!b64) return '';
  if (_gunzipCache.has(b64)) return _gunzipCache.get(b64);

  // client path
  try {
    if (typeof DecompressionStream !== 'undefined') {
      const ds = new DecompressionStream('gzip');
      const blob = new Blob([b64ToU8(b64)]);
      const stream = blob.stream().pipeThrough(ds);
      const ab = await new Response(stream).arrayBuffer();
      const text = new TextDecoder().decode(new Uint8Array(ab));
      gunzipCacheSet(b64, text);
      return text;
    }
  } catch {}

  // fallback to server helper
  try {
    const r = await apiFetch('/api/gunzip', { method:'POST', body: { b64 } });
    const text = String(r.text || '');
    gunzipCacheSet(b64, text);
    return text;
  } catch {
    return '';
  }
}

function parseRoute(){
  const path = location.pathname;
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return { path: '/', params: {} };
  if (parts[0] === 'join') return { path: '/join', params: { code: parts[1] || '' } };
  return { path: '/' + parts[0], params: {} };
}

function nav(path){
  history.pushState({}, '', path);
  render();
}

function requireAuth(){
  if (!APP.state.user) {
    history.replaceState({}, '', '/login');
    render();
    return false;
  }
  return true;
}

function Logo(){
  return `<span style="letter-spacing:.18em; font-weight:800">✦ PARITER ✦</span>`;
}

function HealthBadge(){
  return `<span id="healthBadge" class="pill textMuted" style="font-size: 12px">backend: …</span>`;
}

function PageShell({title, subtitle, body, footer}={}){
  return `
    <div class="centerShell">
      <div class="centerMax">
        <div style="text-align:center; margin-bottom: 18px;">
          <div style="font-size:12px; text-transform:uppercase; opacity:.9">${Logo()}</div>
          ${title ? `<div style="margin-top: 16px; font-size: 28px; font-weight: 800;">${escapeHTML(title)}</div>` : ''}
          ${subtitle ? `<div style="margin-top: 8px; font-size: 14px; color: var(--textMuted);">${escapeHTML(subtitle)}</div>` : ''}
        </div>
        <div class="card" style="padding: 18px;">${body || ''}</div>
        ${footer ? `<div style="text-align:center; margin-top: 14px; font-size: 13px; color: var(--textMuted);">${footer}</div>` : ''}
      </div>
    </div>
  `;
}

function AppHeader(){
  const me = APP.state.user;
  const mates = (APP.state.teamUsers || []).filter(u => me && u.id !== me.id);
  const show = mates.slice(0, 6);
  const more = mates.length - show.length;

  return `
    <header class="header">
      <div class="container">
        <div class="headerRow">
          <button class="btn-ghost" style="padding: 10px 12px" data-action="sidebar-open" aria-label="Меню">☰</button>
          <div style="font-size: 13px; font-weight: 900; letter-spacing: .16em;">PARITER</div>
          <div class="row">
            <div class="row" style="display:none" id="mateIcons"></div>
            <div class="row" style="gap:6px" aria-hidden="true">
              ${show.map(u=>`<div title="${escapeHTML(u.name)}" style="width:32px;height:32px;border-radius:999px;border:1px solid var(--border);display:grid;place-items:center;background:rgba(255,255,255,.03)">${ROLE_META[u.role]?.emoji || '✦'}</div>`).join('')}
              ${more>0 ? `<div style="width:32px;height:32px;border-radius:999px;border:1px solid var(--border);display:grid;place-items:center;background:rgba(255,255,255,.03);font-size:12px">+${more}</div>` : ''}
            </div>
            <button class="btn-ghost" style="padding: 10px 12px" data-action="go-settings" aria-label="Настройки">⚙️</button>
          </div>
        </div>
      </div>
    </header>
  `;
}

function Sidebar(){
  const open = APP.state.sidebarOpen;
  const me = APP.state.user;
  const current = location.pathname;

  const item = (path, label, icon) => {
    const is = current === path || (path === '/path' && current === '/');
    return `
      <button class="soft" style="width:100%; text-align:left; padding: 12px; border-radius: 16px; border-color: ${is ? 'color-mix(in srgb, var(--accent) 55%, var(--border))' : 'var(--border)'}; background: ${is ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'rgba(255,255,255,.02)'}" data-nav="${path}">
        <div class="rowBetween">
          <div class="row" style="gap:10px">
            <span>${icon}</span>
            <span style="font-weight:700">${label}</span>
          </div>
          ${is ? `<span class="textMuted" style="font-size: 12px">активно</span>` : ''}
        </div>
      </button>
    `;
  };

  return `
    <div class="${open ? '' : 'hidden'}" style="position:fixed; inset:0; z-index: 50;">
      <div class="sidebar-scrim" style="position:absolute; inset:0" data-action="sidebar-close"></div>
      <aside class="sidebar" style="position:absolute; left:0; top:0; height:100%; width: min(320px, 86vw); padding: 16px;">
        <div class="rowBetween" style="margin-bottom: 12px;">
          <div style="font-size: 12px; text-transform: uppercase; letter-spacing: .16em; font-weight: 900;">✦ PARITER ✦</div>
          <button class="btn-ghost" style="padding: 10px 12px" data-action="sidebar-close" aria-label="Закрыть">✕</button>
        </div>

        ${me ? `
          <div class="soft" style="padding: 12px; margin-bottom: 12px;">
            <div class="row" style="gap:10px; align-items: center;">
              <div style="width:40px;height:40px;border-radius:999px;display:grid;place-items:center;border:1px solid var(--border);background:rgba(255,255,255,.03)">${ROLE_META[me.role]?.emoji || '✦'}</div>
              <div style="min-width: 0;">
                <div style="font-weight: 800; white-space: nowrap; overflow:hidden; text-overflow: ellipsis;">${escapeHTML(me.name)}</div>
                <div class="textMuted" style="font-size: 12px; white-space: nowrap; overflow:hidden; text-overflow: ellipsis;">@${escapeHTML(me.login)}</div>
              </div>
            </div>
          </div>
        ` : ''}

        <div class="grid" style="gap: 10px;">
          ${item('/path', 'Путь', '🛤️')}
          ${item('/invite', 'Спутники', '👥')}
          ${item('/settings', 'Настройки', '⚙️')}
        </div>

        <div class="divider" style="margin: 14px 0"></div>

        <button class="btn-danger" style="width:100%; text-align:left; padding: 12px; border-radius: 16px;" data-action="logout">🚪 Выйти</button>

        <div class="textMuted" style="margin-top: 14px; font-size: 12px;">
          <div>Backend: <span style="color: var(--text); font-weight: 800;">Bun + SQLite</span></div>
        </div>
      </aside>
    </div>
  `;
}

function ThemeGrid({role, value, onPickAction, idsPrefix=''}={}){
  const list = THEMES.filter(t => t.role === role);
  const t = list.find(x=>x.id===value) || list[0];
  const dots = list.map(x => {
    const active = x.id === value;
    return `<button type="button" class="theme-dot" data-action="${onPickAction}" data-theme="${x.id}" data-active="${active}" aria-label="${escapeHTML(x.ru)}"><span aria-hidden="true">${x.emoji}</span></button>`;
  }).join('');

  return `
    <div class="grid">
      <div style="font-size: 14px; font-weight: 800;">Выбери свой путь <span class="textMuted" style="font-weight: 700">/ Elige viam tuam</span></div>
      <div style="display:grid; grid-template-columns: repeat(7, 44px); gap: 8px; margin-top: 6px;">${dots}</div>
      <div class="soft" style="padding: 12px;" id="${idsPrefix}themePreview">
        <div class="rowBetween" style="align-items: flex-start;">
          <div>
            <div style="font-weight: 900;" id="${idsPrefix}themePreviewTitle">${t.emoji} ${escapeHTML(t.ru)}</div>
            <div class="textMuted" style="font-size: 12px" id="${idsPrefix}themePreviewLa">${escapeHTML(t.la)}</div>
          </div>
          <div class="textMuted" style="font-size: 12px">превью</div>
        </div>
      </div>
    </div>
  `;
}

function RolePicker({value, onPickAction}){
  const mk = (role) => {
    const m = ROLE_META[role];
    const active = value === role;
    return `
      <button type="button" class="soft" style="padding: 14px; width:100%; text-align:left; border-color:${active ? 'color-mix(in srgb, var(--accent) 55%, var(--border))' : 'var(--border)'}; background:${active ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'rgba(255,255,255,.02)'}" data-action="${onPickAction}" data-role="${role}">
        <div class="rowBetween">
          <div>
            <div style="font-size: 20px; font-weight: 900;">${m.emoji} ${escapeHTML(m.ru)}</div>
            <div class="textMuted" style="font-size: 12px">${escapeHTML(m.la)}</div>
          </div>
          <div class="textMuted" style="font-size: 13px">${active ? 'выбрано' : 'выбрать'}</div>
        </div>
      </button>
    `;
  };
  return `<div class="grid" style="gap: 10px">${mk('warrior')}${mk('amazon')}</div>`;
}

function DateDivider(label){
  return `
    <div class="row" style="gap: 12px; padding: 8px 0; align-items:center;">
      <div class="divider" style="flex:1"></div>
      <div class="textMuted" style="font-size: 12px; font-weight: 900; letter-spacing:.18em">${escapeHTML(label)}</div>
      <div class="divider" style="flex:1"></div>
    </div>
  `;
}

function EntryCard({entry, author, meId}){
  const isMine = entry.user_id === meId;
  const roleEmoji = ROLE_META[author?.role]?.emoji || '✦';
  const authorName = author?.name || 'Неизвестный';
  const dateLabel = ruDateLabel(entry.date);

  return `
    <article class="card" style="padding: 14px;">
      <div class="rowBetween">
        <div class="row" style="gap:10px; min-width:0">
          <div style="width:40px;height:40px;border-radius:999px;display:grid;place-items:center;border:1px solid var(--border);background:rgba(255,255,255,.03)">${roleEmoji}</div>
          <div style="min-width:0">
            <div style="font-weight: 900; white-space: nowrap; overflow:hidden; text-overflow: ellipsis;">${escapeHTML(authorName)}${isMine ? ' <span class="textMuted" style="font-size:12px">(ты)</span>' : ''}</div>
            <div class="textMuted" style="font-size: 12px">${escapeHTML(dateLabel)}</div>
          </div>
        </div>
        ${isMine ? `
          <div class="row" style="gap: 8px;">
            <button type="button" class="btn-ghost" style="padding: 10px 12px" data-action="entry-edit" data-id="${entry.id}">✎</button>
            <button type="button" class="btn-ghost" style="padding: 10px 12px" data-action="entry-delete" data-id="${entry.id}" aria-label="Удалить">🗑️</button>
          </div>
        ` : ''}
      </div>

      <div class="grid" style="margin-top: 12px;">
        <div class="soft" style="padding: 12px; background: var(--victory)">
          <div style="font-size: 12px; font-weight: 900; letter-spacing:.16em">⚔️ VICTORIA</div>
          <div style="margin-top: 6px; white-space: pre-wrap; word-break: break-word;" data-entry-text="victory" data-id="${entry.id}">…</div>
        </div>
        <div class="soft" style="padding: 12px; background: var(--lesson)">
          <div style="font-size: 12px; font-weight: 900; letter-spacing:.16em">🦉 LECTIO</div>
          <div style="margin-top: 6px; white-space: pre-wrap; word-break: break-word;" data-entry-text="lesson" data-id="${entry.id}">…</div>
        </div>
      </div>
    </article>
  `;
}

// Pages
function pageLanding(){
  if (APP.state.user) { history.replaceState({}, '', '/path'); render(); return ''; }
  return `
    <div class="centerShell">
      <div class="container" style="text-align:center">
        <div style="font-size:12px; text-transform:uppercase; opacity:.9">${Logo()}</div>
        <div style="margin-top: 18px; font-size: 44px; font-weight: 900;">Вместе. Наравне. Вперёд.</div>
        <div class="textMuted" style="margin-top: 6px;">Ūnā. Pariter. Porro.</div>

        <div class="card" style="margin: 22px auto 0; width: min(620px, 100%); padding: 18px; text-align:left">
          <div style="font-size:18px; font-weight: 900;">Зачем Pariter</div>
          <div class="textMuted" style="margin-top: 10px; line-height: 1.6">
            <div>• Фиксируй ежедневные победы над страхом.</div>
            <div>• Забирай уроки из ошибок, не повторяя их.</div>
            <div>• Видь записи спутников — и иди вместе.</div>
          </div>
          <div class="row" style="margin-top: 16px; flex-wrap: wrap">
            <button class="btn" style="flex:1" data-nav="/register">Начать путь</button>
            <button class="btn-ghost" style="flex:1" data-nav="/login">Уже в пути? Войти</button>
          </div>
          <div class="textMuted" style="margin-top: 10px; font-size: 12px;">Self-hosted. Open Source. Bun + SQLite.</div>
          <div style="margin-top: 12px; display:flex; justify-content:center">${HealthBadge()}</div>
        </div>
      </div>
    </div>
  `;
}

function pageLogin(){
  if (APP.state.user) { history.replaceState({}, '', '/path'); render(); return ''; }
  return PageShell({
    title: 'Продолжить путь',
    subtitle: 'Perge iter',
    body: `
      <form id="loginForm" class="grid">
        <div>
          <div class="label" style="margin-bottom: 6px">Логин</div>
          <input class="input" name="login" autocomplete="username" placeholder="например: loom" required />
        </div>
        <div>
          <div class="label" style="margin-bottom: 6px">Пароль</div>
          <input class="input" name="password" type="password" autocomplete="current-password" required />
        </div>
        <button class="btn" type="submit">Войти</button>
      </form>
      <div style="margin-top: 12px; display:flex; justify-content:center">${HealthBadge()}</div>
    `,
    footer: `Нет аккаунта? <a class="link" href="/register" data-nav="/register">Создать команду</a>`
  });
}

function pageRegister(){
  if (APP.state.user) { history.replaceState({}, '', '/path'); render(); return ''; }
  const defaultRole = 'warrior';
  const defaultTheme = THEMES.find(t=>t.role===defaultRole)?.id || 'dark_warrior';

  return PageShell({
    title: 'Начни свой путь',
    subtitle: 'Incipe iter tuum',
    body: `
      <form id="registerForm" class="grid" style="gap: 14px">
        <div class="grid" style="gap: 12px">
          <div>
            <div class="label" style="margin-bottom: 6px">Email (обязательно)</div>
            <input class="input" name="email" type="email" autocomplete="email" required placeholder="you@example.com" />
          </div>
          <div>
            <div class="label" style="margin-bottom: 6px">Имя (видят спутники)</div>
            <input class="input" name="name" required placeholder="Твоё имя" />
          </div>
          <div>
            <div class="label" style="margin-bottom: 6px">Логин</div>
            <input class="input" name="login" autocomplete="username" required placeholder="loom" />
            <div class="textMuted" style="margin-top: 6px; font-size: 12px">3–32 символа: a-z, 0-9, _ . -</div>
          </div>
          <div>
            <div class="label" style="margin-bottom: 6px">Пароль</div>
            <input class="input" name="password" type="password" autocomplete="new-password" required />
          </div>
        </div>

        <div class="divider"></div>

        <div>
          <div style="font-size: 14px; font-weight: 900; margin-bottom: 10px">Выбери роль</div>
          <input type="hidden" name="role" value="${escapeHTML(defaultRole)}" />
          ${RolePicker({ value: defaultRole, onPickAction: 'pick-role-register' })}
        </div>

        <div class="divider"></div>

        <div>
          <input type="hidden" name="theme" value="${escapeHTML(defaultTheme)}" />
          <div id="themeBlock">${ThemeGrid({ role: defaultRole, value: defaultTheme, onPickAction: 'pick-theme-register', idsPrefix:'reg-' })}</div>
        </div>

        <button class="btn" type="submit">Начать</button>
      </form>
      <div style="margin-top: 12px; display:flex; justify-content:center">${HealthBadge()}</div>
    `,
    footer: `Уже в пути? <a class="link" href="/login" data-nav="/login">Войти</a>`
  });
}

function pageJoin(){
  if (APP.state.user) { history.replaceState({}, '', '/path'); render(); return ''; }
  const code = APP.state.route.params.code || '';
  const defaultRole = 'warrior';
  const defaultTheme = THEMES.find(t=>t.role===defaultRole)?.id || 'dark_warrior';

  return PageShell({
    title: 'Присоединиться к пути',
    subtitle: 'Iunge te itineri',
    body: `
      <div class="soft" style="padding: 12px; margin-bottom: 14px" id="joinInfo">Проверяю приглашение…</div>
      <form id="joinForm" class="grid" style="gap: 14px" data-code="${escapeHTML(code)}">
        <div>
          <div class="label" style="margin-bottom: 6px">Имя</div>
          <input class="input" name="name" required placeholder="Твоё имя" disabled />
        </div>
        <div>
          <div class="label" style="margin-bottom: 6px">Логин</div>
          <input class="input" name="login" required autocomplete="username" placeholder="your_login" disabled />
        </div>
        <div>
          <div class="label" style="margin-bottom: 6px">Пароль</div>
          <input class="input" name="password" type="password" required autocomplete="new-password" disabled />
        </div>

        <div class="divider"></div>

        <div>
          <div style="font-size: 14px; font-weight: 900; margin-bottom: 10px">Роль</div>
          <input type="hidden" name="role" value="${escapeHTML(defaultRole)}" />
          ${RolePicker({ value: defaultRole, onPickAction: 'pick-role-join' })}
        </div>

        <div class="divider"></div>

        <div>
          <input type="hidden" name="theme" value="${escapeHTML(defaultTheme)}" />
          <div id="themeBlock">${ThemeGrid({ role: defaultRole, value: defaultTheme, onPickAction: 'pick-theme-join', idsPrefix:'join-' })}</div>
        </div>

        <button class="btn" type="submit" disabled>Присоединиться</button>
      </form>
    `,
    footer: `Уже в пути? <a class="link" href="/login" data-nav="/login">Войти</a>`
  });
}

function pagePath(){
  if (!requireAuth()) return '';
  const me = APP.state.user;
  const today = todayYMD();

  return `
    ${AppHeader()}
    ${Sidebar()}
    <main class="container" style="padding: 18px 0 28px">
      <div class="card" style="padding: 18px">
        <div class="rowBetween" style="align-items: flex-start">
          <div>
            <div class="textMuted" style="font-size: 12px; font-weight: 900; letter-spacing: .18em">✦ Сегодня ✦</div>
            <div style="margin-top: 6px; font-size: 22px; font-weight: 900">${escapeHTML(ruDateLabel(today))}</div>
            <div class="textMuted" style="margin-top: 8px; font-size: 12px" id="pathStats">Загрузка статистики…</div>
          </div>
          <div class="pill textMuted" style="font-size: 12px">${ROLE_META[me.role]?.emoji || '✦'} <span style="color: var(--text); font-weight: 900">${escapeHTML(me.name)}</span></div>
        </div>

        <form id="todayForm" class="grid" style="margin-top: 14px">
          <div class="soft" style="padding: 12px; background: var(--victory)">
            <div style="font-size: 12px; font-weight: 900; letter-spacing:.16em">⚔️ VICTORIA</div>
            <textarea class="textarea" style="margin-top: 10px" name="victory" placeholder="Что ты сделал(а) сегодня, несмотря на страх?"></textarea>
          </div>

          <div class="soft" style="padding: 12px; background: var(--lesson)">
            <div style="font-size: 12px; font-weight: 900; letter-spacing:.16em">🦉 LECTIO</div>
            <textarea class="textarea" style="margin-top: 10px" name="lesson" placeholder="Какой урок ты забираешь из ошибки?"></textarea>
          </div>

          <div class="rowBetween">
            <div class="textMuted" style="font-size: 12px" id="todayHint">Загрузка…</div>
            <button class="btn" type="submit">✓ Зафиксировать</button>
          </div>
        </form>
      </div>

      <div style="margin-top: 18px;">
        <div class="textMuted" style="font-size: 12px; font-weight: 900; letter-spacing: .18em">Бесконечный путь вниз</div>
        <div id="feed" class="grid" style="margin-top: 10px"></div>
        <div id="feedSentinel" style="height: 10px"></div>
        <div id="feedStatus" class="textMuted" style="text-align:center; font-size: 12px; padding: 12px 0"></div>
        <div style="display:flex; justify-content:center; padding-bottom: 8px;">
          <button type="button" id="feedMore" class="btn-ghost hidden" data-action="feed-more" style="padding: 10px 14px;">Загрузить ещё</button>
        </div>
      </div>
    </main>
  `;
}

function pageInvite(){
  if (!requireAuth()) return '';
  return `
    ${AppHeader()}
    ${Sidebar()}
    <main class="container" style="padding: 18px 0 28px">
      <div class="card" style="padding: 18px">
        <div>
          <div style="font-size: 26px; font-weight: 900">Спутники</div>
          <div class="textMuted" style="margin-top: 4px">Comitēs</div>
        </div>

        <div class="grid" style="margin-top: 16px; gap: 14px">
          <section class="soft" style="padding: 14px">
            <div style="font-weight: 900">Твоя команда</div>
            <div id="teamList" class="grid" style="margin-top: 10px"></div>
          </section>

          <section class="soft" style="padding: 14px">
            <div style="font-weight: 900">Пригласить <span class="textMuted" style="font-weight: 700">/ Invitā comitem</span></div>
            <div class="grid" style="margin-top: 10px; gap: 10px">
              <div>
                <div class="label">Ссылка (действует 7 дней)</div>
                <div class="row" style="margin-top: 6px">
                  <input id="inviteLink" class="input" readonly placeholder="Создай ссылку ниже" />
                  <button type="button" class="btn-ghost" style="padding: 10px 12px" data-action="copy-invite" title="Скопировать">📋</button>
                </div>
              </div>
              <div class="row">
                <button type="button" class="btn" data-action="new-invite">+ Новая ссылка</button>
                <button type="button" class="btn-ghost" data-action="clear-invite">Очистить</button>
              </div>
            </div>
          </section>

          <section class="soft" style="padding: 14px">
            <div style="font-weight: 900">Приглашения</div>
            <div id="inviteList" class="grid" style="margin-top: 10px"></div>
          </section>
        </div>
      </div>
    </main>
  `;
}

function pageSettings(){
  if (!requireAuth()) return '';
  const me = APP.state.user;
  const t = THEMES.find(x=>x.id===me.theme) || THEMES[0];

  return `
    ${AppHeader()}
    ${Sidebar()}
    <main class="container" style="padding: 18px 0 28px">
      <div class="card" style="padding: 18px">
        <div>
          <div style="font-size: 26px; font-weight: 900">Настройки</div>
          <div class="textMuted" style="margin-top: 4px">Optiōnēs</div>
        </div>

        <form id="settingsForm" class="grid" style="margin-top: 16px; gap: 14px">
          <div>
            <div class="label" style="margin-bottom: 6px">Имя</div>
            <input class="input" name="name" value="${escapeHTML(me.name)}" required />
          </div>
          <div>
            <div class="label" style="margin-bottom: 6px">Новый пароль (необязательно)</div>
            <input class="input" name="password" type="password" autocomplete="new-password" placeholder="••••••" />
          </div>

          <div class="divider"></div>

          <div>
            <input type="hidden" name="theme" value="${escapeHTML(me.theme)}" />
            <div id="settingsThemeBlock">${ThemeGrid({ role: me.role, value: me.theme, onPickAction: 'pick-theme-settings', idsPrefix:'set-' })}</div>
            <div class="textMuted" style="margin-top: 10px; font-size: 12px">Текущая тема: <span style="color: var(--text); font-weight: 900">${t.emoji} ${escapeHTML(t.ru)}</span></div>
          </div>

          <div class="row" style="flex-wrap: wrap">
            <button class="btn" type="submit">Сохранить</button>
            <button class="btn-ghost" type="button" data-action="go-path">Назад</button>
            <button class="btn-ghost" type="button" data-action="export-json">Экспорт JSON</button>
            <button class="btn-ghost" type="button" data-action="import-json">Импорт JSON</button>
            <input id="importFile" type="file" accept="application/json" style="display:none" />
          </div>
          <div class="textMuted" style="font-size: 12px; line-height: 1.5">
            Импорт доступен администратору. Данные будут добавлены/обновлены внутри текущей команды.
          </div>
        </form>
      </div>
    </main>
  `;
}

function pageNotFound(){
  return PageShell({
    title: 'Страница не найдена',
    subtitle: 'Errōr',
    body: `
      <div class="textMuted">Такого пути нет.</div>
      <div class="row" style="margin-top: 12px">
        <button class="btn" data-nav="/">На главную</button>
        <button class="btn-ghost" data-nav="/path">В путь</button>
      </div>
    `
  });
}

async function render(){
  if (APP._rendering) { APP._rerenderRequested = true; return; }
  APP._rendering = true;

  // SSR bootstrap (one-shot)
  if (!render._bootstrapConsumed) {
    render._bootstrapConsumed = true;
    try {
      const b = window.__PARITER_BOOTSTRAP__;
      if (b && typeof b === 'object') {
        APP.state.user = b.user || null;
        APP.state.team = b.team || null;
        if (Array.isArray(b.teamUsers)) {
          APP.state.teamUsers = b.teamUsers;
          APP.state.teamUsersFetchedAt = Date.now();
        }
      }
    } catch {}
    // free memory; next updates happen via API
    try { delete window.__PARITER_BOOTSTRAP__; } catch {}
  }

  // auth
  try {
    const needsMe = (APP.state.user == null);
    if (needsMe) {
      const { user, team } = await api.me();
      APP.state.user = user;
      APP.state.team = team;
    }
  } catch {
    APP.state.user = null;
    APP.state.team = null;
  }

  // theme
  if (APP.state.user?.theme) setTheme(APP.state.user.theme);
  else setTheme('dark_warrior');

  // team users cache (TTL)
  if (APP.state.user) {
    const ttlMs = 30_000;
    const fresh = (Date.now() - (APP.state.teamUsersFetchedAt || 0)) < ttlMs;
    if (!fresh || !APP.state.teamUsers?.length) {
      try {
        const { users } = await api.team();
        APP.state.teamUsers = users;
        APP.state.teamUsersFetchedAt = Date.now();
      } catch {
        APP.state.teamUsers = [];
        APP.state.teamUsersFetchedAt = 0;
      }
    }
  } else {
    APP.state.teamUsers = [];
    APP.state.teamUsersFetchedAt = 0;
  }

  APP.state.route = parseRoute();
  const route = APP.state.route.path;

  let html = '';
  if (route === '/') html = pageLanding();
  else if (route === '/login') html = pageLogin();
  else if (route === '/register') html = pageRegister();
  else if (route === '/join') html = pageJoin();
  else if (route === '/path') html = pagePath();
  else if (route === '/invite') html = pageInvite();
  else if (route === '/settings') html = pageSettings();
  else html = pageNotFound();

  $('#app').innerHTML = html;
  bindHandlers();

  if ((route === '/' || route === '/login' || route === '/register' || route === '/join') && !APP.state.user) {
    // fire and forget
    hydrateHealth();
  }

  if (route === '/join' && !APP.state.user) await hydrateJoin();
  if (route === '/path' && APP.state.user) {
    await hydratePathStats();
    await hydrateTodayForm();
    await hydrateFeed(true);
  }
  if (route === '/invite' && APP.state.user) await hydrateInvite();

  APP._rendering = false;
  if (APP._rerenderRequested) {
    APP._rerenderRequested = false;
    // fire and forget
    render();
  }
}

function bindHandlers(){
  // one-time keyboard handler
  if (!bindHandlers._kbdBound) {
    bindHandlers._kbdBound = true;
    document.addEventListener('keydown', (e)=>{
      if (e.key === 'Escape') {
        const modal = $('#entryModal');
        if (modal && !modal.classList.contains('hidden')) {
          closeEntryModal();
          return;
        }
        if (APP.state.sidebarOpen) {
          APP.state.sidebarOpen = false;
          render();
        }
      }
    });
  }

  // One delegated click handler for all dynamic buttons/links.
  // Prevents duplicate listeners when feed/invite blocks are re-rendered.
  if (!bindHandlers._delegated) {
    bindHandlers._delegated = true;

    document.addEventListener('click', async (e)=>{
      // Let modal handle its own buttons.
      if (e.target?.closest?.('#entryModal')) return;

      // data-nav
      const navEl = e.target?.closest?.('[data-nav]');
      if (navEl) {
        e.preventDefault();
        e.stopPropagation();
        APP.state.sidebarOpen = false;
        nav(navEl.getAttribute('data-nav'));
        return;
      }

      // data-action
      const actionEl = e.target?.closest?.('[data-action]');
      const action = actionEl?.getAttribute?.('data-action');
      if (!action) return;

      e.preventDefault();
      e.stopPropagation();

      // Sidebar
      if (action === 'sidebar-open') {
        APP.state.sidebarOpen = true;
        render();
        setTimeout(()=>{ try { $('[data-action="sidebar-close"]')?.focus?.(); } catch {} }, 0);
        return;
      }
      if (action === 'sidebar-close') {
        APP.state.sidebarOpen = false;
        render();
        return;
      }
      if (action === 'go-settings') {
        APP.state.sidebarOpen = false;
        nav('/settings');
        return;
      }
      if (action === 'go-path') {
        APP.state.sidebarOpen = false;
        nav('/path');
        return;
      }
      if (action === 'logout') {
        try { await api.logout(); } catch {}
        APP.state.sidebarOpen = false;
        toast('До встречи на пути.');
        history.replaceState({}, '', '/');
        render();
        return;
      }

      // Settings: export/import
      if (action === 'export-json') {
        try {
          const data = await api.export();
          const ymd = todayYMD();
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json; charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `pariter-export-${ymd}.json`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          toast('Экспорт готов.');
        } catch (err) {
          toast(err.message || 'Ошибка экспорта.');
        }
        return;
      }

      if (action === 'import-json') {
        const input = $('#importFile');
        if (!input) return toast('Не найден элемент выбора файла.');

        input.value = '';
        input.onchange = async ()=>{
          try {
            const file = input.files?.[0];
            if (!file) return;
            const text = await file.text();
            const data = JSON.parse(text);

            const defaultPassword = prompt(
              'Импорт JSON.\n\n' +
              'Если в текущей команде нет пользователя с таким login, он будет создан.\n' +
              'Укажи пароль по умолчанию для НОВЫХ пользователей (минимум 6 символов).\n' +
              'Оставь пустым — Pariter сгенерирует пароли и отдаст их списком.',
              ''
            );

            const pass = (defaultPassword == null) ? null : String(defaultPassword).trim();
            if (pass === null) return; // cancelled

            const r = await api.import({ data, defaultPassword: pass || '' });

            const msg = [
              `Импорт: пользователи +${Number(r.usersCreated||0)} (сопоставлено ${Number(r.usersMapped||0)}),`,
              `инвайты +${Number(r.invitesCreated||0)} (пропущено ${Number(r.invitesSkipped||0)}),`,
              `записи +${Number(r.entriesCreated||0)} / обновлено ${Number(r.entriesUpdated||0)} (пропущено ${Number(r.entriesSkipped||0)}).`
            ].join(' ');
            toast('Импорт выполнен.');

            if (Array.isArray(r.createdCreds) && r.createdCreds.length) {
              const ymd = todayYMD();
              const lines = [
                'PARITER — созданные пользователи (сгенерированные пароли)',
                `Дата: ${ymd}`,
                '',
                ...r.createdCreds.map(x => `${x.login}: ${x.password}`),
                '',
                msg
              ].join('\n');
              const blob = new Blob([lines], { type: 'text/plain; charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `pariter-import-creds-${ymd}.txt`;
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(url);
            }

            APP.state.teamUsersFetchedAt = 0;
            await render();
          } catch (err) {
            toast(err.message || 'Ошибка импорта.');
          } finally {
            input.value = '';
            input.onchange = null;
          }
        };

        input.click();
        return;
      }

      // Register/join role selection
      if (action === 'pick-role-register' || action === 'pick-role-join') {
        const role = actionEl.getAttribute('data-role');
        const form = action === 'pick-role-register' ? $('#registerForm') : $('#joinForm');
        if (!form || !role) return;

        form.querySelector('input[name="role"]').value = role;
        const theme = (THEMES.find(t=>t.role===role)?.id) || 'dark_warrior';
        form.querySelector('input[name="theme"]').value = theme;
        setTheme(theme);

        const themeBlock = $('#themeBlock');
        if (themeBlock) themeBlock.innerHTML = ThemeGrid({
          role,
          value: theme,
          onPickAction: action === 'pick-role-register' ? 'pick-theme-register' : 'pick-theme-join',
          idsPrefix: action === 'pick-role-register' ? 'reg-' : 'join-'
        });
        return;
      }

      // Theme selection
      if (action === 'pick-theme-register' || action === 'pick-theme-join') {
        const theme = actionEl.getAttribute('data-theme');
        const form = action === 'pick-theme-register' ? $('#registerForm') : $('#joinForm');
        if (!form || !theme) return;

        form.querySelector('input[name="theme"]').value = theme;
        setTheme(theme);
        $('#themeBlock').innerHTML = ThemeGrid({
          role: form.querySelector('input[name="role"]').value,
          value: theme,
          onPickAction: action,
          idsPrefix: action === 'pick-theme-register' ? 'reg-' : 'join-'
        });
        return;
      }

      if (action === 'pick-theme-settings') {
        const theme = actionEl.getAttribute('data-theme');
        const f = $('#settingsForm');
        if (!f || !theme) return;

        const nameV = f.querySelector('input[name="name"]').value;
        const passV = f.querySelector('input[name="password"]').value;

        f.querySelector('input[name="theme"]').value = theme;
        setTheme(theme);
        await render();
        const nf = $('#settingsForm');
        if (nf) {
          nf.querySelector('input[name="name"]').value = nameV;
          nf.querySelector('input[name="password"]').value = passV;
          nf.querySelector('input[name="theme"]').value = theme;
        }
        return;
      }

      // Invite page actions
      if (action === 'new-invite') {
        try {
          const { invite } = await api.invitesCreate();
          const link = `${location.origin}/join/${invite.code}`;
          const el = $('#inviteLink');
          if (el) el.value = link;
          toast('Ссылка создана.');
          await hydrateInvite();
        } catch (err) {
          toast(err.message || 'Ошибка создания ссылки.');
        }
        return;
      }

      if (action === 'clear-invite') {
        const el = $('#inviteLink');
        if (el) el.value = '';
        return;
      }

      if (action === 'copy-invite') {
        const el = $('#inviteLink');
        const text = el?.value || '';
        if (!text) return toast('Сначала создай ссылку.');
        try {
          await navigator.clipboard.writeText(text);
          toast('Скопировано.');
        } catch {
          el.select();
          document.execCommand('copy');
          toast('Скопировано.');
        }
        return;
      }

      if (action === 'invite-use') {
        const code = actionEl.getAttribute('data-code');
        const link = `${location.origin}/join/${code}`;
        const el = $('#inviteLink');
        if (el) el.value = link;
        toast('Ссылка подготовлена.');
        return;
      }

      if (action === 'invite-copy') {
        const code = actionEl.getAttribute('data-code');
        const link = `${location.origin}/join/${code}`;
        try {
          await navigator.clipboard.writeText(link);
          toast('Скопировано.');
        } catch {
          const el = $('#inviteLink');
          if (el) {
            el.value = link;
            el.focus();
            el.select();
            document.execCommand('copy');
            toast('Скопировано.');
          } else {
            toast('Не удалось скопировать.');
          }
        }
        return;
      }

      if (action === 'invite-delete') {
        const id = Number(actionEl.getAttribute('data-id'));
        if (!confirm('Удалить приглашение?')) return;
        try {
          await api.invitesDelete(id);
          toast('Удалено.');
          await hydrateInvite();
        } catch (err) {
          toast(err.message || 'Ошибка удаления.');
        }
        return;
      }

      // Feed (fallback for browsers without IntersectionObserver)
      if (action === 'feed-more') {
        await loadMoreFeed();
        return;
      }

      // Entry actions
      if (action === 'entry-delete') {
        const id = Number(actionEl.getAttribute('data-id'));
        if (!confirm('Удалить запись?')) return;
        try {
          await api.entryDelete(id);
          toast('Удалено.');
          await hydratePathStats();
          await hydrateFeed(true);
          await hydrateTodayForm();
        } catch (err) {
          toast(err.message || 'Ошибка удаления.');
        }
        return;
      }

      if (action === 'entry-edit') {
        const id = Number(actionEl.getAttribute('data-id'));
        const cached = APP.state.cache.entryText.get(id);
        if (!cached) return toast('Запись ещё загружается. Попробуй через секунду.');
        openEntryModal(id);
        return;
      }
    });
  }

  // Forms are re-rendered, but each form is new in DOM, so we bind once via a flag.
  const loginForm = $('#loginForm');
  if (loginForm && !loginForm._bound) {
    loginForm._bound = true;
    loginForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const fd = new FormData(loginForm);
      try {
        await api.login({ login: fd.get('login'), password: fd.get('password') });
        toast('Вход выполнен.');
        history.replaceState({}, '', '/path');
        render();
      } catch (err) {
        toast(err.message || 'Ошибка входа.');
      }
    });
  }

  const registerForm = $('#registerForm');
  if (registerForm && !registerForm._bound) {
    registerForm._bound = true;
    registerForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const fd = new FormData(registerForm);
      try {
        await api.register({
          email: fd.get('email'),
          name: fd.get('name'),
          login: fd.get('login'),
          password: fd.get('password'),
          role: fd.get('role'),
          theme: fd.get('theme'),
        });
        toast('Команда создана. Путь начался.');
        history.replaceState({}, '', '/path');
        render();
      } catch (err) {
        toast(err.message || 'Ошибка регистрации.');
      }
    });
  }

  const joinForm = $('#joinForm');
  if (joinForm && !joinForm._bound) {
    joinForm._bound = true;
    joinForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const fd = new FormData(joinForm);
      const code = joinForm.getAttribute('data-code') || '';
      try {
        await api.join(code, {
          name: fd.get('name'),
          login: fd.get('login'),
          password: fd.get('password'),
          role: fd.get('role'),
          theme: fd.get('theme'),
        });
        toast('Добро пожаловать на путь.');
        history.replaceState({}, '', '/path');
        render();
      } catch (err) {
        const reason = err?.reason;
        if (reason === 'invalid') toast('Приглашение недействительно.');
        else if (reason === 'expired') toast('Срок действия приглашения истёк.');
        else if (reason === 'used') toast('Приглашение уже использовано.');
        else toast(err.message || 'Ошибка присоединения.');
        try { await hydrateJoin(); } catch {}
      }
    });
  }

  const settingsForm = $('#settingsForm');
  if (settingsForm && !settingsForm._bound) {
    settingsForm._bound = true;
    settingsForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const fd = new FormData(settingsForm);
      try {
        const pass = String(fd.get('password') || '').trim() || null;
        await api.settingsUpdate({
          name: fd.get('name'),
          theme: fd.get('theme'),
          password: pass,
        });
        toast('Сохранено.');
        await render();
      } catch (err) {
        toast(err.message || 'Ошибка сохранения.');
      }
    });
  }
}

async function hydrateHealth(){
  const el = $('#healthBadge');
  if (!el) return;
  try {
    const r = await api.health();
    if (r && r.ok) {
      el.innerHTML = `backend: <span style="color: var(--text); font-weight: 900">ok</span>`;
      return;
    }
    el.innerHTML = `backend: <span style="color: var(--danger); font-weight: 900">offline</span>`;
  } catch {
    el.innerHTML = `backend: <span style="color: var(--danger); font-weight: 900">offline</span>`;
  }
}

async function hydrateJoin(){
  const form = $('#joinForm');
  const info = $('#joinInfo');
  if (!form || !info) return;
  const code = form.getAttribute('data-code') || '';

  const setEnabled = (enabled)=>{
    $$('input, button', form).forEach(el=>{
      if (el.type === 'hidden') return;
      el.disabled = !enabled;
    });
  };

  try {
    const r = await api.inviteResolve(code);

    if (r && r.ok === true) {
      info.innerHTML = `Тебя пригласил: <span style="font-weight: 900">${escapeHTML(r.inviter?.name || 'Спутник')}</span>`;
      setEnabled(true);
      setTimeout(()=>{ try { form.querySelector('input[name="name"]')?.focus?.(); } catch {} }, 0);
      return;
    }

    const reason = r?.reason;
    let msg = 'Код недействителен или истёк';
    if (reason === 'invalid') msg = 'Приглашение недействительно';
    else if (reason === 'expired') msg = 'Срок действия приглашения истёк';
    else if (reason === 'used') msg = 'Приглашение уже использовано';

    info.innerHTML = `<span style="font-weight: 900; color: var(--danger)">${escapeHTML(msg)}</span>`;
    setEnabled(false);
  } catch (e) {
    info.innerHTML = `<span style="font-weight: 900; color: var(--danger)">Не удалось проверить приглашение</span>`;
    setEnabled(false);
  }
}

async function hydratePathStats(){
  const el = $('#pathStats');
  if (!el) return;
  try {
    const s = await api.stats();
    const bits = [];
    bits.push(`Серия: <span style="color: var(--text); font-weight: 900">${Number(s.streak || 0)}</span>`);
    bits.push(`Команда сегодня: <span style="color: var(--text); font-weight: 900">${Number(s.teamToday || 0)}</span>`);
    bits.push(`Всего в команде: <span style="color: var(--text); font-weight: 900">${Number(s.teamTotal || 0)}</span>`);
    el.innerHTML = bits.join(' · ');
  } catch {
    el.textContent = '';
  }
}

async function hydrateTodayForm(){
  const form = $('#todayForm');
  if (!form) return;
  const hint = $('#todayHint');

  try {
    const { entry } = await api.today();
    if (!entry) {
      form.querySelector('textarea[name="victory"]').value = '';
      form.querySelector('textarea[name="lesson"]').value = '';
      if (hint) hint.textContent = 'Новая запись будет добавлена.';
    } else {
      const v = await gunzipB64(entry.victory);
      const l = await gunzipB64(entry.lesson);
      form.querySelector('textarea[name="victory"]').value = v;
      form.querySelector('textarea[name="lesson"]').value = l;
      if (hint) hint.textContent = 'Сегодняшняя запись будет обновлена.';
    }
  } catch {
    if (hint) hint.textContent = 'Новая запись будет добавлена.';
  }

  if (!form._bound) {
    form._bound = true;
    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const fd = new FormData(form);
      try {
        const victory = String(fd.get('victory') || '').trim();
        const lesson = String(fd.get('lesson') || '').trim();
        if (!victory && !lesson) return toast('Заполни хотя бы одну часть: победу или урок.');
        await api.entryUpsertToday({ victory, lesson });
        toast('Зафиксировано.');
        await hydratePathStats();
        await hydrateTodayForm();
        await hydrateFeed(true);
      } catch (err) {
        toast(err.message || 'Ошибка сохранения.');
      }
    });
  }
}

function teamUserMap(){
  const m = new Map();
  for (const u of (APP.state.teamUsers || [])) m.set(u.id, u);
  return m;
}

async function hydrateFeed(reset=false){
  if (!APP.state.user) return;
  const feed = $('#feed');
  const status = $('#feedStatus');
  const sentinel = $('#feedSentinel');
  const moreBtn = $('#feedMore');
  if (!feed || !status || !sentinel) return;

  if (reset) {
    APP.state.feed.cursor = null;
    APP.state.feed.loading = false;
    APP.state.feed.done = false;
    APP.state.feed.lastRenderedDate = null;
    APP.state.feed.renderedCount = 0;
    feed.innerHTML = '';
    status.textContent = '';
    if (moreBtn) moreBtn.classList.add('hidden');
  }

  // Infinite scroll when IntersectionObserver is available.
  if (typeof IntersectionObserver !== 'undefined') {
    if (!hydrateFeed._io) {
      hydrateFeed._io = new IntersectionObserver(async (entries)=>{
        if (entries.some(e=>e.isIntersecting)) await loadMoreFeed();
      }, { rootMargin: '300px' });
    }
    hydrateFeed._io.disconnect();
    hydrateFeed._io.observe(sentinel);
    if (moreBtn) moreBtn.classList.add('hidden');
  } else {
    // Fallback: manual "Load more" button.
    if (moreBtn) moreBtn.classList.remove('hidden');
  }

  await loadMoreFeed();
}

async function loadMoreFeed(){
  const feed = $('#feed');
  const status = $('#feedStatus');
  const moreBtn = $('#feedMore');
  if (!feed || !status) return;
  if (APP.state.feed.loading || APP.state.feed.done) return;

  APP.state.feed.loading = true;
  status.textContent = 'Загружаю…';
  if (moreBtn) moreBtn.disabled = true;

  try {
    const { entries, nextCursor, nextBefore } = await api.entriesGet({ limit: 20, before: APP.state.feed.cursor });
    if (!entries.length) {
      APP.state.feed.done = true;
      status.textContent = APP.state.feed.renderedCount ? 'Конец пути (пока что).' : 'Пока нет записей. Начни сегодня.';
      const moreBtn = $('#feedMore');
      if (moreBtn) moreBtn.classList.add('hidden');
      return;
    }

    const map = teamUserMap();

    for (const e of entries) {
      if (APP.state.feed.lastRenderedDate !== e.date) {
        feed.insertAdjacentHTML('beforeend', DateDivider(ruDateLabel(e.date)));
        APP.state.feed.lastRenderedDate = e.date;
      }

      const author = map.get(e.user_id) || null;
      feed.insertAdjacentHTML('beforeend', EntryCard({ entry: e, author, meId: APP.state.user.id }));
      APP.state.feed.renderedCount++;
    }

    // fill texts for freshly appended cards (decode in parallel)
    const entryById = new Map(entries.map(x => [Number(x.id), x]));
    const fresh = Array.from(feed.querySelectorAll('[data-entry-text][data-id]')).slice(-entries.length*2);
    await Promise.all(fresh.map(async (el) => {
      const id = Number(el.getAttribute('data-id'));
      const kind = el.getAttribute('data-entry-text');
      const entry = entryById.get(id);
      if (!entry) return;
      const b64 = kind === 'victory' ? entry.victory : entry.lesson;
      const text = await gunzipB64(b64);
      el.textContent = text || '—';

      const cur = APP.state.cache.entryText.get(id) || { victory: null, lesson: null };
      if (kind === 'victory') cur.victory = text;
      if (kind === 'lesson') cur.lesson = text;
      APP.state.cache.entryText.set(id, cur);
    }));

    APP.state.feed.cursor = nextCursor || (nextBefore ? { date: nextBefore, id: 0 } : null);
    status.textContent = '';

    // update fallback button visibility
    const moreBtn = $('#feedMore');
    if (moreBtn) {
      const io = (typeof IntersectionObserver !== 'undefined');
      const hasMore = !!APP.state.feed.cursor;
      if (!io && hasMore) moreBtn.classList.remove('hidden');
      if (!io && !hasMore) moreBtn.classList.add('hidden');
    }

    bindHandlers();

  } catch (err) {
    status.textContent = '';
    toast(err.message || 'Ошибка загрузки ленты.');
  } finally {
    APP.state.feed.loading = false;
    const moreBtn = $('#feedMore');
    if (moreBtn) moreBtn.disabled = false;
  }
}

async function hydrateInvite(){
  const teamList = $('#teamList');
  const inviteList = $('#inviteList');
  const inviteLink = $('#inviteLink');
  if (!teamList || !inviteList) return;

  const { users } = await api.team();
  APP.state.teamUsers = users;
  APP.state.teamUsersFetchedAt = Date.now();
  const me = APP.state.user;

  teamList.innerHTML = users.map(u => {
    const joined = new Intl.DateTimeFormat('ru-RU', { year:'numeric', month:'short', day:'numeric' }).format(new Date(u.created_at));
    return `
      <div class="soft" style="padding: 10px 12px; display:flex; align-items:center; justify-content: space-between; gap: 10px">
        <div class="row" style="min-width:0; gap:10px">
          <div style="width:36px;height:36px;border-radius:999px;border:1px solid var(--border);display:grid;place-items:center;background:rgba(255,255,255,.03)">${ROLE_META[u.role]?.emoji || '✦'}</div>
          <div style="min-width:0">
            <div style="font-weight: 800; white-space: nowrap; overflow:hidden; text-overflow: ellipsis;">${escapeHTML(u.name)}${u.id===me.id ? ' <span class="textMuted" style="font-size:12px">(ты)</span>' : ''}</div>
            <div class="textMuted" style="font-size: 12px">присоединился: ${escapeHTML(joined)}</div>
          </div>
        </div>
        <div class="textMuted" style="font-size: 12px">@${escapeHTML(u.login)}</div>
      </div>
    `;
  }).join('');

  const { invites } = await api.invitesList();
  const now = Date.now();
  const active = invites.filter(i => i.used === 0 && new Date(i.expires_at).getTime() > now);
  const history = invites
    .filter(i => !(i.used === 0 && new Date(i.expires_at).getTime() > now))
    .sort((a,b)=> (new Date(b.created_at || 0).getTime() || 0) - (new Date(a.created_at || 0).getTime() || 0));

  const sectionTitle = (t)=> `
    <div class="row" style="gap: 12px; padding: 8px 0; align-items:center;">
      <div class="divider" style="flex:1"></div>
      <div class="textMuted" style="font-size: 12px; font-weight: 900; letter-spacing:.18em">${escapeHTML(t)}</div>
      <div class="divider" style="flex:1"></div>
    </div>
  `;

  const renderInvite = (i, { mode })=>{
    const exp = new Intl.DateTimeFormat('ru-RU', { year:'numeric', month:'short', day:'numeric' }).format(new Date(i.expires_at));
    const expired = new Date(i.expires_at).getTime() <= now;
    const status = i.used === 1 ? 'использовано' : (expired ? 'истекло' : 'активно');
    const badgeColor = i.used === 1
      ? 'rgba(255,255,255,.08)'
      : (expired ? 'color-mix(in srgb, var(--danger) 18%, transparent)' : 'color-mix(in srgb, var(--accent) 14%, transparent)');

    return `
      <div class="soft" style="padding: 10px 12px; display:flex; align-items:center; justify-content: space-between; gap: 10px">
        <div>
          <div style="font-weight: 900"><span class="kbd">${escapeHTML(i.code)}</span></div>
          <div class="textMuted" style="font-size: 12px">до: ${escapeHTML(exp)}</div>
        </div>
        <div class="row" style="gap: 8px; align-items:center">
          <span class="pill" style="padding:6px 10px; font-size: 12px; background:${badgeColor}">${escapeHTML(status)}</span>
          ${mode === 'active' ? `
            <button type="button" class="btn-ghost" style="padding: 10px 12px" data-action="invite-copy" data-code="${escapeHTML(i.code)}" title="Скопировать ссылку">📋</button>
            <button type="button" class="btn-ghost" style="padding: 10px 12px" data-action="invite-use" data-code="${escapeHTML(i.code)}" title="Подставить в поле">↗</button>
          ` : ''}
          <button type="button" class="btn-ghost" style="padding: 10px 12px" data-action="invite-delete" data-id="${i.id}" aria-label="Удалить">✕</button>
        </div>
      </div>
    `;
  };

  let html = '';
  html += sectionTitle('АКТИВНЫЕ');
  html += active.length
    ? active.map(i => renderInvite(i, { mode: 'active' })).join('')
    : `<div class="textMuted" style="font-size: 13px">Нет активных приглашений.</div>`;

  if (history.length) {
    html += sectionTitle('ИСТОРИЯ');
    html += history.map(i => renderInvite(i, { mode: 'history' })).join('');
  }

  inviteList.innerHTML = html;

  // Clicks are handled via delegated handler in bindHandlers()
  bindHandlers();
}

window.addEventListener('popstate', render);

document.addEventListener('click', (e)=>{
  // intercept plain <a href="/..."></a>
  const a = e.target?.closest?.('a');
  if (!a) return;
  // If a link already uses SPA data-nav, the delegated handler will process it.
  if (a.hasAttribute('data-nav')) return;
  const href = a.getAttribute('href');
  if (!href) return;
  if (href.startsWith('/') && !href.startsWith('/static/') && !href.includes('.')) {
    e.preventDefault();
    nav(href);
  }
});

(async function init(){
  setTheme('dark_warrior');
  ensureEntryModal();
  await render();
})();
