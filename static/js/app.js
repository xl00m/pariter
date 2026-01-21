const APP = {
  _authRedirectScheduled: false,
  _rendering: false,
  _rerenderRequested: false,
  _pushBusy: false,
  pwa: { deferredPrompt: null, installed: false },
  state: {
    user: null,
    team: null,
    teamUsers: [],
    teamUsersFetchedAt: 0,
    sidebarOpen: false,
    route: { path: '/', params: {} },
    feed: { cursor: null, loading: false, done: false, lastRenderedDate: null, renderedCount: 0 },
    cache: { entryText: new Map() },
    live: { topKey: null, pending: false, unread: 0, lastNotifiedKey: null, prompted: false },
    sound: { enabled: false, lastAt: 0 },
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

  { id:'sync_warrior', role:'warrior', emoji:'🖤', ru:'Синхронизация', la:'Synchronizatio', light:false, colors:{ bg:'#0a0a0f', bgSecondary:'#14141f', text:'#d4dbe8', textMuted:'#7a8599', accent:'#8fa4c9', accentHover:'#b8c8e8', border:'rgba(150,160,180,.12)', victory:'rgba(143,164,201,.12)', lesson:'rgba(255,190,225,.10)' } },
  { id:'sync_amazon', role:'amazon', emoji:'🖤', ru:'Синхронизация', la:'Synchronizatio', light:false, colors:{ bg:'#0a0a0f', bgSecondary:'#14141f', text:'#d4dbe8', textMuted:'#7a8599', accent:'#8fa4c9', accentHover:'#b8c8e8', border:'rgba(150,160,180,.12)', victory:'rgba(143,164,201,.12)', lesson:'rgba(255,190,225,.10)' } },
];

function themeById(id){
  return THEMES.find(t => t.id === id) || THEMES[0];
}

function shouldAnimateNow(){
  try {
    const inFocus = !document.hidden && (typeof document.hasFocus !== 'function' || document.hasFocus());
    if (!inFocus) return false;

    const p = APP.state?.route?.path || parseRoute().path;
    return !!p;
  } catch { return false; }
}

function shouldAnimateBlackHoles(){
  try {
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const inFocus = !document.hidden && (typeof document.hasFocus !== 'function' || document.hasFocus());
    if (!inFocus) return false;

    const p = APP.state?.route?.path || parseRoute().path;
    return !!p && !prefersReducedMotion;
  } catch { return false; }
}

function shouldAnimateWithReducedIntensity(){
  try {
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const inFocus = !document.hidden && (typeof document.hasFocus !== 'function' || document.hasFocus());
    if (!inFocus) return false;

    const p = APP.state?.route?.path || parseRoute().path;
    return !!p && prefersReducedMotion;
  } catch { return false; }
}

function ensureStarsLayer(){
  if (!document.getElementById('starsCanvas')) {
    const old = document.querySelector('.stars-bg');
    if (old) old.remove();

    const bg = document.createElement('div');
    bg.className = 'stars-bg';
    const canvas = document.createElement('canvas');
    canvas.id = 'starsCanvas';
    bg.appendChild(canvas);
    document.body.insertBefore(bg, document.body.firstChild || null);

    document.documentElement.classList.add('l00m-stars-on');
  }

  if (!ensureStarsLayer._stars) ensureStarsLayer._stars = new StarsEngine(document.getElementById('starsCanvas'));
  ensureStarsLayer._stars.start();

  if (!ensureStarsLayer._crystal) ensureStarsLayer._crystal = new CrystalEngine();
  ensureStarsLayer._crystal.syncToRoute();

  if (!ensureStarsLayer._bound) {
    ensureStarsLayer._bound = true;

    const pauseAll = ()=>{
      try { document.documentElement.classList.add('l00m-paused'); } catch {}
      try { ensureStarsLayer._stars?.stop(); } catch {}
      try { ensureStarsLayer._crystal?.stop(); } catch {}
    };
    const resumeAll = ()=>{
      try { document.documentElement.classList.remove('l00m-paused'); } catch {}
      try { ensureStarsLayer._stars?.start(); } catch {}
      try { ensureStarsLayer._crystal?.syncToRoute(); } catch {}
    };

    document.addEventListener('visibilitychange', ()=>{
      try {
        if (document.hidden) pauseAll();
        else resumeAll();
      } catch {}
    });

    window.addEventListener('blur', ()=>{ try { pauseAll(); } catch {} });
    window.addEventListener('focus', ()=>{ try { resumeAll(); } catch {} });
  }
}

function StarsEngine(canvas){
  this.canvas = canvas;
  this.ctx = canvas ? canvas.getContext('2d') : null;
  this.baseCanvas = document.createElement('canvas');
  this.baseCtx = this.baseCanvas.getContext('2d');
  this.bgColor = ()=>{
    try {
      const r = getComputedStyle(document.documentElement);
      const lunar = r.getPropertyValue('--lunar-bg-deep').trim();
      const v = r.getPropertyValue('--bg').trim();
      return lunar || v || '#0a0a0f';
    } catch { return '#0a0a0f'; }
  };

  this.W = 0; this.H = 0;
  this.stars = []; this.twinkle = []; this.ghosts = [];
  this.holes = [];
  this.comets = [];
  this._lastCometAt = 0;
  this._ghostCheckAt = 0;
  this._lastDocH = 0;

  this._raf = 0;
  this._onResize = ()=>{ this.rebuild(); this.generateGhosts(); };

  this.pickSpectral = ()=>{
    const w = [
      { sp: 'A', w: 0.40 }, { sp: 'B', w: 0.16 }, { sp: 'F', w: 0.18 },
      { sp: 'O', w: 0.04 }, { sp: 'G', w: 0.10 }, { sp: 'K', w: 0.08 }, { sp: 'M', w: 0.04 }
    ];
    let x = Math.random(), acc = 0;
    for (const it of w) { acc += it.w; if (x <= acc) return it.sp; }
    return 'A';
  };

  this.hexToRgb = (hex)=>{
    const h = String(hex || '').replace('#','');
    return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) };
  };

  this.getDocHeight = ()=>{
    try {
      return Math.max(
        document.body.scrollHeight || 0,
        document.body.offsetHeight || 0,
        document.documentElement.clientHeight || 0,
        document.documentElement.scrollHeight || 0,
        document.documentElement.offsetHeight || 0
      );
    } catch { return this.H; }
  };

  this.generateGhosts = ()=>{
    this.ghosts = [];
    if (!this.W || !this.H) return;
    let docH = this.getDocHeight();
    if (docH < this.H) docH = this.H;
    const screens = docH / this.H;
    let total = Math.round(screens * (2 + Math.random() * 3));
    total = Math.max(4, total);
    for (let i=0;i<total;i++) {
      const nodes = 3 + Math.floor(Math.random()*4);
      const pts = [];
      for (let n=0;n<nodes;n++) pts.push({ x: Math.random()*this.W, y: Math.random()*docH });
      this.ghosts.push(pts);
    }
    this._lastDocH = docH;
  };

  this.CFG = {
    holeInfluence: 260,
    holePull: 0.020,
    holeSwirl: 0.016,
    maxPull: 0.15,
    maxSwirl: 0.12,
    eventHorizon: 40
  };

  this.generateHoles = ()=>{
    this.holes = [];
    if (!this.W || !this.H) return;
    const n = (Math.random() > 0.55) ? 2 : 1;
    const presets = [
      { x: this.W*0.28, y: this.H*0.38, r: 44 },
      { x: this.W*0.74, y: this.H*0.62, r: 58 },
    ];
    for (let i=0;i<n;i++) {
      const p = presets[i] || { x: Math.random()*this.W, y: Math.random()*this.H, r: 42 + Math.random()*28 };
      this.holes.push({
        x: p.x,
        y: p.y,
        r: p.r,
        spin: (Math.random() > 0.5 ? 1 : -1),
        ph: Math.random()*Math.PI*2,
      });
    }
    this.comets = [];
    this._lastCometAt = 0;
  };

  this.spawnComet = ()=>{
    if (!this.W || !this.H) return;
    const max = 2;
    if (this.comets.length >= max) return;

    const side = (Math.random()*4)|0;
    let x, y;
    if (side === 0) { x = -40; y = Math.random()*this.H; }
    else if (side === 1) { x = this.W + 40; y = Math.random()*this.H; }
    else if (side === 2) { x = Math.random()*this.W; y = -40; }
    else { x = Math.random()*this.W; y = this.H + 40; }

    const tx = Math.max(40, Math.min(this.W-40, this.W*(0.15 + Math.random()*0.7)));
    const ty = Math.max(40, Math.min(this.H-40, this.H*(0.15 + Math.random()*0.7)));
    const dx = tx - x;
    const dy = ty - y;
    const dist = Math.hypot(dx, dy) || 1;

    const speed = 2.0 + Math.random()*1.0;
    const vx = (dx/dist)*speed;
    const vy = (dy/dist)*speed;

    const tint = (Math.random() > 0.5)
      ? { r: 190, g: 215, b: 255 }
      : { r: 255, g: 190, b: 225 };

    const tail = 120 + Math.random()*120;
    this.comets.push({ x, y, vx, vy, life: 220 + Math.random()*220, tail, c: tint, sparkle: Math.random()*Math.PI*2 });
  };

  this.renderBase = ()=>{
    if (!this.W || !this.H) return;
    const bg = this.bgColor();
    this.baseCtx.fillStyle = bg;
    this.baseCtx.fillRect(0,0,this.W,this.H);
    this.baseCtx.globalCompositeOperation = 'lighter';
    for (const st of this.stars) {
      this.baseCtx.beginPath();
      this.baseCtx.fillStyle = st.color;
      this.baseCtx.arc(st.x, st.y, st.r, 0, Math.PI*2);
      this.baseCtx.fill();
    }
    this.baseCtx.globalCompositeOperation = 'source-over';
  };

  this.rebuild = ()=>{
    if (!this.canvas || !this.ctx) return;
    this.W = window.innerWidth || document.documentElement.clientWidth || 0;
    this.H = window.innerHeight || document.documentElement.clientHeight || 0;
    if (!this.W || !this.H) return;

    this.canvas.width = this.W;
    this.canvas.height = this.H;
    this.baseCanvas.width = this.W;
    this.baseCanvas.height = this.H;

    const SPECTRAL = {
      O: '#9BBEFF', B: '#BFD7FF', A: '#F5F7FF',
      F: '#FFF7EC', G: '#FFEDC9', K: '#FFC18A', M: '#FF9977'
    };

    this.stars = [];
    this.twinkle = [];

    const count = 900;
    for (let i=0;i<count;i++) {
      const sp = this.pickSpectral();
      const fill = SPECTRAL[sp];
      const jitter = 0.98 + Math.random()*0.04;
      const c = this.hexToRgb(fill);
      const rr = Math.round(c.r*jitter);
      const gg = Math.round(c.g*jitter);
      const bb = Math.round(c.b*jitter);

      const alpha = 0.12 + Math.random()*0.62;
      const sizeRand = Math.random();
      const radius = (sizeRand > 0.95) ? 1.6 : (sizeRand > 0.80 ? 1.1 : 0.6);

      const st = {
        x: Math.random()*this.W,
        y: Math.random()*this.H,
        r: radius,
        rr, gg, bb,
        a0: alpha,
        color: `rgba(${rr},${gg},${bb},${alpha.toFixed(2)})`,
      };
      this.stars.push(st);

      if (radius >= 1.0 || alpha > 0.4 || Math.random() < 0.12) {
        this.twinkle.push({
          x: st.x, y: st.y, r: st.r,
          rr: st.rr, gg: st.gg, bb: st.bb, a0: st.a0,
          tw: 0.55 + Math.random()*1.7,
          ph: Math.random()*Math.PI*2
        });
      }
    }

    this.renderBase();
    this.generateHoles();
  };

  this.drawGhosts = (t)=>{
    const ctx = this.ctx;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
    const pulse = 0.65 + 0.35 * Math.sin(t * 0.65);
    ctx.strokeStyle = `rgba(200,220,255,${(0.10 * pulse).toFixed(3)})`;
    ctx.lineWidth = 0.5;
    ctx.fillStyle = `rgba(200,220,255,${(0.08 * pulse).toFixed(3)})`;

    for (const pts of this.ghosts) {
      if (!pts?.length) continue;
      let visible = false;
      for (const p of pts) {
        const sy = p.y - scrollY;
        if (sy > -100 && sy < this.H + 100) { visible = true; break; }
      }
      if (!visible) continue;

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y - scrollY);
      for (let k=1;k<pts.length;k++) ctx.lineTo(pts[k].x, pts[k].y - scrollY);
      ctx.stroke();

      for (const p of pts) {
        ctx.beginPath();
        ctx.arc(p.x, p.y - scrollY, 0.6, 0, Math.PI*2);
        ctx.fill();
      }
    }
  };

  this.drawHoles = (t)=>{
    const ctx = this.ctx;
    if (!this.holes?.length) return;

    if (!shouldAnimateBlackHoles() && !shouldAnimateWithReducedIntensity()) return;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';

    for (const h of this.holes) {
      h.ph += 0.006 * h.spin;

      const g1 = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, h.r * 2.6);
      g1.addColorStop(0.00, 'rgba(0,0,0,0.55)');
      g1.addColorStop(0.35, 'rgba(0,0,0,0.22)');
      g1.addColorStop(1.00, 'rgba(0,0,0,0)');

      ctx.fillStyle = g1;
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.r * 2.6, 0, Math.PI * 2);
      ctx.fill();

      const g2 = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, h.r * 1.05);
      g2.addColorStop(0, 'rgba(0,0,0,0.85)');
      g2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.r * 1.05, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(h.x, h.y);
      ctx.rotate(h.ph);

      const ringR = h.r * 1.55;
      const ringW = h.r * 0.42;

      const g3 = ctx.createRadialGradient(0, 0, ringR - ringW, 0, 0, ringR + ringW);
      g3.addColorStop(0.00, 'rgba(255,255,255,0)');
      g3.addColorStop(0.45, 'rgba(190,215,255,0.12)');
      g3.addColorStop(0.55, 'rgba(255,190,225,0.18)');
      g3.addColorStop(0.75, 'rgba(255,255,255,0.06)');
      g3.addColorStop(1.00, 'rgba(255,255,255,0)');

      ctx.strokeStyle = g3;
      ctx.lineWidth = Math.max(1, h.r * 0.18);
      ctx.beginPath();
      ctx.ellipse(0, 0, ringR, ringR * 0.72, 0, 0, Math.PI * 2);
      ctx.stroke();

      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + t * 0.35 * h.spin;
        const sx = Math.cos(a) * ringR;
        const sy = Math.sin(a) * ringR * 0.72;

        ctx.beginPath();
        ctx.arc(sx, sy, 1.1, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fill();
      }

      ctx.restore();
    }

    ctx.restore();
  };

  this.drawComets = ()=>{
    const ctx = this.ctx;
    if (!this.comets?.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    for (const c of this.comets) {
      const speed = Math.hypot(c.vx, c.vy) || 1;
      const nx = c.vx / speed;
      const ny = c.vy / speed;
      const tailLen = c.tail;

      const tx = c.x - nx * tailLen;
      const ty = c.y - ny * tailLen;

      const g = ctx.createLinearGradient(c.x, c.y, tx, ty);
      g.addColorStop(0.00, `rgba(${c.c.r},${c.c.g},${c.c.b},0.55)`);
      g.addColorStop(0.35, `rgba(${c.c.r},${c.c.g},${c.c.b},0.22)`);
      g.addColorStop(1.00, `rgba(${c.c.r},${c.c.g},${c.c.b},0)`);

      ctx.strokeStyle = g;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      const bend = 18 * Math.sin(c.sparkle);
      ctx.quadraticCurveTo(
        c.x - nx*(tailLen*0.5) + (-ny)*bend,
        c.y - ny*(tailLen*0.5) + ( nx)*bend,
        tx, ty
      );
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(c.x, c.y, 2.2, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fill();
    }

    ctx.restore();
  };

  this.renderFrame = (t)=>{
    if (!this.W || !this.H) return;
    const ctx = this.ctx;

    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.baseCanvas, 0, 0);

    this.drawHoles(t);

    for (const st of this.twinkle) {
      const twk = 0.55 + 0.45 * Math.sin(t * st.tw + st.ph);
      const a = st.a0 * twk;

      ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath();
      ctx.fillStyle = this.bgColor();
      ctx.arc(st.x, st.y, st.r + 0.9, 0, Math.PI*2);
      ctx.fill();

      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath();
      ctx.fillStyle = `rgba(${st.rr},${st.gg},${st.bb},${a.toFixed(3)})`;
      ctx.arc(st.x, st.y, st.r, 0, Math.PI*2);
      ctx.fill();
    }

    ctx.globalCompositeOperation = 'lighter';
    this.drawGhosts(t);
    this.drawComets();
    ctx.globalCompositeOperation = 'source-over';
  };

  this.applyBlackHoleForces = (p) => {
    for (const h of this.holes) {
      const dx = h.x - p.x;
      const dy = h.y - p.y;
      const dist = Math.hypot(dx, dy) || 1;

      if (dist < 260) {
        const k = 1 - dist / 260;

        const pull = 0.020 * k;
        p.vx += (dx / dist) * pull;
        p.vy += (dy / dist) * pull;

        const swirl = 0.016 * k * h.spin;
        p.vx += (-dy / dist) * swirl;
        p.vy += ( dx / dist) * swirl;

        if (dist < h.r * 0.78) {
          p.x = Math.random() * this.W;
          p.y = Math.random() * this.H;
          p.vx *= 0.2;
          p.vy *= 0.2;
        }
      }
    }
  };

  this.updateComets = ()=>{
    if (!this.comets?.length) return;
    for (let i=this.comets.length-1;i>=0;i--) {
      const c = this.comets[i];

      for (const h of this.holes || []) {
        const dx = h.x - c.x;
        const dy = h.y - c.y;
        const dist = Math.hypot(dx, dy) || 1;
        
        if (dist < (h.r*4.6)) {
          const k = 1 - dist/(h.r*4.6);
          
          const pull = 0.040 * k;
          c.vx += (dx/dist) * pull;
          c.vy += (dy/dist) * pull;
          
          const swirl = 0.035 * k * h.spin;
          c.vx += (-dy/dist) * swirl;
          c.vy += ( dx/dist) * swirl;
          
          if (dist < h.r * 0.8) {
            c.life = 0;
          }
        }
      }

      c.x += c.vx;
      c.y += c.vy;
      c.life -= 1;
      c.sparkle += 0.08;

      if (c.life <= 0 || c.x < -260 || c.x > this.W + 260 || c.y < -260 || c.y > this.H + 260) {
        this.comets.splice(i, 1);
      }
    }
  };

  this._loop = (ts)=>{
    const fullAnimation = shouldAnimateNow();
    const blackHoleAnimation = shouldAnimateBlackHoles() || shouldAnimateWithReducedIntensity();
    
    if (!fullAnimation && !blackHoleAnimation) {
      this._raf = requestAnimationFrame(this._loop);
      return;
    }

    const now = ts;

    if (fullAnimation && (!this._ghostCheckAt || (now - this._ghostCheckAt) > 1800)) {
      this._ghostCheckAt = now;
      const dh = this.getDocHeight();
      if (Math.abs(dh - (this._lastDocH || 0)) > 80) {
        this.generateGhosts();
      }
    }

    if (fullAnimation) {
      if (!this._lastCometAt) this._lastCometAt = now;
      if ((now - this._lastCometAt) > (2600 + Math.random()*1200)) {
        this.spawnComet();
        if (Math.random() < 0.18) {
          setTimeout(()=>{ try { this.spawnComet(); } catch {} }, 220);
        }
        this._lastCometAt = now;
      }
    }

    if (fullAnimation) {
      this.updateComets();
    }
    
    for (const s of this.stars) {
      this.applyBlackHoleForces(s);
      
      s.x += s.vx;
      s.y += s.vy;

      s.vx *= 0.985;
      s.vy *= 0.985;

      s.ph += s.phs;

      if (s.x < -30) s.x = this.W + 30;
      if (s.x > this.W + 30) s.x = -30;
      if (s.y < -30) s.y = this.H + 30;
      if (s.y > this.H + 30) s.y = -30;
    }
    
    this.renderFrame(ts/1000);
    this._raf = requestAnimationFrame(this._loop);
  };

  this.start = ()=>{
    if (!this.canvas || !this.ctx) return;
    if (!this.W || !this.H) { this.rebuild(); this.generateGhosts(); }
    if (this._raf) return;
    window.addEventListener('resize', this._onResize, { passive: true });
    this._raf = requestAnimationFrame(this._loop);
  };

  this.stop = ()=>{
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
    try { window.removeEventListener('resize', this._onResize); } catch {}
  };

  try { this.rebuild(); this.generateGhosts(); } catch {}
}

