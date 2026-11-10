'use strict';
// =============================================================
//  ÇİZİM — dünya, varlıklar, ışık/karanlık, hava, mini harita
// =============================================================
const cv = $('c'), ctx = cv.getContext('2d');
const dark = document.createElement('canvas'), dctx = dark.getContext('2d');
let VW = innerWidth, VH = innerHeight, DPR = 1;
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  VW = innerWidth; VH = innerHeight;
  cv.width = dark.width = Math.round(VW * DPR); cv.height = dark.height = Math.round(VH * DPR);
  cv.style.width = VW + 'px'; cv.style.height = VH + 'px';
}
addEventListener('resize', resize); resize();

let groundPat = null;
function makeGround() {
  const c = document.createElement('canvas'); c.width = c.height = 384; const g = c.getContext('2d');
  g.fillStyle = '#2c3f22'; g.fillRect(0, 0, 384, 384);
  for (let i = 0; i < 2600; i++) { g.fillStyle = pick(['#34492a', '#273a1f', '#3a5030', '#2f4425', '#3d4a28', '#24331b']); g.fillRect(Math.random() * 384, Math.random() * 384, rand(1, 3), rand(2, 6)); }
  for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(70,55,30,.18)'; g.beginPath(); g.ellipse(Math.random() * 384, Math.random() * 384, rand(10, 40), rand(6, 22), rand(0, 3), 0, TAU); g.fill(); }
  groundPat = ctx.createPattern(c, 'repeat');
}
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = v => clamp(Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k), 0, 255);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
function hpBar(x, y, f, w) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - w / 2, y, w, 4); ctx.fillStyle = f > 0.5 ? '#7c4' : f > 0.25 ? '#ca3' : '#c33'; ctx.fillRect(x - w / 2, y, w * clamp(f, 0, 1), 4); }
const circle = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };

