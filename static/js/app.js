// PARITER client (Vanilla JS) — talks to Bun backend via /api/*

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

  // Synchronization (shared palette for both roles)
  { id:'sync_warrior', role:'warrior', emoji:'🖤', ru:'Синхронизация', la:'Synchronizatio', light:false, colors:{ bg:'#0a0a0f', bgSecondary:'#14141f', text:'#d4dbe8', textMuted:'#7a8599', accent:'#8fa4c9', accentHover:'#b8c8e8', border:'rgba(150,160,180,.12)', victory:'rgba(143,164,201,.12)', lesson:'rgba(255,190,225,.10)' } },
  { id:'sync_amazon', role:'amazon', emoji:'🖤', ru:'Синхронизация', la:'Synchronizatio', light:false, colors:{ bg:'#0a0a0f', bgSecondary:'#14141f', text:'#d4dbe8', textMuted:'#7a8599', accent:'#8fa4c9', accentHover:'#b8c8e8', border:'rgba(150,160,180,.12)', victory:'rgba(143,164,201,.12)', lesson:'rgba(255,190,225,.10)' } },
];

function themeById(id){
  return THEMES.find(t => t.id === id) || THEMES[0];
}

// --- Stars + landing crystal background (battery-friendly)
function shouldAnimateNow(){
  try {
    const inFocus = !document.hidden && (typeof document.hasFocus !== 'function' || document.hasFocus());
    if (!inFocus) return false;

    // Only animate when a route exists (SPA mounted)
    const p = APP.state?.route?.path || parseRoute().path;
    return !!p;
  } catch { return false; }
}

function shouldAnimateBlackHoles(){
  try {
    // Even with reduced motion, we still want to show black holes (with reduced intensity)
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    const inFocus = !document.hidden && (typeof document.hasFocus !== 'function' || document.hasFocus());
    if (!inFocus) return false;

    // Only animate when a route exists (SPA mounted)
    const p = APP.state?.route?.path || parseRoute().path;
    return !!p && !prefersReducedMotion; // Only animate black holes if not reduced motion
  } catch { return false; }
}

function shouldAnimateWithReducedIntensity(){
  try {
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    const inFocus = !document.hidden && (typeof document.hasFocus !== 'function' || document.hasFocus());
    if (!inFocus) return false;

    // Only animate when a route exists (SPA mounted)
    const p = APP.state?.route?.path || parseRoute().path;
    return !!p && prefersReducedMotion; // Return true only if reduced motion is preferred but other conditions are met
  } catch { return false; }
}