function CrystalEngine(){
  this._raf = 0;
  this._ro = null;
  this._ctx = null;
  this._root = null;
  this._canvas = null;

  this._state = null;

  this._setSize = ()=>{
    const root = this._root;
    const canvas = this._canvas;
    if (!root || !canvas) return;
    const rect = root.getBoundingClientRect();
    const W = Math.max(1, Math.round(rect.width + 140));
    const H = Math.max(1, Math.round(rect.height + 140));
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._ctx = ctx;

    this._state = this._makeState(W, H);
  };

  this._makeState = (W,H)=>{
    const rand = (a,b)=> a + Math.random()*(b-a);
    const palette = [
      { r:255,g:255,b:255 },
      { r:190,g:215,b:255 },
      { r:255,g:190,b:225 }
    ];

    const stars = [];
    for (let i=0;i<56;i++) {
      const c = palette[(Math.random()*palette.length)|0];
      stars.push({
        x: Math.random()*W,
        y: Math.random()*H,
        vx: (Math.random()-0.5)*0.18,
        vy: (Math.random()-0.5)*0.18,
        r: rand(0.7, 1.8),
        c,
        ph: Math.random()*Math.PI*2,
        phs: rand(0.015,0.035)
      });
    }

    const holes = [
      { x: W*0.28, y: H*0.38, r: 44, spin: (Math.random()>0.5?1:-1), ph: Math.random()*Math.PI*2 },
      { x: W*0.74, y: H*0.62, r: 58, spin: (Math.random()>0.5?1:-1), ph: Math.random()*Math.PI*2 },
    ];

    return {
      W, H,
      stars,
      holes,
      comets: [],
      lastCometAt: 0,
      palette,
      rand,
    };
  };

  this._applyHoles = (p, st)=>{
    for (const h of st.holes) {
      const dx = h.x - p.x;
      const dy = h.y - p.y;
      const dist = Math.hypot(dx, dy) || 1;

      if (dist < 260) {
        const k = 1 - dist / 260;

        const pull = 0.020 * k;
        p.vx += (dx / dist) * pull;
        p.vy += (dy / dist) * pull;

        const swirl = 0.016 * k * h.spin;
        p.vx += (-dy / dist) * swirl;
        p.vy += ( dx / dist) * swirl;

        if (dist < h.r * 0.78) {
          p.x = Math.random() * st.W;
          p.y = Math.random() * st.H;
          p.vx *= 0.2;
          p.vy *= 0.2;
        }
      }
    }
  };

  this._spawnComet = ()=>{
    const st = this._state;
    if (!st) return;
    const CFG = { cometMax: 2, speed: [2.0,2.9], tail: [120,200] };
    if (st.comets.length >= CFG.cometMax) return;

    const side = (Math.random()*4)|0;
    let x,y;
    if (side===0){ x=-30; y=Math.random()*st.H; }
    else if (side===1){ x=st.W+30; y=Math.random()*st.H; }
    else if (side===2){ x=Math.random()*st.W; y=-30; }
    else { x=Math.random()*st.W; y=st.H+30; }

    const tx = Math.max(40, Math.min(st.W-40, st.W*(0.15+Math.random()*0.7)));
    const ty = Math.max(40, Math.min(st.H-40, st.H*(0.15+Math.random()*0.7)));
    const dx = tx-x, dy = ty-y;
    const dist = Math.hypot(dx,dy) || 1;
    const speed = st.rand(CFG.speed[0], CFG.speed[1]);
    const vx = (dx/dist)*speed;
    const vy = (dy/dist)*speed;
    const tint = Math.random()>0.5 ? st.palette[1] : st.palette[2];
    const tail = st.rand(CFG.tail[0], CFG.tail[1]);

    st.comets.push({ x,y,vx,vy, life: st.rand(220, 340), tail, c:tint, sparkle: Math.random()*Math.PI*2 });
  };

  this._render = (t)=>{
    const st = this._state;
    const ctx = this._ctx;
    if (!st || !ctx) return;

    ctx.clearRect(0,0,st.W,st.H);

    if (shouldAnimateBlackHoles() || shouldAnimateWithReducedIntensity()) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      for (const h of st.holes) {
        h.ph += 0.006 * h.spin;

        const g1 = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, h.r * 2.6);
        g1.addColorStop(0.00, 'rgba(0,0,0,0.55)');
        g1.addColorStop(0.35, 'rgba(0,0,0,0.22)');
        g1.addColorStop(1.00, 'rgba(0,0,0,0)');

        ctx.fillStyle = g1;
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.r * 2.6, 0, Math.PI * 2);
        ctx.fill();

        const g2 = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, h.r * 1.05);
        g2.addColorStop(0, 'rgba(0,0,0,0.85)');
        g2.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g2;
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.r * 1.05, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.translate(h.x, h.y);
        ctx.rotate(h.ph);

        const ringR = h.r * 1.55;
        const ringW = h.r * 0.42;

        const g3 = ctx.createRadialGradient(0, 0, ringR - ringW, 0, 0, ringR + ringW);
        g3.addColorStop(0.00, 'rgba(255,255,255,0)');
        g3.addColorStop(0.45, 'rgba(190,215,255,0.12)');
        g3.addColorStop(0.55, 'rgba(255,190,225,0.18)');
        g3.addColorStop(0.75, 'rgba(255,255,255,0.06)');
        g3.addColorStop(1.00, 'rgba(255,255,255,0)');

        ctx.strokeStyle = g3;
        ctx.lineWidth = Math.max(1, h.r * 0.18);
        ctx.beginPath();
        ctx.ellipse(0, 0, ringR, ringR * 0.72, 0, 0, Math.PI * 2);
        ctx.stroke();

        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2 + t * 0.35 * h.spin;
          const sx = Math.cos(a) * ringR;
          const sy = Math.sin(a) * ringR * 0.72;

          ctx.beginPath();
          ctx.arc(sx, sy, 1.1, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.fill();
        }

        ctx.restore();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 0.6;
    for (let i=0;i<st.stars.length;i++){
      for (let j=i+1;j<st.stars.length;j++){
        const a=st.stars[i], b=st.stars[j];
        const dx=a.x-b.x, dy=a.y-b.y;
        const dist=Math.hypot(dx,dy);
        const linkDist=175;
        if (dist<linkDist){
          const k=1-dist/linkDist;
          const alpha=0.10*k;
          const g=ctx.createLinearGradient(a.x,a.y,b.x,b.y);
          g.addColorStop(0,`rgba(${a.c.r},${a.c.g},${a.c.b},${alpha})`);
          g.addColorStop(1,`rgba(${b.c.r},${b.c.g},${b.c.b},${alpha})`);
          ctx.strokeStyle=g;
          ctx.beginPath();
          ctx.moveTo(a.x,a.y);
          ctx.lineTo(b.x,b.y);
          ctx.stroke();
        }
      }
    }
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation='lighter';
    for (const s of st.stars){
      const tw=0.20+0.80*Math.abs(Math.sin(s.ph));
      const a=0.22+0.55*tw;
      const r=s.r*(0.9+0.18*tw);
      ctx.beginPath();
      ctx.arc(s.x,s.y,r,0,Math.PI*2);
      ctx.fillStyle=`rgba(${s.c.r},${s.c.g},${s.c.b},${a})`;
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation='lighter';
    ctx.lineCap='round';
    for (const c of st.comets){
      const speed=Math.hypot(c.vx,c.vy)||1;
      const nx=c.vx/speed, ny=c.vy/speed;
      const tailLen=c.tail;
      const tx=c.x-nx*tailLen, ty=c.y-ny*tailLen;
      const g=ctx.createLinearGradient(c.x,c.y,tx,ty);
      g.addColorStop(0.00,`rgba(${c.c.r},${c.c.g},${c.c.b},0.55)`);
      g.addColorStop(0.35,`rgba(${c.c.r},${c.c.g},${c.c.b},0.22)`);
      g.addColorStop(1.00,`rgba(${c.c.r},${c.c.g},${c.c.b},0)`);
      ctx.strokeStyle=g;
      ctx.lineWidth=1.6;
      ctx.beginPath();
      ctx.moveTo(c.x,c.y);
      const bend=18*Math.sin(c.sparkle);
      ctx.quadraticCurveTo(
        c.x-nx*(tailLen*0.5)+(-ny)*bend,
        c.y-ny*(tailLen*0.5)+( nx)*bend,
        tx,ty
      );
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(c.x,c.y,2.2,0,Math.PI*2);
      ctx.fillStyle='rgba(255,255,255,0.85)';
      ctx.fill();
    }
    ctx.restore();
  };

  this._loop = (now)=>{
    const fullAnimation = shouldAnimateNow();
    const blackHoleAnimation = shouldAnimateBlackHoles() || shouldAnimateWithReducedIntensity();
    
    if (!fullAnimation && !blackHoleAnimation) {
      this._raf = requestAnimationFrame(this._loop);
      return;
    }
    
    const st = this._state;
    if (st) {
      if (fullAnimation) {
        if (now - st.lastCometAt > 2600) { this._spawnComet(); st.lastCometAt = now; }
        for (const s of st.stars){
          this._applyHoles(s, st);
          s.x += s.vx; s.y += s.vy;
          s.vx *= 0.985; s.vy *= 0.985;
          s.ph += s.phs;
          if (s.x < -30) s.x = st.W + 30;
          if (s.x > st.W + 30) s.x = -30;
          if (s.y < -30) s.y = st.H + 30;
          if (s.y > st.H + 30) s.y = -30;
        }
        for (let i=st.comets.length-1;i>=0;i--){
          const c=st.comets[i];
          
          for (const h of st.holes || []) {
            const dx = h.x - c.x;
            const dy = h.y - c.y;
            const dist = Math.hypot(dx, dy) || 1;

            if (dist < 260 * 0.9) {
              const k = 1 - dist / (260 * 0.9);
              const swirl = 0.030 * k * h.spin;
              c.vx += (-dy / dist) * swirl;
              c.vy += ( dx / dist) * swirl;
            }
          }
          
          c.x += c.vx; c.y += c.vy;
          c.life -= 1;
          c.sparkle += 0.08;
          if (c.life<=0 || c.x<-260 || c.x>st.W+260 || c.y<-260 || c.y>st.H+260) st.comets.splice(i,1);
        }
      }
      
      this._render(now*0.001);
    }
    this._raf = requestAnimationFrame(this._loop);
  };

  this.start = ()=>{
    if (this._raf) return;
    const p = APP.state?.route?.path || parseRoute().path;
    if (p !== '/') return;
    this._root = document.getElementById('cosmosRoot');
    this._canvas = document.getElementById('crystalCanvas');
    if (!this._root || !this._canvas) return;
    this._setSize();
    if (typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver(()=> this._setSize());
      this._ro.observe(this._root);
    }
    this._raf = requestAnimationFrame(this._loop);
  };

  this.stop = ()=>{
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
    try { this._ro?.disconnect?.(); } catch {}
    this._ro = null;
  };

  this.syncToRoute = ()=>{
    const p = APP.state?.route?.path || parseRoute().path;
    if (p === '/') this.start();
    else this.stop();
  };
}