function render() {
  const sx = (Math.random() - 0.5) * G.shake, sy = (Math.random() - 0.5) * G.shake;
  G.camX = L.x - VW / 2 + sx; G.camY = L.y - VH / 2 + sy;
  const cx = G.camX, cy = G.camY;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.save(); ctx.translate(-cx, -cy);
  const inV = (x, y, m) => x > cx - m && x < cx + VW + m && y > cy - m && y < cy + VH + m;
  // zemin + biyom rengi
  ctx.fillStyle = groundPat; ctx.fillRect(cx, cy, VW, VH);
  ctx.imageSmoothingEnabled = true;
  { const s = MAPC, x0 = cx / s, y0 = cy / s; ctx.drawImage(biomeTint, x0, y0, VW / s, VH / s, cx, cy, VW, VH); }
  ctx.fillStyle = '#0b1408';
  if (cx < 0) ctx.fillRect(cx, cy, -cx, VH); if (cy < 0) ctx.fillRect(cx, cy, VW, -cy);
  if (cx + VW > WORLD) ctx.fillRect(WORLD, cy, cx + VW - WORLD, VH); if (cy + VH > WORLD) ctx.fillRect(cx, WORLD, VW, cy + VH - WORLD);
  { const g = ctx.createRadialGradient(CAMP.x, CAMP.y, 20, CAMP.x, CAMP.y, 220); g.addColorStop(0, 'rgba(90,70,45,.7)'); g.addColorStop(1, 'rgba(90,70,45,0)'); ctx.fillStyle = g; circle(CAMP.x, CAMP.y, 220); }
  // göller ve havuzlar
  for (const l of G.lakes) if (inV(l.x, l.y, l.r)) {
    ctx.fillStyle = '#26402a'; circle(l.x, l.y, l.r + 8);
    const g = ctx.createRadialGradient(l.x, l.y, l.r * 0.2, l.x, l.y, l.r); g.addColorStop(0, '#16324a'); g.addColorStop(1, '#1f4a5a'); ctx.fillStyle = g; circle(l.x, l.y, l.r);
    ctx.strokeStyle = 'rgba(180,220,230,.12)'; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(l.x + Math.sin(G.now * 0.3 + i) * 20, l.y + i * 20 - 20, l.r * (0.3 + i * 0.15), 0.3, 1.2); ctx.stroke(); }
  }
  for (const p of G.pools) if (inV(p.x, p.y, p.r)) {
    ctx.fillStyle = '#2b3420'; circle(p.x, p.y, p.r + 6);
    ctx.fillStyle = '#34402a'; circle(p.x, p.y, p.r);
    ctx.fillStyle = 'rgba(90,110,60,.35)'; circle(p.x - p.r * 0.3, p.y - p.r * 0.2, p.r * 0.4);
    if (p.croc && p.croc.hidden && Math.sin(G.now * 3 + p.x) > 0.7) { ctx.fillStyle = 'rgba(200,220,180,.5)'; circle(p.croc.x + Math.sin(G.now * 5) * 6, p.croc.y, 2.5); circle(p.croc.x + 8, p.croc.y + 4, 1.8); }
  }
  // süslemeler
  for (const d of G.deco) if (inV(d.x, d.y, 20)) drawDeco(d);
  for (const s of G.stains) { ctx.fillStyle = `rgba(80,5,5,${Math.min(0.6, s.life / 60)})`; ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r, s.r * 0.7, 0, 0, TAU); ctx.fill(); }
  for (const t of G.tracks) if (inV(t.x, t.y, 30)) drawTrack(t);
  // bitkiler
  for (const b of G.bushes) if (inV(b.x, b.y, 30)) {
    ctx.fillStyle = '#1f3a18'; circle(b.x, b.y, b.r + 2);
    ctx.fillStyle = '#2d5222'; ctx.beginPath(); ctx.arc(b.x - 4, b.y - 3, b.r - 3, 0, TAU); ctx.arc(b.x + 5, b.y + 2, b.r - 5, 0, TAU); ctx.fill();
    ctx.fillStyle = b.col; for (let i = 0; i < Math.min(7, b.amt + Math.floor(b.amt / 2)); i++) { const q = b.berries[i]; circle(b.x + q[0], b.y + q[1], 2.6); }
  }
  for (const h of G.herbs) if (inV(h.x, h.y, 20)) {
    ctx.strokeStyle = '#4c8a3a'; ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(h.x + Math.cos(a) * 9, h.y + Math.sin(a) * 9); ctx.stroke(); }
    if (h.amt > 0) { ctx.fillStyle = '#e8f0ff'; for (let i = 0; i < h.amt; i++) circle(h.x + Math.cos(i * 2.1) * 6, h.y + Math.sin(i * 2.1) * 6, 2.2); }
  }
  for (const h of G.poisons) if (inV(h.x, h.y, 20)) {
    ctx.fillStyle = '#3a2048'; circle(h.x, h.y, 9);
    ctx.strokeStyle = '#8a3ab0'; ctx.lineWidth = 2;
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + 0.3; ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(h.x + Math.cos(a) * 12, h.y + Math.sin(a) * 12); ctx.stroke(); }
    if (h.amt > 0) { ctx.fillStyle = '#c6f04a'; for (let i = 0; i < h.amt; i++) circle(h.x - 3 + i * 6, h.y - 2, 2); }
  }
  for (const n of G.nests) if (inV(n.x, n.y, 30)) {
    ctx.strokeStyle = '#6a5030'; ctx.lineWidth = 3;
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; ctx.beginPath(); ctx.moveTo(n.x + Math.cos(a) * 12, n.y + Math.sin(a) * 10); ctx.lineTo(n.x + Math.cos(a + 0.7) * 20, n.y + Math.sin(a + 0.7) * 16); ctx.stroke(); }
    ctx.fillStyle = '#e9e0c8'; for (let i = 0; i < n.eggs; i++) { ctx.beginPath(); ctx.ellipse(n.x - 7 + i * 7, n.y, 4, 5.5, 0, 0, TAU); ctx.fill(); }
  }
  for (const t of G.trees) if (t.stump && inV(t.x, t.y, 20)) { ctx.fillStyle = '#5a3d22'; circle(t.x, t.y, 9); ctx.strokeStyle = '#3a2614'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(t.x, t.y, 5, 0, TAU); ctx.stroke(); }
  for (const r of G.rocks) if (!r.dead && inV(r.x, r.y, 40)) {
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(r.x + 4, r.y + 6, r.r, r.r * 0.6, 0, 0, TAU); ctx.fill();
    const c = Math.round(110 * r.shade); ctx.fillStyle = `rgb(${c},${c - 4},${c - 10})`; ctx.beginPath(); r.v.forEach((v, i) => i ? ctx.lineTo(r.x + v[0], r.y + v[1]) : ctx.moveTo(r.x + v[0], r.y + v[1])); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.12)'; circle(r.x - r.r * 0.3, r.y - r.r * 0.3, r.r * 0.4);
  }
  for (const c of G.crystals) if (!c.dead && inV(c.x, c.y, 30)) {
    const gl = 0.5 + Math.sin(G.now * 2 + c.x) * 0.2;
    ctx.fillStyle = `hsla(${c.hue},80%,60%,${0.25 * gl})`; circle(c.x, c.y, 22);
    for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + (i - 1) * 0.5, h = 18 - Math.abs(i - 1) * 5; ctx.fillStyle = `hsl(${c.hue},70%,${55 + i * 8}%)`; ctx.beginPath(); ctx.moveTo(c.x + Math.cos(a + 1.57) * 5, c.y + Math.sin(a + 1.57) * 5); ctx.lineTo(c.x + Math.cos(a) * h, c.y + Math.sin(a) * h); ctx.lineTo(c.x + Math.cos(a - 1.57) * 5, c.y + Math.sin(a - 1.57) * 5); ctx.fill(); }
  }
  for (const b of G.builds) if (b.type === 'tuzak') { ctx.strokeStyle = '#7a5a30'; ctx.lineWidth = 3; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ctx.beginPath(); ctx.moveTo(b.x + Math.cos(a) * 4, b.y + Math.sin(a) * 4); ctx.lineTo(b.x + Math.cos(a) * 15, b.y + Math.sin(a) * 15); ctx.stroke(); } ctx.fillStyle = '#3a2a18'; circle(b.x, b.y, 5); }
  if (inV(G.rift.x, G.rift.y, 200)) drawRift();
  drawFire();
  // sıralı varlıklar
  const ents = [];
  for (const b of G.builds) if (b.type !== 'tuzak' && inV(b.x, b.y, 60)) ents.push(b);
  for (const p of G.people) if (!p.inHut && inV(p.x, p.y, 40) && !(p === L && G.mount)) ents.push(p);
  for (const d of G.dinos) if (!d.fly && !d.hidden && inV(d.x, d.y, d.r * 3)) ents.push(d);
  if (G.rescue && inV(G.rescue.x, G.rescue.y, 40)) ents.push(G.rescue);
  for (const t of G.trees) if (!t.stump && inV(t.x, t.y, 30)) ents.push(t);
  ents.sort((a, b) => a.y - b.y);
  for (const e of ents) {
    if (e.kind === 'build') drawBuild(e);
    else if (e.kind === 'tree') drawTrunk(e);
    else if (e.type) { drawDino(e); if (e === G.mount) drawPerson(L); }
    else drawPerson(e);
  }
  for (const q of G.parts) { ctx.globalAlpha = clamp(q.life, 0, 1); ctx.fillStyle = q.col; ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s); }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#d8c8a0'; ctx.lineWidth = 2;
  for (const q of G.proj) { ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - Math.cos(q.ang) * 14, q.y - Math.sin(q.ang) * 14); ctx.stroke(); if (q.poison) { ctx.fillStyle = '#9f3'; circle(q.x, q.y, 2); } }
  for (const t of G.trees) if (!t.stump && inV(t.x, t.y, t.cr + 10)) drawCanopy(t);
  for (const d of G.dinos) if (d.fly && inV(d.x, d.y, 80)) drawFlyer(d);
  if (G.placing) {
    const p = placePos(), ok = placeOk(G.placing, p), r = BUILD[G.placing].r;
    ctx.globalAlpha = 0.55; ctx.fillStyle = ok ? '#7c6' : '#c44'; circle(p.x, p.y, r); ctx.globalAlpha = 1;
    ctx.strokeStyle = ok ? '#bfa' : '#f88'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  }
  if (G.actProg > 0 && G.interact) { ctx.strokeStyle = '#ffd890'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(L.x, L.y, 22, -Math.PI / 2, -Math.PI / 2 + TAU * G.actProg); ctx.stroke(); }
  ctx.restore();

  // ---- sis
  const b = biomeFast(L.x, L.y);
  const fogA = (b === 3 ? 0.42 : 0) + (G.weather.type === 'sis' ? 0.3 : 0);
  if (fogA > 0) {
    const g = ctx.createRadialGradient(VW / 2, VH / 2, 90, VW / 2, VH / 2, Math.max(VW, VH) * 0.55);
    g.addColorStop(0, 'rgba(150,155,168,0)'); g.addColorStop(1, `rgba(150,155,168,${Math.min(0.85, fogA * 1.6)})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    for (let i = 0; i < 6; i++) { const x = ((i * 397 + G.now * 14) % (VW + 400)) - 200, y = (i * 211) % VH; ctx.fillStyle = `rgba(170,175,185,${fogA * 0.25})`; ctx.beginPath(); ctx.ellipse(x, y, 220, 70, 0, 0, TAU); ctx.fill(); }
  }
  // ---- karanlık
  const dk = darkness(), LS = lights();
  if (dk > 0.01) {
    dctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    dctx.globalCompositeOperation = 'source-over'; dctx.clearRect(0, 0, VW, VH);
    dctx.fillStyle = `rgba(3,5,12,${dk})`; dctx.fillRect(0, 0, VW, VH);
    dctx.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r, a) => { if (x - cx < -r || y - cy < -r || x - cx > VW + r || y - cy > VH + r) return; const g = dctx.createRadialGradient(x - cx, y - cy, r * 0.15, x - cx, y - cy, r); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.6, `rgba(0,0,0,${a * 0.7})`); g.addColorStop(1, 'rgba(0,0,0,0)'); dctx.fillStyle = g; dctx.beginPath(); dctx.arc(x - cx, y - cy, r, 0, TAU); dctx.fill(); };
    for (const l of LS) hole(l.x, l.y, l.r, l.blue ? 0.7 : 1);
    hole(L.x, L.y, 95, 0.5);
    for (const c of G.crystals) if (!c.dead) hole(c.x, c.y, 45, 0.5);
    ctx.drawImage(dark, 0, 0, VW, VH);
    ctx.globalCompositeOperation = 'lighter';
    for (const l of LS) {
      const x = l.x - cx, y = l.y - cy; if (x < -l.r || y < -l.r || x > VW + l.r || y > VH + l.r) continue;
      const g = ctx.createRadialGradient(x, y, 0, x, y, l.r * 0.9);
      g.addColorStop(0, l.blue ? `rgba(60,120,255,${0.3 * dk})` : `rgba(255,140,40,${0.22 * l.warm * dk})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, l.r, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    if (dk > 0.5) drawEyes(LS, cx, cy);
  } else { ctx.fillStyle = 'rgba(255,220,150,.04)'; ctx.fillRect(0, 0, VW, VH); }
  if (G.weather.type === 'yagmur' || G.weather.type === 'firtina') {
    ctx.strokeStyle = 'rgba(170,190,220,.35)'; ctx.lineWidth = 1; ctx.beginPath();
    const n = G.weather.type === 'firtina' ? 220 : 130;
    for (let i = 0; i < n; i++) { const x = (i * 137.5 + G.now * 60) % VW, y = (i * 91.3 + G.now * 900) % VH; ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 14); }
    ctx.stroke();
  }
  if (G.flash > 0) { ctx.fillStyle = `rgba(220,230,255,${G.flash * 1.5})`; ctx.fillRect(0, 0, VW, VH); }
  // yazılar ve isimler
  ctx.font = 'bold 13px Georgia'; ctx.textAlign = 'center';
  for (const t of G.texts) { ctx.globalAlpha = clamp(t.life, 0, 1); ctx.fillStyle = '#000'; ctx.fillText(t.t, t.x - cx + 1, t.y - cy + 1); ctx.fillStyle = t.col; ctx.fillText(t.t, t.x - cx, t.y - cy); }
  ctx.globalAlpha = 1;
  drawLabels(LS, cx, cy);
  // kenar işaretleri
  edgeMarker(G.fire.x, G.fire.y, '🔥', dist(L, G.fire) > 450 || G.carryEgg);
  if (G.rescue) edgeMarker(G.rescue.x, G.rescue.y, '🆘', true);
  if (G.rift.found || (G.riftHint && isNight())) edgeMarker(G.rift.x, G.rift.y, '🌀', true);
  for (const p of G.people) if (p.grabbed || p.desert > 0 || p.downed > 0) edgeMarker(p.x, p.y, p.downed > 0 ? '🩸' : '❗', true);
  // vinyet
  const fearV = Math.max(G.danger * 0.8, dk * 0.5);
  const vg = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * (0.42 - fearV * 0.15), VW / 2, VH / 2, Math.max(VW, VH) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(${Math.round(40 * G.danger)},0,0,${0.45 + fearV * 0.4})`);
  ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);
  if (G.red > 0) { ctx.fillStyle = `rgba(160,0,0,${G.red * 0.4})`; ctx.fillRect(0, 0, VW, VH); }
  if (L.hp < 35) { ctx.fillStyle = `rgba(120,0,0,${(0.15 + Math.sin(G.now * 6) * 0.08) * (1 - L.hp / 35)})`; ctx.fillRect(0, 0, VW, VH); }
  if (G.finale) { ctx.fillStyle = `rgba(40,80,200,${0.08 + Math.sin(G.now * 3) * 0.04})`; ctx.fillRect(0, 0, VW, VH); }
}
function drawEyes(LS, cx, cy) {
  for (const d of G.dinos) {
    if (d.tamed || d.blink < 0 || d.ko > 0 || d.hidden || d.fly) continue;
    const lv = lightLevel(d.x, d.y, LS); if (lv > 0.35) continue;
    const hx = d.x + Math.cos(d.ang) * d.r * 1.05 - cx, hy = d.y + Math.sin(d.ang) * d.r * 1.05 - cy;
    if (hx < -20 || hy < -20 || hx > VW + 20 || hy > VH + 20) continue;
    const toL = Math.cos(d.ang - angTo(d, L)); if (toL < -0.2 && !(d.scouted > 0)) continue;
    const er = d.r * 0.09 + 1.2, sep = d.r * 0.22, px = -Math.sin(d.ang) * sep, py = Math.cos(d.ang) * sep, col = DINO[d.type].eye;
    ctx.globalAlpha = d.scouted > 0 ? 0.9 : 0.5 + 0.5 * toL * (1 - lv);
    for (const s of [-1, 1]) { const ex = hx + px * s, ey = hy + py * s; const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, er * 4); g.addColorStop(0, col); g.addColorStop(0.25, col); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ex, ey, er * 4, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
}
function drawLabels(LS, cx, cy) {
  ctx.font = '10px Georgia'; ctx.textAlign = 'center';
  for (const p of G.people) {
    if (p.inHut || p.leader) continue;
    const x = p.x - cx, y = p.y - cy; if (x < -40 || x > VW + 40 || y < -40 || y > VH + 40) continue;
    if (lightLevel(p.x, p.y, LS) < 0.3 && !(p.downed > 0)) continue;
    const isM = GORDER.some(g => G.managers[g] === p.id);
    const label = (isM ? '★ ' : '') + p.name;
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillText(label, x + 1, y + 25); ctx.fillStyle = p.fear >= 80 ? '#f99' : isM ? '#ffd27a' : '#eadcc0'; ctx.fillText(label, x, y + 24);
    let ic = '';
    if (p.downed > 0) ic = '🩸' + Math.ceil(p.downed);
    else { if (p.injury) ic += p.injury.type === 'kanama' ? '🩸' : p.injury.type === 'kirik' ? '🦴' : '🤢'; if (p.tired) ic += '😴'; if (p.fear >= 80) ic += '❗'; if (p.partner && p.child === false && Math.sin(G.now + p.id) > 0.97) ic += '❤'; }
    if (ic) { ctx.font = '12px serif'; ctx.fillText(ic, x, y - 20); ctx.font = '10px Georgia'; }
  }
  if (L.injury) { ctx.font = '13px serif'; ctx.fillText(L.injury.type === 'kanama' ? '🩸' : L.injury.type === 'kirik' ? '🦴' : '🤢', L.x - cx, L.y - cy - 24); }
  if (G.carryEgg) { ctx.font = '14px serif'; ctx.fillText('🥚', L.x - cx + 14, L.y - cy - 14); }
}
function edgeMarker(wx, wy, ic, show) {
  if (!show) return;
  const x = wx - G.camX, y = wy - G.camY;
  if (x > 20 && y > 20 && x < VW - 20 && y < VH - 20) { if (ic !== '🔥' && ic !== '🌀') { ctx.font = '18px serif'; ctx.textAlign = 'center'; ctx.fillText(ic, x, y - 28); } return; }
  const a = Math.atan2(y - VH / 2, x - VW / 2), m = 34;
  const tx = clamp(VW / 2 + Math.cos(a) * VW, m, VW - m), ty = clamp(VH / 2 + Math.sin(a) * VH, m + 60, VH - m - 120);
  ctx.save(); ctx.translate(tx, ty); ctx.rotate(a); ctx.fillStyle = ic === '🌀' ? 'rgba(120,170,255,.8)' : 'rgba(255,200,120,.7)'; ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(4, -7); ctx.lineTo(4, 7); ctx.fill(); ctx.restore();
  ctx.font = '16px serif'; ctx.textAlign = 'center'; ctx.fillText(ic, tx - Math.cos(a) * 8, ty - Math.sin(a) * 8 + 5);
}
function drawDeco(d) {
  const x = d.x, y = d.y, s = d.s;
  if (d.t === 'fern') { ctx.strokeStyle = '#2f5626'; ctx.lineWidth = 2; for (let i = 0; i < 5; i++) { const a = d.a + i * 1.25; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * 8 * s, y + Math.sin(a) * 8 * s - 4, x + Math.cos(a) * 14 * s, y + Math.sin(a) * 14 * s); ctx.stroke(); } }
  else if (d.t === 'bone') { ctx.strokeStyle = '#cfc6b0'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x - Math.cos(d.a) * 7 * s, y - Math.sin(d.a) * 7 * s); ctx.lineTo(x + Math.cos(d.a) * 7 * s, y + Math.sin(d.a) * 7 * s); ctx.stroke(); ctx.fillStyle = '#cfc6b0'; circle(x + Math.cos(d.a) * 8 * s, y + Math.sin(d.a) * 8 * s, 2.5); circle(x - Math.cos(d.a) * 8 * s, y - Math.sin(d.a) * 8 * s, 2.5); }
  else if (d.t === 'reed') { ctx.strokeStyle = '#6a7a3a'; ctx.lineWidth = 1.5; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(x + i * 3, y); ctx.lineTo(x + i * 4 + Math.sin(G.now + d.a) * 2, y - 16 * s); ctx.stroke(); } ctx.fillStyle = '#5a3a20'; ctx.fillRect(x - 1, y - 18 * s, 3, 6); }
  else if (d.t === 'pebble') { ctx.fillStyle = '#857d70'; circle(x, y, 3 * s); circle(x + 5, y + 2, 2 * s); }
  else if (d.t === 'deadtree') { ctx.strokeStyle = '#4a4540'; ctx.lineWidth = 3; ctx.beginPath(); for (let i = 0; i < 4; i++) { const a = d.a + i * 1.6; ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 18 * s, y + Math.sin(a) * 18 * s); } ctx.stroke(); }
}
function drawTrack(t) {
  ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.a); ctx.fillStyle = 'rgba(30,20,10,.55)';
  ctx.beginPath(); ctx.ellipse(0, 0, 9, 7, 0, 0, TAU); ctx.fill();
  for (const a of [-0.5, 0, 0.5]) { ctx.beginPath(); ctx.ellipse(Math.cos(a) * 15, Math.sin(a) * 15, 6, 2.5, a, 0, TAU); ctx.fill(); }
  ctx.restore();
}
function drawRift() {
  const r = G.rift, t = G.now;
  ctx.save(); ctx.translate(r.x, r.y);
  for (let i = 0; i < 5; i++) {
    ctx.strokeStyle = `hsla(${200 + i * 12},90%,${60 + i * 5}%,${0.6 - i * 0.08})`; ctx.lineWidth = 4 - i * 0.5;
    ctx.beginPath(); ctx.ellipse(0, 0, 50 - i * 8 + Math.sin(t * 2 + i) * 3, 22 - i * 3, t * (0.3 + i * 0.15) * (i % 2 ? -1 : 1), 0, TAU); ctx.stroke();
  }
  ctx.fillStyle = `rgba(200,230,255,${0.6 + Math.sin(t * 4) * 0.2})`; ctx.beginPath(); ctx.ellipse(0, 0, 8, 26, 0, 0, TAU); ctx.fill();
  ctx.restore();
  if (G.finale) { ctx.fillStyle = '#cfe4ff'; ctx.font = 'bold 22px Georgia'; ctx.textAlign = 'center'; ctx.fillText(Math.ceil(G.finale.t), r.x, r.y - 50); }
}
function drawFire() {
  const f = G.fire;
  ctx.fillStyle = '#2a2420'; for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; circle(f.x + Math.cos(a) * 24, f.y + Math.sin(a) * 20, 6); }
  ctx.fillStyle = '#3a2412'; ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(0.6); ctx.fillRect(-16, -3, 32, 6); ctx.rotate(1.6); ctx.fillRect(-16, -3, 32, 6); ctx.restore();
  if (f.fuel <= 0) { ctx.fillStyle = '#222'; circle(f.x, f.y, 10); return; }
  const s = 0.5 + f.fuel / 100;
  for (let i = 0; i < 6; i++) {
    const t = G.now * 8 + i * 1.7, h = (16 + Math.sin(t) * 5) * s, w = (8 - i) * s;
    ctx.fillStyle = ['#c22a08', '#ff5a10', '#ff8a20', '#ffb030', '#ffd060', '#fff0a0'][i];
    ctx.beginPath(); ctx.ellipse(f.x + Math.sin(t * 0.7) * 2, f.y - h * 0.4 - i, w + 2, h * (1 - i * 0.1), 0, 0, TAU); ctx.fill();
  }
  for (const e of G.eggs) { ctx.fillStyle = '#efe4c8'; ctx.beginPath(); ctx.ellipse(f.x + 30, f.y + 18, 5, 7, 0.3, 0, TAU); ctx.fill(); }
}
function drawTrunk(t) {
  const sh = t.shake > 0 ? Math.sin(G.now * 60) * 2 : 0;
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(t.x + 10, t.y + 10, t.cr * 0.8, t.cr * 0.5, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = t.b === 3 ? '#3a3430' : '#4a3220'; circle(t.x + sh, t.y, t.r);
  ctx.fillStyle = t.b === 3 ? '#4a423c' : '#5c4029'; circle(t.x + sh - 3, t.y - 3, t.r * 0.55);
}
const CANOPY = [[['#163a14', '#1f4a1a', '#2a5e22'], ['#1a3a1e', '#24502a', '#2f6634'], ['#24391a', '#334d20', '#42602a']], null, [['#2a3418', '#36421e', '#435024'], ['#283220', '#323e26', '#3e4a2c']], [['#1e2422', '#283030', '#323a38'], ['#22261e', '#2c3226', '#363c2e']]];
function drawCanopy(t) {
  const under = (L && Math.hypot(L.x - t.x, L.y - (t.y - 20)) < t.cr) ? 0.35 : 0.95;
  const sw = Math.sin(G.now * 0.8 + t.sw) * 2 + (t.shake > 0 ? Math.sin(G.now * 50) * 3 : 0);
  const pal = CANOPY[t.b] || CANOPY[0], g1 = pal[Math.floor(t.tone * pal.length) % pal.length];
  ctx.globalAlpha = under;
  ctx.fillStyle = g1[0]; circle(t.x + sw, t.y - 22, t.cr);
  ctx.fillStyle = g1[1]; ctx.beginPath(); ctx.arc(t.x - t.cr * 0.3 + sw, t.y - 28, t.cr * 0.65, 0, TAU); ctx.arc(t.x + t.cr * 0.35 + sw, t.y - 18, t.cr * 0.55, 0, TAU); ctx.fill();
  ctx.fillStyle = g1[2]; circle(t.x - t.cr * 0.25 + sw, t.y - 36, t.cr * 0.35);
  ctx.globalAlpha = 1;
}
function drawBuild(b) {
  const x = b.x + (b.hit > 0 ? Math.sin(G.now * 70) * 2 : 0), y = b.y;
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x + 5, y + 7, b.r + 3, b.r * 0.6, 0, 0, TAU); ctx.fill();
  if (b.type === 'kulube') {
    ctx.fillStyle = '#6b4a28'; circle(x, y, b.r);
    ctx.strokeStyle = '#4a3018'; ctx.lineWidth = 2; for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * b.r, y + Math.sin(a) * b.r); ctx.stroke(); }
    ctx.fillStyle = '#8a6a3a'; circle(x, y, 7);
    ctx.fillStyle = '#1a1008'; ctx.fillRect(x - 6, y + b.r - 8, 12, 10);
    if (b.occ.length) { ctx.font = '10px serif'; ctx.textAlign = 'center'; ctx.fillText('💤'.repeat(b.occ.length), x, y - b.r - 4); }
  } else if (b.type === 'cit') {
    for (let i = -2; i <= 2; i++) { const px = x + Math.cos(b.ang + Math.PI / 2) * i * 8, py = y + Math.sin(b.ang + Math.PI / 2) * i * 8; ctx.fillStyle = '#6a4a26'; circle(px, py, 5); ctx.fillStyle = '#8a6a3a'; circle(px - 1, py - 1, 2.5); }
  } else if (b.type === 'duvar') {
    for (let i = -1; i <= 1; i++) { const px = x + Math.cos(b.ang + Math.PI / 2) * i * 13, py = y + Math.sin(b.ang + Math.PI / 2) * i * 13; ctx.fillStyle = '#7c7a74'; ctx.fillRect(px - 8, py - 9, 16, 18); ctx.fillStyle = '#95928a'; ctx.fillRect(px - 7, py - 8, 14, 6); }
  } else if (b.type === 'mesale') {
    ctx.fillStyle = '#4a3018'; ctx.fillRect(x - 3, y - 26, 6, 28);
    const t = G.now * 10 + b.x; ctx.fillStyle = '#ff7a20'; ctx.beginPath(); ctx.ellipse(x, y - 30, 5, 9 + Math.sin(t) * 2, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffd060'; ctx.beginPath(); ctx.ellipse(x, y - 28, 2.5, 5, 0, 0, TAU); ctx.fill();
  } else if (b.type === 'kule') {
    ctx.fillStyle = '#4a3220'; for (const [dx, dy] of [[-16, -16], [16, -16], [-16, 16], [16, 16]]) ctx.fillRect(x + dx - 3, y + dy - 3, 6, 6);
    ctx.fillStyle = '#7a5a34'; ctx.fillRect(x - 22, y - 30, 44, 34); ctx.fillStyle = '#5a3e22'; ctx.fillRect(x - 22, y - 30, 44, 6);
    const t = G.now * 10 + b.x; ctx.fillStyle = '#ff8a30'; ctx.beginPath(); ctx.ellipse(x + 18, y - 36, 4, 7 + Math.sin(t) * 2, 0, 0, TAU); ctx.fill();
    if (b.guard && dist(b.guard, b) < 12) { ctx.fillStyle = JMAP(b.guard); circle(x, y - 14, 8); ctx.fillStyle = b.guard.skin; circle(x + 2, y - 15, 5); }
  } else if (b.type === 'raf') {
    ctx.strokeStyle = '#5a3d22'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 16, y - 10); ctx.lineTo(x + 16, y - 10); ctx.moveTo(x - 14, y + 6); ctx.lineTo(x - 14, y - 14); ctx.moveTo(x + 14, y + 6); ctx.lineTo(x + 14, y - 14); ctx.stroke();
    ctx.fillStyle = '#8a2a1a'; for (let i = -2; i <= 2; i++) ctx.fillRect(x + i * 6 - 2, y - 9, 4, 10);
  } else if (b.type === 'sifahane') {
    ctx.fillStyle = '#c8b89a'; ctx.beginPath(); ctx.moveTo(x - b.r, y + 12); ctx.lineTo(x, y - b.r); ctx.lineTo(x + b.r, y + 12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#a8987a'; ctx.beginPath(); ctx.moveTo(x, y - b.r); ctx.lineTo(x + b.r, y + 12); ctx.lineTo(x, y + 12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3a7a5a'; ctx.fillRect(x - 3, y - 12, 6, 16); ctx.fillRect(x - 8, y - 7, 16, 6);
  }
  if (b.hp < b.maxhp && b.type !== 'tuzak') hpBar(x, y - b.r - 12, b.hp / b.maxhp, 30);
}
const JMAP = p => p.leader ? '#8a3a1a' : p.child ? '#b89a6a' : (GROUPS[p.group] || GROUPS.bos).col;
function drawPerson(p) {
  const sc = p.child ? 0.72 : 1;
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(p.x + 2, p.y + 9 * sc, 10 * sc, 5 * sc, 0, 0, TAU); ctx.fill();
  if (p.downed > 0) {
    ctx.fillStyle = 'rgba(110,0,0,.5)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 4, 16, 9, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.PI / 2 + p.id);
    ctx.fillStyle = '#5a5050'; ctx.beginPath(); ctx.ellipse(0, 0, 8, 11, 0, 0, TAU); ctx.fill(); ctx.fillStyle = p.skin; circle(0, -12, 6);
    ctx.restore();
    ctx.strokeStyle = '#f66'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 18, -Math.PI / 2, -Math.PI / 2 + TAU * (p.downed / 25)); ctx.stroke();
    return;
  }
  const step = p.moving ? Math.sin(p.anim) * 3 : 0;
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ang); ctx.scale(sc, sc);
  ctx.fillStyle = '#3a2a1a'; ctx.beginPath(); ctx.arc(step, -5, 3.5, 0, TAU); ctx.arc(-step, 5, 3.5, 0, TAU); ctx.fill();
  if (!p.child && (p.leader || p.group === 'muhafiz' || p.group === 'takip')) {
    if (ranged(p) && !p.leader) { ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(8, 0, 12, -1.2, 1.2); ctx.stroke(); }
    else {
      const ext = p.swing > 0 ? 14 : 0, tier = spearTier();
      ctx.strokeStyle = '#7a5530'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-10 + ext, 8); ctx.lineTo(24 + ext, 8); ctx.stroke();
      ctx.fillStyle = tier === 3 ? '#eee6d0' : tier === 2 ? '#aaa' : '#c9a070'; ctx.beginPath(); ctx.moveTo(30 + ext, 8); ctx.lineTo(22 + ext, 4); ctx.lineTo(22 + ext, 12); ctx.fill();
    }
  }
  if (p.leader && G.torchOn) { ctx.fillStyle = '#ff9030'; circle(6, -12, 4 + Math.random() * 1.5); ctx.fillStyle = '#ffe080'; circle(6, -12, 2); }
  ctx.fillStyle = p.hurtT > 0 ? '#fff' : JMAP(p);
  ctx.beginPath(); ctx.ellipse(0, 0, 8, 11, 0, 0, TAU); ctx.fill();
  if (p.leader && G.tech.has('deriZirh')) { ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 2; ctx.stroke(); }
  if (p.carry > 0) { const k = Object.keys(p.bag)[0]; ctx.fillStyle = k === 'wood' ? '#7a5028' : k === 'stone' ? '#999' : k === 'crystal' ? '#7ac' : k === 'herb' ? '#5a5' : k === 'poison' ? '#a5c' : '#a33'; ctx.fillRect(-12, -5, 6, 10); }
  ctx.fillStyle = p.skin; circle(2, 0, 6.5);
  ctx.fillStyle = p.hair; ctx.beginPath(); ctx.arc(0, 0, 6.5, Math.PI * 0.55, Math.PI * 1.45); ctx.fill();
  ctx.restore();
  if (p.leader) { ctx.strokeStyle = 'rgba(255,200,100,.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, TAU); ctx.stroke(); }
  if (p.isRescue) { ctx.fillStyle = '#fff'; ctx.font = 'bold 16px Georgia'; ctx.textAlign = 'center'; ctx.fillText('!', p.x, p.y - 18 + Math.sin(G.now * 6) * 2); }
  if (p.hp < p.maxhp) hpBar(p.x, p.y - 20, p.hp / p.maxhp, 22);
}
function drawDino(d) {
  const def = DINO[d.type], r = d.r, step = d.moving ? Math.sin(d.anim) : 0;
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(d.x + 4, d.y + r * 0.35, r * 1.3, r * 0.55, 0, 0, TAU); ctx.fill();
  ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.ang);
  let col = d.hurt > 0 ? '#e8d0d0' : def.col; if (d.tamed && !d.pet) col = shade(def.col, 0.15); if (d.poison > 0 && d.hurt <= 0) col = '#6a7a3a';
  const dk = shade(col.startsWith('#') ? col : def.col, -0.35);
  if (d.type === 'boynuzlu') {
    ctx.fillStyle = dk; for (const [lx, ly, s] of [[r * 0.5, -r * 0.55, 1], [r * 0.5, r * 0.55, -1], [-r * 0.45, -r * 0.55, -1], [-r * 0.45, r * 0.55, 1]]) { ctx.beginPath(); ctx.ellipse(lx + step * s * r * 0.15, ly, r * 0.22, r * 0.16, 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-r * 0.9, -r * 0.2); ctx.lineTo(-r * 1.7, Math.sin(G.now * 2 + d.id) * 4); ctx.lineTo(-r * 0.9, r * 0.2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 0, r * 1.05, r * 0.68, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = dk; ctx.beginPath(); ctx.ellipse(-r * 0.1, 0, r * 0.7, r * 0.18, 0, 0, TAU); ctx.fill();
    if (d.tamed && G.tech.has('eyer')) { ctx.fillStyle = '#5a3418'; ctx.fillRect(-r * 0.3, -r * 0.45, r * 0.5, r * 0.9); }
    ctx.fillStyle = shade(def.col, -0.15); ctx.beginPath(); ctx.ellipse(r * 0.95, 0, r * 0.32, r * 0.72, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(r * 1.3, 0, r * 0.4, r * 0.32, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ece0c0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(r * 1.15, -r * 0.2); ctx.lineTo(r * 1.85, -r * 0.35); ctx.moveTo(r * 1.15, r * 0.2); ctx.lineTo(r * 1.85, r * 0.35); ctx.moveTo(r * 1.6, 0); ctx.lineTo(r * 1.9, 0); ctx.stroke();
    if (d.ko > 0) { ctx.font = `${r * 0.5}px serif`; ctx.fillText('💫', 0, -r); }
  } else if (d.type === 'uzunboyun') {
    ctx.fillStyle = dk; for (const [lx, ly, s] of [[r * 0.45, -r * 0.5, 1], [r * 0.45, r * 0.5, -1], [-r * 0.45, -r * 0.5, -1], [-r * 0.45, r * 0.5, 1]]) { ctx.beginPath(); ctx.arc(lx + step * s * r * 0.12, ly, r * 0.2, 0, TAU); ctx.fill(); }
    const sway = Math.sin(G.now * 0.8 + d.id) * r * 0.3;
    ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineWidth = r * 0.35; ctx.beginPath(); ctx.moveTo(-r * 0.8, 0); ctx.quadraticCurveTo(-r * 1.8, sway, -r * 2.6, sway * 1.5); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.0, r * 0.7, 0, 0, TAU); ctx.fill();
    ctx.lineWidth = r * 0.28; ctx.beginPath(); ctx.moveTo(r * 0.7, 0); ctx.quadraticCurveTo(r * 1.6, -sway * 0.6, r * 2.3, -sway); ctx.stroke(); ctx.lineCap = 'butt';
    ctx.fillStyle = shade(def.col, 0.1); ctx.beginPath(); ctx.ellipse(r * 2.4, -sway, r * 0.28, r * 0.2, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = dk; for (let i = 0; i < 4; i++) circle(-r * 0.4 + i * r * 0.3, 0, r * 0.08);
  } else if (d.type === 'batakci') {
    ctx.fillStyle = dk; for (const [lx, ly] of [[r * 0.5, -r * 0.45], [r * 0.5, r * 0.45], [-r * 0.4, -r * 0.45], [-r * 0.4, r * 0.45]]) circle(lx + step * r * 0.1, ly, r * 0.15);
    const sway = Math.sin(d.anim * 0.6) * r * 0.3;
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-r * 0.6, -r * 0.3); ctx.quadraticCurveTo(-r * 1.6, sway, -r * 2.3, sway * 1.4); ctx.quadraticCurveTo(-r * 1.6, sway + r * 0.1, -r * 0.6, r * 0.3); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.95, r * 0.42, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(r * 0.7, -r * 0.3); ctx.lineTo(r * 2.0, -r * 0.12); ctx.lineTo(r * 2.0, r * 0.12); ctx.lineTo(r * 0.7, r * 0.3); ctx.fill();
    ctx.fillStyle = dk; for (let i = 0; i < 6; i++) circle(-r * 0.7 + i * r * 0.28, 0, r * 0.07);
    ctx.fillStyle = def.eye; circle(r * 0.85, -r * 0.22, 2); circle(r * 0.85, r * 0.22, 2);
  } else {
    // iki ayaklı yırtıcılar
    ctx.fillStyle = dk;
    ctx.beginPath(); ctx.ellipse(step * r * 0.35, -r * 0.42, r * 0.28, r * 0.18, 0, 0, TAU); ctx.ellipse(-step * r * 0.35, r * 0.42, r * 0.28, r * 0.18, 0, 0, TAU); ctx.fill();
    const sway = Math.sin(d.anim * 0.5) * r * 0.25;
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.32); ctx.quadraticCurveTo(-r * 1.4, sway * 0.5 - r * 0.1, -r * 2.2, sway); ctx.quadraticCurveTo(-r * 1.4, sway * 0.5 + r * 0.1, -r * 0.5, r * 0.32); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.95, r * 0.52, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = dk; ctx.lineWidth = Math.max(1, r * 0.08);
    if (d.type === 'yirtici') { for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * r * 0.25, -r * 0.4); ctx.lineTo(i * r * 0.25 - r * 0.1, r * 0.4); ctx.stroke(); } }
    else { ctx.beginPath(); ctx.moveTo(-r * 1.6, sway * 0.7); ctx.quadraticCurveTo(-r * 0.6, 0, r * 0.7, 0); ctx.stroke(); }
    if (d.type === 'dev') { ctx.fillStyle = dk; circle(r * 0.7, -r * 0.3, r * 0.08); circle(r * 0.7, r * 0.3, r * 0.08); }
    else { ctx.lineWidth = Math.max(1.5, r * 0.1); ctx.beginPath(); ctx.moveTo(r * 0.5, -r * 0.35); ctx.lineTo(r * 0.85, -r * 0.45); ctx.moveTo(r * 0.5, r * 0.35); ctx.lineTo(r * 0.85, r * 0.45); ctx.stroke(); }
    const hl = d.type === 'dev' ? 1.0 : 0.85, hw = d.type === 'dev' ? 0.62 : 0.45, hh = d.type === 'dev' ? 0.42 : 0.28;
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(r * hl, 0, r * hw, r * hh, 0, 0, TAU); ctx.fill();
    const jaw = d.atkCd > def.cd * 0.6 || d.carry ? 0.18 : 0.04;
    ctx.fillStyle = shade(def.col, -0.2); ctx.beginPath(); ctx.moveTo(r * (hl + 0.1), -r * jaw); ctx.lineTo(r * (hl + hw), 0); ctx.lineTo(r * (hl + 0.1), r * jaw); ctx.fill();
    if (d.type === 'dev') { ctx.fillStyle = '#eee'; for (let i = 0; i < 5; i++) { ctx.fillRect(r * (hl + 0.05 + i * 0.1), -r * 0.24, 2, 4); ctx.fillRect(r * (hl + 0.05 + i * 0.1), r * 0.24 - 4, 2, 4); } }
    ctx.fillStyle = darkness() > 0.5 && !d.tamed ? def.eye : '#111'; const ex = r * (hl + hw * 0.2), ey = r * hh * 0.6;
    circle(ex, -ey, Math.max(1.3, r * 0.07)); circle(ex, ey, Math.max(1.3, r * 0.07));
    if (d.mother) { ctx.strokeStyle = '#f33'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r * 1.2, 0, TAU); ctx.stroke(); }
  }
  ctx.restore();
  if ((d.hp < d.maxhp && d.type !== 'kucuk') || d.tamed) hpBar(d.x, d.y - r - 12, d.hp / d.maxhp, Math.max(26, r * 1.4));
  if (d.tamed) { ctx.fillStyle = '#9f9'; ctx.font = '11px Georgia'; ctx.textAlign = 'center'; ctx.fillText(d.pet ? '♥ yavru' : '♥', d.x, d.y - r - 16); }
}
function drawFlyer(d) {
  const def = DINO.kanatli, r = d.r, lift = d.alt * 40, flap = Math.sin(d.anim * (d.alt > 0.5 ? 1.2 : 0.3)) * 0.5;
  ctx.fillStyle = `rgba(0,0,0,${0.15 + (1 - d.alt) * 0.15})`; ctx.beginPath(); ctx.ellipse(d.x + d.alt * 20, d.y + 6, r * (1.6 - d.alt * 0.4), r * 0.5, 0, 0, TAU); ctx.fill();
  ctx.save(); ctx.translate(d.x, d.y - lift); ctx.rotate(d.ang);
  const col = d.hurt > 0 ? '#e8d0d0' : d.tamed ? '#a08878' : def.col;
  ctx.fillStyle = shade(def.col, -0.2);
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(r * 0.3, 0); ctx.lineTo(-r * 0.2, s * r * (2.2 + flap)); ctx.lineTo(-r * 0.7, s * r * (1.6 + flap)); ctx.lineTo(-r * 0.5, 0); ctx.fill(); }
  ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.7, r * 0.3, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(r * 0.5, -r * 0.12); ctx.lineTo(r * 1.6, 0); ctx.lineTo(r * 0.5, r * 0.12); ctx.fill();
  ctx.fillStyle = '#b4502a'; ctx.beginPath(); ctx.moveTo(r * 0.6, 0); ctx.lineTo(r * 0.1, -r * 0.5); ctx.lineTo(r * 0.3, 0); ctx.fill();
  ctx.restore();
  if (d.tamed) { ctx.fillStyle = '#9cf'; ctx.font = '11px Georgia'; ctx.textAlign = 'center'; ctx.fillText('♥', d.x, d.y - lift - r - 6); }
}

// ---- mini harita
let fogC = null;
function drawMini() {
  const c = $('mini'); if (!c || !G.explored || $('miniBox').style.display === 'none') return;
  const big = $('miniBox').classList.contains('big');
  const size = big ? Math.min(innerWidth, innerHeight) * 0.8 : 150;
  const px = Math.round(size * DPR);
  if (c.width !== px) { c.width = c.height = px; c.style.width = c.style.height = size + 'px'; }
  const g = c.getContext('2d'), S = px, k = S / WORLD;
  g.imageSmoothingEnabled = false; g.drawImage(biomeMini, 0, 0, S, S);
  if (!fogC) { fogC = document.createElement('canvas'); fogC.width = fogC.height = MAPN; }
  const fg = fogC.getContext('2d'), id = fg.createImageData(MAPN, MAPN);
  for (let i = 0; i < MAPN * MAPN; i++) { id.data[i * 4 + 3] = G.explored[i] ? 0 : 245; }
  fg.putImageData(id, 0, 0);
  g.imageSmoothingEnabled = true; g.drawImage(fogC, 0, 0, S, S);
  const dot = (x, y, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(x * k, y * k, r * DPR, 0, TAU); g.fill(); };
  for (const b of G.builds) dot(b.x, b.y, 1.5, '#c9a46a');
  dot(G.fire.x, G.fire.y, 3.5, '#ff8a2a');
  if (G.rift.found) dot(G.rift.x, G.rift.y, 4, '#7ab0ff');
  for (const n of G.nests) if (n.found && n.eggs > 0) dot(n.x, n.y, 2.5, '#efe4c8');
  for (const z of GORDER) if (G.zone[z]) dot(G.zone[z].x, G.zone[z].y, 2.5, GROUPS[z].col);
  for (const p of G.people) if (!p.inHut && p !== L) dot(p.x, p.y, 1.4, p.downed > 0 || p.grabbed ? '#f44' : '#e8dcc0');
  for (const d of G.dinos) { if (d.tamed) dot(d.x, d.y, 2, '#8f8'); else if (d.scouted > 0 && DINO[d.type].pred) dot(d.x, d.y, 2, '#f33'); }
  if (G.rescue) dot(G.rescue.x, G.rescue.y, 3, '#5cf');
  dot(L.x, L.y, 3, '#fff');
  g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = DPR; g.strokeRect((L.x - VW / 2) * k, (L.y - VH / 2) * k, VW * k, VH * k);
}
