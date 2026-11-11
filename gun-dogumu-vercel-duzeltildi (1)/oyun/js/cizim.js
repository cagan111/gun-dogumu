'use strict';
// =============================================================
//  ÇİZİM — zemin, gölgeler, ışık, varlıklar, efektler, sis, harita
// =============================================================
const cv = $('c'), ctx = cv.getContext('2d');
const dark = document.createElement('canvas'), dctx = dark.getContext('2d');
const fogCv = document.createElement('canvas'), fctx = fogCv.getContext('2d'), memC = document.createElement('canvas');
let VW = innerWidth, VH = innerHeight, DPR = 1;
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  VW = innerWidth; VH = innerHeight;
  cv.width = dark.width = fogCv.width = Math.round(VW * DPR); cv.height = dark.height = fogCv.height = Math.round(VH * DPR);
  cv.style.width = VW + 'px'; cv.style.height = VH + 'px';
}
addEventListener('resize', resize); resize();

// ---- yardımcılar
function shade(hex, k) {
  if (hex[0] !== '#') return hex;
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = v => clamp(Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k), 0, 255);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
function hpBar(x, y, f, w) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 6); ctx.fillStyle = f > 0.5 ? '#7c4' : f > 0.25 ? '#ca3' : '#c33'; ctx.fillRect(x - w / 2, y, w * clamp(f, 0, 1), 4); }
const circle = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
const ell = (x, y, rx, ry, a = 0) => { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), a, 0, TAU); ctx.fill(); };
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function bodyGrad(r, col) {
  const g = ctx.createLinearGradient(0, -r, 0, r);
  g.addColorStop(0, shade(col, -0.45)); g.addColorStop(0.42, shade(col, 0.14)); g.addColorStop(0.58, shade(col, 0.06)); g.addColorStop(1, shade(col, -0.5));
  return g;
}
const OUTLINE = 'rgba(10,6,2,.45)';

// ---- güneş, gölge ve renk tonu
const SUN = { x: 6, y: 5, len: 8, grade: null };
function sunUpdate() {
  const p = phase(), t = clamp(p / 0.5, 0, 1);
  const len = isNight() ? 4 : 5 + 18 * (1 - Math.sin(t * Math.PI));
  SUN.x = -Math.cos(t * Math.PI) * len; SUN.y = len * 0.35 + 3; SUN.len = len;
  SUN.grade = null;
  if (p < 0.1) SUN.grade = `rgba(255,160,120,${0.12 * (1 - p / 0.1)})`;
  else if (p > 0.34 && p < 0.5) SUN.grade = `rgba(255,140,50,${0.16 * Math.min(1, (p - 0.34) / 0.1)})`;
  else if (p > 0.9) SUN.grade = `rgba(255,150,140,${0.1 * ((p - 0.9) / 0.1)})`;
}
const shadowAt = (x, y, rx, ry, a = 0.28) => { ctx.fillStyle = `rgba(0,0,0,${a})`; ell(x + SUN.x, y + SUN.y, rx, ry); };

// ---- doku: zemin
let groundPat = null, detailPat = null;
function makeGround() {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  const R = mulberry32(7);
  g.fillStyle = '#2f4423'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 260; i++) {
    const x = R() * S, y = R() * S, r = 20 + R() * 70, light = R() < 0.5;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      gr.addColorStop(0, light ? 'rgba(80,110,50,.16)' : 'rgba(18,30,12,.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    }
  }
  for (let i = 0; i < 26; i++) { const x = R() * S, y = R() * S; g.fillStyle = 'rgba(92,72,42,.22)'; g.beginPath(); g.ellipse(x, y, 8 + R() * 30, 5 + R() * 16, R() * 3, 0, TAU); g.fill(); }
  const blades = ['#3d5a2c', '#2a4020', '#486a33', '#355028', '#55783a', '#26391c', '#5f7f3e'];
  g.lineCap = 'round';
  for (let i = 0; i < 9000; i++) {
    const x = R() * S, y = R() * S, a = -Math.PI / 2 + (R() - 0.5) * 1.2, l = 2 + R() * 6;
    g.strokeStyle = blades[Math.floor(R() * blades.length)]; g.globalAlpha = 0.5 + R() * 0.5; g.lineWidth = 0.8 + R() * 0.8;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 70; i++) { g.fillStyle = R() < 0.5 ? 'rgba(230,220,140,.6)' : 'rgba(220,160,200,.5)'; g.beginPath(); g.arc(R() * S, R() * S, 1 + R(), 0, TAU); g.fill(); }
  groundPat = ctx.createPattern(c, 'repeat');
  const d = document.createElement('canvas'); d.width = d.height = 331; const h = d.getContext('2d');
  for (let i = 0; i < 40; i++) { const x = R() * 331, y = R() * 331, r = 30 + R() * 60; const gr = h.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, R() < 0.5 ? 'rgba(0,0,0,.12)' : 'rgba(120,140,60,.08)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); h.fillStyle = gr; h.fillRect(x - r, y - r, r * 2, r * 2); }
  detailPat = ctx.createPattern(d, 'repeat');
}
// ---- doku: ağaç tepeleri (önbellekli)
const TREE_PAL = [
  [['#163a14', '#24561e', '#3f7a2c', '#7aa84a'], ['#1a3a1e', '#285a30', '#3f7a40', '#7ab070'], ['#24391a', '#3a5a22', '#58782e', '#9ab05a']],
  null,
  [['#283018', '#3a4622', '#54602e', '#88904a'], ['#24301e', '#34422a', '#4c5a36', '#7a8a5a']],
  [['#1c2224', '#283234', '#3a4648', '#6a7a7c'], ['#20241e', '#2e3428', '#40483a', '#6a7460']],
  [['#2e5a1c', '#4a8a2a', '#64a23a', '#9ac85a'], ['#3a5e1e', '#5a8e30', '#76a640', '#a8c860']],
  [['#2a4a18', '#3e7a26', '#5a9a34', '#8ab84a'], ['#345a1c', '#4a8228', '#62a036', '#94c05a']]
];
const treeCache = new Map();
function treeSprite(b, tone, cr) {
  const pals = TREE_PAL[b] || TREE_PAL[0], pi = Math.floor(tone * pals.length) % pals.length, rb = Math.round(cr / 6) * 6;
  const key = b + '_' + pi + '_' + rb + '_' + (Math.floor(tone * 7) % 3);
  let s = treeCache.get(key); if (s) return s;
  const pal = pals[pi], R = mulberry32(hashStr(key)), S = Math.ceil(rb * 2.5), c = document.createElement('canvas');
  c.width = c.height = S * 2; const g = c.getContext('2d'); g.scale(2, 2);
  const cx = S / 2, cy = S / 2, n = 9 + Math.floor(R() * 5);
  g.fillStyle = pal[0]; g.beginPath(); g.arc(cx, cy, rb * 0.92, 0, TAU); g.fill();
  const blobs = [];
  for (let i = 0; i < n; i++) { const a = R() * TAU, d = R() * rb * 0.55, br = rb * (0.32 + R() * 0.25); blobs.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d, br]); }
  blobs.sort((a, b2) => a[1] - b2[1]);
  for (const [x, y, br] of blobs) {
    const gr = g.createRadialGradient(x - br * 0.35, y - br * 0.4, br * 0.1, x, y, br);
    gr.addColorStop(0, pal[2]); gr.addColorStop(0.55, pal[1]); gr.addColorStop(1, pal[0]);
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, br, 0, TAU); g.fill();
  }
  for (let i = 0; i < 220; i++) {
    const a = R() * TAU, d = Math.sqrt(R()) * rb * 0.9, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
    const up = (y - cy) < -rb * 0.1 && (x - cx) < rb * 0.2;
    g.fillStyle = up && R() < 0.6 ? pal[3] : R() < 0.5 ? pal[2] : pal[0];
    g.globalAlpha = 0.35 + R() * 0.4; g.beginPath(); g.ellipse(x, y, 1.5 + R() * 2.5, 1 + R() * 1.4, R() * 3, 0, TAU); g.fill();
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-atop';
  const rim = g.createRadialGradient(cx - rb * 0.25, cy - rb * 0.3, rb * 0.3, cx, cy, rb * 1.05);
  rim.addColorStop(0, 'rgba(255,255,220,.08)'); rim.addColorStop(0.7, 'rgba(0,0,0,0)'); rim.addColorStop(1, 'rgba(0,0,0,.4)');
  g.fillStyle = rim; g.fillRect(0, 0, S, S);
  s = { c, S }; treeCache.set(key, s); return s;
}
function rockSprite(r) {
  if (r.spr) return r.spr;
  const S = Math.ceil(r.r * 2.6), c = document.createElement('canvas'); c.width = c.height = S * 2; const g = c.getContext('2d'); g.scale(2, 2);
  const cx = S / 2, cy = S / 2, R = mulberry32(Math.floor(r.x * 7 + r.y));
  const base = Math.round(112 * r.shade), mtn = biomeFast(r.x, r.y) === 1;
  const gr = g.createLinearGradient(cx - r.r, cy - r.r, cx + r.r, cy + r.r);
  gr.addColorStop(0, `rgb(${base + 40},${base + 36},${base + 28})`); gr.addColorStop(0.5, `rgb(${base},${base - 4},${base - 10})`); gr.addColorStop(1, `rgb(${base - 45},${base - 48},${base - 52})`);
  g.fillStyle = gr; g.beginPath(); r.v.forEach((v, i) => i ? g.lineTo(cx + v[0], cy + v[1]) : g.moveTo(cx + v[0], cy + v[1])); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.2; g.stroke();
  g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1;
  for (let i = 0; i < 3; i++) { g.beginPath(); const a = R() * TAU; g.moveTo(cx + Math.cos(a) * r.r * 0.2, cy + Math.sin(a) * r.r * 0.2); g.lineTo(cx + Math.cos(a + 0.4) * r.r * 0.7, cy + Math.sin(a + 0.4) * r.r * 0.7); g.stroke(); }
  if (!mtn) { g.globalCompositeOperation = 'source-atop'; for (let i = 0; i < 12; i++) { g.fillStyle = `rgba(70,110,40,${0.3 + R() * 0.3})`; g.beginPath(); g.arc(cx + (R() - 0.7) * r.r, cy + (R() - 0.7) * r.r, 2 + R() * 4, 0, TAU); g.fill(); } }
  r.spr = { c, S }; return r.spr;
}

// ---- ortam efektleri (kaydedilmez)
const FX = { flies: [], leaves: [], smoke: [] };
function updFX(dt, cx, cy) {
  const dk = baseDark();
  if (dk > 0.3 && FX.flies.length < 40 && Math.random() < 0.5) FX.flies.push({ x: cx + rand(0, VW), y: cy + rand(0, VH), vx: rand(-10, 10), vy: rand(-10, 10), ph: rand(0, TAU), life: rand(6, 14) });
  for (const f of FX.flies) { f.vx += rand(-20, 20) * dt; f.vy += rand(-20, 20) * dt; f.vx *= 0.98; f.vy *= 0.98; f.x += f.vx * dt; f.y += f.vy * dt; f.life -= dt; f.ph += dt * 3; }
  FX.flies = FX.flies.filter(f => f.life > 0 && f.x > cx - 50 && f.x < cx + VW + 50 && f.y > cy - 50 && f.y < cy + VH + 50 && dk > 0.2);
  if (dk < 0.3 && FX.leaves.length < 14 && Math.random() < dt * 3) FX.leaves.push({ x: cx + rand(-100, VW), y: cy - 20 + rand(0, VH * 0.4), vx: rand(15, 35), vy: rand(10, 25), a: rand(0, TAU), va: rand(-3, 3), life: rand(5, 9), col: pick(['#6a8a3a', '#9a8a3a', '#8a5a2a', '#5a7a2a']) });
  for (const l of FX.leaves) { l.x += (l.vx + Math.sin(l.a) * 12) * dt; l.y += l.vy * dt; l.a += l.va * dt; l.life -= dt; }
  FX.leaves = FX.leaves.filter(l => l.life > 0);
  if (G.fire.fuel > 0 && Math.random() < dt * 5) FX.smoke.push({ x: G.fire.x + rand(-6, 6), y: G.fire.y - 18, r: rand(4, 7), life: rand(2.5, 4), a: rand(0.12, 0.22) });
  for (const s of FX.smoke) { s.y -= 18 * dt; s.x += Math.sin(G.now + s.r) * 8 * dt + 6 * dt; s.r += 6 * dt; s.life -= dt; }
  FX.smoke = FX.smoke.filter(s => s.life > 0);
}