function parseRoute(){
  const path = location.hash ? location.hash.slice(1) : (location.pathname || '/');
  const [basePath, queryStr = ''] = path.split('?');
  const params = {};
  if (queryStr) {
    try {
      for (const pair of queryStr.split('&')) {
        const [k, v] = pair.split('=');
        if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
      }
    } catch {}
  }
  return { path: basePath || '/', params };
}

function nav(to, { replace = false } = {}){
  if (to.startsWith('http')) {
    location.href = to;
    return;
  }
  if (replace) history.replaceState(null, '', to);
  else history.pushState(null, '', to);
  render();
}

function $(sel, root=document){
  return root.querySelector(sel);
}

function escapeHTML(s){
  const m = { '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#039;' };
  return String(s || '').replace(/[&<>"']/g, (x)=> m[x]);
}

function ruDateLabel(iso){
  const d = new Date(iso);
  const now = new Date();
  const isThisYear = d.getFullYear() === now.getFullYear();
  const fmt = isThisYear
    ? { month: 'long', day: 'numeric' }
    : { year: 'numeric', month: 'long', day: 'numeric' };
  return new Intl.DateTimeFormat('ru-RU', fmt).format(d);
}

function DateDivider(label){
  return `
    <div class="row" style="gap: 12px; padding: 20px 0 10px; align-items:center;">
      <div class="divider" style="flex:1"></div>
      <div class="textMuted" style="font-size: 12px; font-weight: 900; letter-spacing:.18em">${escapeHTML(label)}</div>
      <div class="divider" style="flex:1"></div>
    </div>
  `;
}

function EntryCard({ entry, author, meId, meIsAdmin }){
  const isMine = Number(entry.user_id) === Number(meId);
  const date = new Intl.DateTimeFormat('ru-RU', { hour:'numeric', minute:'2-digit' }).format(new Date(entry.created_at));
  const authorName = author?.name || 'Спутник';
  const authorLogin = author?.login || '';
  const canDelete = meIsAdmin || isMine;

  return `
    <div class="soft" style="padding: 16px; margin-bottom: 6px;" data-entry-id="${Number(entry.id)}">
      <div class="row" style="gap: 12px; margin-bottom: 12px;">
        <div style="width:36px;height:36px;border-radius:999px;border:1px solid var(--border);display:grid;place-items:center;background:rgba(255,255,255,.03)">${ROLE_META[author?.role || 'warrior']?.emoji || '⚔️'}</div>
        <div style="flex:1">
          <div style="font-weight: 900">${escapeHTML(authorName)}</div>
          <div class="textMuted" style="font-size: 12px">@${escapeHTML(authorLogin)}, ${escapeHTML(date)}</div>
        </div>
        ${canDelete ? `<button type="button" class="btn-ghost" style="padding: 8px 10px" data-action="entry-delete" data-id="${Number(entry.id)}" aria-label="Удалить шаг">🗑️</button>` : ''}
      </div>
      <div class="row" style="gap: 20px; margin-bottom: 12px;">
        <div style="flex:1">
          <div class="textMuted" style="font-size: 12px; margin-bottom: 6px">Победа</div>
          <div class="soft" style="padding: 10px 12px;" data-entry-text="victory" data-id="${Number(entry.id)}">—</div>
        </div>
        <div style="flex:1">
          <div class="textMuted" style="font-size: 12px; margin-bottom: 6px">Урок</div>
          <div class="soft" style="padding: 10px 12px;" data-entry-text="lesson" data-id="${Number(entry.id)}">—</div>
        </div>
      </div>
    </div>
  `;
}

function setDocumentTitle(path){
  const base = 'pariter';
  const n = Number(APP.state.live.unread || 0);
  const prefix = n > 0 ? `(${Math.min(n, 99)}) ` : '';
  
  let title = base;
  if (path === '/') title = `${prefix}${base}`;
  else if (path === '/path') title = `${prefix}${base}.path`;
  else if (path === '/join') title = `${prefix}${base}.join`;
  else if (path === '/login') title = `${prefix}${base}.login`;
  else if (path === '/settings') title = `${prefix}${base}.settings`;
  
  document.title = title;
}

function toast(message, { duration = 2500, action = null } = {}){
  const container = $('#toastContainer');
  if (!container) return;

  const id = Date.now();
  const actionHtml = action ? `<button type="button" class="btn-ghost" style="margin-left: 12px; height: 30px;" data-toast-action="${id}">${escapeHTML(action.text)}</button>` : '';

  container.insertAdjacentHTML('beforeend', `
    <div class="toast" id="toast-${id}" style="opacity: 0; transform: translateY(20px); transition: all 180ms cubic-bezier(0.2, 0, 0, 1);">
      <div class="row" style="align-items: center; gap: 8px; padding: 12px 16px; background: var(--bgSecondary); border: 1px solid var(--border); border-radius: 999px; box-shadow: 0 6px 12px rgba(0,0,0,.1);">
        <span style="font-size: 13px; flex:1;">${escapeHTML(message)}</span>
        ${actionHtml}
        <button type="button" class="btn-ghost" style="padding: 6px 8px; margin-right: -6px;" data-toast-close="${id}" aria-label="Закрыть">×</button>
      </div>
    </div>
  `);

  setTimeout(()=> {
    const el = document.getElementById(`toast-${id}`);
    if (el) el.style.opacity = '1';
  }, 1);

  const close = (el)=>{
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    setTimeout(()=> el.remove(), 180);
  };

  setTimeout(()=>{
    const el = document.getElementById(`toast-${id}`);
    if (el) close(el);
  }, duration);
}

function bindHandlers(){
  document.removeEventListener('click', clickHandler);
  document.addEventListener('click', clickHandler);
}

function clickHandler(e){
  const btn = e.target.closest('button');
  if (!btn) return;

  if (btn.hasAttribute('data-toast-close')) {
    e.preventDefault();
    const id = btn.getAttribute('data-toast-close');
    const el = document.getElementById(`toast-${id}`);
    if (el) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      setTimeout(()=> el.remove(), 180);
    }
    return;
  }

  if (btn.hasAttribute('data-toast-action')) {
    e.preventDefault();
    const id = btn.getAttribute('data-toast-action');
    const toastEl = document.getElementById(`toast-${id}`);
    if (toastEl) {
      toastEl.remove();
    }
    return;
  }

  if (btn.hasAttribute('data-action')) {
    e.preventDefault();
    const action = btn.getAttribute('data-action');
    const id = Number(btn.getAttribute('data-id') || '0');

    if (action === 'entry-delete' && id) {
      if (!confirm('Удалить шаг?')) return;
      (async ()=>{
        try {
          await api.entryDelete({ id });
          const card = btn.closest(`[data-entry-id="${id}"]`);
          if (card) card.remove();
          toast('Удалено.');
        } catch (err) {
          toast(err.message || 'Ошибка удаления.');
        }
      })();
    } else if (action === 'team-user-delete' && id) {
      if (!confirm('Исключить спутника из команды?')) return;
      (async ()=>{
        try {
          await api.teamUserDelete({ id });
          toast('Спутник исключен.');
          await hydrateInvite();
        } catch (err) {
          toast(err.message || 'Ошибка исключения.');
        }
      })();
    } else if (action === 'invite-delete') {
      if (!confirm('Удалить приглашение?')) return;
      (async ()=>{
        try {
          const inviteId = Number(btn.getAttribute('data-id') || '0');
          await api.inviteDelete({ id: inviteId });
          toast('Приглашение удалено.');
          await hydrateInvite();
        } catch (err) {
          toast(err.message || 'Ошибка удаления.');
        }
      })();
    } else if (action === 'invite-copy') {
      const code = btn.getAttribute('data-code');
      if (code) {
        (async ()=>{
          try {
            await navigator.clipboard.writeText(`${location.origin}/join#${code}`);
            toast('Ссылка скопирована.');
          } catch {
            toast('Не удалось скопировать ссылку.');
          }
        })();
      }
    } else if (action === 'invite-use') {
      const code = btn.getAttribute('data-code');
      const f = $('#inviteForm');
      const inp = f?.querySelector('input[name="code"]');
      if (inp && code) {
        inp.value = code;
        toast('Код подставлен в поле.');
      }
    } else if (action === 'pwa-install') {
      (async ()=>{
        if (APP.pwa.deferredPrompt) {
          APP.pwa.deferredPrompt.prompt();
          const result = await APP.pwa.deferredPrompt.userChoice;
          if (result.outcome === 'accepted') {
            APP.pwa.installed = true;
            APP.pwa.deferredPrompt = null;
          }
          updatePwaUI();
        } else {
          toast('Установка недоступна.');
        }
      })();
    } else if (action === 'notif-permission') {
      if (typeof Notification !== 'undefined') {
        Notification.requestPermission().then(()=>{
          updateNotifUI();
          if (Notification.permission === 'granted') {
            toast('Разрешение на уведомления выдано.');
          }
        });
      }
    } else if (action === 'push-enable') {
      (async ()=>{
        try {
          await enablePush();
          toast('Push включён.');
          updatePushUI();
        } catch (err) {
          toast(err.message || 'Не удалось включить Push.');
        }
      })();
    } else if (action === 'push-disable') {
      (async ()=>{
        try {
          await disablePush();
          toast('Push выключен.');
          updatePushUI();
        } catch (err) {
          toast(err.message || 'Не удалось выключить Push.');
        }
      })();
    } else if (action === 'sound-toggle') {
      const enabled = !readSoundEnabled();
      writeSoundEnabled(enabled);
      updateSoundUI();
      toast(enabled ? 'Звук включён.' : 'Звук выключен.');
    }
  }
}

const api = {
  async whoami() {
    const r = await fetch('/api/whoami', { credentials: 'include' });
    if (!r.ok) throw new Error((await r.json()).error || 'Network error');
    return await r.json();
  },

  async login({ login, password }) {
    const r = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password }),
      credentials: 'include',
    });
    if (!r.ok) throw new Error((await r.json()).error || 'Network error');
    return await r.json();
  },

  async logout() {
    const r = await fetch('/api/logout', {
      method: 'POST',
      credentials: 'include',
    });
    if (!r.ok) throw new Error((await r.json()).error || 'Network error');
    return await r.json();
  },

  async register({ name, login, password, role }) {
    const r = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, login, password, role }),
      credentials: 'include',
    });
    if (!r.ok) throw new Error((await r.json()).error || 'Network error');
    return await r.json();
  },

  async joinTeam({ code }) {
    const r = await fetch('/api/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
      credentials: 'include',
    });
    if (!r.ok) throw new Error((await r.json()).error || 'Network error');
    return await r.json();
  },

  async themeSet({ themeId }) {
    const r = await fetch('/api/theme/set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ themeId }),
      credentials: 'include',
    });
    if (!r.ok) throw new Error((await r.json()).error || 'Network error');
    return await r.json();
  },

  async entryCreate({ victory, lesson }) {
    const r = await fetch('/api/entry/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ victory, lesson }),
      credentials: 'include',
    });
    if (!r.ok) throw new Error((await r.json()).error || 'Network error');
    return await r.json();
  },

  async entryDelete({ id }) {
    const r = await fetch('/api/entry/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
      credentials: 'include',
    });
    if (!r.ok) throw new Error((await r.json()).error || 'Network error');
    return await r.json();
  },

  async entriesGet({ limit, before }) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (before?.date) params.append('before_date', before.date);
    if (before?.id) params.append('before_id', String(before.id));

    const r = await fetch(`/api/entries?${params}`, { credentials: 'include' });
    if (!r.ok) throw new Error((await r.json()).error || 'Network error');
    return await r.json();
  },

  async entriesNew({ after, limit }) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (after?.date) params.append('after_date', after.date);
    if (after?.id) params.append('after_id', String(after.id));

    const r = await fetch(`/api/entries/new?${params}`, { credentials: 'include' });
    if (!r.ok) throw new Error((await r.json()).error || 'Network error');
    return await r.json();
  },

  async team() {
    const r = await fetch('/api/team', { credentials: 'include' });
    if (!r.ok) throw new Error((await r.json()).error || 'Network error');
    return await r.json();
  },

  async teamUserDelete({ id }) {
    const r = await fetch('/api/team/user/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
      credentials: 'include',
    });
    if (!r.ok) throw new Error((await r.json()).error || 'Network error');
    return await r.json();
  },

  async invitesList() {
    const r = await fetch('/api/invites', { credentials: 'include' });
    if (!r.ok) throw new Error((await r.json()).error || 'Network error');
    return await r.json();
  },

  async inviteCreate({ expiresAt }) {
    const r = await fetch('/api/invite/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expires_at: expiresAt }),
      credentials: 'include',
    });
    if (!r.ok) throw new Error((await r.json()).error || 'Network error');
    return await r.json();
  },

  async inviteDelete({ id }) {
    const r = await fetch('/api/invite/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
      credentials: 'include',
    });
    if (!r.ok) throw new Error((await r.json()).error || 'Network error');
    return await r.json();
  },

  async pushVapidKey() {
    const r = await fetch('/api/push/vapid-key', { credentials: 'include' });
    if (!r.ok) throw new Error((await r.json()).error || 'Network error');
    return await r.json();
  },

  async pushSubscribe({ endpoint, keys, token }) {
    const r = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint, keys, token }),
      credentials: 'include',
    });
    if (!r.ok) throw new Error((await r.json()).error || 'Network error');
    return await r.json();
  },

  async pushUnsubscribe({ endpoint }) {
    const r = await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
      credentials: 'include',
    });
    if (!r.ok) throw new Error((await r.json()).error || 'Network error');
    return await r.json();
  },
};

