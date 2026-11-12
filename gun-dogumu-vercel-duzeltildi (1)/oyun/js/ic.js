'use strict';
// =============================================================
//  İÇ MEKÂN — mağara / kulübe içinde birinci şahıs dolaşma mantığı
//  İç koordinat: zemin [0,w] x [0,h]; kapı y=h kenarının ortasında (dışarı +y).
//  G.inside = null | { b, x, y }  (lider b yapısının içinde, iç koordinatta)
//  Çizici için API:
//    inDims(b)   -> { w, h, wallH }
//    inRooms(b)  -> [{ t, i, x, y, w, h }]         oda bölgeleri (t: ROOMS anahtarı)
//    inFurn(b)   -> [{ k, x, y, ang, room, t }]     eşyalar (k: bed, crate, hearth, table, bench, block, rack, healbed, herbs, door, torch, paint)
//    inPeople(b) -> [{ p, x, y, ang, pose }]         pose: sleep | work | sit | eat | stand
// =============================================================
function inDims(b) { const n = (b.rooms || [0]).length; return b.type === 'magara' ? { w: 600, h: 460, wallH: 120 } : n > 1 ? { w: 400, h: 320, wallH: 80 } : { w: 220, h: 200, wallH: 70 }; }
function inRooms(b) {
  const D = inDims(b), rooms = (typeof roomsOf === 'function' ? roomsOf(b) : b.rooms) || ['bos'], n = rooms.length, out = [];
  if (n === 1) return [{ t: rooms[0], i: 0, x: 10, y: 10, w: D.w - 20, h: D.h - 60 }];
  const nb = Math.min(n, Math.max(1, Math.round(n / 3))), ns = n - nb, nl = Math.ceil(ns / 2), nr = ns - nl;
  const rw = D.w * 0.27, bh = D.h * 0.3;
  let k = 0;
  for (let i = 0; i < nl; i++) { const hh = (D.h - bh - 20) / nl; out.push({ t: rooms[k], i: k++, x: 0, y: bh + i * hh, w: rw, h: hh - 8 }); }
  for (let i = 0; i < nb; i++) { const ww = D.w / nb; out.push({ t: rooms[k], i: k++, x: i * ww + 4, y: 0, w: ww - 8, h: bh - 6 }); }
  for (let i = 0; i < nr; i++) { const hh = (D.h - bh - 20) / nr; out.push({ t: rooms[k], i: k++, x: D.w - rw, y: bh + i * hh, w: rw, h: hh - 8 }); }
  return out.sort((a, c) => a.i - c.i);
}
const IN_FURN = {
  yatak: [['bed', .28, .3, 0], ['bed', .72, .3, 0], ['bed', .28, .72, 0], ['bed', .72, .72, 0]],
  depo: [['crate', .25, .3, 0], ['crate', .55, .25, .4], ['crate', .8, .4, 0], ['crate', .3, .7, .2], ['rack', .7, .75, 0]],
  mutfak: [['hearth', .3, .45, 0], ['table', .7, .55, 0]],
  sifa: [['healbed', .3, .4, 0], ['healbed', .7, .4, 0], ['herbs', .5, .8, 0]],
  kasap: [['block', .4, .5, 0], ['rack', .78, .35, 0]],
  atolye: [['bench', .45, .45, 0], ['rack', .8, .7, 0]],
  okcu: [['bench', .45, .45, 0], ['rack', .8, .7, 0]],
  tabak: [['bench', .45, .45, 0], ['rack', .8, .7, 0]],
  bos: [],
};
function inLegacyFurn(b) {
  const D = inDims(b), out = [];
  // yatak: yalnızca burada oturanlara zimmetli yatak kadar; kalanı yer yatağı (mat)
  let beds = 0; for (const q of G.people) if (q.own && q.own.yatak && typeof homeOf === 'function' && homeOf(q) === b) beds++;
  for (const r of inRooms(b)) for (const f of (IN_FURN[r.t] || [])) { let k = f[0]; if (k === 'bed') { if (beds > 0) beds--; else k = 'mat'; } out.push({ k, x: r.x + r.w * f[1], y: r.y + r.h * f[2], ang: f[3], room: r.i, t: r.t }); }
  out.push({ k: 'door', x: D.w / 2, y: D.h, ang: 0, room: -1 });
  if (b.type === 'magara') { out.push({ k: 'hearth', x: D.w / 2, y: D.h * 0.62, ang: 0, room: -1, main: 1 }); out.push({ k: 'paint', x: D.w * 0.5, y: 2, ang: 0, room: -1 }); out.push({ k: 'torch', x: D.w * 0.3, y: D.h - 6, ang: 0, room: -1 }); out.push({ k: 'torch', x: D.w * 0.7, y: D.h - 6, ang: 0, room: -1 }); }
  return out;
}
// Geçiş şeması: oda iş mantığı bu ilk parçada korunur, eşya konumları artık kaydedilir.
const CAV_FURN_KINDS = new Set(['bed', 'mat', 'crate', 'hearth', 'table', 'bench', 'block', 'rack', 'healbed', 'herbs']);
function cavFurnitureSync(b) {
  if (!b || b.type !== 'magara') return null;
  const signature = JSON.stringify(b.rooms || []);
  if (!b.furniture || b.furniture.v !== 1) b.furniture = { v: 1, rooms: null, items: [] };
  const data = b.furniture;
  if (data.rooms !== signature) {
    // Eski oda menüsü değişirse yalnız otomatik oda izdüşümü yenilenir; ayrı eşyalar korunur.
    const placed = data.items.filter(f => f.source !== 'legacy');
    const projected = inLegacyFurn(b).filter(f => CAV_FURN_KINDS.has(f.k)).map((f, i) => {
      const legacyBed = f.t === 'yatak' && (f.k === 'bed' || f.k === 'mat');
      return Object.assign({}, f, { id: 'legacy-' + i, k: legacyBed ? 'bed' : f.k,
        legacyBed, built: true, prog: 1, source: 'legacy' });
    });
    data.items = projected.concat(placed); data.rooms = signature;
  }
  return data;
}
function cavFurnitureSave(b) {
  const data = cavFurnitureSync(b);
  return data ? { v: 1, rooms: data.rooms, items: data.items.map(f => Object.assign({}, f)) } : undefined;
}
function cavFurnitureRestore(b, data) {
  if (!data || data.v !== 1 || !Array.isArray(data.items) || b.type !== 'magara') return;
  const D = inDims(b), ids = new Set(), items = [];
  for (const f of data.items) {
    if (!f || !CAV_FURN_KINDS.has(f.k) || !Number.isFinite(f.x) || !Number.isFinite(f.y)) continue;
    let id = typeof f.id === 'string' ? f.id : 'item-' + items.length;
    if (ids.has(id)) { let n = 1; while (ids.has(id + '-' + n)) n++; id += '-' + n; }
    ids.add(id);
    items.push({ id, k: f.k, x: clamp(f.x, 14, D.w - 14), y: clamp(f.y, 14, D.h - 14),
      ang: Number.isFinite(f.ang) ? f.ang : 0, room: Number.isInteger(f.room) ? f.room : -1,
      t: typeof f.t === 'string' ? f.t : 'bos', main: !!f.main, legacyBed: !!f.legacyBed,
      built: f.built !== false, prog: clamp(+f.prog || 0, 0, 1), source: f.source === 'legacy' ? 'legacy' : 'placed' });
  }
  b.furniture = { v: 1, rooms: typeof data.rooms === 'string' ? data.rooms : null, items };
}
function inFurn(b) {
  if (b.type !== 'magara') return inLegacyFurn(b);
  let beds = 0;
  for (const q of G.people) if (q.own && q.own.yatak && homeOf(q) === b) beds++;
  const out = cavFurnitureSync(b).items.filter(f => f.built).map(f => {
    const view = Object.assign({}, f);
    if (f.legacyBed) { view.k = beds > 0 ? 'bed' : 'mat'; if (beds > 0) beds--; }
    return view;
  });
  // Kapı/duvar resmi/meşaleler mimari: taşınabilir eşya envanterine girmez.
  const D = inDims(b);
  out.push({ k: 'door', x: D.w / 2, y: D.h, ang: 0, room: -1 });
  out.push({ k: 'paint', x: D.w * .5, y: 2, ang: 0, room: -1 });
  for (const x of [.3, .7]) out.push({ k: 'torch', x: D.w * x, y: D.h - 6, ang: 0, room: -1 });
  return out;
}
function inPeople(b) {
  const rooms = inRooms(b), occ = typeof occupants === 'function' ? occupants(b) : rooms.map(() => []), out = [];
  const furn = inFurn(b);
  rooms.forEach((r, i) => {
    const f = furn.filter(q => q.room === r.i), list = occ[i] || [];
    list.forEach((p, j) => {
      if (p === L) return;
      let x = r.x + r.w * (0.3 + 0.4 * ((j * 0.37) % 1)), y = r.y + r.h * (0.35 + 0.4 * ((j * 0.61) % 1)), ang = Math.PI / 2, pose = 'stand';
      const beds = f.filter(q => q.k === 'bed' || q.k === 'mat' || q.k === 'healbed');
      if ((p.inHut === b || (p.bed && p.bed.s === b)) && beds.length) { const q = beds[j % beds.length]; x = q.x + (j >= beds.length ? 12 : 0); y = q.y; ang = 0; pose = 'sleep'; }
      else if (r.t === 'mutfak') {
        const tb = f.find(q => q.k === 'table'), hz = f.find(q => q.k === 'hearth');
        if (p.group === 'asci' && hz && !(G.meal && p.ate)) { x = hz.x + 22; y = hz.y + 6; ang = Math.PI; pose = 'work'; }
        else if (tb) { const a = j * 1.3; x = tb.x + Math.cos(a) * 34; y = tb.y + Math.sin(a) * 26; ang = a + Math.PI; pose = G.meal ? 'eat' : 'sit'; }
      }
      else if (r.t === 'atolye' || r.t === 'kasap' || r.t === 'okcu' || r.t === 'tabak') { const q = f.find(z => z.k === 'bench' || z.k === 'block'); if (q) { x = q.x + (j ? 26 : 0); y = q.y + 22; ang = -Math.PI / 2; pose = 'work'; } }
      else if (r.t === 'sifa') { const q = f.find(z => z.k === 'herbs'); if (q) { x = q.x + j * 18; y = q.y - 16; ang = Math.PI / 2; pose = 'work'; } }
      out.push({ p, x, y, ang, pose });
    });
  });
  return out;
}
// ---- girme / çıkma / içeride yürüme
function enterable(b) { return b && b.built && !b.dead && (b.type === 'magara' || b.type === 'kulube' || b.type === 'cadir'); }
function enterBuilding(b) {
  if (!enterable(b) || G.mount) return;
  const D = inDims(b); G.inside = { b, x: D.w / 2, y: D.h - 34 }; G.yaw = -Math.PI / 2; G.pitch = 0;
  if (G.placing) cancelPlace(); G.huntMode = false; G.tutIn = true; SFX.pickup && SFX.pickup();
}
function exitBuilding() {
  if (!G.inside) return; const b = G.inside.b; G.inside = null; L.insideB = null;
  if (b && !b.dead) { const q = stnPos(b); L.x = q.x; L.y = q.y + 16; } G.yaw = Math.PI / 2; G.pitch = 0; pushOut(L, false);
}
function inMove(mx, my, spd, dt) {
  const I = G.inside, D = inDims(I.b); let x = I.x + mx * spd * dt, y = I.y + my * spd * dt;
  x = clamp(x, 14, D.w - 14); y = clamp(y, 14, D.h - 10);
  for (const f of inFurn(I.b)) { if (f.k === 'door' || f.k === 'paint' || f.k === 'torch' || f.k === 'mat') continue; const r = f.k === 'table' ? 30 : f.k === 'hearth' ? 22 : 18, dx = x - f.x, dy = y - f.y, d = Math.hypot(dx, dy); if (d < r && d > 0.01) { x = f.x + dx / d * r; y = f.y + dy / d * r; } }
  // duvar, sütun ve kaya bölmeleri (çizici tanımlar): içinden geçilmez
  if (typeof inSolids === 'function') for (const o of inSolids(I.b)) { const dx = x - o.x, dy = y - o.y, d = Math.hypot(dx, dy), r = o.r + 9; if (d < r && d > 0.01) { x = o.x + dx / d * r; y = o.y + dy / d * r; } }
  if (typeof inWall === 'function') { const q = inWall(I.b, x, y); if (q) { x = q.x; y = q.y; } }
  I.x = x; I.y = y;
}
function inInteract() {
  const I = G.inside, b = I.b, fx = Math.cos(G.yaw), fy = Math.sin(G.yaw);
  let best = null, bs = 0.55;
  const test = (x, y, o, maxD) => { const dx = x - I.x, dy = y - I.y, d = Math.hypot(dx, dy); if (d > maxD) return; const s = d < 26 ? 0.2 : 1 - (dx * fx + dy * fy) / d; if (s < bs) { bs = s; best = o; } };
  for (const q of inPeople(b)) test(q.x, q.y, { kind: 'person', p: q.p, label: `${q.p.name} — emir ver` }, 150);
  for (const f of inFurn(b)) {
    if (f.k === 'door') test(f.x, f.y, { kind: 'exit', label: 'Dışarı çık' }, 80);
    else if (f.k === 'bed' || f.k === 'mat') test(f.x, f.y, { kind: 'sleep', label: goHome() ? 'Uyu' : 'Yatak (gece uyuyabilirsin)' }, 70);
    else if (f.k === 'bench') { const od = G.orders.find(o => o.worker && o.stageAd && !(o.trips > 0)); test(f.x, f.y, { kind: 'craft', label: od ? `Üretim masası — ${ITEMS[od.item].ad}: ${od.stageAd}` : 'Üretim masası' }, 80); }
    else if (f.k === 'crate') test(f.x, f.y, { kind: 'store', label: 'Depo — oda türünü değiştir (I)' }, 60);
  }
  return best;
}