// =============================================================
//  ANA ÇİZİM
// =============================================================
function render() {
  G.camX = L.x - VW / 2; G.camY = L.y - VH / 2;
  if (!G.vis) G.vis = visionSources();
  sunUpdate();
  let ok3 = false;
  try { ok3 = typeof render3D === 'function' && render3D(G.dt || 0.016); }
  catch (e) { if (!render.err) { render.err = true; console.error('3B çizim hatası:', e); } ok3 = U3.ok === true; }
  if (!ok3) { render2D(); return; }
  drawOverlay3D();
}
// ---- 3B görünümün üstündeki 2B kaplama (şeffaf #c tuvali)
function drawOverlay3D() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, VW, VH);
  const dk = darkness(), LS = U3.LS && U3.LS.length ? U3.LS : lights();
  if (SUN.grade) { ctx.fillStyle = SUN.grade; ctx.fillRect(0, 0, VW, VH); }
  if (L && precipAt(L.x, L.y) === 'yagmur' && !G.inside && (G.pitch || 0) > -0.2) {
    // merceğe düşen birkaç damla (yağmur çizgileri 3B sahnede)
    for (let i = 0; i < 9; i++) { const ph = (G.now * 0.35 + i * 0.37) % 1, x = (i * 211.7) % VW, y = (i * 133.1) % VH + ph * 24, a = (1 - ph) * 0.16; ctx.fillStyle = `rgba(200,215,240,${a})`; ell(x, y, 4 + (i % 3), 5 + (i % 3)); }
  }
  if (G.flash > 0) { ctx.fillStyle = `rgba(220,230,255,${Math.min(0.85, G.flash * 1.5)})`; ctx.fillRect(0, 0, VW, VH); }
  // dünyaya bağlı yazılar
  ctx.textAlign = 'center';
  ctx.font = 'bold 13px Georgia';
  if (!G.inside) for (const t of G.texts) { const s = w2s(t.x, t.y, 30 + (1.3 - t.life) * 14); if (!s || !s.on || s.z > 900) continue; ctx.globalAlpha = clamp(t.life, 0, 1); ctx.fillStyle = '#000'; ctx.fillText(t.t, s.x + 1, s.y + 1); ctx.fillStyle = t.col; ctx.fillText(t.t, s.x, s.y); }
  ctx.globalAlpha = 1;
  if (G.inside) drawLabelsIn();
  else {
    drawLabels3D(LS, dk);
    edgeMarker(G.fire.x, G.fire.y, '🔥', dist(L, G.fire) > 450 || G.carryEgg);
    if (G.rescue) edgeMarker(G.rescue.x, G.rescue.y, '🆘', true);
    if (G.rift.found || (G.riftHint && isNight())) edgeMarker(G.rift.x, G.rift.y, '🌀', true);
    if (G.hunt && G.hunt.t && !G.hunt.t.dead) edgeMarker(G.hunt.t.x, G.hunt.t.y, '🎯', true);
    for (const p of G.people) if ((p.grabbed && p.grabT > 0 && dist(p, L) < 1100) || p.desert > 0 || p.downed > 0) edgeMarker(p.x, p.y, p.downed > 0 ? '🩸' : '❗', true);
    for (const c of G.ccamps) if (c.captives.length) edgeMarker(c.x, c.y, '⛓️', true);
    for (const w of G.wrecks || []) if (!w.found && dist(w, L) < 900) edgeMarker(w.x, w.y, '⚓', true);
  }
  // karartma, tehlike, hasar
  const fearV = G.inside ? 0.35 : Math.max(G.danger * 0.8, dk * 0.5);
  const vg = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * (0.42 - fearV * 0.15), VW / 2, VH / 2, Math.max(VW, VH) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(${Math.round(40 * G.danger)},0,0,${0.36 + fearV * 0.4})`);
  ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);
  if (G.red > 0) { ctx.fillStyle = `rgba(160,0,0,${G.red * 0.4})`; ctx.fillRect(0, 0, VW, VH); }
  if (G.scare > 0) { ctx.fillStyle = G.scare > 0.35 ? `rgba(255,255,255,${(G.scare - 0.35) * 5})` : `rgba(120,0,0,${G.scare * 0.6})`; ctx.fillRect(0, 0, VW, VH); }
  if (L.hp < 35) { ctx.fillStyle = `rgba(120,0,0,${(0.15 + Math.sin(G.now * 6) * 0.08) * (1 - L.hp / 35)})`; ctx.fillRect(0, 0, VW, VH); }
  if (G.finale) { ctx.fillStyle = `rgba(40,80,200,${0.08 + Math.sin(G.now * 3) * 0.04})`; ctx.fillRect(0, 0, VW, VH); }
  // nişangâh + eylem halkası + lider durum simgeleri
  if (!G.sleep && L.hp > 0) {
    const cx = VW / 2, cy = VH / 2;
    ctx.fillStyle = 'rgba(0,0,0,.45)'; circle(cx, cy, 3); ctx.fillStyle = 'rgba(255,240,210,.85)'; circle(cx, cy, 1.7);
    if (G.actProg > 0 && G.interact) { ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(cx, cy, 18, 0, TAU); ctx.stroke(); ctx.strokeStyle = '#ffd890'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, 18, -Math.PI / 2, -Math.PI / 2 + TAU * G.actProg); ctx.stroke(); }
    let ic = (L.injury ? (L.injury.type === 'kanama' ? '🩸' : L.injury.type === 'kirik' ? '🦴' : '🤢') : '') + (L.sick ? '🤒' : '') + (G.carryEgg ? '🥚' : '');
    if (ic) { ctx.font = '16px serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(ic, cx, cy + 40); }
  }
}
// içeride: yakındaki insanların adı + duruşu
function drawLabelsIn() {
  if (typeof inPeople !== 'function') return;
  const I = G.inside; ctx.textAlign = 'center';
  for (const q of inPeople(I.b)) {
    if (!q.p || q.p === L) continue;
    const d = Math.hypot(q.x - I.x, q.y - I.y); if (d > 260) continue;
    const s = w2s(q.x, q.y, q.pose === 'sleep' ? 14 : q.pose === 'sit' || q.pose === 'eat' ? 32 : 42); if (!s || !s.on) continue;
    const look = G.lookP === q.p, k = clamp(200 / Math.max(80, s.z), 0.8, 1.3);
    ctx.globalAlpha = clamp((260 - d) / 80, 0, 1);
    ctx.font = Math.round(11 * k) + 'px Georgia'; ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillText(q.p.name, s.x + 1, s.y + 1); ctx.fillStyle = look ? '#ffd27a' : '#eadcc0'; ctx.fillText(q.p.name, s.x, s.y);
    const ic = q.pose === 'sleep' ? '💤' : q.pose === 'eat' ? '🍲' : q.pose === 'work' ? '⚒️' : '';
    if (ic) { ctx.font = Math.round(12 * k) + 'px serif'; ctx.fillText(ic, s.x, s.y - 14 * k); }
    if (q.p.stageAd && d < 250) { ctx.font = '10px Georgia'; ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillText(q.p.stageAd, s.x + 1, s.y + 13); ctx.fillStyle = '#cfe0b0'; ctx.fillText(q.p.stageAd, s.x, s.y + 12); }
    if (look) { ctx.strokeStyle = 'rgba(255,210,122,.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(s.x - 6, s.y + 6); ctx.lineTo(s.x, s.y + 12); ctx.lineTo(s.x + 6, s.y + 6); ctx.stroke(); }
  }
  ctx.globalAlpha = 1;
}
function drawLabels3D(LS, dk) {
  ctx.textAlign = 'center';
  const label = (s, text, col, ic) => {
    const k = clamp(260 / Math.max(120, s.z), 0.75, 1.35), fs = Math.round(11 * k);
    ctx.globalAlpha = clamp((520 - s.z) / 140, 0, 1);
    if (text) { ctx.font = fs + 'px Georgia'; ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillText(text, s.x + 1, s.y + 1); ctx.fillStyle = col; ctx.fillText(text, s.x, s.y); }
    if (ic) { ctx.font = Math.round(13 * k) + 'px serif'; ctx.fillStyle = '#fff'; ctx.fillText(ic, s.x, s.y - fs - 3); }
    ctx.globalAlpha = 1;
  };
  for (const p of G.people) {
    if (p.inHut || p.leader || p.insideB) continue;
    if (Math.abs(p.x - L.x) > 520 || Math.abs(p.y - L.y) > 520) continue;
    if (lightLevel(p.x, p.y, LS) < 0.3 && !(p.downed > 0)) continue;
    const lying = p.downed > 0 || p.bed || p.carriedBy;
    const s = w2s(p.x, p.y, lying ? 16 : p.child ? 31 : 42); if (!s || !s.on || s.z > 520) continue;
    const isM = !p.child && GORDER.some(g => G.managers[g] === p.id);
    let ic = '';
    if (p.downed > 0) ic = '🩸' + Math.ceil(p.downed);
    else { if (p.injury) ic += p.injury.type === 'kanama' ? '🩸' : p.injury.type === 'kirik' ? '🦴' : '🤢'; if (p.sick) ic += '🤒'; if (p.tired) ic += '😴'; if (p.fear >= 80) ic += '❗'; }
    label(s, (isM ? '★ ' : '') + p.name, p.fear >= 80 ? '#f99' : isM ? '#ffd27a' : '#eadcc0', ic);
    if (p.stageAd && s.z < 250) { ctx.globalAlpha = clamp((250 - s.z) / 80, 0, 1); ctx.font = '10px Georgia'; ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillText(p.stageAd, s.x + 1, s.y + 13); ctx.fillStyle = '#cfe0b0'; ctx.fillText(p.stageAd, s.x, s.y + 12); ctx.globalAlpha = 1; }
    if ((p.hp < p.maxhp * 0.75 || p.hurtT > 0) && s.z < 380) hpBar(s.x, s.y + 4, p.hp / p.maxhp, 26);
  }
  for (const d of G.dinos) {
    if (d.hidden || d.dead || Math.abs(d.x - L.x) > 700 || Math.abs(d.y - L.y) > 700) continue;
    if (!(d.tamed || visible(d.x, d.y, d.r))) continue;
    const mim = d.type === 'taklitci' && !d.revealed;
    if (mim) { if (lightLevel(d.x, d.y, LS) < 0.3) continue; const s = w2s(d.x, d.y, 42); if (s && s.on && s.z < 520) label(s, d.disguise.name, '#eadcc0', ''); continue; }
    const hurt = d.hp < d.maxhp, human = d.type === 'yamyam';
    if (!hurt && !d.tamed) continue;
    if (dk > 0.5 && lightLevel(d.x, d.y, LS) < 0.2 && !d.tamed) continue;
    const s = w2s(d.x, d.y, (human ? 44 : d.r * 2.1 + 8) + (d.fly ? (d.alt || 0) * 85 : 0)); if (!s || !s.on || s.z > 650) continue;
    if (hurt) hpBar(s.x, s.y, d.hp / d.maxhp, clamp(d.r * 1.4, 26, 70));
    if (d.tamed) { ctx.fillStyle = '#9cf'; ctx.font = '12px Georgia'; ctx.fillText('♥', s.x, s.y - 5); }
  }
  for (const b of G.builds) {
    if (b.dead || Math.abs(b.x - L.x) > 480 || Math.abs(b.y - L.y) > 480 || !BUILD[b.type]) continue;
    const T = b.type, flat = (BUILD[T] || {}).flat;
    const top = T === 'magara' ? 95 : T === 'kulube' ? 66 : T === 'kule' ? 122 : T === 'gemi' ? 90 : flat ? 22 : T === 'cit' || T === 'duvar' ? 42 : 50;
    const s = w2s(b.x, T === 'magara' ? b.y + b.r * 0.95 : b.y, top); if (!s || !s.on || s.z > 480) continue;
    if (!b.built) { hpBar(s.x, s.y, b.prog / b.need, 34); continue; }
    if (b.hp < b.maxhp && !flat) hpBar(s.x, s.y, b.hp / b.maxhp, 30);
    ctx.globalAlpha = clamp((480 - s.z) / 120, 0, 1); ctx.fillStyle = '#e8d8b8';
    const n = (b.occ || []).length;
    if (T === 'magara' && n) { ctx.font = '12px Georgia'; ctx.fillText(`💤 ${n}`, s.x, s.y - 4); }
    else if (T === 'kulube') { ctx.font = '12px serif'; ctx.fillText((b.rooms || []).map(r => ROOMS[r].ic).join(' ') + (n ? ' 💤' : ''), s.x, s.y - 6); }
    else if (T === 'cadir') { if (n) { ctx.font = '11px serif'; ctx.fillText('💤', s.x, s.y - 6); } else if (!b.owners.length) { ctx.font = '10px Georgia'; ctx.fillStyle = 'rgba(255,240,200,.75)'; ctx.fillText('boş', s.x, s.y - 6); } }
    else if (T === 'tarla' && b.planted && b.g >= 1) { ctx.font = '14px serif'; ctx.fillText('🌾', s.x, s.y); }
    ctx.globalAlpha = 1;
  }
  for (const c of G.ccamps) if (c.alive && c.totem < 250) { const s = w2s(c.x, c.y, 76); if (s && s.on && s.z < 600) hpBar(s.x, s.y, c.totem / 250, 34); }
  if (G.finale) { const s = w2s(G.rift.x, G.rift.y, 130); if (s && s.on) { ctx.fillStyle = '#cfe4ff'; ctx.font = 'bold 22px Georgia'; ctx.fillText(Math.ceil(G.finale.t), s.x, s.y); } }
}
// pusula tarzı işaret: hedef görüşteyse üstünde, değilse ekran kenarında ok
function edgeMarker(wx, wy, ic, show) {
  if (!show) return;
  if (!U3.cam || U3.ok !== true) return edgeMarker2D(wx, wy, ic, show);
  const quiet = ic === '🔥' || ic === '🌀' || ic === '🎯';
  const d = Math.hypot(wx - L.x, wy - L.y), s = w2s(wx, wy, quiet ? 70 : 52), m = 34;
  ctx.textAlign = 'center';
  if (s && s.z > 1 && s.x > m && s.x < VW - m && s.y > m && s.y < VH - m) {
    if (quiet && d < 320) return;
    ctx.font = (quiet ? 15 : 18) + 'px serif'; ctx.globalAlpha = quiet ? 0.85 : 1; ctx.fillStyle = '#fff'; ctx.fillText(ic, s.x, s.y);
    if (d > 150) { const tx = Math.round(d / 10) + ' m'; ctx.font = '10px Georgia'; ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillText(tx, s.x + 1, s.y + 14); ctx.fillStyle = '#eadcc0'; ctx.fillText(tx, s.x, s.y + 13); }
    ctx.globalAlpha = 1; return;
  }
  const yaw = G.yaw === undefined ? (L.ang || 0) : G.yaw;
  let rel = Math.atan2(wy - L.y, wx - L.x) - yaw; rel = Math.atan2(Math.sin(rel), Math.cos(rel));
  const side = rel >= 0 ? 1 : -1, back = clamp((Math.abs(rel) - 0.6) / (Math.PI - 0.6), 0, 1);
  const tx = side > 0 ? VW - m : m;
  let ty = VH * 0.42 + back * VH * 0.2;
  if (s && s.z > 1) ty = clamp(s.y, m + 60, VH - m - 120);
  ty = clamp(ty, m + 60, Math.max(m + 61, VH - m - 120));
  ctx.save(); ctx.translate(tx, ty); ctx.rotate(side > 0 ? back * 0.9 : Math.PI - back * 0.9);
  ctx.fillStyle = ic === '🌀' ? 'rgba(120,170,255,.8)' : ic === '🎯' ? 'rgba(255,90,60,.85)' : 'rgba(255,200,120,.75)';
  ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(5, -7); ctx.lineTo(5, 7); ctx.fill(); ctx.restore();
  ctx.font = '16px serif'; ctx.fillStyle = '#fff'; ctx.fillText(ic, tx - side * 12, ty + 5);
  ctx.font = '9px Georgia'; ctx.fillStyle = 'rgba(234,220,192,.85)'; ctx.fillText(Math.round(d / 10) + ' m', tx - side * 12, ty + 18);
}
// ---- eski kuşbakışı çizim: WebGL yoksa yedek
function render2D() {
  const sx = (Math.random() - 0.5) * G.shake, sy = (Math.random() - 0.5) * G.shake;
  G.camX = L.x - VW / 2 + sx; G.camY = L.y - VH / 2 + sy;
  const cx = G.camX, cy = G.camY;
  sunUpdate(); updFX(G.dt || 0.016, cx, cy);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (!G.vis) G.vis = visionSources();
  ctx.save();
  if (G.scare > 0) { const z = 1 + G.scare * 0.12; ctx.translate(VW / 2, VH / 2); ctx.scale(z, z); ctx.translate(-VW / 2, -VH / 2); }
  ctx.translate(-cx, -cy);
  const inV = (x, y, m) => x > cx - m && x < cx + VW + m && y > cy - m && y < cy + VH + m;
  ctx.fillStyle = groundPat; ctx.fillRect(cx, cy, VW, VH);
  ctx.fillStyle = detailPat; ctx.fillRect(cx, cy, VW, VH);
  ctx.imageSmoothingEnabled = true;
  { const s = MAPC; ctx.drawImage(biomeTint, cx / s, cy / s, VW / s, VH / s, cx, cy, VW, VH); }
  ctx.fillStyle = '#0b1408';
  if (cx < 0) ctx.fillRect(cx, cy, -cx, VH); if (cy < 0) ctx.fillRect(cx, cy, VW, -cy);
  if (cx + VW > WORLD) ctx.fillRect(WORLD, cy, cx + VW - WORLD, VH); if (cy + VH > WORLD) ctx.fillRect(cx, WORLD, VW, cy + VH - WORLD);
  { const g = ctx.createRadialGradient(CAMP.x, CAMP.y, 20, CAMP.x, CAMP.y, 260); g.addColorStop(0, 'rgba(110,85,52,.75)'); g.addColorStop(0.6, 'rgba(95,75,45,.35)'); g.addColorStop(1, 'rgba(90,70,45,0)'); ctx.fillStyle = g; circle(CAMP.x, CAMP.y, 260); }
  for (const l of G.lakes) if (inV(l.x, l.y, l.r + 20)) drawLake(l);
  for (const p of G.pools) if (inV(p.x, p.y, p.r + 10)) drawPool(p);
  for (const d of G.deco) if (inV(d.x, d.y, 20)) drawDeco(d);
  for (const s of G.stains) { ctx.fillStyle = `rgba(80,5,5,${Math.min(0.6, s.life / 60)})`; ell(s.x, s.y, s.r, s.r * 0.7); }
  for (const t of G.tracks) if (inV(t.x, t.y, 30) && exploredAt(t.x, t.y)) drawTrack(t);
  for (const c of G.ccamps) if ((c.found || visible(c.x, c.y, 100)) && inV(c.x, c.y, 160)) drawCamp(c);
  for (const b of G.builds) if (BUILD[b.type].flat && inV(b.x, b.y, 60)) drawBuild(b);
  for (const b of G.builds) if (b.type === 'sifahane' && inV(b.x, b.y, 60)) drawBuild(b);
  for (const c of G.carcs) if (inV(c.x, c.y, c.r * 2) && (visible(c.x, c.y, 40) || exploredAt(c.x, c.y))) drawCarcass(c);
  for (const t of G.trees) if (!t.stump && inV(t.x, t.y, t.cr + 30)) shadowAt(t.x + 6, t.y + 4, t.cr * 0.85, t.cr * 0.55, 0.26);
  for (const r of G.rocks) if (!r.dead && inV(r.x, r.y, 40)) shadowAt(r.x, r.y + 2, r.r, r.r * 0.6, 0.3);
  for (const b of G.bushes) if (inV(b.x, b.y, 30)) drawBush(b);
  for (const h of G.herbs) if (inV(h.x, h.y, 20)) drawHerb(h);
  for (const h of G.poisons) if (inV(h.x, h.y, 20)) drawPoison(h);
  for (const n of G.nests) if (inV(n.x, n.y, 30)) drawNest(n);
  for (const t of G.trees) if (t.stump && inV(t.x, t.y, 20)) { ctx.fillStyle = '#5a3d22'; circle(t.x, t.y, 9); ctx.fillStyle = '#8a6a44'; circle(t.x - 1, t.y - 1, 6.5); ctx.strokeStyle = '#5a3d22'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(t.x - 1, t.y - 1, 3.5, 0, TAU); ctx.stroke(); }
  for (const r of G.rocks) if (!r.dead && inV(r.x, r.y, 40)) { const s = rockSprite(r); ctx.drawImage(s.c, r.x - s.S / 2, r.y - s.S / 2, s.S, s.S); }
  for (const c of G.crystals) if (!c.dead && inV(c.x, c.y, 30)) drawCrystal(c);
  if (inV(G.rift.x, G.rift.y, 200)) drawRift();
  drawFire();
  const ents = [];
  for (const b of G.builds) if (!BUILD[b.type].flat && b.type !== 'sifahane' && inV(b.x, b.y, 60)) ents.push(b);
  for (const p of G.people) if (!p.inHut && !p.insideB && inV(p.x, p.y, 40) && !(p === L && G.mount) && !(p.grabbed && G.dinos.some(d => d.type === 'yamyam' && d.carry === p))) ents.push(p);
  for (const d of G.dinos) if (!d.fly && !d.hidden && inV(d.x, d.y, d.r * 3) && (d.tamed || visible(d.x, d.y, d.r))) ents.push(d);
  if (G.rescue && inV(G.rescue.x, G.rescue.y, 40) && visible(G.rescue.x, G.rescue.y)) ents.push(G.rescue);
  for (const t of G.trees) if (!t.stump && inV(t.x, t.y, 30)) ents.push(t);
  ents.sort((a, b) => (a.bed ? a.y - 40 : a.y) - (b.bed ? b.y - 40 : b.y));
  for (const e of ents) {
    if (e.kind === 'build') drawBuild(e);
    else if (e.kind === 'tree') drawTrunk(e);
    else if (e.type === 'yamyam') { drawPerson(cannibalView(e)); if (e.carry) drawPerson(e.carry); }
    else if (e.type === 'taklitci') drawMimic(e);
    else if (e.type) { drawDino(e); if (e === G.mount) drawPerson(L); }
    else drawPerson(e);
  }
  if (G.hunt && G.hunt.t && !G.hunt.t.dead && visible(G.hunt.t.x, G.hunt.t.y, 60)) { const t = G.hunt.t; ctx.strokeStyle = 'rgba(255,80,40,.85)'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.arc(t.x, t.y, t.r + 12 + Math.sin(G.now * 5) * 2, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
  for (const q of G.parts) { ctx.globalAlpha = clamp(q.life, 0, 1); ctx.fillStyle = q.col; ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s); }
  ctx.globalAlpha = 1;
  for (const q of G.proj) { ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - Math.cos(q.ang) * 16, q.y - Math.sin(q.ang) * 16); ctx.stroke(); ctx.fillStyle = q.poison ? '#9f3' : '#ddd'; circle(q.x, q.y, 1.8); }
  ctx.fillStyle = '#b8e04a'; for (const q of G.eproj) { ctx.globalAlpha = 0.85; circle(q.x, q.y, 4); ctx.globalAlpha = 1; }
  for (const s of FX.smoke) { ctx.fillStyle = `rgba(120,115,110,${s.a * clamp(s.life / 2, 0, 1)})`; circle(s.x, s.y, s.r); }
  for (const t of G.trees) if (!t.stump && inV(t.x, t.y, t.cr + 10)) drawCanopy(t);
  for (const d of G.dinos) if (d.fly && inV(d.x, d.y, 80) && (d.tamed || visible(d.x, d.y, 40))) drawFlyer(d);
  for (const l of FX.leaves) { ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(l.a); ctx.fillStyle = l.col; ctx.globalAlpha = clamp(l.life, 0, 0.9); ell(0, 0, 3.5, 1.6); ctx.restore(); }
  ctx.globalAlpha = 1;
  if (G.placing) {
    const p = placePos(), ok = placeOk(G.placing, p), r = BUILD[G.placing].r;
    ctx.globalAlpha = 0.45; ctx.fillStyle = ok ? '#7c6' : '#c44'; circle(p.x, p.y, r); ctx.globalAlpha = 1;
    ctx.strokeStyle = ok ? '#bfa' : '#f88'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  }
  if (G.actProg > 0 && G.interact) { ctx.strokeStyle = '#ffd890'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(L.x, L.y, 22, -Math.PI / 2, -Math.PI / 2 + TAU * G.actProg); ctx.stroke(); }
  ctx.restore();

  if (SUN.grade) { ctx.fillStyle = SUN.grade; ctx.fillRect(0, 0, VW, VH); }
  const bm = biomeFast(L.x, L.y);
  const fogA = (bm === 3 ? 0.42 : 0) + (G.weather.type === 'sis' ? 0.3 : 0);
  if (fogA > 0) {
    const g = ctx.createRadialGradient(VW / 2, VH / 2, 90, VW / 2, VH / 2, Math.max(VW, VH) * 0.55);
    g.addColorStop(0, 'rgba(150,155,168,0)'); g.addColorStop(1, `rgba(150,155,168,${Math.min(0.85, fogA * 1.6)})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    for (let i = 0; i < 6; i++) { const x = ((i * 397 + G.now * 14) % (VW + 400)) - 200, y = (i * 211) % VH; ctx.fillStyle = `rgba(170,175,185,${fogA * 0.25})`; ell(x, y, 220, 70); }
  }
  const dk = darkness(), LS = lights();
  if (dk > 0.01) {
    dctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    dctx.globalCompositeOperation = 'source-over'; dctx.clearRect(0, 0, VW, VH);
    dctx.fillStyle = `rgba(3,6,18,${dk})`; dctx.fillRect(0, 0, VW, VH);
    dctx.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r, a) => { if (x - cx < -r || y - cy < -r || x - cx > VW + r || y - cy > VH + r) return; const g = dctx.createRadialGradient(x - cx, y - cy, r * 0.15, x - cx, y - cy, r); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.6, `rgba(0,0,0,${a * 0.7})`); g.addColorStop(1, 'rgba(0,0,0,0)'); dctx.fillStyle = g; dctx.beginPath(); dctx.arc(x - cx, y - cy, r, 0, TAU); dctx.fill(); };
    for (const l of LS) hole(l.x, l.y, l.r, l.blue ? 0.7 : l.red ? 0.8 : 1);
    hole(L.x, L.y, 95, 0.5);
    for (const c of G.crystals) if (!c.dead) hole(c.x, c.y, 45, 0.5);
    ctx.drawImage(dark, 0, 0, VW, VH);
    ctx.globalCompositeOperation = 'lighter';
    for (const l of LS) {
      const x = l.x - cx, y = l.y - cy; if (x < -l.r || y < -l.r || x > VW + l.r || y > VH + l.r) continue;
      const g = ctx.createRadialGradient(x, y, 0, x, y, l.r * 0.9);
      g.addColorStop(0, l.blue ? `rgba(60,120,255,${0.3 * dk})` : l.red ? `rgba(255,60,20,${0.3 * dk})` : `rgba(255,140,40,${0.24 * l.warm * dk})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, l.r, 0, TAU); ctx.fill();
    }
    for (const f of FX.flies) { const a = (0.5 + 0.5 * Math.sin(f.ph)) * dk; if (a < 0.1) continue; const x = f.x - cx, y = f.y - cy, g = ctx.createRadialGradient(x, y, 0, x, y, 6); g.addColorStop(0, `rgba(210,255,120,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x - 6, y - 6, 12, 12); }
    ctx.globalCompositeOperation = 'source-over';
  } else { ctx.fillStyle = 'rgba(255,225,160,.035)'; ctx.fillRect(0, 0, VW, VH); }
  drawFog(cx, cy);
  if (dk > 0.5) drawEyes(LS, cx, cy);
  const lpr = L ? precipAt(L.x, L.y) : null;
  if (lpr === 'kar') {
    ctx.fillStyle = 'rgba(240,245,255,.7)'; const n = G.weather.heavy ? 260 : 140;
    for (let i = 0; i < n; i++) { const x = (i * 137.5 + G.now * (G.weather.heavy ? 90 : 20) + Math.sin(G.now + i) * 12) % VW, y = (i * 91.3 + G.now * 70) % VH; ell(x, y, 1.6 + (i % 3) * 0.6, 1.6 + (i % 3) * 0.6); }
  } else if (lpr === 'yagmur') {
    ctx.strokeStyle = 'rgba(170,190,220,.35)'; ctx.lineWidth = 1; ctx.beginPath();
    const n = G.weather.type === 'firtina' ? 220 : 130;
    for (let i = 0; i < n; i++) { const x = (i * 137.5 + G.now * 60) % VW, y = (i * 91.3 + G.now * 900) % VH; ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 14); }
    ctx.stroke();
    ctx.fillStyle = 'rgba(190,210,240,.25)'; for (let i = 0; i < 30; i++) { const x = (i * 211.7 + G.now * 37) % VW, y = (i * 133.1 + G.now * 53) % VH; ell(x, y, 3, 1.2); }
  }
  if (G.flash > 0) { ctx.fillStyle = `rgba(220,230,255,${G.flash * 1.5})`; ctx.fillRect(0, 0, VW, VH); }
  ctx.font = 'bold 13px Georgia'; ctx.textAlign = 'center';
  for (const t of G.texts) { ctx.globalAlpha = clamp(t.life, 0, 1); ctx.fillStyle = '#000'; ctx.fillText(t.t, t.x - cx + 1, t.y - cy + 1); ctx.fillStyle = t.col; ctx.fillText(t.t, t.x - cx, t.y - cy); }
  ctx.globalAlpha = 1;
  drawLabels(LS, cx, cy);
  edgeMarker(G.fire.x, G.fire.y, '🔥', dist(L, G.fire) > 450 || G.carryEgg);
  if (G.rescue) edgeMarker(G.rescue.x, G.rescue.y, '🆘', true);
  if (G.rift.found || (G.riftHint && isNight())) edgeMarker(G.rift.x, G.rift.y, '🌀', true);
  if (G.hunt && G.hunt.t && !G.hunt.t.dead) edgeMarker(G.hunt.t.x, G.hunt.t.y, '🎯', true);
  for (const p of G.people) if ((p.grabbed && p.grabT > 0 && dist(p, L) < 1100) || p.desert > 0 || p.downed > 0) edgeMarker(p.x, p.y, p.downed > 0 ? '🩸' : '❗', true);
  for (const c of G.ccamps) if (c.captives.length) edgeMarker(c.x, c.y, '⛓️', true);
  const fearV = Math.max(G.danger * 0.8, dk * 0.5);
  const vg = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * (0.42 - fearV * 0.15), VW / 2, VH / 2, Math.max(VW, VH) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(${Math.round(40 * G.danger)},0,0,${0.42 + fearV * 0.4})`);
  ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);
  if (G.red > 0) { ctx.fillStyle = `rgba(160,0,0,${G.red * 0.4})`; ctx.fillRect(0, 0, VW, VH); }
  if (G.scare > 0) { ctx.fillStyle = G.scare > 0.35 ? `rgba(255,255,255,${(G.scare - 0.35) * 5})` : `rgba(120,0,0,${G.scare * 0.6})`; ctx.fillRect(0, 0, VW, VH); }
  if (L.hp < 35) { ctx.fillStyle = `rgba(120,0,0,${(0.15 + Math.sin(G.now * 6) * 0.08) * (1 - L.hp / 35)})`; ctx.fillRect(0, 0, VW, VH); }
  if (G.finale) { ctx.fillStyle = `rgba(40,80,200,${0.08 + Math.sin(G.now * 3) * 0.04})`; ctx.fillRect(0, 0, VW, VH); }
}
function drawEyes(LS, cx, cy) {
  for (const d of G.dinos) {
    if (d.tamed || d.blink < 0 || d.ko > 0 || d.hidden || d.fly || d.silent || d.type === 'yamyam' || (d.type === 'taklitci' && !d.revealed)) continue;
    if (!exploredAt(d.x, d.y) || !(visibleK(d.x, d.y, 1.8) || d.scouted > 0)) continue;
    const lv = lightLevel(d.x, d.y, LS); if (lv > 0.35) continue;
    const hx = d.x + Math.cos(d.ang) * d.r * 1.05 - cx, hy = d.y + Math.sin(d.ang) * d.r * 1.05 - cy;
    if (hx < -20 || hy < -20 || hx > VW + 20 || hy > VH + 20) continue;
    const toL = Math.cos(d.ang - angTo(d, L)); if (toL < -0.2 && !(d.scouted > 0)) continue;
    const big = d.type === 'geceavcisi' ? 1.8 : 1;
    const er = (d.r * 0.09 + 1.2) * big, sep = d.r * 0.22, px = -Math.sin(d.ang) * sep, py = Math.cos(d.ang) * sep, col = DINO[d.type].eye;
    ctx.globalAlpha = d.scouted > 0 ? 0.9 : 0.5 + 0.5 * toL * (1 - lv);
    for (const s of [-1, 1]) { const ex = hx + px * s, ey = hy + py * s; const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, er * 4); g.addColorStop(0, col); g.addColorStop(0.25, col); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ex, ey, er * 4, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
}
function drawLabels(LS, cx, cy) {
  ctx.font = '10px Georgia'; ctx.textAlign = 'center';
  const label = (x, y, text, col, ic) => {
    ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillText(text, x + 1, y + 26); ctx.fillStyle = col; ctx.fillText(text, x, y + 25);
    if (ic) { ctx.font = '12px serif'; ctx.fillText(ic, x, y - 21); ctx.font = '10px Georgia'; }
  };
  for (const p of G.people) {
    if (p.inHut || p.leader || p.insideB) continue;
    const x = p.x - cx, y = p.y - cy; if (x < -40 || x > VW + 40 || y < -40 || y > VH + 40) continue;
    if (lightLevel(p.x, p.y, LS) < 0.3 && !(p.downed > 0)) continue;
    const isM = !p.child && GORDER.some(g => G.managers[g] === p.id);
    let ic = '';
    if (p.downed > 0) ic = '🩸' + Math.ceil(p.downed);
    else { if (p.injury) ic += p.injury.type === 'kanama' ? '🩸' : p.injury.type === 'kirik' ? '🦴' : '🤢'; if (p.sick) ic += '🤒'; if (p.tired) ic += '😴'; if (p.fear >= 80) ic += '❗'; }
    label(x, y, (isM ? '★ ' : '') + p.name, p.fear >= 80 ? '#f99' : isM ? '#ffd27a' : '#eadcc0', ic);
  }
  for (const d of G.dinos) {
    if (d.type !== 'taklitci' || d.revealed || !visible(d.x, d.y, 20)) continue;
    if (lightLevel(d.x, d.y, LS) < 0.3) continue;
    label(d.x - cx, d.y - cy, d.disguise.name, '#eadcc0', '');
  }
  if (L.injury || L.sick) { ctx.font = '13px serif'; ctx.fillText((L.injury ? (L.injury.type === 'kanama' ? '🩸' : L.injury.type === 'kirik' ? '🦴' : '🤢') : '') + (L.sick ? '🤒' : ''), L.x - cx, L.y - cy - 26); }
  if (G.carryEgg) { ctx.font = '14px serif'; ctx.fillText('🥚', L.x - cx + 14, L.y - cy - 14); }
}
function edgeMarker2D(wx, wy, ic, show) {
  if (!show) return;
  const x = wx - G.camX, y = wy - G.camY;
  if (x > 20 && y > 20 && x < VW - 20 && y < VH - 20) { if (ic !== '🔥' && ic !== '🌀' && ic !== '🎯') { ctx.font = '18px serif'; ctx.textAlign = 'center'; ctx.fillText(ic, x, y - 30); } return; }
  const a = Math.atan2(y - VH / 2, x - VW / 2), m = 34;
  const tx = clamp(VW / 2 + Math.cos(a) * VW, m, VW - m), ty = clamp(VH / 2 + Math.sin(a) * VH, m + 60, VH - m - 120);
  ctx.save(); ctx.translate(tx, ty); ctx.rotate(a); ctx.fillStyle = ic === '🌀' ? 'rgba(120,170,255,.8)' : ic === '🎯' ? 'rgba(255,90,60,.85)' : 'rgba(255,200,120,.7)'; ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(4, -7); ctx.lineTo(4, 7); ctx.fill(); ctx.restore();
  ctx.font = '16px serif'; ctx.textAlign = 'center'; ctx.fillText(ic, tx - Math.cos(a) * 8, ty - Math.sin(a) * 8 + 5);
}

// ---- çevre
function drawLake(l) {
  const sand = ctx.createRadialGradient(l.x, l.y, l.r * 0.9, l.x, l.y, l.r + 14);
  sand.addColorStop(0, 'rgba(150,130,90,.9)'); sand.addColorStop(1, 'rgba(110,100,60,0)');
  ctx.fillStyle = sand; circle(l.x, l.y, l.r + 14);
  const g = ctx.createRadialGradient(l.x - l.r * 0.2, l.y - l.r * 0.2, l.r * 0.1, l.x, l.y, l.r);
  g.addColorStop(0, '#0e2a40'); g.addColorStop(0.7, '#17435a'); g.addColorStop(1, '#2a6a70');
  ctx.fillStyle = g; circle(l.x, l.y, l.r);
  ctx.strokeStyle = 'rgba(200,235,240,.18)'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 5; i++) { const a = G.now * 0.2 + i * 1.3, rr = l.r * (0.25 + (i * 0.17) % 0.6); ctx.beginPath(); ctx.arc(l.x + Math.cos(a) * 10, l.y + Math.sin(a * 1.3) * 8, rr, a, a + 0.6); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(230,245,250,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(l.x, l.y, l.r - 2, G.now * 0.3, G.now * 0.3 + 0.4); ctx.stroke();
  const R = mulberry32(Math.floor(l.x)); ctx.fillStyle = '#3a6a2a';
  for (let i = 0; i < 6; i++) { const a = R() * TAU, d = l.r * (0.7 + R() * 0.2); ctx.beginPath(); ctx.arc(l.x + Math.cos(a) * d, l.y + Math.sin(a) * d, 4 + R() * 3, 0.4, TAU - 0.2); ctx.fill(); }
}
function drawPool(p) {
  ctx.fillStyle = '#2b3420'; circle(p.x, p.y, p.r + 6);
  const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r); g.addColorStop(0, '#26301c'); g.addColorStop(1, '#3d4a2c');
  ctx.fillStyle = g; circle(p.x, p.y, p.r);
  ctx.fillStyle = 'rgba(110,130,60,.35)'; circle(p.x - p.r * 0.3, p.y - p.r * 0.2, p.r * 0.35); circle(p.x + p.r * 0.35, p.y + p.r * 0.2, p.r * 0.2);
  if (p.croc && p.croc.hidden && visible(p.x, p.y) && Math.sin(G.now * 3 + p.x) > 0.7) { ctx.fillStyle = 'rgba(200,220,180,.5)'; circle(p.croc.x + Math.sin(G.now * 5) * 6, p.croc.y, 2.5); circle(p.croc.x + 8, p.croc.y + 4, 1.8); }
}
function drawDeco(d) {
  const x = d.x, y = d.y, s = d.s;
  if (d.t === 'fern') { ctx.strokeStyle = '#2f5626'; ctx.lineWidth = 2; for (let i = 0; i < 6; i++) { const a = d.a + i * 1.05 + Math.sin(G.now + d.x) * 0.05; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * 8 * s, y + Math.sin(a) * 8 * s - 4, x + Math.cos(a) * 15 * s, y + Math.sin(a) * 15 * s); ctx.stroke(); } ctx.strokeStyle = '#4a7a36'; ctx.lineWidth = 1; for (let i = 0; i < 6; i++) { const a = d.a + i * 1.05; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 11 * s, y + Math.sin(a) * 11 * s); ctx.stroke(); } }
  else if (d.t === 'bone') { ctx.strokeStyle = '#d8d0ba'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x - Math.cos(d.a) * 7 * s, y - Math.sin(d.a) * 7 * s); ctx.lineTo(x + Math.cos(d.a) * 7 * s, y + Math.sin(d.a) * 7 * s); ctx.stroke(); ctx.fillStyle = '#d8d0ba'; circle(x + Math.cos(d.a) * 8 * s, y + Math.sin(d.a) * 8 * s, 2.5); circle(x - Math.cos(d.a) * 8 * s, y - Math.sin(d.a) * 8 * s, 2.5); }
  else if (d.t === 'reed') { ctx.strokeStyle = '#6a7a3a'; ctx.lineWidth = 1.5; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(x + i * 3, y); ctx.lineTo(x + i * 4 + Math.sin(G.now + d.a + i) * 2, y - 16 * s); ctx.stroke(); } ctx.fillStyle = '#5a3a20'; ctx.fillRect(x - 1, y - 18 * s, 3, 6); }
  else if (d.t === 'pebble') { ctx.fillStyle = '#857d70'; circle(x, y, 3 * s); ctx.fillStyle = '#a49c8e'; circle(x + 5, y + 2, 2 * s); }
  else if (d.t === 'deadtree') { ctx.strokeStyle = '#4a4540'; ctx.lineWidth = 3; ctx.beginPath(); for (let i = 0; i < 4; i++) { const a = d.a + i * 1.6; ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 18 * s, y + Math.sin(a) * 18 * s); } ctx.stroke(); }
}
function drawTrack(t) {
  ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.a); ctx.fillStyle = 'rgba(30,20,10,.55)';
  ell(0, 0, 9, 7); for (const a of [-0.5, 0, 0.5]) ell(Math.cos(a) * 15, Math.sin(a) * 15, 6, 2.5, a);
  ctx.restore();
}
function drawBush(b) {
  shadowAt(b.x, b.y + 2, b.r, b.r * 0.6, 0.25);
  const g = ctx.createRadialGradient(b.x - 5, b.y - 6, 2, b.x, b.y, b.r + 3); g.addColorStop(0, '#4a7a34'); g.addColorStop(0.6, '#2d5222'); g.addColorStop(1, '#1a3414');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 2, 0, TAU); ctx.arc(b.x - 7, b.y - 3, b.r - 4, 0, TAU); ctx.arc(b.x + 6, b.y + 2, b.r - 5, 0, TAU); ctx.fill();
  for (let i = 0; i < Math.min(7, b.amt + Math.floor(b.amt / 2)); i++) { const q = b.berries[i]; ctx.fillStyle = b.col; circle(b.x + q[0], b.y + q[1], 2.8); ctx.fillStyle = 'rgba(255,255,255,.55)'; circle(b.x + q[0] - 0.9, b.y + q[1] - 0.9, 0.9); }
}
function drawHerb(h) {
  ctx.strokeStyle = '#4c8a3a'; ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + Math.sin(G.now + h.x) * 0.1; ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.quadraticCurveTo(h.x + Math.cos(a) * 5, h.y + Math.sin(a) * 5 - 3, h.x + Math.cos(a) * 10, h.y + Math.sin(a) * 10); ctx.stroke(); }
  if (h.amt > 0) for (let i = 0; i < h.amt; i++) { ctx.fillStyle = '#f4f8ff'; circle(h.x + Math.cos(i * 2.1) * 6, h.y + Math.sin(i * 2.1) * 6, 2.3); ctx.fillStyle = '#ffd84a'; circle(h.x + Math.cos(i * 2.1) * 6, h.y + Math.sin(i * 2.1) * 6, 0.9); }
}
function drawPoison(h) {
  const g = ctx.createRadialGradient(h.x, h.y, 1, h.x, h.y, 10); g.addColorStop(0, '#6a3a8a'); g.addColorStop(1, '#2a1438'); ctx.fillStyle = g; circle(h.x, h.y, 9);
  ctx.strokeStyle = '#9a4ac0'; ctx.lineWidth = 2;
  for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + 0.3; ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(h.x + Math.cos(a) * 13, h.y + Math.sin(a) * 13); ctx.stroke(); }
  if (h.amt > 0) { ctx.fillStyle = '#c6f04a'; for (let i = 0; i < h.amt; i++) circle(h.x - 3 + i * 6, h.y - 2, 2.2); }
}
function drawNest(n) {
  ctx.strokeStyle = '#6a5030'; ctx.lineWidth = 3;
  for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; ctx.beginPath(); ctx.moveTo(n.x + Math.cos(a) * 12, n.y + Math.sin(a) * 10); ctx.lineTo(n.x + Math.cos(a + 0.7) * 22, n.y + Math.sin(a + 0.7) * 17); ctx.stroke(); }
  for (let i = 0; i < n.eggs; i++) { const g = ctx.createRadialGradient(n.x - 8 + i * 7, n.y - 2, 0.5, n.x - 7 + i * 7, n.y, 6); g.addColorStop(0, '#fffaf0'); g.addColorStop(1, '#c8b890'); ctx.fillStyle = g; ell(n.x - 7 + i * 7, n.y, 4.2, 5.8); }
}
function drawCrystal(c) {
  const gl = 0.5 + Math.sin(G.now * 2 + c.x) * 0.2;
  ctx.fillStyle = `hsla(${c.hue},80%,60%,${0.25 * gl})`; circle(c.x, c.y, 22);
  for (let i = 0; i < 4; i++) {
    const a = -Math.PI / 2 + (i - 1.5) * 0.45, h = 19 - Math.abs(i - 1.5) * 5;
    const g = ctx.createLinearGradient(c.x, c.y, c.x + Math.cos(a) * h, c.y + Math.sin(a) * h); g.addColorStop(0, `hsl(${c.hue},60%,35%)`); g.addColorStop(1, `hsl(${c.hue},90%,80%)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(c.x + Math.cos(a + 1.57) * 5, c.y + Math.sin(a + 1.57) * 5); ctx.lineTo(c.x + Math.cos(a) * h, c.y + Math.sin(a) * h); ctx.lineTo(c.x + Math.cos(a - 1.57) * 5, c.y + Math.sin(a - 1.57) * 5); ctx.fill();
  }
}
function drawRift() {
  const r = G.rift, t = G.now;
  ctx.save(); ctx.translate(r.x, r.y);
  for (let i = 0; i < 6; i++) { ctx.strokeStyle = `hsla(${200 + i * 12},90%,${60 + i * 5}%,${0.6 - i * 0.08})`; ctx.lineWidth = 4 - i * 0.5; ctx.beginPath(); ctx.ellipse(0, 0, 54 - i * 8 + Math.sin(t * 2 + i) * 3, 24 - i * 3, t * (0.3 + i * 0.15) * (i % 2 ? -1 : 1), 0, TAU); ctx.stroke(); }
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 30); g.addColorStop(0, `rgba(230,245,255,${0.8 + Math.sin(t * 4) * 0.15})`); g.addColorStop(1, 'rgba(120,170,255,0)');
  ctx.fillStyle = g; ell(0, 0, 14, 30);
  ctx.restore();
  if (G.finale) { ctx.fillStyle = '#cfe4ff'; ctx.font = 'bold 22px Georgia'; ctx.textAlign = 'center'; ctx.fillText(Math.ceil(G.finale.t), r.x, r.y - 50); }
}
function drawFire() {
  const f = G.fire;
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, x = f.x + Math.cos(a) * 25, y = f.y + Math.sin(a) * 20; const g = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, 7); g.addColorStop(0, '#6a625a'); g.addColorStop(1, '#2a2420'); ctx.fillStyle = g; circle(x, y, 6.5); }
  ctx.fillStyle = '#1a1210'; ell(f.x, f.y, 18, 14);
  ctx.fillStyle = '#4a2a14'; ctx.save(); ctx.translate(f.x, f.y); for (const a of [0.6, 2.2, 3.7]) { ctx.rotate(a); ctx.fillRect(-17, -3, 34, 6); } ctx.restore();
  if (f.fuel <= 0) { ctx.fillStyle = '#2a2420'; circle(f.x, f.y, 10); return; }
  const s = 0.55 + f.fuel / 100;
  const glow = ctx.createRadialGradient(f.x, f.y - 6, 2, f.x, f.y - 6, 40 * s); glow.addColorStop(0, 'rgba(255,200,90,.55)'); glow.addColorStop(1, 'rgba(255,90,20,0)'); ctx.fillStyle = glow; circle(f.x, f.y - 6, 40 * s);
  for (let i = 0; i < 7; i++) {
    const t = G.now * 8 + i * 1.7, h = (17 + Math.sin(t) * 5) * s, w = (9 - i) * s;
    ctx.fillStyle = ['#a0180a', '#e03a10', '#ff6a18', '#ff9a28', '#ffc040', '#ffe070', '#fff6c0'][i];
    ctx.beginPath(); ctx.moveTo(f.x - w - 2 + Math.sin(t * 0.7) * 2, f.y - i); ctx.quadraticCurveTo(f.x - w * 0.5, f.y - h * 0.8 - i, f.x + Math.sin(t * 1.3) * 3, f.y - h * 1.4 - i); ctx.quadraticCurveTo(f.x + w * 0.5, f.y - h * 0.8 - i, f.x + w + 2 + Math.sin(t * 0.7) * 2, f.y - i); ctx.closePath(); ctx.fill();
  }
  for (const e of G.eggs) { ctx.fillStyle = '#efe4c8'; ell(f.x + 32, f.y + 18, 5, 7, 0.3); }
}
function drawTrunk(t) {
  const sh = t.shake > 0 ? Math.sin(G.now * 60) * 2 : 0;
  const g = ctx.createLinearGradient(t.x - t.r, t.y, t.x + t.r, t.y);
  const base = t.b === 3 ? '#3a3430' : '#4a3220';
  g.addColorStop(0, shade(base, 0.25)); g.addColorStop(0.6, base); g.addColorStop(1, shade(base, -0.4));
  ctx.fillStyle = g; circle(t.x + sh, t.y, t.r);
  ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(t.x + sh, t.y, t.r, 0, TAU); ctx.stroke();
  ctx.strokeStyle = shade(base, -0.3); ctx.lineWidth = 3; for (let i = 0; i < 3; i++) { const a = t.sw + i * 2.1; ctx.beginPath(); ctx.moveTo(t.x + Math.cos(a) * t.r * 0.8, t.y + Math.sin(a) * t.r * 0.8); ctx.lineTo(t.x + Math.cos(a) * (t.r + 7), t.y + Math.sin(a) * (t.r + 7)); ctx.stroke(); }
}
function drawCanopy(t) {
  const under = (L && Math.hypot(L.x - t.x, L.y - (t.y - 20)) < t.cr) ? 0.32 : 0.9;
  const sw = Math.sin(G.now * 0.8 + t.sw) * 2 + (t.shake > 0 ? Math.sin(G.now * 50) * 3 : 0);
  const s = treeSprite(t.b, t.tone, t.cr);
  ctx.globalAlpha = under; ctx.drawImage(s.c, t.x - s.S / 2 + sw, t.y - 24 - s.S / 2, s.S, s.S); ctx.globalAlpha = 1;
}