async function setTheme(themeId, { persist = true } = {}){
  const t = themeById(themeId);
  if (!t) return;

  const root = document.documentElement;
  root.setAttribute('data-theme', t.id);
  root.setAttribute('data-role', t.role);
  root.style.setProperty('--lunar-bg-deep', t.colors.bg);
  root.style.setProperty('--lunar-bg-main', t.colors.bgSecondary);
  root.style.setProperty('--text', t.colors.text);
  root.style.setProperty('--text-muted', t.colors.textMuted);
  root.style.setProperty('--accent', t.colors.accent);
  root.style.setProperty('--accent-hover', t.colors.accentHover);
  root.style.setProperty('--border', t.colors.border);
  root.style.setProperty('--victory', t.colors.victory);
  root.style.setProperty('--lesson', t.colors.lesson);

  if (persist) {
    try { await api.themeSet({ themeId: t.id }); } catch {}
  }
}

async function hydrateAuth(){
  try {
    const { user } = await api.whoami();
    APP.state.user = user;
    APP.pwa.installed = Boolean(user?.pwa_installed);
    updatePwaUI();
  } catch {
    APP.state.user = null;
  }
}

async function hydratePathStats(){
  if (!APP.state.user) return;
  try {
    const { stats } = await api.team();
    const el = $('#pathStats');
    if (!el) return;

    const s = stats || { members: 0, entries: 0, days: 0 };
    el.innerHTML = `
      <div class="row" style="gap: 20px; justify-content: center;">
        <div class="textCenter">
          <div style="font-size: 32px; font-weight: 900; line-height: 1.2;">${s.members || 0}</div>
          <div class="textMuted" style="font-size: 12px;">СПУТНИКИ</div>
        </div>
        <div class="textCenter">
          <div style="font-size: 32px; font-weight: 900; line-height: 1.2;">${s.entries || 0}</div>
          <div class="textMuted" style="font-size: 12px;">ШАГОВ</div>
        </div>
        <div class="textCenter">
          <div style="font-size: 32px; font-weight: 900; line-height: 1.2;">${s.days || 0}</div>
          <div class="textMuted" style="font-size: 12px;">ДНЕЙ</div>
        </div>
      </div>
    `;
  } catch {}
}

