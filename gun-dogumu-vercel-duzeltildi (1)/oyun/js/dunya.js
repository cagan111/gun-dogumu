'use strict';
// =============================================================
//  DÜNYA — biyomlar, dünya üretimi (tohumlu), zaman, ışık, hava
// =============================================================
// biyom kodları: 0 orman, 1 dağ, 2 bataklık, 3 sisli vadi
const BIOME_AD = ['Orman', 'Dağlar', 'Bataklık', 'Sisli Vadi'];

function biomeAt(x, y) {
  for (const k of [3, 1, 2]) for (const b of G.blobs) {
    if (b.k !== k) continue;
    const a = Math.atan2(y - b.y, x - b.x), d = Math.hypot(x - b.x, y - b.y);
    if (d < b.r * (1 + 0.18 * Math.sin(a * 3 + b.p) + 0.08 * Math.sin(a * 7 + b.q))) return k;
  }
  return 0;
}
function biomeFast(x, y) {
  const i = clamp(Math.floor(x / MAPC), 0, MAPN - 1), j = clamp(Math.floor(y / MAPC), 0, MAPN - 1);
  return G.bmap[j * MAPN + i];
}

function genWorld(seed) {
  const S = mulberry32(seed);
  const sr = (a, b) => a + S() * (b - a), sri = (a, b) => Math.floor(sr(a, b + 1)), spick = a => a[Math.floor(S() * a.length)];
  const sg = () => (S() + S() + S() - 1.5) / 1.5;
  grid = new Map();
  Object.assign(G, { ccamps: [], trees: [], rocks: [], crystals: [], bushes: [], herbs: [], poisons: [], nests: [], lakes: [], pools: [], deco: [], blobs: [] });
  const nearCamp = (x, y, m) => Math.hypot(x - CAMP.x, y - CAMP.y) < m;
  const inW = (x, y, m = 80) => x > m && y > m && x < WORLD - m && y < WORLD - m;
  const polar = (a, r) => ({ x: clamp(CAMP.x + Math.cos(a) * r, 400, WORLD - 400), y: clamp(CAMP.y + Math.sin(a) * r, 400, WORLD - 400) });

  // ---- biyom lekeleri: yarık yönünde sisli vadi + dağ
  const riftA = sr(0, TAU);
  const rp = polar(riftA, 2700);
  G.rift = { x: rp.x, y: rp.y, r: 50, found: false };
  const sp = polar(riftA, 2050);
  G.blobs.push({ k: 3, x: sp.x, y: sp.y, r: 620, p: sr(0, 9), q: sr(0, 9) });
  G.blobs.push({ k: 1, x: rp.x, y: rp.y, r: 650, p: sr(0, 9), q: sr(0, 9) });
  for (let i = 0; i < 3; i++) { const a = riftA + sr(1.2, 5.1), p = polar(a, sr(1500, 2500)); G.blobs.push({ k: 1, x: p.x, y: p.y, r: sr(520, 760), p: sr(0, 9), q: sr(0, 9) }); }
  for (let i = 0; i < 2; i++) { const a = riftA + sr(1.0, 5.3), p = polar(a, sr(1150, 2100)); G.blobs.push({ k: 2, x: p.x, y: p.y, r: sr(500, 700), p: sr(0, 9), q: sr(0, 9) }); }
  // biyom haritası
  G.bmap = new Uint8Array(MAPN * MAPN);
  for (let j = 0; j < MAPN; j++) for (let i = 0; i < MAPN; i++) G.bmap[j * MAPN + i] = biomeAt((i + 0.5) * MAPC, (j + 0.5) * MAPC);
  const B = (x, y) => biomeFast(x, y);

  // ---- göller (katı) ve bataklık havuzları (sığ)
  for (let i = 0; i < 8; i++) {
    let x, y, r, k = 0;
    do { x = sr(300, WORLD - 300); y = sr(300, WORLD - 300); r = sr(110, 230); } while ((nearCamp(x, y, r + 550) || B(x, y) !== 0 || Math.hypot(x - G.rift.x, y - G.rift.y) < 500) && k++ < 80);
    if (k >= 80) continue;
    const o = { x, y, r, kind: 'lake' }; G.lakes.push(o); gAdd(o);
  }
  // ---- yamyam kampları
  for (let k = 0; k < 80 && G.ccamps.length < 3; k++) {
    const p = polar(sr(0, TAU), sr(1700, 2600));
    if (B(p.x, p.y) === 1 || Math.hypot(p.x - G.rift.x, p.y - G.rift.y) < 800 || G.ccamps.some(c => Math.hypot(c.x - p.x, c.y - p.y) < 1400)) continue;
    if (G.lakes.some(l => Math.hypot(l.x - p.x, l.y - p.y) < l.r + 200)) continue;
    G.ccamps.push({ x: p.x, y: p.y, r: 90, totem: 250, alive: true, found: false, captives: [], spawned: false, i: G.ccamps.length,
      huts: [0, 1, 2].map(i => { const a = i / 3 * TAU + sr(-0.3, 0.3); return [Math.cos(a) * sr(55, 75), Math.sin(a) * sr(55, 75)]; }) });
  }
  const free = (x, y, m) => inW(x, y) && !G.lakes.some(l => Math.hypot(l.x - x, l.y - y) < l.r + m) && Math.hypot(x - G.rift.x, y - G.rift.y) > 120 && !G.ccamps.some(c => Math.hypot(c.x - x, c.y - y) < 150);
  for (const b of G.blobs) if (b.k === 2) for (let i = 0; i < 9; i++) {
    const a = sr(0, TAU), rr = sr(0, b.r * 0.8), x = b.x + Math.cos(a) * rr, y = b.y + Math.sin(a) * rr;
    if (!free(x, y, 60) || G.pools.some(p => Math.hypot(p.x - x, p.y - y) < 160)) continue;
    G.pools.push({ x, y, r: sr(45, 90), croc: null });
  }
  const inPool = (x, y, m) => G.pools.some(p => Math.hypot(p.x - x, p.y - y) < p.r + m);

  // ---- ağaçlar
  function addTree(x, y) {
    if (!free(x, y, 30) || nearCamp(x, y, 250) || inPool(x, y, 15)) return;
    const b = B(x, y);
    if (b === 1 && S() < 0.75) return;
    if (gQuery(x, y, 40).some(o => (o.kind === 'tree' || o.kind === 'rock' || o.kind === 'crystal') && Math.hypot(o.x - x, o.y - y) < 40)) return;
    const t = { x, y, r: 13, kind: 'tree', res: 'wood', amt: 18, cr: sr(36, 62), tone: S(), sw: sr(0, TAU), b, i: G.trees.length };
    G.trees.push(t); gAdd(t);
  }
  for (let c = 0; c < 80; c++) { const cx = sr(0, WORLD), cy = sr(0, WORLD), n = sri(12, 30); for (let i = 0; i < n; i++) { const a = sr(0, TAU), rr = Math.abs(sg()) * 280; addTree(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } }
  for (let i = 0; i < 500; i++) addTree(sr(0, WORLD), sr(0, WORLD));
  for (let i = 0; i < 20; i++) { const a = sr(0, TAU), r = sr(270, 560); addTree(CAMP.x + Math.cos(a) * r, CAMP.y + Math.sin(a) * r); }

  // ---- kayalar (dağda yoğun) ve kristaller
  function addRock(x, y) {
    if (!free(x, y, 30) || nearCamp(x, y, 220) || inPool(x, y, 20)) return;
    if (gQuery(x, y, 50).some(o => (o.kind === 'tree' || o.kind === 'rock' || o.kind === 'crystal') && Math.hypot(o.x - x, o.y - y) < 46)) return;
    const r = sr(16, 30), v = [], n = sri(6, 9);
    for (let i = 0; i < n; i++) { const a = i / n * TAU; v.push([Math.cos(a) * r * sr(0.75, 1.15), Math.sin(a) * r * sr(0.75, 1.15)]); }
    const o = { x, y, r, kind: 'rock', res: 'stone', amt: 14, v, shade: sr(0.85, 1.15), i: G.rocks.length }; G.rocks.push(o); gAdd(o);
  }
  for (let c = 0; c < 80; c++) { const cx = sr(0, WORLD), cy = sr(0, WORLD), n = sri(1, 4); for (let i = 0; i < n; i++) addRock(cx + sr(-70, 70), cy + sr(-70, 70)); }
  for (const b of G.blobs) if (b.k === 1) for (let i = 0; i < 90; i++) { const a = sr(0, TAU), rr = sr(0, b.r), x = b.x + Math.cos(a) * rr, y = b.y + Math.sin(a) * rr; if (B(x, y) === 1) addRock(x, y); }
  for (let i = 0; i < 7; i++) { const a = sr(0, TAU), r = sr(300, 600); addRock(CAMP.x + Math.cos(a) * r, CAMP.y + Math.sin(a) * r); }
  for (const b of G.blobs) if (b.k === 1 || b.k === 3) for (let i = 0; i < (b.k === 1 ? 14 : 10); i++) {
    const a = sr(0, TAU), rr = sr(0, b.r * 0.9), x = b.x + Math.cos(a) * rr, y = b.y + Math.sin(a) * rr;
    if (!free(x, y, 30) || gQuery(x, y, 40).some(o => Math.hypot(o.x - x, o.y - y) < o.r + 22)) continue;
    const o = { x, y, r: 13, kind: 'crystal', res: 'crystal', amt: 4, i: G.crystals.length, hue: sr(180, 220) }; G.crystals.push(o); gAdd(o);
  }

  // ---- çalılar, şifalı otlar, zehirli bitkiler
  function addBush(x, y) {
    if (!free(x, y, 20) || nearCamp(x, y, 160) || inPool(x, y, 10)) return;
    const b = B(x, y); if (b === 1 || b === 3) return;
    G.bushes.push({ x, y, r: 16, res: 'food', amt: 5, max: 5, berries: Array.from({ length: 7 }, () => [sr(-11, 11), sr(-11, 11)]), col: spick(['#b3243a', '#6a2a8a', '#c4382a']) });
  }
  for (let i = 0; i < 380; i++) addBush(sr(0, WORLD), sr(0, WORLD));
  for (let i = 0; i < 12; i++) { const a = sr(0, TAU), r = sr(200, 480); addBush(CAMP.x + Math.cos(a) * r, CAMP.y + Math.sin(a) * r); }
  for (let i = 0; i < 400 && G.herbs.length < 90; i++) {
    const x = sr(0, WORLD), y = sr(0, WORLD), b = B(x, y);
    if ((b === 0 || b === 2) && free(x, y, 15) && !nearCamp(x, y, 300) && !inPool(x, y, 10)) G.herbs.push({ x, y, r: 10, res: 'herb', amt: 3, max: 3 });
  }
  for (let i = 0; i < 6; i++) { const a = sr(0, TAU), r = sr(350, 650), x = CAMP.x + Math.cos(a) * r, y = CAMP.y + Math.sin(a) * r; if (free(x, y, 15)) G.herbs.push({ x, y, r: 10, res: 'herb', amt: 3, max: 3 }); }
  for (const b of G.blobs) if (b.k === 2) for (let i = 0; i < 26; i++) {
    const a = sr(0, TAU), rr = sr(0, b.r), x = b.x + Math.cos(a) * rr, y = b.y + Math.sin(a) * rr;
    if (B(x, y) === 2 && free(x, y, 15) && !inPool(x, y, 8)) G.poisons.push({ x, y, r: 10, res: 'poison', amt: 2, max: 2 });
  }
  // ---- yuvalar (sis ve dağ)
  for (const b of G.blobs) if (b.k === 3 || b.k === 1) for (let i = 0; i < (b.k === 3 ? 4 : 1); i++) {
    const a = sr(0, TAU), rr = sr(100, b.r * 0.8), x = b.x + Math.cos(a) * rr, y = b.y + Math.sin(a) * rr;
    if (free(x, y, 30)) G.nests.push({ x, y, r: 20, eggs: sri(1, 3), found: false });
  }
  // ---- süsleme
  for (let i = 0; i < 1500; i++) {
    const x = sr(0, WORLD), y = sr(0, WORLD), b = B(x, y);
    if (!free(x, y, 5) || nearCamp(x, y, 140)) continue;
    const t = b === 0 ? (S() < 0.85 ? 'fern' : 'bone') : b === 1 ? (S() < 0.6 ? 'pebble' : 'bone') : b === 2 ? 'reed' : (S() < 0.5 ? 'deadtree' : 'bone');
    G.deco.push({ x, y, t, a: sr(0, TAU), s: sr(0.7, 1.3) });
  }
  makeBiomeTint();
}

let biomeTint = null, biomeMini = null;
function makeBiomeTint() {
  biomeTint = document.createElement('canvas'); biomeTint.width = biomeTint.height = MAPN;
  biomeMini = document.createElement('canvas'); biomeMini.width = biomeMini.height = MAPN;
  const g = biomeTint.getContext('2d'), m = biomeMini.getContext('2d');
  const tint = [null, 'rgba(118,108,92,0.75)', 'rgba(52,64,34,0.65)', 'rgba(62,66,78,0.7)'];
  const mini = ['#2c4a24', '#6e675a', '#3d4a2a', '#41454f'];
  for (let j = 0; j < MAPN; j++) for (let i = 0; i < MAPN; i++) {
    const b = G.bmap[j * MAPN + i];
    if (tint[b]) { g.fillStyle = tint[b]; g.fillRect(i, j, 1, 1); }
    m.fillStyle = mini[b]; m.fillRect(i, j, 1, 1);
  }
  m.fillStyle = '#1d3a4c';
  for (const l of G.lakes) { m.beginPath(); m.arc(l.x / MAPC, l.y / MAPC, l.r / MAPC, 0, TAU); m.fill(); }
  m.fillStyle = '#2a3a28';
  for (const p of G.pools) { m.beginPath(); m.arc(p.x / MAPC, p.y / MAPC, p.r / MAPC, 0, TAU); m.fill(); }
}

// =============================================================
//  ZAMAN ve IŞIK
// =============================================================
const phase = () => (G.t % CYCLE) / CYCLE;
function baseDark() {
  const p = phase();
  if (p < 0.47) return 0;
  if (p < 0.6) { const k = (p - 0.47) / 0.13; return 0.95 * k * k * (3 - 2 * k); }
  if (p < 0.9) return 0.95;
  const k = (p - 0.9) / 0.1; return 0.95 * (1 - k * k * (3 - 2 * k));
}
function darkness() {
  let d = baseDark();
  const w = G.weather && G.weather.type;
  if (w === 'yagmur' || w === 'firtina') d = Math.max(d, 0.28);
  if (w === 'sis') d = Math.max(d, 0.2);
  if (G.finale) d = Math.max(d, 0.6);
  if (G.flash > 0) d *= 0.15;
  return d;
}
const isNight = () => baseDark() > 0.55;
const goHome = () => { const p = phase(); return p > 0.46 && p < 0.93; };
const lightMul = () => G.weather && G.weather.type === 'sis' ? 0.65 : G.weather && G.weather.type === 'firtina' ? 0.85 : 1;
function fireR() { return G.fire.fuel <= 0 ? 0 : (90 + G.fire.fuel * 2.6) * lightMul(); }
function lights() {
  const lm = lightMul(), out = [];
  if (G.fire.fuel > 0) out.push({ x: G.fire.x, y: G.fire.y, r: fireR() * (0.96 + Math.sin(G.now * 13) * 0.02 + Math.random() * 0.03), safe: true, warm: 1 });
  for (const b of G.builds) {
    if (b.type === 'mesale' && b.built) out.push({ x: b.x, y: b.y - 20, r: 150 * lm * (0.97 + Math.random() * 0.04), warm: 0.6 });
    if (b.type === 'kule' && b.built) out.push({ x: b.x, y: b.y - 10, r: 220 * lm * (0.97 + Math.random() * 0.03), warm: 0.6 });
  }
  if (L && G.torchOn && L.hp > 0) out.push({ x: L.x, y: L.y, r: 175 * lm * (0.95 + Math.random() * 0.06), warm: 0.7 });
  if (G.rift) out.push({ x: G.rift.x, y: G.rift.y, r: G.finale ? 420 : 240, warm: 0, blue: 1 });
  for (const c of G.ccamps || []) if (c.alive) out.push({ x: c.x, y: c.y, r: 170 * (0.94 + Math.random() * 0.08), warm: 0.9, red: 1 });
  return out;
}
// ---- görüş: dünyayı yalnızca halkının, ışıklarının ve evcil yaratıklarının gördüğü kadar görürsün
function visionSources() {
  const out = [], n = isNight(), wf = G.weather.type === 'sis' ? 0.7 : 1;
  const f = (x, y) => (n ? 0.55 : 1) * wf * (biomeFast(x, y) === 3 ? 0.6 : 1);
  if (L) out.push({ x: L.x, y: L.y, r: (G.mount ? 440 : 380) * f(L.x, L.y), who: L });
  const sb = abilOn('kasif') ? 1.6 : 1;
  for (const p of G.people) { if (p === L || p.inHut || p.grabbed) continue; out.push({ x: p.x, y: p.y, r: (p.group === 'kasif' ? 330 * sb : p.child ? 120 : 220) * f(p.x, p.y), who: p }); }
  for (const d of G.dinos) if (d.tamed) out.push({ x: d.x, y: d.y, r: (d.fly ? 460 : 200) * (n ? 0.7 : 1), who: d });
  for (const b of G.builds) { if (b.type === 'kule' && b.built) out.push({ x: b.x, y: b.y, r: 480 * (n ? 0.75 : 1) }); else if (b.built && !BUILD[b.type].flat) out.push({ x: b.x, y: b.y, r: 110 }); }
  out.push({ x: G.fire.x, y: G.fire.y, r: G.fire.fuel > 0 ? Math.max(fireR() * 1.05, n ? 0 : 260) : 110 });
  for (const b of G.builds) if (b.type === 'mesale' && b.built) out.push({ x: b.x, y: b.y, r: 150 * lightMul() });
  if (G.torchOn && L) out.push({ x: L.x, y: L.y, r: 190 * lightMul() });
  return out;
}
function visible(x, y, m = 0) { if (!G.vis) return true; for (const s of G.vis) { const r = s.r + m; if ((x - s.x) ** 2 + (y - s.y) ** 2 < r * r) return true; } return false; }
function visibleK(x, y, k) { if (!G.vis) return true; for (const s of G.vis) { const r = s.r * k; if ((x - s.x) ** 2 + (y - s.y) ** 2 < r * r) return true; } return false; }
function exploredAt(x, y) { const i = Math.floor(x / MAPC), j = Math.floor(y / MAPC); return i >= 0 && j >= 0 && i < MAPN && j < MAPN && G.explored[j * MAPN + i] === 1; }
function safeZones() {
  const z = [], n = isNight(), lm = lightMul();
  if (G.fire.fuel > 0) z.push({ x: G.fire.x, y: G.fire.y, r: n ? fireR() * 0.88 : Math.max(fireR(), 320) });
  if (n) {
    for (const b of G.builds) { if (b.type === 'mesale' && b.built) z.push({ x: b.x, y: b.y, r: 125 * lm }); if (b.type === 'kule' && b.built) z.push({ x: b.x, y: b.y, r: 180 * lm }); }
    if (G.torchOn && L) z.push({ x: L.x, y: L.y, r: 135 * lm });
  }
  return z;
}
function inSafe(x, y, zones) { for (const s of zones) if ((x - s.x) ** 2 + (y - s.y) ** 2 < s.r * s.r) return s; return null; }
function lightLevel(x, y, LS) {
  if (darkness() < 0.45) return 1;
  let m = 0;
  for (const l of LS) { const d = Math.hypot(x - l.x, y - l.y); m = Math.max(m, clamp((l.r - d) / (l.r * 0.45), 0, 1)); }
  return m;
}

// =============================================================
//  HAVA
// =============================================================
function setWeather(type, t) {
  const old = G.weather.type; G.weather = { type, t };
  if (type === old) return;
  if (type === 'yagmur') msg('Yağmur başladı. Ateş daha hızlı sönecek.', '#9bd', 4);
  if (type === 'firtina') msg('Fırtına! Şimşekler karanlığı yırtıyor...', '#bcf', 5);
  if (type === 'sis') msg('Yoğun bir sis çöktü. Işık zayıfladı.', '#bbc', 5);
  if (type === 'acik' && old !== 'acik') msg('Hava açıldı.', '#ddd', 3);
}
function updWeather(dt) {
  const w = G.weather;
  if (w.t > 0) { w.t -= dt; if (w.t <= 0 && !isNight()) setWeather('acik', 0); }
  if (A.ctx) A.rain.gain.setTargetAtTime(w.type === 'yagmur' ? 0.05 : w.type === 'firtina' ? 0.09 : 0, A.ctx.currentTime, 1.5);
  if (w.type === 'firtina') {
    G.lightT = (G.lightT || 6) - dt;
    if (G.lightT <= 0) {
      G.lightT = rand(5, 14); G.flash = 0.22;
      const v = rand(0.4, 0.9); setTimeout(() => SFX.thunder(v), rand(200, 1400));
      for (const p of G.people) p.fear = Math.min(100, p.fear + 4);
    }
  }
  G.flash = Math.max(0, (G.flash || 0) - dt);
}