// ---- mağara
function drawCave(b) {
  const x = b.x, y = b.y, r = b.r;
  shadowAt(x + 6, y + 10, r * 1.35, r * 0.75, 0.35);
  const R = mulberry32(77);
  const pts = []; for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; pts.push([x + Math.cos(a) * r * 1.35 * (0.85 + R() * 0.25), y + Math.sin(a) * r * 0.9 * (0.85 + R() * 0.25)]); }
  const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.5, r * 0.2, x, y, r * 1.4); g.addColorStop(0, '#8a8476'); g.addColorStop(0.6, '#5e5a50'); g.addColorStop(1, '#3a3630');
  ctx.fillStyle = g; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = 'rgba(70,110,40,.45)'; for (let i = 0; i < 18; i++) circle(x + (R() - 0.5) * r * 2.2, y - r * 0.2 + (R() - 0.6) * r, 3 + R() * 7);
  ctx.strokeStyle = 'rgba(30,26,20,.5)'; ctx.lineWidth = 1.5; for (let i = 0; i < 6; i++) { const a = R() * TAU; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.2); ctx.lineTo(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.6); ctx.stroke(); }
  const mouth = ctx.createRadialGradient(x, y + r * 0.55, 2, x, y + r * 0.45, r * 0.55); mouth.addColorStop(0, '#000'); mouth.addColorStop(0.7, '#0e0a08'); mouth.addColorStop(1, 'rgba(20,16,12,0)');
  ctx.fillStyle = mouth; ctx.beginPath(); ctx.ellipse(x, y + r * 0.5, r * 0.5, r * 0.36, 0, Math.PI, TAU); ctx.lineTo(x + r * 0.5, y + r * 0.75); ctx.lineTo(x - r * 0.5, y + r * 0.75); ctx.closePath(); ctx.fill();
  if (darkness() > 0.3 || b.occ.length) { const gl = ctx.createRadialGradient(x, y + r * 0.55, 1, x, y + r * 0.55, r * 0.35); gl.addColorStop(0, 'rgba(255,150,60,.45)'); gl.addColorStop(1, 'rgba(255,120,40,0)'); ctx.fillStyle = gl; circle(x, y + r * 0.55, r * 0.35); }
  ctx.fillStyle = '#e8d8b8'; ctx.font = '11px Georgia'; ctx.textAlign = 'center';
  const n = (b.occ || []).length; if (n) ctx.fillText(`💤 ${n}`, x, y + r * 0.2);
}
// ---- yapılar
function drawBuild(b) {
  const x = b.x + (b.hit > 0 ? Math.sin(G.now * 70) * 2 : 0), y = b.y;
  if (!b.built) ctx.globalAlpha = 0.45;
  if (!BUILD[b.type].flat && b.type !== 'sifahane') shadowAt(x + 2, y + 4, b.r + 2, b.r * 0.6, 0.3);
  const T = b.type;
  if (T === 'magara') { drawCave(b); ctx.globalAlpha = 1; return; }
  if (T === 'kulube') {
    const w = b.r * 1.6, h = b.r * 1.25;
    const g = ctx.createLinearGradient(x - w / 2, y - h / 2, x + w / 2, y + h / 2); g.addColorStop(0, '#9a7444'); g.addColorStop(1, '#5a3e20');
    ctx.fillStyle = '#4a3218'; ctx.fillRect(x - w / 2 - 3, y - h / 2 - 3, w + 6, h + 6);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - w / 2, y + h / 2); ctx.lineTo(x - w / 2, y - h * 0.1); ctx.lineTo(x, y - h / 2 - 10); ctx.lineTo(x + w / 2, y - h * 0.1); ctx.lineTo(x + w / 2, y + h / 2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(40,24,8,.55)'; ctx.lineWidth = 1.2; for (let i = -4; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(x + i * w / 9, y - h / 2 - 10 + Math.abs(i) * 6); ctx.lineTo(x + i * w / 9, y + h / 2); ctx.stroke(); }
    ctx.strokeStyle = '#3a2410'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y - h / 2 - 10); ctx.lineTo(x, y + h / 2); ctx.stroke();
    ctx.fillStyle = '#1a0e06'; ctx.fillRect(x - 8, y + h / 2 - 16, 16, 16);
    if (b.built) { ctx.font = '11px serif'; ctx.textAlign = 'center'; (b.rooms || []).forEach((r, i) => ctx.fillText(ROOMS[r].ic, x - w / 2 + 12 + i * (w - 24) / Math.max(1, b.rooms.length - 1), y - 2)); if (b.occ.length) ctx.fillText('💤', x + w / 2 - 6, y - h / 2); }
  } else if (T === 'cadir') {
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a0 = b.ang + i / n * TAU, a1 = a0 + TAU / n, lit = Math.cos((a0 + a1) / 2 + 2.4);
      ctx.fillStyle = shade('#9a7a52', lit * 0.18 - 0.05);
      ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x + Math.cos(a0) * b.r, y + Math.sin(a0) * b.r * 0.85); ctx.lineTo(x + Math.cos(a1) * b.r, y + Math.sin(a1) * b.r * 0.85); ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(60,40,20,.6)'; ctx.lineWidth = 1;
    for (let i = 0; i < n; i++) { const a = b.ang + i / n * TAU; ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x + Math.cos(a) * b.r, y + Math.sin(a) * b.r * 0.85); ctx.stroke(); }
    ctx.fillStyle = '#1a1008'; ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x + Math.cos(b.ang - 0.25) * b.r, y + Math.sin(b.ang - 0.25) * b.r * 0.85); ctx.lineTo(x + Math.cos(b.ang + 0.25) * b.r, y + Math.sin(b.ang + 0.25) * b.r * 0.85); ctx.fill();
    ctx.strokeStyle = '#3a2410'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 3, y - 12); ctx.lineTo(x, y - 6); ctx.lineTo(x + 4, y - 13); ctx.stroke();
    if (b.built && b.occ.length) { ctx.font = '10px serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText('💤', x + 12, y - b.r); }
    if (b.built && !b.owners.length) { ctx.font = '9px Georgia'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,240,200,.7)'; ctx.fillText('boş', x, y + b.r + 10); }
  } else if (T === 'atolye') {
    ctx.fillStyle = '#6a4a2a'; ctx.fillRect(x - 28, y - 22, 56, 44);
    ctx.strokeStyle = '#4a3018'; ctx.lineWidth = 1; for (let i = -22; i <= 22; i += 7) { ctx.beginPath(); ctx.moveTo(x - 28, y + i); ctx.lineTo(x + 28, y + i); ctx.stroke(); }
    ctx.fillStyle = '#3a2410'; for (const [dx, dy] of [[-26, -20], [24, -20], [-26, 18], [24, 18]]) ctx.fillRect(x + dx, y + dy, 4, 4);
    ctx.fillStyle = '#8a6a44'; ctx.fillRect(x - 18, y - 8, 30, 10);
    ctx.strokeStyle = '#999'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 12, y - 4); ctx.lineTo(x - 4, y - 4); ctx.stroke();
    ctx.fillStyle = '#5a3a1e'; for (let i = 0; i < 4; i++) ell(x + 18, y + i * 4, 7, 2.5);
  } else if (T === 'kasaphane') {
    ctx.fillStyle = '#7a5a36'; ctx.fillRect(x - 20, y - 10, 40, 20);
    ctx.fillStyle = '#5a3a1e'; ctx.fillRect(x - 20, y - 10, 40, 3);
    ctx.fillStyle = '#8a1a14'; ell(x - 6, y, 7, 4); ell(x + 8, y + 2, 5, 3);
    ctx.fillStyle = 'rgba(90,0,0,.4)'; ell(x, y + 16, 14, 4);
    ctx.strokeStyle = '#4a3018'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 22, y - 20); ctx.lineTo(x + 22, y - 20); ctx.stroke();
    for (let i = -1; i <= 1; i++) { ctx.fillStyle = '#9a2a1a'; ell(x + i * 12, y - 14, 3, 5); }
  } else if (T === 'tarla') {
    ctx.fillStyle = '#5a3e22'; ell(x, y, b.r, b.r * 0.8);
    ctx.save(); ctx.beginPath(); ctx.ellipse(x, y, b.r, b.r * 0.8, 0, 0, TAU); ctx.clip();
    ctx.strokeStyle = '#3e2a16'; ctx.lineWidth = 2.5; for (let i = -b.r; i < b.r; i += 9) { ctx.beginPath(); ctx.moveTo(x - b.r, y + i); ctx.lineTo(x + b.r, y + i); ctx.stroke(); }
    if (b.planted) {
      const g = b.g;
      for (let i = -b.r + 4; i < b.r; i += 9) for (let j = -b.r + 4; j < b.r; j += 8) {
        if ((i * i) / (b.r * b.r) + (j * j) / (b.r * b.r * 0.64) > 0.85) continue;
        const px = x + j + Math.sin(G.now * 1.5 + i + j) * g * 1.5, py = y + i - 2;
        if (g < 0.35) { ctx.fillStyle = '#6aa040'; circle(px, py, 1.2 + g * 4); }
        else if (g < 1) { ctx.strokeStyle = '#4a8a2a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(px, py + 3); ctx.lineTo(px, py - 4 * g); ctx.stroke(); ctx.fillStyle = '#5a9a30'; ell(px - 2, py - 2 * g, 2.5 * g, 1.2); ell(px + 2, py - 3 * g, 2.5 * g, 1.2); }
        else { ctx.strokeStyle = '#8a7a2a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(px, py + 3); ctx.lineTo(px, py - 5); ctx.stroke(); ctx.fillStyle = '#e8c04a'; ell(px, py - 6, 1.8, 3.5); }
      }
    }
    ctx.restore();
    ctx.strokeStyle = '#6a4a28'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y, b.r, b.r * 0.8, 0, 0, TAU); ctx.stroke();
    if (b.planted && b.g >= 1 && b.built) { ctx.font = '12px serif'; ctx.textAlign = 'center'; ctx.fillText('🌾', x, y - b.r * 0.8 - 4); }
  } else if (T === 'sifahane') {
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ell(x + SUN.x, y + SUN.y, b.r + 6, b.r * 0.7);
    ctx.fillStyle = '#7a6a4a'; ctx.fillRect(x - b.r, y - b.r * 0.65, b.r * 2, b.r * 1.3);
    ctx.fillStyle = 'rgba(240,235,220,.35)'; ctx.fillRect(x - b.r, y - b.r * 0.65, b.r * 2, 7);
    for (let i = 0; i < 4; i++) { const p = bedPos(b, i); ctx.fillStyle = '#c8b898'; ctx.fillRect(p.x - 13, p.y - 5, 26, 11); ctx.fillStyle = '#e8e0d0'; ctx.fillRect(p.x - 13, p.y - 5, 7, 11); }
    ctx.fillStyle = '#4a3018'; for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ctx.fillRect(x + dx * b.r - 3, y + dy * b.r * 0.65 - 3, 6, 6);
    ctx.fillStyle = '#e8e4da'; ctx.fillRect(x - 9, y - b.r * 0.65 - 18, 18, 14); ctx.fillStyle = '#2a8a5a'; ctx.fillRect(x - 2, y - b.r * 0.65 - 16, 4, 10); ctx.fillRect(x - 6, y - b.r * 0.65 - 13, 12, 4);
  } else if (T === 'cit') {
    for (let i = -2; i <= 2; i++) { const px = x + Math.cos(b.ang + Math.PI / 2) * i * 8, py = y + Math.sin(b.ang + Math.PI / 2) * i * 8; const g = ctx.createRadialGradient(px - 1.5, py - 1.5, 0.5, px, py, 5.5); g.addColorStop(0, '#a88a5a'); g.addColorStop(1, '#5a3a1e'); ctx.fillStyle = g; circle(px, py, 5.2); }
    ctx.strokeStyle = '#4a3018'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + Math.cos(b.ang + Math.PI / 2) * -16, y + Math.sin(b.ang + Math.PI / 2) * -16); ctx.lineTo(x + Math.cos(b.ang + Math.PI / 2) * 16, y + Math.sin(b.ang + Math.PI / 2) * 16); ctx.stroke();
  } else if (T === 'duvar') {
    for (let i = -1; i <= 1; i++) { const px = x + Math.cos(b.ang + Math.PI / 2) * i * 13, py = y + Math.sin(b.ang + Math.PI / 2) * i * 13; const g = ctx.createLinearGradient(px - 8, py - 9, px + 8, py + 9); g.addColorStop(0, '#a6a298'); g.addColorStop(1, '#5e5a52'); ctx.fillStyle = g; ctx.fillRect(px - 8, py - 9, 16, 18); ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.strokeRect(px - 8, py - 9, 16, 18); }
  } else if (T === 'mesale') {
    ctx.fillStyle = '#4a3018'; ctx.fillRect(x - 3, y - 26, 6, 28);
    if (b.built) { const t = G.now * 10 + b.x; ctx.fillStyle = '#ff7a20'; ell(x, y - 30, 5, 9 + Math.sin(t) * 2); ctx.fillStyle = '#ffd060'; ell(x, y - 28, 2.5, 5); }
  } else if (T === 'kule') {
    ctx.fillStyle = '#3a2410'; for (const [dx, dy] of [[-16, -16], [16, -16], [-16, 16], [16, 16]]) ctx.fillRect(x + dx - 3, y + dy - 3, 6, 6);
    const g = ctx.createLinearGradient(x - 22, y - 30, x + 22, y + 4); g.addColorStop(0, '#9a7a4a'); g.addColorStop(1, '#5a3e22'); ctx.fillStyle = g; ctx.fillRect(x - 22, y - 30, 44, 34);
    ctx.fillStyle = '#4a3018'; ctx.fillRect(x - 22, y - 30, 44, 6);
    if (b.built) { const t = G.now * 10 + b.x; ctx.fillStyle = '#ff8a30'; ell(x + 18, y - 36, 4, 7 + Math.sin(t) * 2); }
    if (b.guard && dist(b.guard, b) < 12) { ctx.fillStyle = JMAP(b.guard); circle(x, y - 14, 8); ctx.fillStyle = b.guard.skin; circle(x + 2, y - 15, 5); }
  } else if (T === 'raf') {
    ctx.strokeStyle = '#5a3d22'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 16, y - 10); ctx.lineTo(x + 16, y - 10); ctx.moveTo(x - 14, y + 6); ctx.lineTo(x - 14, y - 14); ctx.moveTo(x + 14, y + 6); ctx.lineTo(x + 14, y - 14); ctx.stroke();
    ctx.fillStyle = '#8a2a1a'; for (let i = -2; i <= 2; i++) ctx.fillRect(x + i * 6 - 2, y - 9, 4, 10);
  } else if (T === 'tuzak') {
    ctx.strokeStyle = '#7a5a30'; ctx.lineWidth = 3; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 4, y + Math.sin(a) * 4); ctx.lineTo(x + Math.cos(a) * 15, y + Math.sin(a) * 15); ctx.stroke(); }
    ctx.fillStyle = '#3a2a18'; circle(x, y, 5);
  }
  ctx.globalAlpha = 1;
  if (!b.built) {
    ctx.strokeStyle = 'rgba(190,220,255,.8)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.arc(x, y, b.r + 4, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 2; for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.4; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * b.r, y + Math.sin(a) * b.r); ctx.lineTo(x + Math.cos(a) * b.r * 0.6, y + Math.sin(a) * b.r * 0.6 - 10); ctx.stroke(); }
    hpBar(x, y - b.r - 12, b.prog / b.need, 34);
  } else if (b.hp < b.maxhp && !BUILD[b.type].flat) hpBar(x, y - b.r - 12, b.hp / b.maxhp, 30);
}
function drawCarcass(c) {
  const k = clamp(c.meat / (DINO[c.type].drop.meat || 1), 0, 1), r = c.r;
  ctx.fillStyle = 'rgba(80,0,0,.45)'; ell(c.x, c.y + 3, r * 1.3, r * 0.75);
  ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.ang);
  const col = c.rotten ? '#5a5a3a' : DINO[c.type].col;
  if (k > 0.05) { ctx.fillStyle = bodyGrad(r * 0.6 * (0.5 + k * 0.5), shade(col, -0.2)); ell(0, 0, r * 0.95 * (0.6 + k * 0.4), r * 0.55 * (0.5 + k * 0.5)); ctx.fillStyle = shade(col, -0.25); ell(-r * 1.1, 0, r * 0.6, r * 0.14); ell(r * 0.95, 0, r * 0.35, r * 0.25); }
  ctx.strokeStyle = '#e8e0cc'; ctx.lineWidth = Math.max(1, r * 0.06);
  for (let i = -3; i <= 3; i++) { if (k > 0.6 && Math.abs(i) < 2) continue; ctx.beginPath(); ctx.moveTo(i * r * 0.18, -r * 0.35); ctx.quadraticCurveTo(i * r * 0.18 + r * 0.05, 0, i * r * 0.18, r * 0.35); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(-r * 0.7, 0); ctx.lineTo(r * 0.7, 0); ctx.stroke();
  ctx.fillStyle = '#9a1a12'; if (k > 0.1) ell(r * 0.1, 0, r * 0.25 * k, r * 0.15 * k);
  ctx.restore();
  if (c.rotten) { ctx.fillStyle = '#111'; for (let i = 0; i < 6; i++) { const a = G.now * 4 + i * 1.3; circle(c.x + Math.cos(a) * r * 0.7, c.y - 8 + Math.sin(a * 1.4) * r * 0.4, 1.1); } }
}
const JMAP = p => p.leader ? '#8a3a1a' : p.child ? '#b89a6a' : (GROUPS[p.group] || GROUPS.bos).col;
function cannibalView(d) {
  return { x: d.x, y: d.y, ang: d.ang, anim: d.anim, moving: d.moving, skin: '#6a4a32', hair: '#111', hurtT: d.hurt, swing: d.swing || 0, cannibal: true, id: d.id, hp: d.hp, maxhp: d.maxhp, carry: 0, bag: {}, eq: {} };
}