async function render(){
  APP._rendering = true;
  APP._rerenderRequested = false;

  await hydrateAuth();

  const route = parseRoute();
  APP.state.route = route;

  const main = $('main');
  if (!main) return;

  setDocumentTitle(route.path);

  if (!APP.state.user && route.path !== '/join' && route.path !== '/login' && route.path !== '/register') {
    main.innerHTML = `
      <div class="page">
        <div class="col" style="min-height: 40vh; place-content: center; gap: 20px;">
          <h2 style="margin: 0; text-align: center;">pariter</h2>
          <div class="row" style="gap: 12px; place-content: center;">
            <a href="/login" class="btn" style="padding: 12px 24px;">Вход</a>
            <a href="/register" class="btn" style="padding: 12px 24px;">Регистрация</a>
          </div>
        </div>
      </div>
    `;
    nav.update();
    APP._rendering = false;
    return;
  }

  if (APP.state.user && (route.path === '/login' || route.path === '/register')) {
    nav('/');
    return;
  }

  if (route.path === '/') {
    main.innerHTML = `
      <div class="page">
        <div class="col" style="min-height: 40vh; place-content: center; gap: 20px;">
          <h2 style="margin: 0; text-align: center;">pariter</h2>
          <div class="row" style="gap: 12px; place-content: center;">
            <a href="/path" class="btn" style="padding: 12px 24px;">Перейти</a>
          </div>
          <div class="textMuted" style="font-size: 12px; text-align: center;">(лат. поровну, в равной степени)</div>
        </div>
      </div>
    `;
  } else if (route.path === '/path') {
    main.innerHTML = `
      <div class="page">
        <div id="pathStats" class="soft" style="padding: 16px; margin: 16px auto; max-width: 400px;"></div>
        <div id="entryModal" class="modal-backdrop hidden">
          <div class="modal" style="width: 90%; max-width: 600px; margin: 5vh auto;">
            <div style="padding: 20px;">
              <form id="entryForm">
                <div class="col" style="gap: 20px;">
                  <div>
                    <div class="row" style="align-items: center; justify-content: space-between; margin-bottom: 8px;">
                      <label for="victory" class="textMuted" style="font-size: 12px; font-weight: 900; letter-spacing:.18em;">ПОБЕДА</label>
                      <span id="victoryCounter" class="textMuted" style="font-size: 12px;">0</span>
                    </div>
                    <textarea id="victory" name="victory" rows="3" placeholder="Что получилось?" style="width: 100%; padding: 12px; resize: vertical; min-height: 80px;" maxlength="4000"></textarea>
                  </div>
                  <div>
                    <div class="row" style="align-items: center; justify-content: space-between; margin-bottom: 8px;">
                      <label for="lesson" class="textMuted" style="font-size: 12px; font-weight: 900; letter-spacing:.18em;">УРОК</label>
                      <span id="lessonCounter" class="textMuted" style="font-size: 12px;">0</span>
                    </div>
                    <textarea id="lesson" name="lesson" rows="3" placeholder="Что можно улучшить?" style="width: 100%; padding: 12px; resize: vertical; min-height: 80px;" maxlength="4000"></textarea>
                  </div>
                  <div class="row" style="gap: 12px; justify-content: flex-end;">
                    <button type="button" id="modalCancel" class="btn-ghost" style="padding: 12px 20px;">Отмена</button>
                    <button type="submit" class="btn" style="padding: 12px 20px;">Зафиксировать</button>
                  </div>
                  <div id="draftHint" class="textMuted" style="font-size: 12px; text-align: center;"></div>
                </div>
              </form>
            </div>
          </div>
        </div>
        <div id="liveBar" class="soft row" style="position: sticky; top: 16px; margin: 0 16px 16px; padding: 8px 16px; justify-content: center; z-index: 100; display: none;">
          <a href="/path" class="row" style="gap: 6px; align-items: center; text-decoration: none; color: inherit;">
            <span>новые шаги</span>
            <span id="liveCount" class="pill" style="padding: 2px 8px; font-size: 11px;"></span>
          </a>
        </div>
        <div id="feed" style="max-width: 600px; margin: 0 auto;"></div>
        <div class="textCenter textMuted" id="feedStatus" style="padding: 40px 16px; font-size: 13px;"></div>
        <div id="feedSentinel" style="height: 1px;"></div>
        <button id="feedMore" type="button" class="btn-ghost row" style="width: 100%; gap: 8px; padding: 20px; display: none;">Загрузить ещё<div></div></button>
      </div>
    `;
    await hydratePathStats();
    await hydrateFeed(true);
    ensureEntryModal();
  } else if (route.path === '/join') {
    main.innerHTML = `
      <div class="page">
        <div class="col" style="min-height: 40vh; place-content: center; gap: 20px;">
          <h3 style="margin: 0; text-align: center;">Присоединиться к команде</h3>
          <form id="inviteForm" class="soft" style="padding: 20px; width: min(100% - 32px, 400px); margin: 0 auto;">
            <div class="col" style="gap: 16px;">
              <div>
                <label for="code" class="textMuted" style="display: block; font-size: 12px; margin-bottom: 6px;">КОД ПРИГЛАШЕНИЯ</label>
                <input type="text" id="code" name="code" required autocomplete="off" style="width: 100%; padding: 12px;" placeholder="XXXXX-XXXXX">
              </div>
              <button type="submit" class="btn" style="padding: 12px 20px;">Присоединиться</button>
            </div>
          </form>
        </div>
      </div>
    `;
    const form = $('#inviteForm');
    if (form) {
      if (route.params.code) {
        const inp = form.querySelector('input[name="code"]');
        if (inp) inp.value = route.params.code;
      }
      form.addEventListener('submit', async (e)=>{
        e.preventDefault();
        const fd = new FormData(form);
        const code = String(fd.get('code') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (code.length !== 11 || !code.includes('-')) {
          toast('Неверный формат кода.');
          return;
        }
        try {
          await api.joinTeam({ code });
          toast('Присоединились!');
          nav('/');
        } catch (err) {
          toast(err.message || 'Ошибка присоединения.');
        }
      });
    }
  } else if (route.path === '/login') {
    main.innerHTML = `
      <div class="page">
        <div class="col" style="min-height: 40vh; place-content: center; gap: 20px;">
          <h3 style="margin: 0; text-align: center;">Вход</h3>
          <form id="loginForm" class="soft" style="padding: 20px; width: min(100% - 32px, 400px); margin: 0 auto;">
            <div class="col" style="gap: 16px;">
              <div>
                <label for="login" class="textMuted" style="display: block; font-size: 12px; margin-bottom: 6px;">ЛОГИН</label>
                <input type="text" id="login" name="login" required autocomplete="username" style="width: 100%; padding: 12px;" placeholder="Логин">
              </div>
              <div>
                <label for="password" class="textMuted" style="display: block; font-size: 12px; margin-bottom: 6px;">ПАРОЛЬ</label>
                <input type="password" id="password" name="password" required autocomplete="current-password" style="width: 100%; padding: 12px;" placeholder="Пароль">
              </div>
              <button type="submit" class="btn" style="padding: 12px 20px;">Войти</button>
              <div class="textCenter" style="margin-top: 10px;">
                <a href="/register" style="font-size: 13px;">Регистрация</a>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;
    const form = $('#loginForm');
    if (form) {
      form.addEventListener('submit', async (e)=>{
        e.preventDefault();
        const fd = new FormData(form);
        const login = String(fd.get('login') || '').trim();
        const password = String(fd.get('password') || '');
        if (!login || !password) {
          toast('Заполните все поля.');
          return;
        }
        try {
          await api.login({ login, password });
          toast('Вошли!');
          nav('/');
        } catch (err) {
          toast(err.message || 'Ошибка входа.');
        }
      });
    }
  } else if (route.path === '/register') {
    main.innerHTML = `
      <div class="page">
        <div class="col" style="min-height: 40vh; place-content: center; gap: 20px;">
          <h3 style="margin: 0; text-align: center;">Регистрация</h3>
          <form id="registerForm" class="soft" style="padding: 20px; width: min(100% - 32px, 400px); margin: 0 auto;">
            <div class="col" style="gap: 16px;">
              <div>
                <label for="name" class="textMuted" style="display: block; font-size: 12px; margin-bottom: 6px;">ИМЯ</label>
                <input type="text" id="name" name="name" required autocomplete="name" style="width: 100%; padding: 12px;" placeholder="Имя">
              </div>
              <div>
                <label for="login" class="textMuted" style="display: block; font-size: 12px; margin-bottom: 6px;">ЛОГИН</label>
                <input type="text" id="login" name="login" required autocomplete="username" style="width: 100%; padding: 12px;" placeholder="Логин">
              </div>
              <div>
                <label for="password" class="textMuted" style="display: block; font-size: 12px; margin-bottom: 6px;">ПАРОЛЬ</label>
                <input type="password" id="password" name="password" required autocomplete="new-password" style="width: 100%; padding: 12px;" placeholder="Пароль">
              </div>
              <div>
                <label class="textMuted" style="display: block; font-size: 12px; margin-bottom: 6px;">РОЛЬ</label>
                <div class="row" style="gap: 10px; flex-wrap: wrap;">
                  <label class="btn-ghost col soft" style="flex:1; max-width: 140px; padding: 16px 10px; text-align: center; gap: 8px; cursor: pointer; margin: 0;">
                    <input type="radio" name="role" value="warrior" checked style="display: none;">
                    <div style="font-size: 24px;">⚔️</div>
                    <div style="font-size: 12px;">Воин</div>
                  </label>
                  <label class="btn-ghost col soft" style="flex:1; max-width: 140px; padding: 16px 10px; text-align: center; gap: 8px; cursor: pointer; margin: 0;">
                    <input type="radio" name="role" value="amazon" style="display: none;">
                    <div style="font-size: 24px;">🏹</div>
                    <div style="font-size: 12px;">Амазонка</div>
                  </label>
                </div>
              </div>
              <button type="submit" class="btn" style="padding: 12px 20px;">Зарегистрироваться</button>
              <div class="textCenter" style="margin-top: 10px;">
                <a href="/login" style="font-size: 13px;">Вход</a>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;
    const form = $('#registerForm');
    if (form) {
      form.addEventListener('submit', async (e)=>{
        e.preventDefault();
        const fd = new FormData(form);
        const name = String(fd.get('name') || '').trim();
        const login = String(fd.get('login') || '').trim();
        const password = String(fd.get('password') || '');
        const role = String(fd.get('role') || 'warrior');
        if (!name || !login || !password) {
          toast('Заполните все поля.');
          return;
        }
        try {
          await api.register({ name, login, password, role });
          toast('Зарегистрировались!');
          nav('/login');
        } catch (err) {
          toast(err.message || 'Ошибка регистрации.');
        }
      });
      form.addEventListener('click', (e)=>{
        if (e.target.type === 'radio') {
          const labels = form.querySelectorAll('label.btn-ghost');
          labels.forEach(lbl => lbl.classList.remove('active'));
          const activeLabel = e.target.closest('label');
          if (activeLabel) activeLabel.classList.add('active');
        }
      });
    }
  } else if (route.path === '/settings') {
    main.innerHTML = `
      <div class="page">
        <div class="soft" style="padding: 20px; margin: 16px auto; max-width: 600px;">
          <div class="col" style="gap: 24px;">
            <div>
              <h4 style="margin: 0 0 16px;">Тема</h4>
              <div class="row wrap" style="gap: 10px;">
                ${THEMES.map(t => `
                  <button type="button" class="theme-btn" data-theme="${t.id}" style="
                    width: 50px; height: 50px; border-radius: 8px; border: 2px solid var(--border);
                    background: ${t.colors.bg}; ${t.id === APP.state.user?.theme_id ? 'border-color: var(--accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent);' : ''}
                    position: relative; place-content: center;
                  ">
                    <div style="font-size: 20px; filter: brightness(1.4);">${t.emoji}</div>
                  </button>
                `).join('')}
              </div>
            </div>
            
            <div>
              <h4 style="margin: 0 0 16px;">Команда</h4>
              <div id="teamList" style="margin-bottom: 20px;"></div>
              <div id="inviteList"></div>
              <div class="row" style="gap: 12px; margin-top: 20px;">
                <button type="button" id="inviteAdd" class="btn-ghost" style="padding: 10px 16px;">Создать приглашение</button>
              </div>
            </div>

            <div>
              <h4 style="margin: 0 0 16px;">Установка</h4>
              <div class="row" style="gap: 12px; align-items: center; padding: 12px 0;">
                <button type="button" id="pwaInstallBtn" class="btn-ghost" style="padding: 10px 16px;">Установить</button>
                <div class="textMuted" style="font-size: 13px; flex:1;">PWA: <span id="pwaStatus">проверяю…</span></div>
              </div>
            </div>

            <div>
              <h4 style="margin: 0 0 16px;">Уведомления</h4>
              <div class="row" style="gap: 12px; align-items: center; padding: 12px 0;">
                <button type="button" id="notifBtn" class="btn-ghost" style="padding: 10px 16px;">Разрешить</button>
                <div class="textMuted" style="font-size: 13px; flex:1;">OS: <span id="notifStatus">проверяю…</span></div>
              </div>
              <div class="row" style="gap: 12px; align-items: center; padding: 12px 0;">
                <button type="button" id="pushBtn" class="btn-ghost" style="padding: 10px 16px;">Включить</button>
                <button type="button" id="pushOffBtn" class="btn-ghost" style="padding: 10px 16px; display: none;">Выключить</button>
                <div class="textMuted" style="font-size: 13px; flex:1;">Push: <span id="pushStatus">проверяю…</span></div>
              </div>
              <div class="row" style="gap: 12px; align-items: center; padding: 12px 0;">
                <button type="button" id="soundBtn" class="btn-ghost" style="padding: 10px 16px;">Звук: выкл</button>
                <div class="textMuted" style="font-size: 13px; flex:1;">Cosmic chime: <span id="soundStatus">проверяю…</span></div>
              </div>
            </div>

            <div>
              <h4 style="margin: 0 0 16px;">Аккаунт</h4>
              <div class="row" style="gap: 12px;">
                <button type="button" id="logoutBtn" class="btn-ghost" style="padding: 10px 16px;">Выйти</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    const themeBtns = document.querySelectorAll('.theme-btn');
    themeBtns.forEach(btn => {
      btn.addEventListener('click', ()=>{
        const id = btn.getAttribute('data-theme');
        setTheme(id);
        themeBtns.forEach(b => b.style.borderColor = 'var(--border)');
        btn.style.borderColor = 'var(--accent)';
        btn.style.boxShadow = '0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent)';
      });
    });

    $('#inviteAdd')?.addEventListener('click', async ()=>{
      const now = new Date();
      const inOneWeek = new Date(now.getTime() + 7*24*60*60*1000);
      try {
        await api.inviteCreate({ expiresAt: inOneWeek.toISOString() });
        toast('Приглашение создано.');
        await hydrateInvite();
      } catch (err) {
        toast(err.message || 'Ошибка создания приглашения.');
      }
    });

    $('#logoutBtn')?.addEventListener('click', async ()=>{
      try {
        await api.logout();
        toast('Вышли.');
        nav('/');
      } catch (err) {
        toast(err.message || 'Ошибка выхода.');
      }
    });

    updatePwaUI();
    updateNotifUI();
    updatePushUI();
    updateSoundUI();
    await hydrateInvite();
  }

  nav.update();
  bindHandlers();

  if (APP._rerenderRequested) {
    setTimeout(render, 0);
  } else {
    APP._rendering = false;
  }
}

nav.update = ()=>{
  const all = document.querySelectorAll('a[href]');
  for (const a of all) {
    if (a.host !== location.host) continue;
    if (a.pathname.startsWith('/static/')) continue;
    if (a.pathname.includes('.')) continue;
    a.setAttribute('data-nav', 'true');
    if (!a.onclick) {
      a.onclick = (e)=>{
        e.preventDefault();
        nav(a.href);
      };
    }
  }
};

async function gunzipB64(input) {
  if (!input) return '';
  try {
    const s = String(input || '').trim();
    if (!s) return '';

    const bin = atob(s);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }

    const b = await (new Response(bytes)).blob();
    const tb = await b.arrayBuffer();
    const ds = new DecompressionStream('gzip');
    const uc = new Blob([tb]).stream().pipeThrough(ds);
    const ab = await new Response(uc).arrayBuffer();
    const txt = new TextDecoder().decode(new Uint8Array(ab));
    return txt;
  } catch {
    return '(ошибка распаковки)';
  }
}

function ensureEntryModal(){
  const modal = $('#entryModal');
  const openBtn = document.querySelector('a[href="/path"]') || document.querySelector('button[data-action="open-modal"]');
  if (!modal || !openBtn) return;

  const form = $('#entryForm');
  if (!form) return;

  const closeModal = ()=>{
    modal.classList.add('hidden');
    try { ensureStarsLayer()._bound = false; } catch {}
  };

  const openModal = ()=>{
    modal.classList.remove('hidden');
    const victoryEl = $('#victory');
    const lessonEl = $('#lesson');
    if (victoryEl) victoryEl.focus();
    try { ensureStarsLayer()._bound = true; } catch {}
  };

  $('#modalCancel')?.addEventListener('click', closeModal);

  const updateCounter = (el, counterEl)=>{
    if (!el || !counterEl) return;
    const len = el.value.length;
    const max = Number(el.getAttribute('maxlength') || 0);
    counterEl.textContent = max ? `${len}/${max}` : String(len);
    counterEl.style.color = len > (max * 0.9) ? 'var(--accent)' : '';
  };

  const victoryEl = $('#victory');
  const lessonEl = $('#lesson');
  const victoryCounter = $('#victoryCounter');
  const lessonCounter = $('#lessonCounter');
  const hint = $('#draftHint');

  if (victoryEl && victoryCounter) {
    updateCounter(victoryEl, victoryCounter);
    victoryEl.addEventListener('input', ()=> updateCounter(victoryEl, victoryCounter));
  }
  if (lessonEl && lessonCounter) {
    updateCounter(lessonEl, lessonCounter);
    lessonEl.addEventListener('input', ()=> updateCounter(lessonEl, lessonCounter));
  }

  const draftKey = ()=> APP.state.user ? `draft:${APP.state.user.id}:${location.pathname}` : null;
  const readDraft = ()=>{
    const k = draftKey();
    if (!k) return null;
    try {
      const raw = localStorage.getItem(k);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      return {
        victory: typeof obj?.victory === 'string' ? obj.victory : '',
        lesson: typeof obj?.lesson === 'string' ? obj.lesson : '',
      };
    } catch { return null; }
  };
  const clearDraft = ()=>{
    const k = draftKey();
    if (!k) return;
    try { localStorage.removeItem(k); } catch {}
  };
  const saveDraft = (victory, lesson)=>{
    const k = draftKey();
    if (!k) return;
    try {
      const v = String(victory || '');
      const l = String(lesson || '');
      if (!v.trim() && !l.trim()) {
        localStorage.removeItem(k);
        return;
      }
      localStorage.setItem(k, JSON.stringify({ victory: v, lesson: l, ts: Date.now() }));
    } catch {}
  };

  const d = readDraft();
  const vEl = form.querySelector('textarea[name="victory"]');
  const lEl = form.querySelector('textarea[name="lesson"]');
  if (vEl && !vEl.value) vEl.value = d?.victory || '';
  if (lEl && !lEl.value) lEl.value = d?.lesson || '';
  if (hint) hint.textContent = d ? 'Черновик восстановлен.' : '';

  if (!form._draftBound) {
    form._draftBound = true;
    const schedule = ()=>{
      clearTimeout(form._draftT);
      form._draftT = setTimeout(()=>{
        saveDraft(vEl?.value || '', lEl?.value || '');
      }, 250);
    };
    vEl?.addEventListener('input', schedule);
    lEl?.addEventListener('input', schedule);
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

        await api.entryCreate({ victory, lesson });
        clearDraft();

        try { vEl.value = ''; lEl.value = ''; } catch {}

        toast('Зафиксировано.');
        await hydratePathStats();
        await hydrateFeed(true);
        closeModal();
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

function liveKeyOf(entry){
  if (!entry) return null;
  return `${entry.date}#${entry.id}`;
}

function liveBarShow(){
  const el = $('#liveBar');
  if (!el) return;
  const c = document.getElementById('liveCount');
  if (c) {
    const n = Number(APP.state.live.unread || 0);
    c.textContent = n > 0 ? `(${Math.min(n, 99)})` : '';
  }
  el.classList.remove('hidden');
}

function liveBarHide(){
  const el = $('#liveBar');
  if (!el) return;
  const c = document.getElementById('liveCount');
  if (c) c.textContent = '';
  el.classList.add('hidden');
}

function updateAttentionIndicators(){
  const n = Math.max(0, Number(APP.state.live.unread || 0));
  try {
    if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
      if (n > 0) navigator.setAppBadge(Math.min(n, 99));
      else navigator.clearAppBadge();
    }
  } catch {}
  try { setDocumentTitle(APP.state.route?.path || parseRoute().path); } catch {}
}

async function notifyNewEntry(entry){
  try {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') {
      if (Notification.permission === 'default' && !APP.state.live.prompted) {
        APP.state.live.prompted = true;
        toast('Разреши уведомления в настройках, чтобы видеть новые шаги.');
      }
      return;
    }

    const shouldNotify = document.hidden || (typeof document.hasFocus === 'function' && !document.hasFocus());
    if (!shouldNotify) return;

    const map = teamUserMap();
    const author = map.get(entry.user_id);
    const authorName = author?.name || 'Спутник';

    let body = '';
    try {
      const v = await gunzipB64(entry.victory);
      const l = await gunzipB64(entry.lesson);
      const pick = (v && v.trim()) ? v.trim() : (l && l.trim()) ? l.trim() : '';
      body = pick ? pick.split(/\r?\n/)[0].slice(0, 140) : '';
    } catch {}

    const extra = Math.max(0, Number(entry._extraCount || 0));
    if (extra > 0) {
      body = body
        ? `${body} (и еще ${extra})`
        : `Новых шагов: ${extra + 1}`;
    }

    try {
      if (readPushDesired && readPushDesired()) return;
    } catch {}

    const title = `${authorName}`;
    const tag = `pariter_${entry.date}_${entry.id}`;
    const opts = {
      body,
      tag,
      renotify: false,
      data: { url: '/path' },
    };

    try {
      const reg = await navigator.serviceWorker?.getRegistration?.();
      if (reg && reg.showNotification) {
        await reg.showNotification(title, opts);
        return;
      }
    } catch {}

    try {
      new Notification(title, opts);
    } catch {}
  } catch {}
}