function ensureStarsLayer(){
  // Mount global stars canvas once
  if (!document.getElementById('starsCanvas')) {
    const old = document.querySelector('.stars-bg');
    if (old) old.remove();

    const bg = document.createElement('div');
    bg.className = 'stars-bg';
    const canvas = document.createElement('canvas');
    canvas.id = 'starsCanvas';
    bg.appendChild(canvas);
    document.body.insertBefore(bg, document.body.firstChild || null);

    // enable transparent html/body backgrounds
    document.documentElement.classList.add('l00m-stars-on');
  }

  // Start animation loop (paused when app is not active)
  if (!ensureStarsLayer._stars) ensureStarsLayer._stars = new StarsEngine(document.getElementById('starsCanvas'));
  ensureStarsLayer._stars.start();

  // Landing crystal: start/stop based on route
  if (!ensureStarsLayer._crystal) ensureStarsLayer._crystal = new CrystalEngine();
  ensureStarsLayer._crystal.syncToRoute();

  // Pause/resume on visibility
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
  // extra layer: comets + black holes (subtle, global)
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
    // 1-2 subtle black holes for depth
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
    // reset comets on hole regen
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

    // tint: ice or pink
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

    // canvas size
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

    const count = 900; // reduce from 1500 for battery
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
    // extra layer
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

    // Check if we should animate black holes specifically
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

    // black holes beneath
    this.drawHoles(t);

    // twinkle
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

      // enhanced gravitational effects near holes
      for (const h of this.holes || []) {
        const dx = h.x - c.x;
        const dy = h.y - c.y;
        const dist = Math.hypot(dx, dy) || 1;
        
        if (dist < (h.r*4.6)) {
          // Коэффициент влияния в зависимости от расстояния
          const k = 1 - dist/(h.r*4.6);
          
          // Сила притяжения
          const pull = 0.040 * k; // Увеличенная сила притяжения
          c.vx += (dx/dist) * pull;
          c.vy += (dy/dist) * pull;
          
          // Сила вращения (вихревое движение)
          const swirl = 0.035 * k * h.spin; // Увеличенная сила вращения
          c.vx += (-dy/dist) * swirl;
          c.vy += ( dx/dist) * swirl;
          
          // Если комета слишком близко к центру, она может быть "поглощена"
          if (dist < h.r * 0.8) {
            c.life = 0; // Уничтожаем комету
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
    // Check if we should run the full animation or just black holes
    const fullAnimation = shouldAnimateNow();
    const blackHoleAnimation = shouldAnimateBlackHoles() || shouldAnimateWithReducedIntensity();
    
    if (!fullAnimation && !blackHoleAnimation) {
      this._raf = requestAnimationFrame(this._loop);
      return;
    }

    const now = ts;

    // refresh ghost constellations if page height changes (SPA / infinite feed)
    if (fullAnimation && (!this._ghostCheckAt || (now - this._ghostCheckAt) > 1800)) {
      this._ghostCheckAt = now;
      const dh = this.getDocHeight();
      if (Math.abs(dh - (this._lastDocH || 0)) > 80) {
        this.generateGhosts();
      }
    }

    // spawn comets sometimes - only if full animation is enabled
    if (fullAnimation) {
      if (!this._lastCometAt) this._lastCometAt = now;
      if ((now - this._lastCometAt) > (2600 + Math.random()*1200)) {
        this.spawnComet();
        // rare double-comet
        if (Math.random() < 0.18) {
          setTimeout(()=>{ try { this.spawnComet(); } catch {} }, 220);
        }
        this._lastCometAt = now;
      }
    }

    // update comets only if full animation is enabled
    if (fullAnimation) {
      this.updateComets();
    }
    
    // Apply black hole forces to stars for gravitational effects
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
    
    // Render frame - always render if either animation is enabled
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

  // init
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

    // rebuild state
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

    // holes
    // Check if we should animate black holes specifically
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

    // links
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

    // stars
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

    // comets
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
    // Check if we should run the full animation or just black holes
    const fullAnimation = shouldAnimateNow();
    const blackHoleAnimation = shouldAnimateBlackHoles() || shouldAnimateWithReducedIntensity();
    
    if (!fullAnimation && !blackHoleAnimation) {
      this._raf = requestAnimationFrame(this._loop);
      return;
    }
    
    const st = this._state;
    if (st) {
      // Only update comets and stars if full animation is enabled
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
          
          // Apply black hole forces to comets
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
      
      // Always render if either animation is enabled
      this._render(now*0.001);
    }
    this._raf = requestAnimationFrame(this._loop);
  };

  this.start = ()=>{
    if (this._raf) return;
    const p = APP.state?.route?.path || parseRoute().path;
    if (p !== '/') return; // only landing
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

function defaultThemeForRole(role){
  return (THEMES.find(t => t.role === role) || THEMES[0]).id;
}

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
            <div class="ai-wrap" style="margin-top: 10px;">
              <textarea class="textarea ai-textarea" id="entryModalVictory" placeholder="Текст победы"></textarea>
              <button type="button" class="ai-btn" data-action="ai-rewrite" data-target="entryModalVictory" data-field="victory" title="Переписать с ИИ" aria-label="Переписать с ИИ">✦</button>
            </div>
          </div>

          <div class="soft" style="padding: 12px; background: var(--lesson)">
            <div style="font-size: 12px; font-weight: 900; letter-spacing:.16em">🦉 LECTIO</div>
            <div class="ai-wrap" style="margin-top: 10px;">
              <textarea class="textarea ai-textarea" id="entryModalLesson" placeholder="Текст урока"></textarea>
              <button type="button" class="ai-btn" data-action="ai-rewrite" data-target="entryModalLesson" data-field="lesson" title="Переписать с ИИ" aria-label="Переписать с ИИ">✦</button>
            </div>
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
  const b = document.body;

  // Important: SSR can set CSS variables inline on <body>. If we only set vars on <html>,
  // body vars will win and theme switching will look “stuck”. So we set vars on BOTH.
  Object.entries(t.colors).forEach(([k,v]) => {
    r.style.setProperty(`--${k}`, v);
    b.style.setProperty(`--${k}`, v);
  });

  // If stars background is enabled, canvas draws the “night”, so we keep body transparent.
  if (document.documentElement.classList.contains('l00m-stars-on')) {
    b.style.background = 'transparent';
    return;
  }

  if (t.light) {
    b.style.background = `radial-gradient(1100px 560px at 20% -10%, rgba(76,111,255,.12), transparent 55%),
                          radial-gradient(900px 520px at 110% 10%, rgba(31,185,129,.12), transparent 60%),
                          var(--bg)`;
  } else {
    b.style.background = `radial-gradient(1200px 600px at 20% -10%, rgba(124,92,255,.22), transparent 55%),
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

function ruTimeLabel(iso){
  try {
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return '';
    return new Intl.DateTimeFormat('ru-RU', { hour:'2-digit', minute:'2-digit' }).format(dt);
  } catch { return ''; }
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

      const curPath = location.pathname;
      const isAuthPage = curPath === '/login' || curPath === '/register' || curPath.startsWith('/join/');
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
  // legacy, not used in infinite-path mode
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
  entriesNew: ({after, limit=3}={})=>{
    const p = new URLSearchParams();
    if (after?.date && after?.id) {
      p.set('afterDate', after.date);
      p.set('afterId', String(after.id));
    }
    p.set('limit', String(limit));
    return apiFetch('/api/entries/new?' + p.toString());
  },
  entryCreate: ({victory, lesson})=> apiFetch('/api/entries', { method:'POST', body: { victory, lesson, pushToken: readPushToken() || null } }),
  // legacy name (kept for older code paths)
  entryUpsertToday: ({victory, lesson})=> apiFetch('/api/entries', { method:'POST', body: { victory, lesson, pushToken: readPushToken() || null } }),
  entryUpdate: (id, {victory, lesson})=> apiFetch('/api/entries/' + Number(id), { method:'PUT', body: { victory, lesson } }),
  entryDelete: (id)=> apiFetch('/api/entries/' + Number(id), { method:'DELETE' }),
  settingsUpdate: ({name, role, theme, password})=> apiFetch('/api/settings', { method:'PUT', body: { name, role, theme, password } }),
  export: ()=> apiFetch('/api/export'),
  import: ({data, defaultPassword})=> apiFetch('/api/import', { method:'POST', body: { data, defaultPassword } }),
  stats: ()=> apiFetch('/api/stats'),
  aiRewrite: ({field, text})=> apiFetch('/api/ai/rewrite', { method:'POST', body: { field, text } }),

  // Push
  pushVapidKey: ()=> apiFetch('/api/push/vapidPublicKey'),
  pushSubscribe: ({ endpoint, keys, token=null })=> apiFetch('/api/push/subscribe', { method:'POST', body: { endpoint, keys, token } }),
  pushResubscribe: ({ token, endpoint, keys })=> apiFetch('/api/push/resubscribe', { method:'POST', body: { token, endpoint, keys } }),
  pushUnsubscribe: ({ endpoint=null }={})=> apiFetch('/api/push/unsubscribe', { method:'POST', body: { endpoint } }),

  // Account / Team management
  profileDelete: ()=> apiFetch('/api/profile', { method:'DELETE' }),
  teamDelete: (id)=> apiFetch('/api/team/' + Number(id), { method:'DELETE' }),
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

function setDocumentTitle(routePath){
  // Keep titles in sync with server-side pages.ts (so no F5 needed for title updates).
  const base = '✦ PARITER ✦';
  let t = base;
  if (routePath === '/login') t = `Вход — ${base}`;
  else if (routePath === '/register') t = `Регистрация — ${base}`;
  else if (routePath === '/join') t = `Присоединиться — ${base}`;
  else if (routePath === '/path') t = `Путь — ${base}`;
  else if (routePath === '/invite') t = `Спутники — ${base}`;
  else if (routePath === '/settings') t = `Настройки — ${base}`;

  const n = Number(APP?.state?.live?.unread || 0);
  const prefix = (n > 0) ? `(${Math.min(n, 99)}) ` : '';
  try { document.title = prefix + t; } catch {}
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
  return `<span id="healthBadge" class="pill textMuted" style="font-size: 12px">связь: …</span>`;
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
  const mates = (APP.state.teamUsers || []).filter(u => me && Number(u.id) !== Number(me.id));
  const show = mates.slice(0, 6);
  const more = mates.length - show.length;

  return `
    <header class="header">
      <div class="container">
        <div class="headerRow">
          <button class="btn-ghost" style="padding: 10px 12px" data-action="sidebar-open" aria-label="Меню">☰</button>
          <button type="button" class="btn-ghost" style="padding: 8px 10px; border:0; background:transparent; letter-spacing:.16em" data-nav="/" aria-label="На главную">PARITER</button>
          <div class="row">
            <div class="row" style="display:none" id="mateIcons"></div>
            <div class="row" style="gap:6px" aria-hidden="true">
              ${show.map(u=>`<div title="Спутник: ${escapeHTML(u.name)}" style="width:32px;height:32px;border-radius:999px;border:1px solid var(--border);display:grid;place-items:center;background:rgba(255,255,255,.03)">${ROLE_META[u.role]?.emoji || '✦'}</div>`).join('')}
              ${more>0 ? `<div title="Ещё спутники" style="width:32px;height:32px;border-radius:999px;border:1px solid var(--border);display:grid;place-items:center;background:rgba(255,255,255,.03);font-size:12px">+${more}</div>` : ''}
            </div>
            <div aria-hidden="true" style="width:1px; height: 22px; background: var(--border); margin: 0 8px;"></div>
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
      <div style="display:grid; grid-template-columns: repeat(auto-fit, 44px); gap: 8px; margin-top: 6px;">${dots}</div>
      <div class="soft" style="padding: 12px;" id="${idsPrefix}themePreview">
        <div class="rowBetween" style="align-items: flex-start;">
          <div>
            <div style="font-weight: 900;" id="${idsPrefix}themePreviewTitle">${t.emoji} ${escapeHTML(t.ru)}</div>
            <div class="textMuted" style="font-size: 12px" id="${idsPrefix}themePreviewLa">${escapeHTML(t.la)}</div>
          </div>
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

function EntryCard({entry, author, meId, meIsAdmin}){
  const isMine = Number(entry.user_id) === Number(meId);
  const canManage = !!(isMine || meIsAdmin);
  const roleEmoji = ROLE_META[author?.role]?.emoji || '✦';
  const authorName = author?.name || 'Неизвестный';
  const dateLabel = ruDateLabel(entry.date);
  const timeLabel = entry?.created_at ? ruTimeLabel(entry.created_at) : '';

  const mineStamp = isMine
    ? `${dateLabel}${timeLabel ? ` · ${timeLabel}` : ''}`
    : '';

  // Editing is done by tapping the field (bubble). Buttons are only for delete.
  const editAttrs = canManage ? ` data-action="entry-edit" data-id="${entry.id}"` : '';

  return `
    <article class="card" data-mine="${isMine ? '1' : '0'}" style="padding: 0;">
      <div class="rowBetween entryHead" style="padding: 10px 10px 0; align-items: flex-start;">
        <div class="row" style="gap:10px; min-width:0">
          <div style="width:38px;height:38px;border-radius:999px;display:grid;place-items:center;border:1px solid var(--border);background:rgba(255,255,255,.03)">${roleEmoji}</div>
          <div style="min-width:0">
            <div style="font-weight: 900; white-space: nowrap; overflow:hidden; text-overflow: ellipsis;">${escapeHTML(authorName)}</div>
            <div class="textMuted" style="font-size: 12px">${escapeHTML(dateLabel)}${timeLabel ? ` <span aria-hidden="true">·</span> ${escapeHTML(timeLabel)}` : ''}</div>
          </div>
        </div>
        ${canManage ? `
          <div class="row" style="gap: 8px; align-items:center;">
            ${isMine ? `<span class="textMuted" style="font-size: 12px; margin-right: 2px">${escapeHTML(mineStamp)}</span>` : ''}
          </div>
        ` : ''}
      </div>

      <div class="grid entryBubbles" style="margin-top: 10px; padding: 0 10px 12px;">
        <div class="soft" style="padding: 12px; background: var(--victory)"${editAttrs}>
          <div style="font-size: 12px; font-weight: 900; letter-spacing:.16em">⚔️ VICTORIA</div>
          <div style="margin-top: 6px; white-space: pre-wrap; word-break: break-word;" data-entry-text="victory" data-id="${entry.id}">…</div>
        </div>
        <div class="soft" style="padding: 12px; background: var(--lesson)"${editAttrs}>
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

        <div class="card" style="margin: 22px auto 0; width: min(720px, 100%); padding: 0; text-align:left">
          <div id="cosmosRoot" style="padding: 22px;">
            <canvas id="crystalCanvas" aria-hidden="true"></canvas>

            <div style="font-size:18px; font-weight: 900;">Зачем Pariter</div>
            <div class="textMuted" style="margin-top: 10px; line-height: 1.6">
              <div>• Фиксируй победы над страхом.</div>
              <div>• Забирай уроки из ошибок, не повторяя их.</div>
              <div>• Видь шаги спутников - и иди вместе.</div>
            </div>

            <div class="row" style="margin-top: 16px; flex-wrap: wrap">
              <button class="btn" style="flex:1" data-nav="/register">Начать путь</button>
              <button class="btn-ghost" style="flex:1" data-nav="/login">Уже в пути? Войти</button>
            </div>

            <div style="margin-top: 12px; display:flex; justify-content:center">${HealthBadge()}</div>
          </div>
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
      <div class="textMuted" style="margin: -6px 0 12px; font-size: 12px">Логин и пароль ты задаёшь сам(а).</div>
      <form id="joinForm" class="grid" style="gap: 14px" data-code="${escapeHTML(code)}">
        <div>
          <div class="label" style="margin-bottom: 6px">Имя</div>
          <input class="input" name="name" required disabled />
        </div>
        <div>
          <div class="label" style="margin-bottom: 6px">Логин</div>
          <input class="input" name="login" required autocomplete="username" disabled />
        </div>
        <div>
          <div class="label" style="margin-bottom: 6px">Пароль</div>
          <div class="pw-wrap">
            <input class="input pw-input" name="password" type="password" required autocomplete="new-password" disabled />
            <button type="button" class="pw-toggle" data-action="toggle-password" aria-label="Показать пароль" title="Показать/скрыть">👁</button>
          </div>
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
            <div class="textMuted" style="font-size: 12px; font-weight: 900; letter-spacing: .18em">✦ Путь героя ✦</div>
            <div style="margin-top: 6px; font-size: 22px; font-weight: 900">${escapeHTML(ruDateLabel(today))}</div>
            <div class="textMuted" style="margin-top: 8px; font-size: 12px" id="pathStats">Загрузка статистики…</div>
          </div>
          <div class="pill textMuted" style="font-size: 12px">${ROLE_META[me.role]?.emoji || '✦'} <span style="color: var(--text); font-weight: 900">${escapeHTML(me.name)}</span></div>
        </div>

        <form id="todayForm" class="grid" style="margin-top: 14px">
          <div class="soft" style="padding: 12px; background: var(--victory)">
            <div style="font-size: 12px; font-weight: 900; letter-spacing:.16em">⚔️ VICTORIA</div>
            <div class="ai-wrap" style="margin-top: 10px;">
              <textarea id="todayVictory" class="textarea ai-textarea" name="victory" placeholder="Что ты ${me.role === 'amazon' ? 'сделала' : 'сделал'} сейчас, несмотря на страх?"></textarea>
              <button type="button" class="ai-btn" data-action="ai-rewrite" data-target="todayVictory" data-field="victory" title="Переписать с ИИ" aria-label="Переписать с ИИ">✦</button>
            </div>
          </div>

          <div class="soft" style="padding: 12px; background: var(--lesson)">
            <div style="font-size: 12px; font-weight: 900; letter-spacing:.16em">🦉 LECTIO</div>
            <div class="ai-wrap" style="margin-top: 10px;">
              <textarea id="todayLesson" class="textarea ai-textarea" name="lesson" placeholder="Какой урок ты забираешь прямо сейчас?"></textarea>
              <button type="button" class="ai-btn" data-action="ai-rewrite" data-target="todayLesson" data-field="lesson" title="Переписать с ИИ" aria-label="Переписать с ИИ">✦</button>
            </div>
          </div>

          <div class="rowBetween">
            <div class="textMuted" style="font-size: 12px" id="todayHint"></div>
            <button class="btn" type="submit">✓ Зафиксировать шаг</button>
          </div>
        </form>
      </div>

      <div style="margin-top: 18px;">
        <div id="liveBar" class="hidden" style="position: sticky; top: 62px; z-index: 30; margin-bottom: 10px;">
          <div class="soft" style="padding: 10px 12px; display:flex; align-items:center; justify-content: space-between; gap: 10px; background: color-mix(in srgb, var(--accent) 10%, transparent); border-color: color-mix(in srgb, var(--accent) 40%, var(--border));">
            <div style="font-weight: 800">Новые шаги <span id="liveCount" class="textMuted" style="font-weight:700"></span></div>
            <div class="row" style="gap: 8px">
              <button type="button" class="btn-ghost" style="padding: 10px 12px" data-action="live-dismiss">Скрыть</button>
              <button type="button" class="btn" style="padding: 10px 14px" data-action="live-refresh">Обновить</button>
            </div>
          </div>
        </div>

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
  const t = themeById(me.theme);

  return `
    ${AppHeader()}
    ${Sidebar()}
    <main class="container" style="padding: 18px 0 28px">
      <div class="card" style="padding: 18px">
        <div>
          <div style="font-size: 26px; font-weight: 900">Настройки</div>
          <div class="textMuted" style="margin-top: 4px">Optiōnēs</div>
        </div>

        <div class="soft" style="padding: 14px; margin-top: 14px">
          <div style="font-weight: 900">Установить как приложение</div>
          <div class="textMuted" style="margin-top: 6px; font-size: 12px; line-height: 1.45">
            На Android/desktop появится кнопка установки. На iPhone/iPad: Safari → «Поделиться» → «На экран Домой».
          </div>
          <div class="row" style="margin-top: 10px; flex-wrap: wrap">
            <button type="button" class="btn" data-action="pwa-install" id="pwaInstallBtn" disabled>Установить</button>
            <span class="pill textMuted" id="pwaStatus" style="font-size: 12px">проверяю…</span>
          </div>
        </div>

        <div class="soft" style="padding: 14px; margin-top: 14px">
          <div style="font-weight: 900">Уведомления</div>

          <div class="row" style="margin-top: 10px; flex-wrap: wrap">
            <button type="button" class="btn" data-action="notif-enable" id="notifBtn">Разрешить уведомления</button>
            <span class="pill textMuted" id="notifStatus" style="font-size: 12px">проверяю…</span>
          </div>

          <div class="row" style="margin-top: 10px; flex-wrap: wrap">
            <button type="button" class="btn" data-action="push-enable" id="pushBtn">Включить push</button>
            <button type="button" class="btn-ghost hidden" data-action="push-disable" id="pushOffBtn">Выключить</button>
            <span class="pill textMuted" id="pushStatus" style="font-size: 12px">проверяю…</span>
          </div>

          <div class="row" style="margin-top: 10px; flex-wrap: wrap">
            <button type="button" class="btn-ghost" data-action="sound-toggle" id="soundBtn">Звук</button>
            <span class="pill textMuted" id="soundStatus" style="font-size: 12px">проверяю…</span>
          </div>
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
            <div style="font-size: 14px; font-weight: 900; margin-bottom: 10px">Выбери свой путь</div>
            <input type="hidden" name="role" value="${escapeHTML(me.role)}" />
            <div id="settingsRoleBlock">${RolePicker({ value: me.role, onPickAction: 'pick-role-settings' })}</div>
          </div>

          <div class="divider"></div>

          <div>
            <input type="hidden" name="theme" value="${escapeHTML(me.theme)}" />
            <div id="settingsThemeBlock">${ThemeGrid({ role: me.role, value: me.theme, onPickAction: 'pick-theme-settings', idsPrefix:'set-' })}</div>
            <div class="textMuted" style="margin-top: 10px; font-size: 12px">
              Выбрано: <span id="settingsThemeLabel" style="color: var(--text); font-weight: 900">${t.emoji} ${escapeHTML(t.ru)}</span>
              <span aria-hidden="true"> · </span>
              можно менять в любой момент
            </div>
          </div>

          <div class="row" style="flex-wrap: wrap">
            <button class="btn" type="submit">Сохранить</button>
            <button class="btn-ghost" type="button" data-action="go-path">Назад</button>
            <button class="btn-ghost" type="button" data-action="export-json">Экспорт</button>
            <button class="btn-ghost" type="button" data-action="import-json">Импорт</button>
            <input id="importFile" type="file" accept="application/json" style="display:none" />
          </div>
          <div class="textMuted" style="font-size: 12px; line-height: 1.5">
            Импорт доступен администратору. Данные будут добавлены/обновлены внутри текущей команды.
          </div>
          <div class="divider" style="margin: 10px 0"></div>
          <button type="button" class="btn-danger" data-action="account-delete" style="padding: 10px 14px; border-radius: 12px">Удалить аккаунт</button>
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

  // Update document title on every SPA navigation (no full reload needed).
  setDocumentTitle(route);

  // Cleanup path-only observers when leaving /path.
  // Prevents observing a removed sentinel node and reduces background work.
  if (route !== '/path' && hydrateFeed._io) {
    try { hydrateFeed._io.disconnect(); } catch {}
    hydrateFeed._io = null;
  }

  // Background animations: only run when on-screen and in focus.
  try { ensureStarsLayer(); } catch {}

  // Live updates: run while authed. Feed auto-refresh happens only on /path.
  if (APP.state.user) liveStart();
  else liveStop();

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

  if (route === '/settings' && APP.state.user) {
    // ensure installability/notifications UI reflects current browser state
    setTimeout(()=>{ try { updatePwaUI(); } catch {} }, 0);
    setTimeout(()=>{ try { updateNotifUI(); } catch {} }, 0);
    setTimeout(()=>{ try { updatePushUI(); } catch {} }, 0);
    setTimeout(()=>{ try { updateSoundUI(); } catch {} }, 0);
    // best-effort: keep push alive without manual toggling
    setTimeout(()=>{ try { pushAutoMaintain(); } catch {} }, 0);
  }

  if ((route === '/' || route === '/login' || route === '/register' || route === '/join') && !APP.state.user) {
    // fire and forget
    hydrateHealth();
  }

  if (route === '/join' && !APP.state.user) await hydrateJoin();
  if (route === '/path' && APP.state.user) {
    // Do NOT clear unread just because we navigated to /path.
    // Clear happens when the user is actually viewing the feed (near top) or when the tab becomes visible.

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

    // Keep app badge/title in sync when user returns to the tab.
    document.addEventListener('visibilitychange', ()=>{
      try {
        // When the app becomes visible, clear old system notifications (messenger-like).
        if (!document.hidden && APP.state.user) {
          try {
            navigator.serviceWorker?.controller?.postMessage?.({ type: 'clear-notifications' });
            navigator.serviceWorker?.getRegistration?.().then((reg)=>{
              try { reg?.active?.postMessage?.({ type: 'clear-notifications' }); } catch {}
            }).catch(()=>{});
          } catch {}

          // Only mark as read when user is on /path AND near the top (they are actually looking at the feed).
          if (APP.state.route?.path === '/path') {
            const nearTop = (window.scrollY || document.documentElement.scrollTop || 0) < 220;
            if (nearTop) {
              APP.state.live.unread = 0;
              updateAttentionIndicators();
              liveBarHide();
            }
          }
        }
      } catch {}
    });

    // Auto-apply new steps when user scrolls back to the top AND the app is in focus.
    window.addEventListener('scroll', ()=>{
      try {
        if (!APP.state.user) return;
        if (APP.state.route?.path !== '/path') return;
        if (!APP.state.live.unread) return;
        const nearTop = (window.scrollY || document.documentElement.scrollTop || 0) < 220;
        if (!nearTop) return;

        const inFocus = (!document.hidden) && (typeof document.hasFocus !== 'function' || document.hasFocus());
        if (!inFocus) return;

        clearTimeout(bindHandlers._scrollT);
        bindHandlers._scrollT = setTimeout(()=>{
          liveApplyIfNeeded({ force: true });
        }, 120);
      } catch {}
    }, { passive: true });

    document.addEventListener('click', async (e)=>{
      // Best-effort: if VAPID rotated, resubscribe on the next user gesture (no manual steps).
      try {
        if (APP.state.user && readPushDesired() && Notification?.permission === 'granted') {
          const need = readPushNeedsResub();
          if (need) {
            // Use a soft guard to avoid looping.
            if (!pushResubscribeIfNeeded._busy) {
              pushResubscribeIfNeeded._busy = true;
              setTimeout(()=>{ pushResubscribeIfNeeded._busy = false; }, 5000);
              pushResubscribeIfNeeded().catch(()=>{});
            }
          }
        }
      } catch {}

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

      // PWA install
      if (action === 'pwa-install') {
        try {
          const dp = APP.pwa.deferredPrompt;
          if (!dp) {
            toast('Установка недоступна. Открой в Chrome/Edge или используй "На экран Домой" в Safari.');
            updatePwaUI();
            return;
          }
          dp.prompt();
          const choice = await dp.userChoice.catch(()=> null);
          APP.pwa.deferredPrompt = null;
          updatePwaUI();
          if (choice && choice.outcome === 'accepted') toast('Установка началась.');
          else toast('Отменено.');
        } catch {
          toast('Не удалось запустить установку.');
        }
        return;
      }

      // Notifications permission
      if (action === 'notif-enable') {
        try {
          if (typeof Notification === 'undefined') {
            toast('Уведомления не поддерживаются в этом браузере.');
            updateNotifUI();
            return;
          }
          const p = await Notification.requestPermission();
          updateNotifUI();
          if (p === 'granted') {
            toast('Уведомления включены.');
            // small confirmation (best-effort)
            try {
              await notifyNewEntry({ id: 0, date: todayYMD(), user_id: APP.state.user?.id || 0, victory: null, lesson: null, created_at: nowISO() });
            } catch {}
          } else if (p === 'denied') {
            toast('Уведомления запрещены в браузере.');
          } else {
            toast('Уведомления не включены.');
          }
        } catch {
          toast('Не удалось запросить разрешение на уведомления.');
        }
        return;
      }

      // Push (Android/desktop messenger-like notifications)
      if (action === 'push-enable') {
        // Prevent double-click storms (Android can be slow)
        if (APP._pushBusy) return;
        APP._pushBusy = true;
        try {
          toast('Включаю push…');
          await enablePush();
          toast('Push включен.');
        } catch (err) {
          toast(err.message || 'Не удалось включить push.');
        } finally {
          APP._pushBusy = false;
          try { updateNotifUI(); } catch {}
          try { updatePushUI(); } catch {}
        }
        return;
      }

      if (action === 'push-disable') {
        if (APP._pushBusy) return;
        APP._pushBusy = true;
        try {
          await disablePush();
          toast('Push выключен.');
        } catch {
          toast('Не удалось выключить push.');
        } finally {
          APP._pushBusy = false;
          try { updatePushUI(); } catch {}
        }
        return;
      }


      // Sound toggle
      if (action === 'sound-toggle') {
        const next = !readSoundEnabled();
        writeSoundEnabled(next);
        APP.state.sound.enabled = next;
        updateSoundUI();
        toast(next ? 'Звук включен.' : 'Звук выключен.');
        // Try to unlock audio on a user gesture
        if (next) {
          try { playCosmicChime({ quiet: true }); } catch {}
        }
        return;
      }

      // Account delete (self)
      if (action === 'account-delete') {
        if (!confirm('Удалить аккаунт? Это действие необратимо.')) return;
        try {
          await api.profileDelete();
        } catch (err) {
          toast(err.message || 'Не удалось удалить аккаунт.');
          return;
        }
        try { await api.logout(); } catch {}
        APP.state.user = null;
        APP.state.team = null;
        APP.state.teamUsers = [];
        toast('Аккаунт удален.');
        history.replaceState({}, '', '/');
        render();
        return;
      }

      // Team: delete teammate (admin)
      if (action === 'team-user-delete') {
        const id = Number(actionEl.getAttribute('data-id') || '0');
        if (!id) return;
        if (!confirm('Удалить спутника? Его записи тоже будут удалены.')) return;
        try {
          await api.teamDelete(id);
          toast('Удалено.');
          APP.state.teamUsersFetchedAt = 0;
          await hydrateInvite();
        } catch (err) {
          toast(err.message || 'Не удалось удалить спутника.');
        }
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
              'Импорт.\n\n' +
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

      if (action === 'pick-role-settings') {
        const role = actionEl.getAttribute('data-role');
        const f = $('#settingsForm');
        if (!f || !role) return;

        const nextTheme = defaultThemeForRole(role);
        f.querySelector('input[name="role"]').value = role;
        f.querySelector('input[name="theme"]').value = nextTheme;

        setTheme(nextTheme);

        const rb = $('#settingsRoleBlock');
        if (rb) rb.innerHTML = RolePicker({ value: role, onPickAction: 'pick-role-settings' });

        const tb = $('#settingsThemeBlock');
        if (tb) tb.innerHTML = ThemeGrid({ role, value: nextTheme, onPickAction: 'pick-theme-settings', idsPrefix:'set-' });

        const lbl = $('#settingsThemeLabel');
        if (lbl) {
          const t = themeById(nextTheme);
          lbl.textContent = `${t.emoji} ${t.ru}`;
        }
        return;
      }

      if (action === 'pick-theme-settings') {
        const theme = actionEl.getAttribute('data-theme');
        const f = $('#settingsForm');
        if (!f || !theme) return;

        const role = f.querySelector('input[name="role"]')?.value || APP.state.user?.role || 'warrior';
        f.querySelector('input[name="theme"]').value = theme;

        setTheme(theme);

        const tb = $('#settingsThemeBlock');
        if (tb) tb.innerHTML = ThemeGrid({ role, value: theme, onPickAction: 'pick-theme-settings', idsPrefix:'set-' });

        const lbl = $('#settingsThemeLabel');
        if (lbl) {
          const t = themeById(theme);
          lbl.textContent = `${t.emoji} ${t.ru}`;
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

      // Join/register: toggle password visibility
      if (action === 'toggle-password') {
        const wrap = actionEl.closest('.pw-wrap') || document;
        const input = wrap.querySelector('input[name="password"]');
        if (!input) return;
        const next = (input.getAttribute('type') === 'password') ? 'text' : 'password';
        input.setAttribute('type', next);
        const btn = actionEl;
        if (btn) {
          const shown = next === 'text';
          btn.setAttribute('aria-label', shown ? 'Скрыть пароль' : 'Показать пароль');
          btn.textContent = shown ? '🙈' : '👁';
        }
        return;
      }

      // AI rewrite for textareas
      if (action === 'ai-rewrite') {
        const field = actionEl.getAttribute('data-field');
        const targetId = actionEl.getAttribute('data-target');
        const target = targetId ? document.getElementById(targetId) : null;
        if (!target || !('value' in target)) return;

        const text = String(target.value || '').trim();
        if (!text) return toast('Сначала напиши текст.');

        // Find (or create) a small accept/undo bar under the textarea
        const host = target.closest('.ai-wrap') || target.parentElement || target;
        const barId = `${targetId || 'ai'}-aiBar`;
        let bar = host.querySelector(`#${CSS.escape(barId)}`);
        if (!bar) {
          bar = document.createElement('div');
          bar.id = barId;
          bar.className = 'ai-bar hidden';
          bar.innerHTML = `
            <button type="button" class="btn-ghost" style="padding:10px 12px" data-action="ai-undo" data-target="${escapeHTML(targetId || '')}">Вернуть</button>
            <button type="button" class="btn" style="padding:10px 14px" data-action="ai-accept" data-target="${escapeHTML(targetId || '')}">Принять</button>
          `;
          host.appendChild(bar);
        }

        // store original text for undo
        target.dataset.aiOriginal = target.value;

        // lock button
        const btn = actionEl;
        const prev = btn.textContent;
        btn.disabled = true;
        btn.textContent = '…';

        try {
          const r = await api.aiRewrite({ field, text });
          const out = String(r?.text || '').trim();
          if (!out) throw new Error('Пустой ответ ИИ.');

          target.value = out;
          // trigger draft autosave if present
          try { target.dispatchEvent(new Event('input', { bubbles: true })); } catch {}

          bar.classList.remove('hidden');
          toast('ИИ предложил вариант.');
        } catch (err) {
          toast(err.message || 'Ошибка ИИ.');
          // restore original on error
          if (target.dataset.aiOriginal != null) target.value = target.dataset.aiOriginal;
        } finally {
          btn.disabled = false;
          btn.textContent = prev || '✦';
        }
        return;
      }

      // AI accept/undo
      if (action === 'ai-undo' || action === 'ai-accept') {
        const targetId = actionEl.getAttribute('data-target');
        const target = targetId ? document.getElementById(targetId) : null;
        if (!target || !('value' in target)) return;
        const host = target.closest('.ai-wrap') || target.parentElement || target;
        const bar = targetId ? host.querySelector(`#${CSS.escape(targetId + '-aiBar')}`) : null;

        if (action === 'ai-undo') {
          if (target.dataset.aiOriginal != null) {
            target.value = target.dataset.aiOriginal;
            try { target.dispatchEvent(new Event('input', { bubbles: true })); } catch {}
          }
          toast('Возвращено.');
        } else {
          toast('Принято.');
        }

        // cleanup
        delete target.dataset.aiOriginal;
        if (bar) bar.classList.add('hidden');
        return;
      }

      // Live updates bar
      if (action === 'live-refresh') {
        await liveApplyIfNeeded({ force: true });
        return;
      }
      if (action === 'live-dismiss') {
        liveBarHide();
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
        const r = await api.login({ login: fd.get('login'), password: fd.get('password') });
        if (r?.user) {
          // optimistic UI
          APP.state.user = r.user;
          APP.state.teamUsersFetchedAt = 0;
          if (APP.state.user?.theme) setTheme(APP.state.user.theme);

          // hard sync (prevents rare mismatches in role/theme/team after auth transitions)
          try {
            const m = await api.me();
            APP.state.user = m.user;
            APP.state.team = m.team;
            if (APP.state.user?.theme) setTheme(APP.state.user.theme);

            const t = await api.team();
            if (Array.isArray(t?.users)) {
              APP.state.teamUsers = t.users;
              APP.state.teamUsersFetchedAt = Date.now();
            }
          } catch {}
        }
        toast('Вход выполнен.');
        history.replaceState({}, '', '/path');
        render();
        // best-effort: keep push alive if user enabled it before
        try { pushAutoMaintain(); } catch {}
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
        const r = await api.register({
          email: fd.get('email'),
          name: fd.get('name'),
          login: fd.get('login'),
          password: fd.get('password'),
          role: fd.get('role'),
          theme: fd.get('theme'),
        });
        if (r?.user) {
          // optimistic UI
          APP.state.user = r.user;
          APP.state.teamUsersFetchedAt = 0;
          if (APP.state.user?.theme) setTheme(APP.state.user.theme);

          // hard sync
          try {
            const m = await api.me();
            APP.state.user = m.user;
            APP.state.team = m.team;
            if (APP.state.user?.theme) setTheme(APP.state.user.theme);

            const t = await api.team();
            if (Array.isArray(t?.users)) {
              APP.state.teamUsers = t.users;
              APP.state.teamUsersFetchedAt = Date.now();
            }
          } catch {}
        }
        toast('Команда создана. Путь начался.');
        history.replaceState({}, '', '/path');
        render();
        try { pushAutoMaintain(); } catch {}
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
        const r = await api.join(code, {
          name: fd.get('name'),
          login: fd.get('login'),
          password: fd.get('password'),
          role: fd.get('role'),
          theme: fd.get('theme'),
        });
        if (r?.user) {
          // optimistic UI
          APP.state.user = r.user;
          APP.state.teamUsersFetchedAt = 0;
          if (APP.state.user?.theme) setTheme(APP.state.user.theme);

          // hard sync
          try {
            const m = await api.me();
            APP.state.user = m.user;
            APP.state.team = m.team;
            if (APP.state.user?.theme) setTheme(APP.state.user.theme);

            const t = await api.team();
            if (Array.isArray(t?.users)) {
              APP.state.teamUsers = t.users;
              APP.state.teamUsersFetchedAt = Date.now();
            }
          } catch {}
        }
        toast('Добро пожаловать на путь.');
        history.replaceState({}, '', '/path');
        render();
        try { pushAutoMaintain(); } catch {}
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
        const r = await api.settingsUpdate({
          name: fd.get('name'),
          role: fd.get('role'),
          theme: fd.get('theme'),
          password: pass,
        });

        if (r?.user) {
          APP.state.user = r.user;
          if (APP.state.user?.theme) setTheme(APP.state.user.theme);
        }

        // hard sync (prevents edge cases where role/theme UI gets out of sync)
        try {
          const m = await api.me();
          APP.state.user = m.user;
          APP.state.team = m.team;
          if (APP.state.user?.theme) setTheme(APP.state.user.theme);

          const t = await api.team();
          if (Array.isArray(t?.users)) {
            APP.state.teamUsers = t.users;
            APP.state.teamUsersFetchedAt = Date.now();
          }
        } catch {}

        // refresh team cache (role/theme icon may change)
        APP.state.teamUsersFetchedAt = 0;
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
      el.innerHTML = `связь: <span style="color: var(--text); font-weight: 900">ok</span>`;
      return;
    }
    el.innerHTML = `связь: <span style="color: var(--danger); font-weight: 900">offline</span>`;
  } catch {
    el.innerHTML = `связь: <span style="color: var(--danger); font-weight: 900">offline</span>`;
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
    bits.push(`Шагов сегодня: <span style="color: var(--text); font-weight: 900">${Number(s.userTodaySteps || 0)}</span>`);
    bits.push(`Спутников сегодня: <span style="color: var(--text); font-weight: 900">${Number(s.teamToday || 0)}</span>`);
    bits.push(`Шагов в команде сегодня: <span style="color: var(--text); font-weight: 900">${Number(s.teamTodaySteps || 0)}</span>`);
    bits.push(`Всего шагов в команде: <span style="color: var(--text); font-weight: 900">${Number(s.teamTotal || 0)}</span>`);
    el.innerHTML = bits.join(' · ');
  } catch {
    el.textContent = '';
  }
}

async function hydrateTodayForm(){
  const form = $('#todayForm');
  if (!form) return;
  const hint = $('#todayHint');

  // Infinite path: draft is per-user (not per-day), because you can write many times a day.
  const draftKey = ()=>{
    const uid = APP.state.user?.id;
    if (!uid) return null;
    return `pariter_draft_${uid}`;
  };
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

  // restore draft into empty form
  const d = readDraft();
  const vEl = form.querySelector('textarea[name="victory"]');
  const lEl = form.querySelector('textarea[name="lesson"]');
  if (vEl && !vEl.value) vEl.value = d?.victory || '';
  if (lEl && !lEl.value) lEl.value = d?.lesson || '';
  if (hint) hint.textContent = d ? 'Черновик восстановлен.' : '';

  // draft autosave (debounced)
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

        // creates a new entry every time
        await api.entryCreate({ victory, lesson });
        clearDraft();

        // reset form for the next step
        try { vEl.value = ''; lEl.value = ''; } catch {}

        toast('Зафиксировано.');
        await hydratePathStats();
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
  // Taskbar/app badge (Chrome/Edge, Android, some desktop PWAs)
  try {
    if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
      // @ts-ignore
      if (n > 0) navigator.setAppBadge(Math.min(n, 99));
      // @ts-ignore
      else navigator.clearAppBadge();
    }
  } catch {}
  // Title prefix
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

    // Do not spam when user is actively reading the app.
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

    // Aggregation hint: if we got a batch, show “and more”.
    const extra = Math.max(0, Number(entry._extraCount || 0));
    if (extra > 0) {
      body = body
        ? `${body} (и еще ${extra})`
        : `Новых шагов: ${extra + 1}`;
    }

    // If server push is enabled, do not duplicate OS notifications from the in-page code.
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

    // Prefer showing notification through Service Worker for better OS integration.
    try {
      const reg = await navigator.serviceWorker?.getRegistration?.();
      if (reg && reg.showNotification) {
        await reg.showNotification(title, opts);
        return;
      }
    } catch {}

    try {
      // Fallback: in-page notification
      // @ts-ignore
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
    // User is effectively "caught up".
    APP.state.live.unread = 0;
    updateAttentionIndicators();

    liveBarHide();
    // Full refresh to keep things simple and consistent.
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
    // Prime baseline if missing: latest entry in team feed.
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

    // Advance our baseline to the newest known entry (so next tick is incremental).
    APP.state.live.topKey = newKey;

    const route = APP.state.route?.path;
    const nearTop = (window.scrollY || document.documentElement.scrollTop || 0) < 220;

    // Auto-apply only when the app is actually in focus.
    // If the tab/PWA is in background (document.hidden), we must NOT silently refresh,
    // otherwise the user will miss notifications while the app sits open on /path.
    const inFocus = (!document.hidden) && (typeof document.hasFocus !== 'function' || document.hasFocus());

    if (route === '/path' && nearTop && inFocus) {
      // user is looking at the top and is actively using the app - auto-refresh
      APP.state.live.unread = 0;
      updateAttentionIndicators();
      await liveApplyIfNeeded({ force: true });
      return;
    }

    // user is not at the top (or not on /path): accumulate unread precisely
    APP.state.live.unread = Math.min(99, Number(APP.state.live.unread || 0) + Math.min(99, count));
    updateAttentionIndicators();
    if (route === '/path') liveBarShow();

    // Notifications: one per newKey (aggregated)
    if (APP.state.live.lastNotifiedKey !== newKey) {
      APP.state.live.lastNotifiedKey = newKey;
      // If push is enabled, OS notification will be shown by Service Worker.
      // In-page notifications would duplicate it.
      if (!(readPushDesired && readPushDesired())) {
        await notifyNewEntry({ ...newest, _extraCount: Math.max(0, count - 1) });
      }
      // Soft cosmic sound (messenger-like: only when app is NOT in focus)
      try { playCosmicChime(); } catch {}
    }

  } catch {
    // ignore network errors in live mode
  }
}

function liveStart(){
  if (liveStart._timer) return;
  // prime baseline in background
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
    // re-prime live top key on next load
    APP.state.live.topKey = null;
    liveBarHide();
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
      status.textContent = APP.state.feed.renderedCount ? 'Здесь начался путь.' : 'Пока нет записей. Начни шаг сейчас.';
      const moreBtn = $('#feedMore');
      if (moreBtn) moreBtn.classList.add('hidden');
      return;
    }

    // prime live baseline (latest entry in team feed)
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

  const meIsAdmin = Number(me?.is_admin || 0) === 1;
  teamList.innerHTML = users.map(u => {
    const joined = new Intl.DateTimeFormat('ru-RU', { year:'numeric', month:'short', day:'numeric' }).format(new Date(u.created_at));
    const isMe = Number(u.id) === Number(me?.id);
    const canDelete = meIsAdmin && !isMe;
    return `
      <div class="soft" style="padding: 10px 12px; display:flex; align-items:center; justify-content: space-between; gap: 10px">
        <div class="row" style="min-width:0; gap:10px">
          <div style="width:36px;height:36px;border-radius:999px;border:1px solid var(--border);display:grid;place-items:center;background:rgba(255,255,255,.03)">${ROLE_META[u.role]?.emoji || '✦'}</div>
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

// PWA install hooks (best-effort)
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
  // Push UI depends on notification permission too.
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

// --- Push helpers (Android/desktop messenger-like notifications)
// Important: do NOT rely on navigator.serviceWorker.ready for Push.
// On Android it may not resolve until the SW controls the page.
// PushManager works with the registration returned by register().
async function ensureServiceWorkerForPush(){
  if (ensureServiceWorkerForPush._p) return ensureServiceWorkerForPush._p;

  ensureServiceWorkerForPush._p = (async ()=>{
    if (!('serviceWorker' in navigator)) throw new Error('Service Worker не поддерживается.');

    // Auto-clean old/incorrect registrations (no manual "unregister" needed).
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(async (r)=>{
        try {
          const scopePath = new URL(r.scope).pathname;
          const activeUrl = r.active?.scriptURL ? new URL(r.active.scriptURL).pathname : '';
          const installingUrl = r.installing?.scriptURL ? new URL(r.installing.scriptURL).pathname : '';
          const waitingUrl = r.waiting?.scriptURL ? new URL(r.waiting.scriptURL).pathname : '';
          const anyUrl = activeUrl || waitingUrl || installingUrl;

          // We want only /sw.js with scope '/'. Remove /static/sw.js and other stray scopes.
          // Keep only a root-scope service worker (/sw.js). Remove any legacy /static scope or wrong script.
          const badScope = scopePath !== '/';
          const badScript = anyUrl && anyUrl !== '/sw.js';
          if (badScope || badScript) {
            // Best-effort: unsubscribe old push subscription to stop duplicate notifications.
            try {
              const sub = await r.pushManager?.getSubscription?.();
              if (sub) await sub.unsubscribe().catch(()=>{});
            } catch {}

            await r.unregister().catch(()=>{});
          }
        } catch {}
      }));
    } catch {}

    // Register root-scope SW.
    let reg = null;
    try {
      reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      try { await reg.update(); } catch {}
    } catch {
      throw new Error('Service worker не зарегистрирован');
    }

    // Important on Android: ensure the registration is activated. ready can hang until SW controls the page.
    // We avoid hanging by waiting for statechange with a timeout.
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
    // allow re-try if we failed
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
      // If a subscription already exists, treat push as enabled (helps after SW migrations/updates).
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

    // Prefer controller
    try { navigator.serviceWorker?.controller?.postMessage?.({ type: 'push-token', token: tok }); } catch {}

    // Also try active reg
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

  // Detect VAPID key rotation and schedule resubscribe if needed.
  const prev = readVapidPublicKey();
  if (prev && prev !== publicKey) {
    writePushNeedsResub(publicKey);
  }

  // Subscribe (idempotent-ish)
  let sub = await reg.pushManager.getSubscription();

  // If server VAPID key changed, rotate subscription on a user gesture (this function is called from a click).
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

  // Persist token for background resubscribe (pushsubscriptionchange)
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
    // also clear token from SW storage
    sendPushTokenToSW('');
  } catch {}
  try { await updatePushUI(); } catch {}
}

// Resubscribe when VAPID key rotates (runs on user gesture, so no manual "unregister" needed).
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

// Best-effort: keep push alive without manual re-enable.
// - If user once enabled push (pushDesired=1), we try to (re)subscribe automatically when possible.
// - Also "ping" server with existing subscription to refresh last_seen_at.
async function pushAutoMaintain(){
  try {
    if (!APP.state.user) return;
    if (!readPushDesired()) return;
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    if (typeof PushManager === 'undefined') return;
    if (!(window.isSecureContext || location.hostname === 'localhost')) return;

    // throttle
    const now = Date.now();
    if (pushAutoMaintain._last && (now - pushAutoMaintain._last < 30_000)) return;
    pushAutoMaintain._last = now;

    const reg = await ensureServiceWorkerForPush();
    let sub = await reg.pushManager.getSubscription();

    const { publicKey } = await api.pushVapidKey().catch(()=> ({ publicKey: '' }));
    if (!publicKey) return;

    // If server VAPID key rotated, mark that we need resubscribe.
    const prev = readVapidPublicKey();
    if (prev && prev !== publicKey) {
      writePushNeedsResub(publicKey);
    }

    // We do NOT unsubscribe/resubscribe automatically here to avoid breaking push in browsers
    // that require a user gesture for subscribe(). The actual rotation happens on the next
    // user gesture (any click) via pushResubscribeIfNeeded().

    if (!sub) {
      // Auto re-subscribe (permission already granted) - usually allowed without gesture.
      try {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: b64urlToU8(publicKey),
        });
        writeVapidPublicKey(publicKey);
        writePushNeedsResub('');
      } catch {
        // Can't subscribe silently. Wait for a user gesture.
        writePushNeedsResub(publicKey);
        return;
      }
    }

    // Refresh server record (upsert). Pass a persistent token so endpoint rotation can be bound to the same device.
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

// --- Sound (gentle cosmic chime)
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

  // Messenger-like behavior: play only when the app is NOT in focus.
  // When the app is focused, we stay silent.
  // Note: some browsers may restrict audio in background tabs.
  if (!quiet) {
    try {
      const inFocus = !document.hidden && (typeof document.hasFocus !== 'function' || document.hasFocus());
      if (inFocus) return;
    } catch {}
  }

  // WebAudio synth: short "cosmic" bell (two detuned sines + soft noise)
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  const ctx = playCosmicChime._ctx || (playCosmicChime._ctx = new Ctx());

  // Some browsers require resume on user gesture.
  if (ctx.state === 'suspended') {
    // best-effort
    ctx.resume().catch(()=>{});
  }

  const t0 = ctx.currentTime + 0.01;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, t0);
  out.gain.exponentialRampToValueAtTime(quiet ? 0.06 : 0.12, t0 + 0.02);
  out.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
  out.connect(ctx.destination);

  // Main tone
  const o1 = ctx.createOscillator();
  o1.type = 'sine';
  o1.frequency.setValueAtTime(660, t0);
  o1.frequency.exponentialRampToValueAtTime(520, t0 + 0.35);

  const o2 = ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.setValueAtTime(660 * 1.008, t0);
  o2.frequency.exponentialRampToValueAtTime(520 * 1.01, t0 + 0.35);

  // Gentle filter
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

  // Tiny noise shimmer
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

  // Slight reverb-ish feel via short delay
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

// restore sound setting early
try { APP.state.sound.enabled = readSoundEnabled(); } catch {}


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
  // Restore sound state early
  try { APP.state.sound.enabled = readSoundEnabled(); } catch {}

  // Stars + landing canvas: start only when visible to save battery.
  try { ensureStarsLayer(); } catch {}

  // Best-effort: ensure root-scope Service Worker is registered early (needed for Push on Android).
  try {
    const reg = await ensureServiceWorkerForPush();

    // If a PushSubscription already exists, treat push as enabled.
    // This prevents duplicate OS notifications (SW + in-page) if localStorage flag was lost.
    try {
      const sub = await reg.pushManager.getSubscription();
      if (sub) writePushDesired(true);
    } catch {}

    // Send stored token to SW so pushsubscriptionchange can resubscribe without cookies.
    try {
      const tok = readPushToken();
      if (tok) sendPushTokenToSW(tok);
    } catch {}
  } catch {}

  // If a push arrives while the app is open, the SW can postMessage to update UI faster.
  try {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (ev)=>{
        try {
          if (!ev?.data || typeof ev.data !== 'object') return;
          if (ev.data.type !== 'push') return;
          // Nudge live refresh quickly (do not block)
          if (APP.state.user && APP.state.route?.path === '/path') {
            // mark unread and refresh attention indicators
            APP.state.live.unread = Math.min(99, Number(APP.state.live.unread || 0) + 1);
            updateAttentionIndicators();
            liveBarShow();
          }
        } catch {}
      });
    }
  } catch {}

  await render();

  // After initial render, try to keep push subscription alive (if user enabled it before)
  try { pushAutoMaintain(); } catch {}

  // Keep-alive while the app is open (best-effort). Helps recover after short inactivity.
  setInterval(()=>{ try { pushAutoMaintain(); } catch {} }, 90_000);

  // Also keep live polling going for badge updates even if user stays off /path.
  // (push should work in background; this is just an extra safety net while the app is open)
  setInterval(()=>{ try { liveTick(); } catch {} }, 30_000);
})();