// ---- insanlar
function drawPerson(p) {
  const sc = p.child ? 0.7 : 1;
  const lying = p.downed > 0 || p.bed || p.carriedBy;
  shadowAt(p.x, p.y + 6 * sc, 10 * sc, 5 * sc, 0.3);
  if (lying) {
    if (p.downed > 0) { ctx.fillStyle = 'rgba(110,0,0,.5)'; ell(p.x, p.y + 4, 16, 9); }
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.bed ? Math.PI / 2 : Math.PI / 2 + (p.id % 3) * 0.4); ctx.scale(sc, sc);
    const tunic = p.downed > 0 ? '#5a5050' : JMAP(p);
    ctx.fillStyle = bodyGrad(8, tunic); ell(0, 2, 7, 10);
    ctx.strokeStyle = shade(tunic, -0.3); ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-4, 10); ctx.lineTo(-5, 18); ctx.moveTo(4, 10); ctx.lineTo(5, 18); ctx.stroke();
    if (p.downed > 0) { ctx.beginPath(); ctx.moveTo(-6, -2); ctx.lineTo(-13, 4 + Math.sin(G.now * 3) * 2); ctx.stroke(); }
    ctx.fillStyle = p.skin; circle(0, -10, 5.4); ctx.fillStyle = p.hair; ctx.beginPath(); ctx.arc(0, -11, 5.6, Math.PI, TAU); ctx.fill();
    if (p.bed) { ctx.fillStyle = 'rgba(230,225,210,.92)'; ctx.fillRect(-9, -2, 18, 15); }
    ctx.restore();
    if (p.downed > 0) { ctx.strokeStyle = '#f66'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 18, -Math.PI / 2, -Math.PI / 2 + TAU * (p.downed / 25)); ctx.stroke(); }
    if (p.bed && p.hp < p.maxhp) hpBar(p.x, p.y - 14, p.hp / p.maxhp, 20);
    return;
  }
  const mv = p.moving, ph = p.anim || 0, s = Math.sin(ph), c2 = Math.cos(ph);
  const working = !mv && !p.child && p.work > 0.05 && !p.cannibal;
  const bob = mv ? Math.abs(c2) * 1.3 : Math.sin(G.now * 1.8 + (p.id || 0)) * 0.25;
  const tunic = p.hurtT > 0 ? '#ffffff' : p.cannibal ? '#2a1e16' : JMAP(p);
  ctx.save(); ctx.translate(p.x, p.y - bob * 0.6); ctx.rotate(p.ang + (mv ? s * 0.06 : 0)); ctx.scale(sc, sc);
  if (p.leader) { const w = mv ? s * 2 : Math.sin(G.now * 1.3) * 0.6; const g = ctx.createLinearGradient(-15, 0, -2, 0); g.addColorStop(0, '#3a0e06'); g.addColorStop(1, '#6a2412'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-2, -8); ctx.lineTo(-16, -11 + w); ctx.quadraticCurveTo(-19, 0, -16, 11 + w); ctx.lineTo(-2, 8); ctx.fill(); }
  const stride = mv ? 6.5 : 0, fl = s * stride, fr = -s * stride;
  ctx.lineCap = 'round';
  ctx.strokeStyle = shade(tunic, -0.45); ctx.lineWidth = 3.6;
  ctx.beginPath(); ctx.moveTo(0, -3.5); ctx.lineTo(fl, -4); ctx.moveTo(0, 3.5); ctx.lineTo(fr, 4); ctx.stroke();
  ctx.fillStyle = '#2a1e12'; ell(fl + 1.8, -4, 3.8, 2.5); ell(fr + 1.8, 4, 3.8, 2.5);
  let lh, rh;
  if (working) { const w = Math.sin(G.now * 11); lh = [7 + w * 4, -4]; rh = [7 + w * 4, 4]; }
  else if (p.swing > 0) { lh = [4, -8]; rh = [17, 4]; }
  else if (p.carrying) { lh = [-8, -6]; rh = [-8, 6]; }
  else if (mv) { lh = [-s * 6 + 2, -9]; rh = [s * 6 + 2, 9]; }
  else { const br = Math.sin(G.now * 1.6 + (p.id || 0)) * 0.6; lh = [1.5, -9 - br * 0.4]; rh = [1.5, 9 + br * 0.4]; }
  ctx.fillStyle = bodyGrad(8.6, tunic); ell(0, 0, 6.6, 8.7);
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1; ctx.stroke();
  ctx.strokeStyle = shade(tunic, -0.5); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-1.5, -7); ctx.lineTo(-1.5, 7); ctx.stroke();
  if (p.cannibal) { ctx.fillStyle = '#e8e0cc'; for (let i = -2; i <= 2; i++) circle(3, i * 2.6, 1.1); }
  if (p.eq && p.eq.zirh) { ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, 6.6, 8.7, 0, 0, TAU); ctx.stroke(); ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 1; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(-5, i * 4); ctx.lineTo(4, i * 4); ctx.stroke(); } }
  ctx.strokeStyle = p.cannibal ? p.skin : shade(tunic, -0.12); ctx.lineWidth = 3.2;
  ctx.beginPath(); ctx.moveTo(0, -6.5); ctx.lineTo(lh[0], lh[1]); ctx.moveTo(0, 6.5); ctx.lineTo(rh[0], rh[1]); ctx.stroke();
  ctx.fillStyle = p.skin; circle(lh[0], lh[1], 2.2); circle(rh[0], rh[1], 2.2);
  const armed = p.cannibal || p.leader || (!p.child && (p.group === 'muhafiz' || p.group === 'takip' || p.group === 'avci'));
  if (working) {
    const g = p.group;
    ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(rh[0] - 3, rh[1] - 2); ctx.lineTo(rh[0] + 9, rh[1] - 6); ctx.stroke();
    if (g === 'odun') { ctx.fillStyle = p.eq && p.eq.balta ? '#9a9a9a' : '#7a6a5a'; ctx.fillRect(rh[0] + 7, rh[1] - 9, 4, 6); }
    else if (g === 'tas') { ctx.strokeStyle = '#999'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(rh[0] + 6, rh[1] - 11); ctx.lineTo(rh[0] + 11, rh[1] - 2); ctx.stroke(); }
    else if (g === 'kasap') { ctx.fillStyle = '#ccc'; ctx.fillRect(rh[0] + 6, rh[1] - 7, 6, 2); }
    else if (g === 'zanaat' || g === 'mimar') { ctx.fillStyle = '#777'; ctx.fillRect(rh[0] + 7, rh[1] - 9, 5, 4); }
    else if (g === 'ciftci') { ctx.strokeStyle = '#aaa'; ctx.beginPath(); ctx.arc(rh[0] + 10, rh[1] - 6, 4, -1, 1.5); ctx.stroke(); }
  } else if (armed) {
    if (!p.cannibal && p.eq && p.eq.yay && (p.group === 'avci' || (p.leader && G.shootCd > 0.3))) { ctx.strokeStyle = '#7a5a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(rh[0] + 2, rh[1] - 4, 10, -1.3, 1.3); ctx.stroke(); ctx.strokeStyle = 'rgba(230,220,200,.7)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(rh[0] + 2 + Math.cos(-1.3) * 10, rh[1] - 4 + Math.sin(-1.3) * 10); ctx.lineTo(rh[0] + 2 + Math.cos(1.3) * 10, rh[1] - 4 + Math.sin(1.3) * 10); ctx.stroke(); }
    else {
      const tier = p.cannibal ? 2 : spearTier(p);
      ctx.strokeStyle = '#6a4520'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(rh[0] - 15, rh[1]); ctx.lineTo(rh[0] + 18, rh[1]); ctx.stroke();
      ctx.fillStyle = p.cannibal ? '#e8e0cc' : tier === 3 ? '#eee6d0' : tier === 2 ? '#9a9a9a' : '#b89060';
      ctx.beginPath(); ctx.moveTo(rh[0] + 26, rh[1]); ctx.lineTo(rh[0] + 17, rh[1] - 3.5); ctx.lineTo(rh[0] + 17, rh[1] + 3.5); ctx.fill();
    }
  }
  if (p.leader && G.torchOn) { ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(lh[0], lh[1]); ctx.lineTo(lh[0] + 6, lh[1] - 4); ctx.stroke(); ctx.fillStyle = '#ff9030'; circle(lh[0] + 7, lh[1] - 5, 3.6 + Math.random() * 1.4); ctx.fillStyle = '#ffe080'; circle(lh[0] + 7, lh[1] - 5, 1.8); }
  if (p.carry > 0) { const k = Object.keys(p.bag)[0]; ctx.fillStyle = k === 'wood' ? '#7a5028' : k === 'stone' ? '#999' : k === 'crystal' ? '#7ac' : k === 'herb' ? '#5a5' : k === 'poison' ? '#a5c' : k === 'food' ? '#a33' : '#cba'; ctx.fillRect(-12, -5, 6, 10); ctx.strokeStyle = '#2a1a0a'; ctx.lineWidth = 1; ctx.strokeRect(-12, -5, 6, 10); }
  const hg = ctx.createRadialGradient(0, -1.5, 0.5, 1.5, 0, 6); hg.addColorStop(0, shade(p.skin, 0.2)); hg.addColorStop(1, shade(p.skin, -0.2));
  ctx.fillStyle = hg; circle(1.5, 0, 5.4);
  ctx.fillStyle = p.hair; ctx.beginPath(); ctx.arc(0.6, 0, 5.7, Math.PI * 0.5, Math.PI * 1.5); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.beginPath(); ctx.arc(-0.5, -1.5, 3, Math.PI, Math.PI * 1.4); ctx.fill();
  ctx.fillStyle = shade(p.skin, -0.25); circle(6.3, 0, 1.3);
  if (p.cannibal) { ctx.strokeStyle = '#efe6d2'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(3, -4); ctx.lineTo(3, 4); ctx.moveTo(5, -3); ctx.lineTo(5, 3); ctx.stroke(); ctx.fillStyle = '#c33'; circle(-2, -5, 1.6); circle(-2, 5, 1.6); }
  ctx.restore();
  if (p.leader) { ctx.strokeStyle = 'rgba(255,200,100,.55)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, 17, 0, TAU); ctx.stroke(); }
  if (p.isRescue) { ctx.fillStyle = '#fff'; ctx.font = 'bold 16px Georgia'; ctx.textAlign = 'center'; ctx.fillText('!', p.x, p.y - 18 + Math.sin(G.now * 6) * 2); }
  if (p.hp < p.maxhp) hpBar(p.x, p.y - 20, p.hp / p.maxhp, 22);
}
function drawMimic(d) {
  if (!d.revealed) {
    const fake = { x: d.x, y: d.y, ang: d.ang + (d.tilt || 0) * 0.15, anim: d.anim, moving: d.moving, skin: d.disguise.skin, hair: d.disguise.hair, group: d.disguise.group, hurtT: d.hurt, id: d.id, hp: 1, maxhp: 1, carry: 0, bag: {}, eq: {}, swing: 0, work: 0 };
    drawPerson(fake);
    if (Math.sin(G.now * 2 + d.id) > 0.85) { ctx.fillStyle = 'rgba(255,255,255,.85)'; circle(d.x + Math.cos(d.ang) * 6 - Math.sin(d.ang) * 2, d.y + Math.sin(d.ang) * 6 + Math.cos(d.ang) * 2, 1); circle(d.x + Math.cos(d.ang) * 6 + Math.sin(d.ang) * 2, d.y + Math.sin(d.ang) * 6 - Math.cos(d.ang) * 2, 1); }
    return;
  }
  const s = Math.sin(d.anim);
  shadowAt(d.x, d.y + 8, 14, 6, 0.35);
  ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.ang);
  ctx.strokeStyle = '#cfc4b8'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-2, -5); ctx.lineTo(-10 + s * 8, -9); ctx.moveTo(-2, 5); ctx.lineTo(-10 - s * 8, 9); ctx.stroke();
  const reach = d.swing > 0 ? 34 : 22;
  ctx.beginPath(); ctx.moveTo(2, -7); ctx.quadraticCurveTo(12, -16, reach, -10 + s * 3); ctx.moveTo(2, 7); ctx.quadraticCurveTo(12, 16, reach, 10 - s * 3); ctx.stroke();
  ctx.strokeStyle = '#1a1414'; ctx.lineWidth = 1.2; for (const sy of [-1, 1]) for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(reach, sy * (10 - s * 3 * sy)); ctx.lineTo(reach + 6, sy * (10 - s * 3 * sy) + k * 3); ctx.stroke(); }
  ctx.fillStyle = bodyGrad(9, '#d8d0c8'); ell(-2, 0, 11, 6.5);
  ctx.strokeStyle = 'rgba(80,60,60,.6)'; ctx.lineWidth = 1; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(-8 + i * 2.5, -5); ctx.lineTo(-8 + i * 2.5, 5); ctx.stroke(); }
  ctx.fillStyle = '#e8e2da'; ell(9, 0, 7, 6);
  ctx.fillStyle = '#140808'; ell(13, 0, 4.5, 4 + Math.sin(G.now * 12) * 1.5);
  ctx.fillStyle = '#fff'; for (let i = -2; i <= 2; i++) ctx.fillRect(10 + Math.abs(i) * 0.5, i * 1.6 - 0.4, 2, 0.8);
  ctx.fillStyle = '#ff2a1a'; circle(7, -3, 1.4); circle(7, 3, 1.4);
  ctx.restore();
  if (d.hp < d.maxhp) hpBar(d.x, d.y - 24, d.hp / d.maxhp, 26);
}
function drawCamp(c) {
  ctx.fillStyle = 'rgba(40,28,18,.75)'; ell(c.x, c.y, c.r + 30, c.r + 10);
  for (const [hx, hy] of c.huts) {
    const x = c.x + hx, y = c.y + hy;
    shadowAt(x, y + 4, 22, 10, 0.35);
    ctx.fillStyle = c.alive ? '#3a2a1e' : '#1e1a16'; ctx.beginPath(); ctx.moveTo(x - 22, y + 14); ctx.lineTo(x, y - 22); ctx.lineTo(x + 22, y + 14); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#d8ccb4'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 8, y - 14); ctx.lineTo(x + 8, y - 14); ctx.stroke();
    ctx.fillStyle = '#e8e0cc'; circle(x, y - 20, 3);
  }
  ctx.fillStyle = '#cfc6b0'; for (let i = 0; i < 10; i++) { const a = i * 0.8 + c.i, r = 40 + (i * 13) % 50; circle(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r * 0.8, 2.5); }
  if (c.alive) {
    ctx.fillStyle = '#2a1a10'; circle(c.x + 30, c.y - 10, 10);
    for (let i = 0; i < 4; i++) { const t = G.now * 9 + i; ctx.fillStyle = ['#a0180a', '#e0401a', '#ff8030', '#ffc060'][i]; ell(c.x + 30, c.y - 14 - i * 2, 6 - i, 9 - i + Math.sin(t) * 2); }
    const g = ctx.createLinearGradient(c.x - 5, 0, c.x + 5, 0); g.addColorStop(0, '#6a4a2a'); g.addColorStop(1, '#2a1a0a'); ctx.fillStyle = g; ctx.fillRect(c.x - 5, c.y - 50, 10, 46);
    for (let i = 0; i < 3; i++) { ctx.fillStyle = '#e8e0cc'; circle(c.x, c.y - 44 + i * 13, 6); ctx.fillStyle = '#111'; circle(c.x - 2, c.y - 45 + i * 13, 1.4); circle(c.x + 2, c.y - 45 + i * 13, 1.4); ctx.fillRect(c.x - 2, c.y - 41 + i * 13, 4, 1); }
    if (c.totem < 250) hpBar(c.x, c.y - 62, c.totem / 250, 34);
  } else { ctx.fillStyle = '#1a1410'; circle(c.x + 30, c.y - 10, 12); ctx.fillStyle = '#3a2a1a'; ctx.save(); ctx.translate(c.x, c.y - 4); ctx.rotate(1.2); ctx.fillRect(-4, -20, 8, 40); ctx.restore(); }
  c.captives.forEach((cp, k) => {
    const x = c.x - 30 + k * 24, y = c.y + 34, v = cp.p;
    ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y - 18); ctx.lineTo(x, y + 6); ctx.stroke();
    ctx.fillStyle = (GROUPS[v.group] || GROUPS.bos).col; ell(x, y, 6, 8);
    ctx.fillStyle = v.skin; circle(x + Math.sin(G.now * 4 + k) * 1.5, y - 9, 5);
    ctx.strokeStyle = '#c8b080'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x - 6, y - 2); ctx.lineTo(x + 6, y - 2); ctx.moveTo(x - 6, y + 3); ctx.lineTo(x + 6, y + 3); ctx.stroke();
  });
}