async function liveApplyIfNeeded({ force=false }={}){
  if (!APP.state.user) return;
  if (APP.state.feed.loading) return;
  if (APP.state.live.pending) return;

  const nearTop = (window.scrollY || document.documentElement.scrollTop || 0) < 220;
  if (!force && !nearTop) {
    liveBarShow();
    return;
  }

  APP.state.live.pending = true;
  try {
    APP.state.live.unread = 0;
    updateAttentionIndicators();

    liveBarHide();
    await hydratePathStats();
    await hydrateFeed(true);
  } finally {
    APP.state.live.pending = false;
  }
}

async function liveTick(){
  if (!APP.state.user) return;
  if (APP.state.sidebarOpen) return;

  try {
    if (!APP.state.live.topKey) {
      const r0 = await api.entriesGet({ limit: 1, before: null });
      const top0 = (r0?.entries && r0.entries[0]) ? r0.entries[0] : null;
      const k0 = liveKeyOf(top0);
      if (k0) {
        APP.state.live.topKey = k0;
        APP.state.live.lastNotifiedKey = k0;
      }
      return;
    }

    const cur = APP.state.live.topKey;
    const [afterDate, afterIdStr] = String(cur).split('#');
    const afterId = Number(afterIdStr || '0');
    if (!afterDate || !afterId) return;

    const r = await api.entriesNew({ after: { date: afterDate, id: afterId }, limit: 3 });
    const count = Number(r?.count || 0);
    const newest = (Array.isArray(r?.entries) && r.entries.length) ? r.entries[0] : null;

    if (!count || !newest) return;

    const newKey = liveKeyOf(newest);
    if (!newKey) return;

    APP.state.live.topKey = newKey;

    const route = APP.state.route?.path;
    const nearTop = (window.scrollY || document.documentElement.scrollTop || 0) < 220;

    const inFocus = (!document.hidden) && (typeof document.hasFocus !== 'function' || document.hasFocus());

    if (route === '/path' && nearTop && inFocus) {
      APP.state.live.unread = 0;
      updateAttentionIndicators();
      await liveApplyIfNeeded({ force: true });
      return;
    }

    APP.state.live.unread = Math.min(99, Number(APP.state.live.unread || 0) + Math.min(99, count));
    updateAttentionIndicators();
    if (route === '/path') liveBarShow();

    if (APP.state.live.lastNotifiedKey !== newKey) {
      APP.state.live.lastNotifiedKey = newKey;
      if (!(readPushDesired && readPushDesired())) {
        await notifyNewEntry({ ...newest, _extraCount: Math.max(0, count - 1) });
      }
      try { playCosmicChime(); } catch {}
    }

  } catch {
    // ignore network errors in live mode
  }
}