// =============================================================
//  YARATIKLAR
// =============================================================
function legPair(r, step, y0, len, col, quad) {
  ctx.fillStyle = col;
  for (const s of [-1, 1]) {
    const f = step * s, fx = f * r * 0.38;
    ctx.beginPath(); ctx.ellipse(fx * 0.4, s * r * y0, r * 0.26, r * 0.17, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(fx, s * r * (y0 + 0.12), r * 0.14 * len, r * 0.1, 0, 0, TAU); ctx.fill();
    if (!quad) { ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, r * 0.05); for (const t of [-0.3, 0, 0.3]) { ctx.beginPath(); ctx.moveTo(fx + r * 0.1, s * r * (y0 + 0.12)); ctx.lineTo(fx + r * 0.22, s * r * (y0 + 0.12) + t * r * 0.2); ctx.stroke(); } }
  }
}
function drawDino(d) {
  const def = DINO[d.type], r = d.r, mv = d.moving, step = mv ? Math.sin(d.anim) : 0;
  shadowAt(d.x, d.y + r * 0.25, r * 1.35, r * 0.55, 0.32);
  ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.ang);
  { const br = 1 + Math.sin(G.now * 2.2 + d.id) * 0.015; ctx.scale(br, br); }
  let col = d.hurt > 0 ? '#e8d0d0' : def.col;
  if (d.poison > 0 && d.hurt <= 0) col = '#6a7a3a';
  const dk = shade(col, -0.4), lt = shade(col, 0.25);
  const T = d.type;
  if (T === 'boynuzlu' || T === 'zirhli' || T === 'ordek' || T === 'gurleyen' || T === 'uzunboyun') drawQuad(d, r, col, dk, lt, step);
  else if (T === 'batakci') drawCrocBody(d, r, col, dk, step);
  else drawTheropod(d, r, col, dk, lt, step);
  ctx.restore();
  if ((d.hp < d.maxhp && T !== 'kucuk') || d.tamed) hpBar(d.x, d.y - r - 12, d.hp / d.maxhp, Math.max(26, r * 1.4));
  if (d.tamed) { ctx.fillStyle = '#9f9'; ctx.font = '11px Georgia'; ctx.textAlign = 'center'; ctx.fillText(d.pet ? '♥ yavru' : '♥', d.x, d.y - r - 16); }
  if (d.ko > 0) { ctx.font = `${Math.max(12, r * 0.5)}px serif`; ctx.textAlign = 'center'; ctx.fillText('💫', d.x, d.y - r); }
}
function drawTheropod(d, r, col, dk, lt, step) {
  const T = d.type, def = DINO[T];
  const sway = Math.sin(d.moving ? d.anim * 0.5 : G.now * 1.2 + d.id) * r * (d.moving ? 0.28 : 0.12);
  const slim = T === 'geceavcisi' ? 0.8 : T === 'kucuk' ? 0.85 : T === 'kesici' ? 0.82 : 1;
  legPair(r, step, 0.38 * slim, 1.2, dk, false);
  ctx.fillStyle = bodyGrad(r * 0.4, col);
  ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.34 * slim); ctx.quadraticCurveTo(-r * 1.45, sway * 0.5 - r * 0.12, -r * (T === 'yelken' ? 2.6 : 2.25), sway); ctx.quadraticCurveTo(-r * 1.45, sway * 0.5 + r * 0.12, -r * 0.5, r * 0.34 * slim); ctx.fill();
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = bodyGrad(r * 0.55 * slim, col); ell(0, 0, r * 0.97, r * 0.53 * slim); ctx.stroke();
  ctx.strokeStyle = dk; ctx.lineWidth = Math.max(1, r * 0.07);
  if (T === 'yirtici') { for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * r * 0.25, -r * 0.42); ctx.quadraticCurveTo(i * r * 0.25 - r * 0.12, 0, i * r * 0.25, r * 0.42); ctx.stroke(); } ctx.fillStyle = '#c87a3a'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-r * 0.6 + i * r * 0.28, -r * 0.05); ctx.lineTo(-r * 0.5 + i * r * 0.28, -r * 0.28); ctx.lineTo(-r * 0.4 + i * r * 0.28, -r * 0.05); ctx.fill(); } }
  else if (T === 'dev') { ctx.fillStyle = shade(col, -0.25); for (let i = 0; i < 9; i++) ell(-r * 0.6 + (i % 5) * r * 0.3, (i % 2 ? -1 : 1) * r * 0.22, r * 0.09, r * 0.06); ctx.strokeStyle = 'rgba(120,40,30,.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-r * 0.2, -r * 0.4); ctx.lineTo(r * 0.2, -r * 0.1); ctx.moveTo(-r * 0.1, -r * 0.42); ctx.lineTo(r * 0.28, -r * 0.14); ctx.stroke(); ctx.strokeStyle = dk; ctx.lineWidth = r * 0.06; ctx.beginPath(); ctx.moveTo(-r * 1.5, sway * 0.7); ctx.quadraticCurveTo(-r * 0.6, 0, r * 0.7, 0); ctx.stroke(); }
  else if (T === 'yelken') {
    const fin = ctx.createLinearGradient(0, -r * 0.5, 0, r * 0.5); fin.addColorStop(0, '#5a1a10'); fin.addColorStop(0.5, '#c0502a'); fin.addColorStop(1, '#5a1a10');
    ctx.fillStyle = fin; ctx.beginPath(); ctx.moveTo(-r * 1.0, 0); ctx.quadraticCurveTo(-r * 0.2, -r * 0.55, r * 0.6, 0); ctx.quadraticCurveTo(-r * 0.2, r * 0.55, -r * 1.0, 0); ctx.fill();
    ctx.strokeStyle = 'rgba(40,10,5,.8)'; ctx.lineWidth = 1.2; for (let i = 0; i < 8; i++) { const x = -r * 0.9 + i * r * 0.2, h = r * 0.42 * Math.sin((i + 1) / 9 * Math.PI); ctx.beginPath(); ctx.moveTo(x, -h); ctx.lineTo(x, h); ctx.stroke(); }
  }
  else if (T === 'kesici') { ctx.strokeStyle = '#2a1e16'; ctx.lineWidth = Math.max(1, r * 0.06); for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * r * 0.2, -r * 0.45); ctx.lineTo(i * r * 0.2 + r * 0.08, r * 0.45); ctx.stroke(); } ctx.fillStyle = '#6a1a10'; for (let i = 0; i < 6; i++) ell(-r * 0.7 + i * r * 0.26, 0, r * 0.07, r * 0.14); ctx.strokeStyle = '#e8e0cc'; ctx.lineWidth = 2; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(r * 0.12, s * r * 0.62, r * 0.18, s > 0 ? -0.2 : 0.2 - Math.PI, s > 0 ? 1.4 : -1.4 - Math.PI, s < 0); ctx.stroke(); } }
  else if (T === 'geceavcisi') { ctx.strokeStyle = 'rgba(200,220,210,.45)'; ctx.lineWidth = 1; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * r * 0.22, -r * 0.35); ctx.lineTo(i * r * 0.22 - r * 0.08, r * 0.35); ctx.stroke(); } }
  else if (T === 'kucuk' || T === 'tukurgec') { ctx.beginPath(); ctx.moveTo(-r * 1.5, sway * 0.7); ctx.quadraticCurveTo(-r * 0.6, 0, r * 0.7, 0); ctx.stroke(); ctx.fillStyle = shade(col, 0.2); for (let i = 0; i < 4; i++) circle(-r * 0.4 + i * r * 0.25, (i % 2 ? 1 : -1) * r * 0.2, r * 0.06); }
  if (T === 'dev') { ctx.fillStyle = dk; circle(r * 0.7, -r * 0.3, r * 0.08); circle(r * 0.7, r * 0.3, r * 0.08); }
  else { ctx.strokeStyle = dk; ctx.lineWidth = Math.max(1.5, r * 0.1); const a = Math.sin(G.now * 3 + d.id) * r * 0.05; ctx.beginPath(); ctx.moveTo(r * 0.5, -r * 0.35); ctx.lineTo(r * 0.85 + a, -r * 0.47); ctx.moveTo(r * 0.5, r * 0.35); ctx.lineTo(r * 0.85 - a, r * 0.47); ctx.stroke(); }
  const hb = d.moving ? Math.sin(d.anim * 2) * r * 0.07 : Math.sin(G.now * 1.5 + d.id) * r * 0.03;
  if (T === 'tukurgec' && d.frill > 0) { ctx.fillStyle = 'rgba(235,100,30,.92)'; ell(r * 0.75, hb, r * 0.3, r * 1.05); ctx.strokeStyle = '#6a1a0a'; ctx.lineWidth = 1.5; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(r * 0.75, hb); ctx.lineTo(r * 1.0, hb + i * r * 0.3); ctx.stroke(); } }
  ctx.save(); ctx.translate(0, hb);
  const hl = T === 'dev' ? 1.0 : T === 'yelken' ? 1.05 : 0.85, hw = T === 'dev' ? 0.62 : T === 'yelken' ? 0.75 : 0.45, hh = T === 'dev' ? 0.42 : T === 'yelken' ? 0.22 : 0.28;
  ctx.fillStyle = bodyGrad(r * hh, col); ell(r * hl, 0, r * hw, r * hh); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.2; ctx.stroke();
  const open = d.atkCd > def.cd * 0.55 || d.carry || (T === 'dev' && d.roarT > 16);
  const jaw = open ? 0.2 : 0.04;
  ctx.fillStyle = open ? '#4a0a0a' : shade(col, -0.2);
  ctx.beginPath(); ctx.moveTo(r * (hl + 0.08), -r * jaw); ctx.lineTo(r * (hl + hw), 0); ctx.lineTo(r * (hl + 0.08), r * jaw); ctx.fill();
  if (open || T === 'dev' || T === 'yelken') { ctx.fillStyle = '#efe8d8'; const n = T === 'dev' ? 6 : 4; for (let i = 0; i < n; i++) { const x = r * (hl + 0.1 + i * hw * 0.8 / n); ctx.beginPath(); ctx.moveTo(x, -r * jaw - 0.5); ctx.lineTo(x + 1.5, -r * jaw + r * 0.05); ctx.lineTo(x + 3, -r * jaw - 0.5); ctx.fill(); ctx.beginPath(); ctx.moveTo(x, r * jaw + 0.5); ctx.lineTo(x + 1.5, r * jaw - r * 0.05); ctx.lineTo(x + 3, r * jaw + 0.5); ctx.fill(); } }
  const ex = r * (hl + hw * 0.15), ey = r * hh * 0.6, er = Math.max(1.3, r * (T === 'geceavcisi' ? 0.13 : 0.07));
  ctx.fillStyle = darkness() > 0.5 && !d.tamed ? def.eye : '#f0d040'; circle(ex, -ey, er); circle(ex, ey, er);
  ctx.fillStyle = '#000'; circle(ex + er * 0.2, -ey, er * 0.45); circle(ex + er * 0.2, ey, er * 0.45);
  if (T === 'tukurgec') { ctx.strokeStyle = '#c84a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(r * 0.6, -r * 0.12); ctx.lineTo(r * 1.15, -r * 0.05); ctx.moveTo(r * 0.6, r * 0.12); ctx.lineTo(r * 1.15, r * 0.05); ctx.stroke(); }
  ctx.restore();
  if (d.mother) { ctx.strokeStyle = '#f33'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r * 1.2, 0, TAU); ctx.stroke(); }
}
function drawQuad(d, r, col, dk, lt, step) {
  const T = d.type, sway = Math.sin(d.moving ? d.anim * 0.5 : G.now * 1.1 + d.id) * r * 0.15;
  ctx.fillStyle = dk;
  for (const [lx, ly, s] of [[0.5, -0.55, 1], [0.5, 0.55, -1], [-0.45, -0.55, -1], [-0.45, 0.55, 1]]) { ell(r * lx + step * s * r * 0.15, r * ly, r * 0.22, r * 0.16); ell(r * lx + step * s * r * 0.22 + r * 0.05, r * ly * 1.2, r * 0.12, r * 0.1); }
  if (T === 'uzunboyun') {
    const sw = Math.sin(G.now * 0.8 + d.id) * r * 0.3;
    ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineWidth = r * 0.34; ctx.beginPath(); ctx.moveTo(-r * 0.8, 0); ctx.quadraticCurveTo(-r * 1.8, sw, -r * 2.6, sw * 1.5); ctx.stroke();
    ctx.fillStyle = bodyGrad(r * 0.7, col); ell(0, 0, r * 1.02, r * 0.72); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = r * 0.27; ctx.beginPath(); ctx.moveTo(r * 0.7, 0); ctx.quadraticCurveTo(r * 1.6, -sw * 0.6, r * 2.3, -sw); ctx.stroke();
    ctx.strokeStyle = lt; ctx.lineWidth = r * 0.07; ctx.beginPath(); ctx.moveTo(r * 0.7, 0); ctx.quadraticCurveTo(r * 1.6, -sw * 0.6, r * 2.3, -sw); ctx.stroke(); ctx.lineCap = 'butt';
    ctx.fillStyle = bodyGrad(r * 0.2, col); ell(r * 2.42, -sw, r * 0.28, r * 0.2); ctx.fillStyle = '#111'; circle(r * 2.5, -sw - r * 0.08, r * 0.03); circle(r * 2.5, -sw + r * 0.08, r * 0.03);
    ctx.fillStyle = dk; for (let i = 0; i < 6; i++) circle(-r * 0.6 + i * r * 0.25, 0, r * 0.07);
    return;
  }
  ctx.fillStyle = bodyGrad(r * 0.3, col);
  ctx.beginPath(); ctx.moveTo(-r * 0.85, -r * 0.22); ctx.quadraticCurveTo(-r * 1.4, sway * 0.5, -r * (T === 'zirhli' ? 1.75 : 1.7), sway); ctx.quadraticCurveTo(-r * 1.4, sway * 0.5 + r * 0.05, -r * 0.85, r * 0.22); ctx.fill();
  if (T === 'zirhli') { const sw2 = d.swing > 0 ? Math.sin(d.swing * 15) * r * 0.5 : 0; ctx.fillStyle = shade(col, -0.2); ell(-r * 1.85, sway + sw2, r * 0.26, r * 0.2); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.2; ctx.stroke(); }
  const bw = T === 'ordek' ? 0.55 : T === 'gurleyen' ? 0.5 : 0.68;
  ctx.fillStyle = bodyGrad(r * bw, col); ell(0, 0, r * 1.05, r * bw); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.4; ctx.stroke();
  if (T === 'zirhli') {
    ctx.fillStyle = shade(col, -0.15); ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 0.8;
    for (let i = -3; i <= 3; i++) for (let j = -2; j <= 2; j++) { const x = i * r * 0.25, y = j * r * 0.2; if ((x * x) / (r * r) + (y * y) / (r * r * 0.4) > 0.75) continue; ctx.beginPath(); ctx.arc(x, y, r * 0.09, 0, TAU); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = '#d8d0b8'; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * r * 0.25, -r * 0.6); ctx.lineTo(i * r * 0.25 + r * 0.06, -r * 0.8); ctx.lineTo(i * r * 0.25 + r * 0.12, -r * 0.6); ctx.fill(); ctx.beginPath(); ctx.moveTo(i * r * 0.25, r * 0.6); ctx.lineTo(i * r * 0.25 + r * 0.06, r * 0.8); ctx.lineTo(i * r * 0.25 + r * 0.12, r * 0.6); ctx.fill(); }
  } else { ctx.fillStyle = shade(col, -0.25); ell(-r * 0.1, 0, r * 0.7, r * 0.12); }
  if (T === 'ordek') { ctx.strokeStyle = shade(col, 0.25); ctx.lineWidth = 1; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-r * 0.6 + i * r * 0.3, -r * 0.4); ctx.lineTo(-r * 0.7 + i * r * 0.3, r * 0.4); ctx.stroke(); } }
  if (d.tamed && T === 'boynuzlu' && (G.stock.eyer || 0) > 0) { ctx.fillStyle = '#5a3418'; ctx.fillRect(-r * 0.3, -r * 0.45, r * 0.5, r * 0.9); }
  const hb = d.moving ? Math.sin(d.anim) * r * 0.04 : Math.sin(G.now * 0.9 + d.id) * r * 0.05;
  ctx.save(); ctx.translate(0, hb);
  if (T === 'boynuzlu') {
    ctx.fillStyle = bodyGrad(r * 0.7, shade(col, -0.15)); ell(r * 0.95, 0, r * 0.32, r * 0.74); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = '#e8dcc0'; for (let i = -3; i <= 3; i++) circle(r * 0.85, i * r * 0.2, r * 0.05);
    ctx.fillStyle = bodyGrad(r * 0.32, col); ell(r * 1.3, 0, r * 0.4, r * 0.32);
    ctx.strokeStyle = '#ece0c0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(r * 1.15, -r * 0.2); ctx.lineTo(r * 1.85, -r * 0.35); ctx.moveTo(r * 1.15, r * 0.2); ctx.lineTo(r * 1.85, r * 0.35); ctx.moveTo(r * 1.6, 0); ctx.lineTo(r * 1.9, 0); ctx.stroke();
  } else if (T === 'zirhli') {
    ctx.fillStyle = bodyGrad(r * 0.3, shade(col, -0.1)); ell(r * 1.1, 0, r * 0.3, r * 0.3); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = '#d8d0b8'; circle(r * 1.05, -r * 0.28, r * 0.06); circle(r * 1.05, r * 0.28, r * 0.06);
  } else if (T === 'ordek') {
    ctx.strokeStyle = col; ctx.lineWidth = r * 0.3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(r * 0.8, 0); ctx.lineTo(r * 1.3, 0); ctx.stroke(); ctx.lineCap = 'butt';
    ctx.fillStyle = bodyGrad(r * 0.22, col); ell(r * 1.45, 0, r * 0.3, r * 0.22);
    ctx.fillStyle = '#d0b070'; ell(r * 1.72, 0, r * 0.14, r * 0.17);
    ctx.fillStyle = '#b8503a'; ctx.beginPath(); ctx.moveTo(r * 1.35, 0); ctx.quadraticCurveTo(r * 1.0, -r * 0.1, r * 0.9, 0); ctx.quadraticCurveTo(r * 1.0, r * 0.1, r * 1.35, 0); ctx.fill();
  } else if (T === 'gurleyen') {
    ctx.fillStyle = bodyGrad(r * 0.36, shade(col, 0.1)); circle(r * 1.15, 0, r * 0.38); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.2; ctx.stroke();
    const dg = ctx.createRadialGradient(r * 1.1, -r * 0.1, 1, r * 1.15, 0, r * 0.3); dg.addColorStop(0, '#e8dcc8'); dg.addColorStop(1, '#9a8a6a'); ctx.fillStyle = dg; circle(r * 1.12, 0, r * 0.26);
    ctx.fillStyle = '#5a4a3a'; for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; circle(r * 1.15 + Math.cos(a) * r * 0.36, Math.sin(a) * r * 0.36, r * 0.05); }
  }
  if (T !== 'gurleyen') { const hx = r * (T === 'boynuzlu' ? 1.38 : T === 'ordek' ? 1.5 : 1.2); ctx.fillStyle = '#111'; circle(hx, -r * 0.12, Math.max(1, r * 0.04)); circle(hx, r * 0.12, Math.max(1, r * 0.04)); }
  ctx.restore();
}
function drawCrocBody(d, r, col, dk, step) {
  ctx.fillStyle = dk; for (const [lx, ly, s] of [[0.5, -0.45, 1], [0.5, 0.45, -1], [-0.4, -0.45, -1], [-0.4, 0.45, 1]]) ell(r * lx + step * s * r * 0.12, r * ly, r * 0.16, r * 0.12);
  const sway = Math.sin(d.anim * 0.6) * r * 0.3;
  ctx.fillStyle = bodyGrad(r * 0.4, col); ctx.beginPath(); ctx.moveTo(-r * 0.6, -r * 0.3); ctx.quadraticCurveTo(-r * 1.6, sway, -r * 2.3, sway * 1.4); ctx.quadraticCurveTo(-r * 1.6, sway + r * 0.1, -r * 0.6, r * 0.3); ctx.fill();
  ell(0, 0, r * 0.95, r * 0.42); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(r * 0.7, -r * 0.3); ctx.lineTo(r * 2.0, -r * 0.12); ctx.lineTo(r * 2.0, r * 0.12); ctx.lineTo(r * 0.7, r * 0.3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = dk; for (let i = 0; i < 7; i++) { circle(-r * 0.8 + i * r * 0.26, -r * 0.1, r * 0.06); circle(-r * 0.8 + i * r * 0.26, r * 0.1, r * 0.06); }
  ctx.fillStyle = '#eee'; for (let i = 0; i < 5; i++) { ctx.fillRect(r * (1.0 + i * 0.2), -r * 0.17, 2, 3); ctx.fillRect(r * (1.0 + i * 0.2), r * 0.14, 2, 3); }
  ctx.fillStyle = DINO.batakci.eye; circle(r * 0.85, -r * 0.22, 2.2); circle(r * 0.85, r * 0.22, 2.2);
}
function drawFlyer(d) {
  const def = DINO.kanatli, r = d.r, lift = d.alt * 40, flap = Math.sin(d.anim * (d.alt > 0.5 ? 1.2 : 0.3)) * 0.5;
  ctx.fillStyle = `rgba(0,0,0,${0.15 + (1 - d.alt) * 0.15})`; ell(d.x + d.alt * 20 + SUN.x, d.y + 6 + SUN.y * 0.5, r * (1.6 - d.alt * 0.4), r * 0.5);
  ctx.save(); ctx.translate(d.x, d.y - lift); ctx.rotate(d.ang);
  const col = d.hurt > 0 ? '#e8d0d0' : d.tamed ? '#a08878' : def.col;
  for (const s of [-1, 1]) {
    const g = ctx.createLinearGradient(0, 0, 0, s * r * 2.2); g.addColorStop(0, shade(def.col, -0.1)); g.addColorStop(1, shade(def.col, -0.45));
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(r * 0.3, 0); ctx.lineTo(-r * 0.1, s * r * (2.3 + flap)); ctx.lineTo(-r * 0.7, s * r * (1.6 + flap)); ctx.quadraticCurveTo(-r * 0.6, s * r * 0.6, -r * 0.5, 0); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(r * 0.2, 0); ctx.lineTo(-r * 0.1, s * r * (2.3 + flap)); ctx.stroke();
  }
  ctx.fillStyle = bodyGrad(r * 0.3, col); ell(0, 0, r * 0.7, r * 0.3);
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(r * 0.5, -r * 0.12); ctx.lineTo(r * 1.7, 0); ctx.lineTo(r * 0.5, r * 0.12); ctx.fill();
  ctx.fillStyle = '#b4502a'; ctx.beginPath(); ctx.moveTo(r * 0.6, 0); ctx.lineTo(r * 0.05, -r * 0.5); ctx.lineTo(r * 0.3, 0); ctx.fill();
  ctx.restore();
  if (d.tamed) { ctx.fillStyle = '#9cf'; ctx.font = '11px Georgia'; ctx.textAlign = 'center'; ctx.fillText('♥', d.x, d.y - lift - r - 6); }
}

// ---- mini harita: kabartma gölgeli ada (dunya.js groundH/biomeFast'tan bir kez üretilir)
let fogC = null, miniBase = null, miniKey = null;
function miniBaseCanvas() {
  if (typeof groundH !== 'function' || typeof biomeFast !== 'function' || !G.bmap) return biomeMini;
  if (miniBase && miniKey === G.bmap) return miniBase;
  const N = 400, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), id = g.createImageData(N, N), d = id.data, cs = WORLD / N;
  const BC = [[58, 92, 40], [118, 112, 98], [56, 70, 36], [74, 82, 84], [112, 142, 58], [214, 192, 140], [30, 62, 86], [58, 92, 40]];
  const H = new Float32Array((N + 2) * (N + 2));
  for (let j = 0; j < N + 2; j++) for (let i = 0; i < N + 2; i++) H[j * (N + 2) + i] = groundH((i - 0.5) * cs, (j - 0.5) * cs);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const e = (j + 1) * (N + 2) + i + 1, h = H[e], o = (j * N + i) * 4; let r, gg, b;
    if (h < 0) { const k = Math.min(1, -h / 140); r = 70 - 50 * k; gg = 140 - 96 * k; b = 158 - 88 * k; if (h > -4) { r += 40; gg += 40; b += 30; } }
    else {
      const bc = BC[biomeFast((i + 0.5) * cs, (j + 0.5) * cs)] || BC[0]; r = bc[0]; gg = bc[1]; b = bc[2];
      if (h < 4) { r = 214; gg = 194; b = 142; }
      if (h > 360) { const k = Math.min(1, (h - 360) / 120) * 0.7; r += (128 - r) * k; gg += (122 - gg) * k; b += (112 - b) * k; }
      if (h > 470) { const k = Math.min(1, (h - 470) / 80); r += (236 - r) * k; gg += (240 - gg) * k; b += (244 - b) * k; }
      const sh = Math.max(0.5, Math.min(1.5, 1 + ((H[e - 1] - H[e + 1]) + (H[e - N - 2] - H[e + N + 2])) * 0.012));
      r *= sh; gg *= sh; b *= sh;
    }
    d[o] = r; d[o + 1] = gg; d[o + 2] = b; d[o + 3] = 255;
  }
  g.putImageData(id, 0, 0);
  g.fillStyle = 'rgba(40,90,120,.9)'; for (const l of G.lakes || []) { g.beginPath(); g.arc(l.x / cs, l.y / cs, Math.max(1, l.r / cs), 0, TAU); g.fill(); }
  g.fillStyle = 'rgba(46,62,40,.9)'; for (const p of G.pools || []) { g.beginPath(); g.arc(p.x / cs, p.y / cs, Math.max(1, p.r / cs), 0, TAU); g.fill(); }
  miniBase = c; miniKey = G.bmap; return c;
}
function drawMini() {
  const c = $('mini'); if (!c || !G.explored || $('miniBox').style.display === 'none') return;
  const big = $('miniBox').classList.contains('big');
  const size = big ? Math.min(innerWidth, innerHeight) * 0.8 : 150;
  const px = Math.round(size * DPR);
  if (c.width !== px) { c.width = c.height = px; c.style.width = c.style.height = size + 'px'; }
  const g = c.getContext('2d'), S = px, base = miniBaseCanvas();
  // görünen pencere: büyük harita tüm ada (tıklama eşlemesi buna bağlı), küçük harita oyuncunun çevresi
  const me = G.inside && G.inside.b ? G.inside.b : L;
  const vw = big ? WORLD : 3600, vx = big ? 0 : clamp(me.x - vw / 2, 0, WORLD - vw), vy = big ? 0 : clamp(me.y - vw / 2, 0, WORLD - vw), k = S / vw;
  const X = x => (x - vx) * k, Y = y => (y - vy) * k;
  g.fillStyle = '#12304a'; g.fillRect(0, 0, S, S);
  g.imageSmoothingEnabled = true; g.drawImage(base, vx / WORLD * base.width, vy / WORLD * base.height, vw / WORLD * base.width, vw / WORLD * base.height, 0, 0, S, S);
  if (!fogC) { fogC = document.createElement('canvas'); fogC.width = fogC.height = MAPN; }
  const fg = fogC.getContext('2d'), id = fg.createImageData(MAPN, MAPN);
  for (let i = 0; i < MAPN * MAPN; i++) { id.data[i * 4] = 8; id.data[i * 4 + 1] = 10; id.data[i * 4 + 2] = 14; id.data[i * 4 + 3] = G.explored[i] ? 0 : 236; }
  fg.putImageData(id, 0, 0);
  g.drawImage(fogC, vx / MAPC, vy / MAPC, vw / MAPC, vw / MAPC, 0, 0, S, S);
  const dot = (x, y, r, col) => { const sx = X(x), sy = Y(y); if (sx < -10 || sy < -10 || sx > S + 10 || sy > S + 10) return; g.fillStyle = col; g.beginPath(); g.arc(sx, sy, r * DPR, 0, TAU); g.fill(); };
  for (const b of G.builds) dot(b.x, b.y, b.type === 'gemi' ? 3 : 1.5, b.type === 'gemi' ? '#e8d8a8' : b.built ? '#c9a46a' : '#8ab');
  dot(G.fire.x, G.fire.y, 3.5, '#ff8a2a');
  if (G.rift.found) dot(G.rift.x, G.rift.y, 4, '#7ab0ff');
  for (const n of G.nests) if (n.found && n.eggs > 0) dot(n.x, n.y, 2.5, '#efe4c8');
  for (const w of G.wrecks || []) if (w.found || exploredAt(w.x, w.y)) { dot(w.x, w.y, 3, w.found ? '#7a8a9a' : '#9cf'); if (!w.found) { g.fillStyle = '#fff'; g.font = `${9 * DPR}px serif`; g.textAlign = 'center'; g.fillText('⚓', X(w.x), Y(w.y) - 4 * DPR); } }
  for (const c2 of G.carcs) if (exploredAt(c2.x, c2.y)) dot(c2.x, c2.y, 2, c2.rotten ? '#665' : '#a44');
  for (const z of GORDER) if (G.zone[z]) dot(G.zone[z].x, G.zone[z].y, 2.5, GROUPS[z].col);
  for (const c2 of G.ccamps) if (c2.found) { dot(c2.x, c2.y, 4, c2.alive ? '#d22' : '#633'); if (c2.alive) { g.fillStyle = '#fff'; g.font = `${9 * DPR}px serif`; g.textAlign = 'center'; g.fillText('☠', X(c2.x), Y(c2.y) + 3 * DPR); } }
  if (G.zone.kasif) { g.strokeStyle = '#ffd27a'; g.lineWidth = 1.5 * DPR; g.beginPath(); g.arc(X(G.zone.kasif.x), Y(G.zone.kasif.y), 7 * DPR, 0, TAU); g.stroke(); }
  for (const p of G.people) if (!p.inHut && !p.insideB && p !== L && !(p.grabbed && !(p.grabT > 0))) dot(p.x, p.y, 1.4, p.downed > 0 || p.grabbed ? '#f44' : '#e8dcc0');
  for (const d of G.dinos) { if (d.tamed) dot(d.x, d.y, 2, '#8f8'); else if ((d.scouted > 0 || visible(d.x, d.y)) && hostile(d)) dot(d.x, d.y, 2, '#f33'); else if (visible(d.x, d.y) && DINO[d.type].herb) dot(d.x, d.y, 1.8, '#dc8'); }
  if (G.hunt && G.hunt.t && !G.hunt.t.dead) { g.strokeStyle = '#f63'; g.lineWidth = 1.5 * DPR; g.beginPath(); g.arc(X(G.hunt.t.x), Y(G.hunt.t.y), 5 * DPR, 0, TAU); g.stroke(); }
  if (G.rescue) dot(G.rescue.x, G.rescue.y, 3, '#5cf');
  // oyuncu: bakış konisi + yön oku
  const yaw = G.yaw === undefined ? (L.ang || 0) : G.yaw, mx = X(me.x), my = Y(me.y), len = (big ? 30 : 22) * DPR, hf = 0.55;
  const cg = g.createRadialGradient(mx, my, 0, mx, my, len); cg.addColorStop(0, 'rgba(255,240,200,.55)'); cg.addColorStop(1, 'rgba(255,240,200,0)');
  g.fillStyle = cg; g.beginPath(); g.moveTo(mx, my); g.arc(mx, my, len, yaw - hf, yaw + hf); g.closePath(); g.fill();
  g.save(); g.translate(mx, my); g.rotate(yaw); const a = (big ? 6 : 5) * DPR;
  g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,0,.7)'; g.lineWidth = 1.2 * DPR; g.beginPath(); g.moveTo(a * 1.6, 0); g.lineTo(-a, -a); g.lineTo(-a * 0.45, 0); g.lineTo(-a, a); g.closePath(); g.fill(); g.stroke(); g.restore();
  if (!big) { g.fillStyle = 'rgba(255,255,255,.75)'; g.font = `bold ${9 * DPR}px Georgia`; g.textAlign = 'center'; g.fillText('K', S / 2, 10 * DPR); g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = DPR; g.strokeRect(0.5, 0.5, S - 1, S - 1); }
}