function liveStart(){
  if (liveStart._timer) return;
  liveTick();
  liveStart._timer = setInterval(liveTick, 7000);
}

function liveStop(){
  if (liveStart._timer) {
    clearInterval(liveStart._timer);
    liveStart._timer = null;
  }
  APP.state.live.topKey = null;
  APP.state.live.lastNotifiedKey = null;
  APP.state.live.unread = 0;
  liveBarHide();
  updateAttentionIndicators();
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
    APP.state.live.topKey = null;
    liveBarHide();
  }

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
      status.textContent = APP.state.feed.renderedCount ? 'Здесь начался путь.' : 'Пока нет записей. Начни шаг сейчас.';
      const moreBtn = $('#feedMore');
      if (moreBtn) moreBtn.classList.add('hidden');
      return;
    }

    if (!APP.state.live.topKey) {
      APP.state.live.topKey = liveKeyOf(entries[0]);
    }

    const map = teamUserMap();

    for (const e of entries) {
      if (APP.state.feed.lastRenderedDate !== e.date) {
        feed.insertAdjacentHTML('beforeend', DateDivider(ruDateLabel(e.date)));
        APP.state.feed.lastRenderedDate = e.date;
      }

      const author = map.get(e.user_id) || null;
      const meIsAdmin = Number(APP.state.user?.is_admin || 0) === 1;
      feed.insertAdjacentHTML('beforeend', EntryCard({ entry: e, author, meId: APP.state.user.id, meIsAdmin }));
      APP.state.feed.renderedCount++;
    }

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

  const meIsAdmin = Number(me?.is_admin || 0) === 1;
  teamList.innerHTML = users.map(u => {
    const joined = new Intl.DateTimeFormat('ru-RU', { year:'numeric', month:'short', day:'numeric' }).format(new Date(u.created_at));
    const isMe = Number(u.id) === Number(me?.id);
    const canDelete = meIsAdmin && !isMe;
    return `
      <div class="soft" style="padding: 10px 12px; display:flex; align-items:center; justify-content: space-between; gap: 10px">
        <div class="row" style="min-width:0; gap:10px">
          <div style="width:36px;height:36px;border-radius:999px;border:1px solid var(--border);display:grid;place-items:center;background:rgba(255,255,255,.03)">${ROLE_META[u.role]?.emoji || '⚔️'}</div>
          <div style="min-width:0">
            <div style="font-weight: 800; white-space: nowrap; overflow:hidden; text-overflow: ellipsis;">${escapeHTML(u.name)}</div>
            <div class="textMuted" style="font-size: 12px">присоединился: ${escapeHTML(joined)}</div>
          </div>
        </div>
        <div class="row" style="gap: 8px; align-items:center">
          <div class="textMuted" style="font-size: 12px">@${escapeHTML(u.login)}</div>
          ${canDelete ? `<button type="button" class="btn-ghost" style="padding: 10px 12px" data-action="team-user-delete" data-id="${Number(u.id)}" aria-label="Удалить спутника">🗑️</button>` : ''}
        </div>
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
          <button type="button" class="btn-ghost" style="padding: 10px 12px" data-action="invite-delete" data-id="${i.id}" aria-label="Удалить">×</button>
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

  bindHandlers();
}

window.addEventListener('popstate', render);

window.addEventListener('beforeinstallprompt', (e)=>{
  try {
    e.preventDefault();
    APP.pwa.deferredPrompt = e;
    updatePwaUI();
  } catch {}
});
window.addEventListener('appinstalled', ()=>{
  APP.pwa.installed = true;
  APP.pwa.deferredPrompt = null;
  updatePwaUI();
});

function updatePwaUI(){
  const btn = document.getElementById('pwaInstallBtn');
  const st = document.getElementById('pwaStatus');
  if (!btn || !st) return;
  const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || (navigator.standalone === true);
  if (APP.pwa.installed || isStandalone) {
    btn.disabled = true;
    st.textContent = 'установлено';
    return;
  }
  if (APP.pwa.deferredPrompt) {
    btn.disabled = false;
    st.textContent = 'доступно';
  } else {
    btn.disabled = true;
    st.textContent = 'недоступно';
  }
}

function updateNotifUI(){
  const btn = document.getElementById('notifBtn');
  const st = document.getElementById('notifStatus');
  if (!btn || !st) return;

  if (typeof Notification === 'undefined') {
    btn.disabled = true;
    st.textContent = 'не поддерживается';
    return;
  }

  const p = Notification.permission;
  if (p === 'granted') {
    btn.disabled = true;
    st.textContent = 'разрешено';
    return;
  }
  if (p === 'denied') {
    btn.disabled = true;
    st.textContent = 'запрещено';
    return;
  }
  btn.disabled = false;
  st.textContent = 'не разрешено';
  try { updatePushUI(); } catch {}
}

function b64urlToU8(b64url){
  let s = String(b64url || '').replaceAll('-', '+').replaceAll('_', '/');
  const pad = s.length % 4;
  if (pad) s += '='.repeat(4 - pad);
  const bin = atob(s);
  const u8 = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

function withTimeout(promise, ms, msg){
  let t;
  const timeout = new Promise((_, rej)=>{
    t = setTimeout(()=> rej(new Error(msg || 'Timeout')), ms);
  });
  return Promise.race([promise, timeout]).finally(()=>{ try { clearTimeout(t); } catch {} });
}

async function ensureServiceWorkerForPush(){
  if (ensureServiceWorkerForPush._p) return ensureServiceWorkerForPush._p;

  ensureServiceWorkerForPush._p = (async ()=>{
    if (!('serviceWorker' in navigator)) throw new Error('Service Worker не поддерживается.');

    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(async (r)=>{
        try {
          const scopePath = new URL(r.scope).pathname;
          const activeUrl = r.active?.scriptURL ? new URL(r.active.scriptURL).pathname : '';
          const installingUrl = r.installing?.scriptURL ? new URL(r.installing.scriptURL).pathname : '';
          const waitingUrl = r.waiting?.scriptURL ? new URL(r.waiting.scriptURL).pathname : '';
          const anyUrl = activeUrl || waitingUrl || installingUrl;

          const badScope = scopePath !== '/';
          const badScript = anyUrl && anyUrl !== '/sw.js';
          if (badScope || badScript) {
            try {
              const sub = await r.pushManager?.getSubscription?.();
              if (sub) await sub.unsubscribe().catch(()=>{});
            } catch {}

            await r.unregister().catch(()=>{});
          }
        } catch {}
      }));
    } catch {}

    let reg = null;
    try {
      reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      try { await reg.update(); } catch {}
    } catch {
      throw new Error('Service worker не зарегистрирован');
    }

    try {
      const active = reg.active || reg.waiting || reg.installing;
      if (active && active.state !== 'activated') {
        await withTimeout(new Promise((resolve)=>{
          try {
            const on = ()=>{
              if (active.state === 'activated') {
                try { active.removeEventListener('statechange', on); } catch {}
                resolve(true);
              }
            };
            active.addEventListener('statechange', on);
            on();
          } catch { resolve(true); }
        }), 3000, 'Service worker не активировался');
      }
    } catch {}

    return reg;
  })().catch((e)=>{
    ensureServiceWorkerForPush._p = null;
    throw e;
  });

  return ensureServiceWorkerForPush._p;
}

async function updatePushUI(){
  const btn = document.getElementById('pushBtn');
  const off = document.getElementById('pushOffBtn');
  const st = document.getElementById('pushStatus');
  if (!btn || !st) return;

  const hasPush = (typeof PushManager !== 'undefined');
  const isSecure = (location.protocol === 'https:' || location.hostname === 'localhost');

  if (!hasPush || !('serviceWorker' in navigator)) {
    btn.disabled = true;
    if (off) off.classList.add('hidden');
    st.textContent = 'не поддерживается';
    return;
  }
  if (!isSecure) {
    btn.disabled = true;
    if (off) off.classList.add('hidden');
    st.textContent = 'нужен https';
    return;
  }

  st.textContent = 'проверяю…';

  try {
    const reg = await withTimeout(ensureServiceWorkerForPush(), 2500, 'Service worker не готов');
    const sub = await reg.pushManager.getSubscription();

    if (sub) {
      try { writePushDesired(true); } catch {}
      btn.disabled = true;
      if (off) off.classList.remove('hidden');
      st.textContent = 'включено';
    } else {
      btn.disabled = false;
      if (off) off.classList.add('hidden');
      st.textContent = 'выключено';
    }
  } catch (e) {
    btn.disabled = false;
    if (off) off.classList.add('hidden');
    st.textContent = 'не готово';
  }
}

const PUSH_DESIRED_KEY = 'pariter_push_desired';
const PUSH_VAPID_KEY_KEY = 'pariter_push_vapid_public_key';
const PUSH_NEEDS_RESUB_KEY = 'pariter_push_needs_resub';
const PUSH_TOKEN_KEY = 'pariter_push_token';

function readPushDesired(){
  try { return localStorage.getItem(PUSH_DESIRED_KEY) === '1'; } catch { return false; }
}
function writePushDesired(v){
  try { localStorage.setItem(PUSH_DESIRED_KEY, v ? '1' : '0'); } catch {}
}
function readVapidPublicKey(){
  try { return String(localStorage.getItem(PUSH_VAPID_KEY_KEY) || ''); } catch { return ''; }
}
function writeVapidPublicKey(k){
  try { localStorage.setItem(PUSH_VAPID_KEY_KEY, String(k || '')); } catch {}
}
function readPushNeedsResub(){
  try { return String(localStorage.getItem(PUSH_NEEDS_RESUB_KEY) || ''); } catch { return ''; }
}
function writePushNeedsResub(k){
  try {
    if (!k) localStorage.removeItem(PUSH_NEEDS_RESUB_KEY);
    else localStorage.setItem(PUSH_NEEDS_RESUB_KEY, String(k));
  } catch {}
}
function readPushToken(){
  try { return String(localStorage.getItem(PUSH_TOKEN_KEY) || '').trim(); } catch { return ''; }
}
function writePushToken(tok){
  try {
    const t = String(tok || '').trim();
    if (!t) localStorage.removeItem(PUSH_TOKEN_KEY);
    else localStorage.setItem(PUSH_TOKEN_KEY, t);
  } catch {}
}

async function sendPushTokenToSW(token){
  try {
    const tok = String(token || '').trim();
    if (!tok) return;

    try { navigator.serviceWorker?.controller?.postMessage?.({ type: 'push-token', token: tok }); } catch {}

    try {
      const reg = await navigator.serviceWorker?.getRegistration?.();
      reg?.active?.postMessage?.({ type: 'push-token', token: tok });
    } catch {}
  } catch {}
}

async function enablePush(){
  if (typeof Notification === 'undefined') throw new Error('Уведомления не поддерживаются.');

  const isSecure = (window.isSecureContext || location.hostname === 'localhost');
  if (!isSecure) throw new Error('Push требует https.');

  if (Notification.permission !== 'granted') {
    const p = await Notification.requestPermission();
    try { updateNotifUI(); } catch {}
    if (p !== 'granted') throw new Error('Разрешение на уведомления не выдано.');
  }

  const reg = await withTimeout(ensureServiceWorkerForPush(), 5000, 'Service worker не готов');

  const { publicKey } = await api.pushVapidKey();
  if (!publicKey) throw new Error('Push ключ не получен.');

  const prev = readVapidPublicKey();
  if (prev && prev !== publicKey) {
    writePushNeedsResub(publicKey);
  }

  let sub = await reg.pushManager.getSubscription();

  const need = readPushNeedsResub();
  if (sub && need && need === publicKey) {
    try { await sub.unsubscribe(); } catch {}
    sub = null;
  }

  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: b64urlToU8(publicKey),
    });
  }

  const json = sub.toJSON();
  const token = readPushToken() || null;
  const r = await api.pushSubscribe({ endpoint: json.endpoint, keys: json.keys, token });

  if (r?.token) {
    writePushToken(String(r.token));
    sendPushTokenToSW(String(r.token));
  }

  writePushDesired(true);
  writeVapidPublicKey(publicKey);
  writePushNeedsResub('');

  try { await updatePushUI(); } catch {}
  return true;
}

async function disablePush(){
  try {
    const reg = await ensureServiceWorkerForPush();
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const json = sub.toJSON();
      await sub.unsubscribe().catch(()=>{});
      await api.pushUnsubscribe({ endpoint: json?.endpoint || null }).catch(()=>{});
    }
  } catch {}
  writePushDesired(false);
  writePushNeedsResub('');
  writePushToken('');
  try {
    sendPushTokenToSW('');
  } catch {}
  try { await updatePushUI(); } catch {}
}

async function pushResubscribeIfNeeded(){
  const need = readPushNeedsResub();
  if (!need) return false;
  if (!readPushDesired()) return false;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
  if (typeof PushManager === 'undefined') return false;
  if (!(window.isSecureContext || location.hostname === 'localhost')) return false;

  const reg = await ensureServiceWorkerForPush();
  const { publicKey } = await api.pushVapidKey().catch(()=> ({ publicKey: '' }));
  if (!publicKey || publicKey !== need) return false;

  let sub = await reg.pushManager.getSubscription();
  if (sub) {
    try { await sub.unsubscribe(); } catch {}
  }

  sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: b64urlToU8(publicKey),
  });

  const j = sub.toJSON();
  const token = readPushToken() || null;
  const r = await api.pushSubscribe({ endpoint: j.endpoint, keys: j.keys, token }).catch(()=>null);
  if (r?.token) {
    writePushToken(String(r.token));
    sendPushTokenToSW(String(r.token));
  }

  writeVapidPublicKey(publicKey);
  writePushNeedsResub('');
  try { updatePushUI(); } catch {}
  return true;
}

async function pushAutoMaintain(){
  try {
    if (!APP.state.user) return;
    if (!readPushDesired()) return;
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    if (typeof PushManager === 'undefined') return;
    if (!(window.isSecureContext || location.hostname === 'localhost')) return;

    const now = Date.now();
    if (pushAutoMaintain._last && (now - pushAutoMaintain._last < 30_000)) return;
    pushAutoMaintain._last = now;

    const reg = await ensureServiceWorkerForPush();
    let sub = await reg.pushManager.getSubscription();

    const { publicKey } = await api.pushVapidKey().catch(()=> ({ publicKey: '' }));
    if (!publicKey) return;

    const prev = readVapidPublicKey();
    if (prev && prev !== publicKey) {
      writePushNeedsResub(publicKey);
    }

    if (!sub) {
      try {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: b64urlToU8(publicKey),
        });
        writeVapidPublicKey(publicKey);
        writePushNeedsResub('');
      } catch {
        writePushNeedsResub(publicKey);
        return;
      }
    }

    const j = sub.toJSON();
    if (j?.endpoint && j?.keys?.p256dh && j?.keys?.auth) {
      const token = readPushToken() || null;
      const r = await api.pushSubscribe({ endpoint: j.endpoint, keys: j.keys, token }).catch(()=>null);
      if (r?.token) {
        writePushToken(String(r.token));
        sendPushTokenToSW(String(r.token));
      }
    }
  } catch {
    // ignore
  }
}

const SOUND_KEY = 'pariter_sound_enabled';

function readSoundEnabled(){
  try {
    const v = localStorage.getItem(SOUND_KEY);
    if (v == null) return false;
    return v === '1';
  } catch { return false; }
}

function writeSoundEnabled(enabled){
  try { localStorage.setItem(SOUND_KEY, enabled ? '1' : '0'); } catch {}
}

function updateSoundUI(){
  const btn = document.getElementById('soundBtn');
  const st = document.getElementById('soundStatus');
  if (!btn || !st) return;

  const enabled = readSoundEnabled();
  APP.state.sound.enabled = enabled;

  btn.textContent = enabled ? 'Звук: вкл' : 'Звук: выкл';
  st.textContent = enabled ? 'включено' : 'выключено';
}

function playCosmicChime({ quiet=false }={}){
  const enabled = readSoundEnabled();
  if (!enabled) return;

  const now = Date.now();
  const minGap = 2000;
  if (!quiet && (now - (APP.state.sound.lastAt || 0) < minGap)) return;
  APP.state.sound.lastAt = now;

  if (!quiet) {
    try {
      const inFocus = !document.hidden && (typeof document.hasFocus !== 'function' || document.hasFocus());
      if (inFocus) return;
    } catch {}
  }

  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  const ctx = playCosmicChime._ctx || (playCosmicChime._ctx = new Ctx());

  if (ctx.state === 'suspended') {
    ctx.resume().catch(()=>{});
  }

  const t0 = ctx.currentTime + 0.01;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, t0);
  out.gain.exponentialRampToValueAtTime(quiet ? 0.06 : 0.12, t0 + 0.02);
  out.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
  out.connect(ctx.destination);

  const o1 = ctx.createOscillator();
  o1.type = 'sine';
  o1.frequency.setValueAtTime(660, t0);
  o1.frequency.exponentialRampToValueAtTime(520, t0 + 0.35);

  const o2 = ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.setValueAtTime(660 * 1.008, t0);
  o2.frequency.exponentialRampToValueAtTime(520 * 1.01, t0 + 0.35);

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(1400, t0);
  lp.Q.setValueAtTime(0.8, t0);

  const g1 = ctx.createGain();
  g1.gain.setValueAtTime(0.0, t0);
  g1.gain.linearRampToValueAtTime(0.9, t0 + 0.02);
  g1.gain.exponentialRampToValueAtTime(0.001, t0 + 0.9);

  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.0, t0);
  g2.gain.linearRampToValueAtTime(0.6, t0 + 0.02);
  g2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.9);

  o1.connect(g1);
  o2.connect(g2);
  g1.connect(lp);
  g2.connect(lp);

  const noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.12), ctx.sampleRate);
  const ch = noiseBuf.getChannelData(0);
  for (let i=0;i<ch.length;i++) ch[i] = (Math.random() * 2 - 1) * 0.25;
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;

  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.setValueAtTime(800, t0);

  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.0001, t0);
  ng.gain.exponentialRampToValueAtTime(quiet ? 0.025 : 0.04, t0 + 0.02);
  ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);

  noise.connect(hp);
  hp.connect(ng);
  ng.connect(lp);

  const delay = ctx.createDelay(1.0);
  delay.delayTime.setValueAtTime(0.14, t0);
  const fb = ctx.createGain();
  fb.gain.setValueAtTime(0.18, t0);
  delay.connect(fb);
  fb.connect(delay);

  const wet = ctx.createGain();
  wet.gain.setValueAtTime(0.25, t0);

  lp.connect(out);
  lp.connect(delay);
  delay.connect(wet);
  wet.connect(out);

  o1.start(t0);
  o2.start(t0);
  noise.start(t0);

  o1.stop(t0 + 0.95);
  o2.stop(t0 + 0.95);
  noise.stop(t0 + 0.22);
}

try { APP.state.sound.enabled = readSoundEnabled(); } catch {}


document.addEventListener('click', (e)=>{
  const a = e.target?.closest?.('a');
  if (!a) return;
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
  try { APP.state.sound.enabled = readSoundEnabled(); } catch {}

  try { ensureStarsLayer(); } catch {}

  try {
    const reg = await ensureServiceWorkerForPush();

    try {
      const sub = await reg.pushManager.getSubscription();
      if (sub) writePushDesired(true);
    } catch {}

    try {
      const tok = readPushToken();
      if (tok) sendPushTokenToSW(tok);
    } catch {}
  } catch {}

  try {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (ev)=>{
        try {
          if (!ev?.data || typeof ev.data !== 'object') return;
          if (ev.data.type !== 'push') return;
          if (APP.state.user && APP.state.route?.path === '/path') {
            APP.state.live.unread = Math.min(99, Number(APP.state.live.unread || 0) + 1);
            updateAttentionIndicators();
            liveBarShow();
          }
        } catch {}
      });
    }
  } catch {}

  await render();

  try { pushAutoMaintain(); } catch {}

  setInterval(()=>{ try { pushAutoMaintain(); } catch {} }, 90_000);

  setInterval(()=>{ try { liveTick(); } catch {} }, 30_000);
})();