// ---- keşif sisi
function drawFog(cx, cy) {
  const i0 = Math.floor(cx / MAPC) - 1, j0 = Math.floor(cy / MAPC) - 1, cols = Math.ceil(VW / MAPC) + 3, rows = Math.ceil(VH / MAPC) + 3;
  if (memC.width !== cols || memC.height !== rows) { memC.width = cols; memC.height = rows; }
  const g = memC.getContext('2d'), id = g.createImageData(cols, rows), D = id.data;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const gi = i0 + i, gj = j0 + j, o = (j * cols + i) * 4;
    const ex = gi >= 0 && gj >= 0 && gi < MAPN && gj < MAPN && G.explored[gj * MAPN + gi];
    D[o] = 5; D[o + 1] = 7; D[o + 2] = 10; D[o + 3] = ex ? 120 : 255;
  }
  g.putImageData(id, 0, 0);
  fctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  fctx.globalCompositeOperation = 'source-over'; fctx.clearRect(0, 0, VW, VH);
  fctx.imageSmoothingEnabled = true;
  fctx.drawImage(memC, 0, 0, cols, rows, i0 * MAPC - cx, j0 * MAPC - cy, cols * MAPC, rows * MAPC);
  fctx.globalCompositeOperation = 'destination-out';
  for (const s of G.vis) {
    const x = s.x - cx, y = s.y - cy; if (x < -s.r || y < -s.r || x > VW + s.r || y > VH + s.r) continue;
    const gr = fctx.createRadialGradient(x, y, s.r * 0.55, x, y, s.r);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    fctx.fillStyle = gr; fctx.beginPath(); fctx.arc(x, y, s.r, 0, TAU); fctx.fill();
  }
  fctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(fogCv, 0, 0, VW, VH);
}
