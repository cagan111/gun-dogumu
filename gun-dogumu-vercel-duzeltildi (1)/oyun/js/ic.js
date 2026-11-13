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
// tünelin dış ucu (iç y): dış ağız düzlemine denk gelir; arada yukarı çıkan rampa (uc.js cavFloorH)
function cavTunEnd(b) { return inDims(b).h + 112; }
function inDims(b) { const n = (b.rooms || [0]).length; return b.type === 'magara' ? { w: 600, h: 460, wallH: 120 } : n > 1 ? { w: 400, h: 320, wallH: 80 } : { w: 220, h: 200, wallH: 70 }; }
function inLegacyRooms(b) {
  const D = inDims(b), rooms = (b.type === 'magara' ? b.rooms : typeof roomsOf === 'function' ? roomsOf(b) : b.rooms) || ['bos'], n = rooms.length, out = [];
  if (n === 1) return [{ t: rooms[0], i: 0, x: 10, y: 10, w: D.w - 20, h: D.h - 60 }];
  const nb = Math.min(n, Math.max(1, Math.round(n / 3))), ns = n - nb, nl = Math.ceil(ns / 2), nr = ns - nl;
  const rw = D.w * 0.27, bh = D.h * 0.3;
  let k = 0;
  for (let i = 0; i < nl; i++) { const hh = (D.h - bh - 20) / nl; out.push({ t: rooms[k], i: k++, x: 0, y: bh + i * hh, w: rw, h: hh - 8 }); }
  for (let i = 0; i < nb; i++) { const ww = D.w / nb; out.push({ t: rooms[k], i: k++, x: i * ww + 4, y: 0, w: ww - 8, h: bh - 6 }); }
  for (let i = 0; i < nr; i++) { const hh = (D.h - bh - 20) / nr; out.push({ t: rooms[k], i: k++, x: D.w - rw, y: bh + i * hh, w: rw, h: hh - 8 }); }
  return out.sort((a, c) => a.i - c.i);
}
function inRooms(b) {
  if (b.type !== 'magara') return inLegacyRooms(b);
  const D = inDims(b); return [{ t: 'bos', i: 0, x: 10, y: 10, w: D.w - 20, h: D.h - 60 }];
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
  for (const r of inLegacyRooms(b)) for (const f of (IN_FURN[r.t] || [])) { let k = f[0]; if (k === 'bed') { if (beds > 0) beds--; else k = 'mat'; } out.push({ k, x: r.x + r.w * f[1], y: r.y + r.h * f[2], ang: f[3], room: r.i, t: r.t }); }
  out.push({ k: 'door', x: D.w / 2, y: D.h, ang: 0, room: -1 });
  if (b.type === 'magara') { out.push({ k: 'hearth', x: D.w / 2, y: D.h * 0.62, ang: 0, room: -1, main: 1 }); out.push({ k: 'paint', x: D.w * 0.5, y: 2, ang: 0, room: -1 }); out.push({ k: 'torch', x: D.w * 0.3, y: D.h - 6, ang: 0, room: -1 }); out.push({ k: 'torch', x: D.w * 0.7, y: D.h - 6, ang: 0, room: -1 }); }
  return out;
}
// Geçiş şeması: oda iş mantığı bu ilk parçada korunur, eşya konumları artık kaydedilir.
const CAV_FURN_KINDS = new Set(['bed', 'mat', 'crate', 'hearth', 'table', 'bench', 'block', 'rack', 'healbed', 'herbs']);
// İş süreleri simülasyon saniyesi; malzeme ilk iş adımında bir kez ödenir.
const CAV_FURN_RECIPES = {
  mat: { k: 'mat', t: 'yatak', cost: { hide: 1, herb: 3 }, work: 10 },
  bed: { k: 'bed', t: 'yatak', cost: { wood: 8, hide: 2 }, work: 24 },
  crate: { k: 'crate', t: 'depo', cost: { wood: 6 }, work: 18 },
  rack: { k: 'rack', t: 'depo', cost: { wood: 5 }, work: 16 },
  hearth: { k: 'hearth', t: 'mutfak', cost: { stone: 8, wood: 3 }, work: 22 },
  table: { k: 'table', t: 'mutfak', cost: { wood: 8 }, work: 20 },
  bench: { k: 'bench', t: 'atolye', cost: { wood: 10, stone: 3 }, work: 30 },
  bowbench: { k: 'bench', t: 'okcu', cost: { wood: 8, bone: 3 }, work: 28 },
  tannery: { k: 'bench', t: 'tabak', cost: { wood: 6, hide: 3 }, work: 24 },
  healbed: { k: 'healbed', t: 'sifa', cost: { wood: 8, hide: 3, herb: 2 }, work: 26 },
  herbs: { k: 'herbs', t: 'sifa', cost: { wood: 5, herb: 5 }, work: 20 },
  block: { k: 'block', t: 'kasap', cost: { wood: 6, stone: 2 }, work: 22 }
};
function cavFurnitureSync(b) {
  if (!b || b.type !== 'magara') return null;
  const signature = JSON.stringify(b.rooms || []);
  if (!b.furniture || b.furniture.v !== 1) b.furniture = { v: 1, rooms: null, items: [] };
  const data = b.furniture;
  if (data.rooms == null) {
    // Yalnız ilk eski kayıt dönüşümü: oda metaverisi sonradan eşya üretemez.
    const placed = data.items.filter(f => f.source !== 'legacy');
    const projected = inLegacyFurn(b).filter(f => CAV_FURN_KINDS.has(f.k)).map((f, i) => {
      const legacyBed = f.t === 'yatak' && (f.k === 'bed' || f.k === 'mat');
      return Object.assign({}, f, { id: 'legacy-' + i, k: legacyBed ? 'bed' : f.k,
        legacyBed, built: true, prog: 1, source: 'legacy' });
    });
    data.items = projected.concat(placed); data.rooms = signature; data.rev = (data.rev || 0) + 1;
  }
  return data;
}
function cavFurnitureSave(b) {
  const data = cavFurnitureSync(b);
  return data ? { v: 1, rooms: data.rooms, next: data.next || 1, items: data.items.map(f => Object.assign({}, f, { worker: 0 })) } : undefined;
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
      recipe: Object.hasOwn(CAV_FURN_RECIPES, f.recipe) ? f.recipe : undefined, paid: !!f.paid, worker: 0,
      built: f.built !== false, prog: clamp(+f.prog || 0, 0, 1), source: f.source === 'legacy' ? 'legacy' : 'placed' });
  }
  b.furniture = { v: 1, rooms: typeof data.rooms === 'string' ? data.rooms : null, next: Number.isInteger(data.next) && data.next > 0 ? data.next : 1, items };
}
function cavFurnitureCount(b, kind) {
  const data = cavFurnitureSync(b);
  return data ? data.items.filter(f => f.built && f.k === kind).length : 0;
}
function cavFurnitureRoomCount(b, type) {
  const data = cavFurnitureSync(b); if (!data) return 0;
  let n = 0;
  for (const f of data.items) {
    if (!f.built) continue;
    if (type === 'yatak' && (f.k === 'bed' || f.k === 'mat')) n += f.legacyBed ? .25 : .5;
    else if (type === 'depo' && f.t === 'depo' && (f.k === 'crate' || f.k === 'rack')) n++;
    else if (type === 'sifa' && f.k === 'herbs') n++;
    else if (type === 'mutfak' && f.k === 'hearth' && !f.main) n++;
    else if (type === 'kasap' && f.k === 'block') n++;
    else if ((type === 'atolye' || type === 'okcu' || type === 'tabak') && f.k === 'bench' && f.t === type) n++;
  }
  return type === 'depo' ? n / 5 : n;
}
function cavFurnitureCanPlace(b, recipe, x, y) {
  if (!Object.hasOwn(CAV_FURN_RECIPES, recipe) || !b || !b.built || b.dead || !G.builds.includes(b) || b.type !== 'magara' || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  const D = inDims(b), data = cavFurnitureSync(b);
  if (x < 25 || y < 25 || x > D.w - 25 || y > D.h - 50 || data.items.some(f => Math.hypot(f.x - x, f.y - y) < 48)) return false;
  if (typeof inWall === 'function' && inWall(b, x, y)) return false;
  if (typeof inSolids === 'function' && inSolids(b).some(o => Math.hypot(o.x - x, o.y - y) < o.r + 20)) return false;
  return true;
}
function cavFurnitureQueue(b, recipe, x, y, ang = 0) {
  if (!cavFurnitureCanPlace(b, recipe, x, y)) return null;
  const def = CAV_FURN_RECIPES[recipe], data = cavFurnitureSync(b);
  let next = data.next || 1; while (data.items.some(f => f.id === 'furn-' + next)) next++;
  const f = { id: 'furn-' + next, recipe, k: def.k, t: def.t, x, y, ang: Number.isFinite(ang) ? ang : 0,
    room: -1, built: false, prog: 0, paid: false, worker: 0, source: 'placed' };
  data.next = next + 1; data.items.push(f); data.rev = (data.rev || 0) + 1; G.uiDirty = true;
  return f;
}
function cavFurnitureRefund(f) {
  if (!f.paid) return {};
  if (!Object.hasOwn(CAV_FURN_RECIPES, f.recipe)) return null;
  const out = {}, left = 1 - clamp(f.prog || 0, 0, 1);
  for (const [k, n] of Object.entries(CAV_FURN_RECIPES[f.recipe].cost)) { const amount = Math.floor(n * left); if (amount > 0) out[k] = amount; }
  return out;
}
function cavFurnitureCancel(b, id) {
  if (!b || b.dead || !b.built || b.type !== 'magara' || !G.builds.includes(b)) return false;
  const data = cavFurnitureSync(b), i = data.items.findIndex(f => f.id === id);
  if (i < 0 || data.items[i].built) return false;
  const refund = cavFurnitureRefund(data.items[i]); if (!refund) return false;
  // İadenin bir kısmını depo tavanında kaybetme: tüm iade sığana kadar plan korunur.
  if (Object.entries(refund).some(([k, n]) => CAPPED.includes(k) && (G.stock[k] || 0) + n > storeCap())) return false;
  data.items.splice(i, 1); data.rev = (data.rev || 0) + 1;
  for (const [k, n] of Object.entries(refund)) addStock(k, n);
  G.uiDirty = true; return true;
}
function cavFurnitureWork(p, dt) {
  if (p.group !== 'mimar' || !(dt > 0)) return false;
  let job = null, best = 1600;
  for (const b of G.builds) {
    if (b.type !== 'magara' || !b.built || b.dead) continue;
    for (const f of cavFurnitureSync(b).items) {
      const def = Object.hasOwn(CAV_FURN_RECIPES, f.recipe) ? CAV_FURN_RECIPES[f.recipe] : null; if (f.built || !def || (!f.paid && !canAfford(def.cost))) continue;
      if (f.worker && f.worker !== p.id && G.people.some(q => q.id === f.worker && q.group === 'mimar' && !q.dead && !q.downed && !q.bed && !q.grabbed && !q.injury && !q.desert && !q.carrying && !q.carryOrder && !q.bedRes && !q.inHut && !q.wasDowned)) continue;
      const d = dist(p, b); if (d < best) { job = { b, f, def }; best = d; }
    }
  }
  if (!job) return false;
  const { b, f, def } = job; f.worker = p.id;
  if (!atStation(p, b, dt)) return true;
  if (!f.paid) { if (!canAfford(def.cost)) { f.worker = 0; return false; } pay(def.cost); f.paid = true; }
  p.work = 1; p.stageAd = 'Mağara eşyası inşa ediyor';
  const rate = skillMul(lvl(p, 'insaat')) * grpMul('mimar') * (p.sick ? .5 : 1);
  f.prog = Math.min(1, f.prog + dt * rate / def.work); addXP(p, 'insaat', dt * .6);
  if (f.prog >= 1) {
    f.built = true; f.worker = 0; const data = cavFurnitureSync(b);
    // Tedavi slotları bitiş sırasıyla eklenir: yavaş kalan bir plan mevcut hastanın indeksini kaydırmaz.
    if (f.k === 'healbed') { data.items.splice(data.items.indexOf(f), 1); data.items.push(f); }
    data.rev = (data.rev || 0) + 1; G.uiDirty = true; msg('Mağara eşyası tamamlandı.', '#cfe', 3);
  }
  return true;
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
function cavFurniturePeople(b) {
  const furn = inFurn(b), beds = furn.filter(f => f.k === 'bed' || f.k === 'mat'), medical = furn.filter(f => f.k === 'healbed');
  const list = G.people.filter(p => p !== L && (p.inHut === b || p.insideB === b || (p.bed && p.bed.s === b))), out = [];
  let sleeping = 0;
  for (const p of list) {
    let f = null, pose = p.pose || 'stand', ang = Math.PI / 2;
    if (p.bed && p.bed.s === b) { f = medical[p.bed.i]; pose = 'sleep'; }
    else if (p.inHut === b) { f = beds[sleeping++ % Math.max(1, beds.length)]; pose = f ? 'sleep' : 'sit'; }
    else {
      f = cavFurnitureSync(b).items.find(q => !q.built && q.worker === p.id);
      if (!f) { const kind = { asci: 'hearth', sifaci: 'herbs', kasap: 'block', zanaat: 'bench' }[p.group]; f = furn.find(q => q.k === kind && !q.main); }
      if (f) pose = 'work';
    }
    const n = out.length, D = inDims(b), fa = f ? f.ang || 0 : 0;
    const x = f ? clamp(f.x - (pose === 'work' ? Math.sin(fa) * 24 : 0), 14, D.w - 14) : 260 + (n % 4) * 28;
    const y = f ? clamp(f.y + (pose === 'work' ? Math.cos(fa) * 24 : 0), 14, D.h - 14) : 340 + Math.floor(n / 4) * 24;
    if (f) ang = pose === 'work' ? Math.atan2(f.y - y, f.x - x) : fa;
    out.push({ p, x, y, ang, pose });
  }
  return out;
}
function inPeople(b) {
  if (b.type === 'magara') return cavFurniturePeople(b);
  const rooms = inRooms(b), occ = typeof occupants === 'function' ? occupants(b) : rooms.map(() => []), out = [];
  const furn = inFurn(b);
  rooms.forEach((r, i) => {
    const f = furn.filter(q => q.room === r.i), list = occ[i] || [];
    list.forEach((p, j) => {
      if (p === L) return;
      let x = r.x + r.w * (0.3 + 0.4 * ((j * 0.37) % 1)), y = r.y + r.h * (0.35 + 0.4 * ((j * 0.61) % 1)), ang = Math.PI / 2, pose = 'stand';
      const beds = f.filter(q => q.k === 'bed' || q.k === 'mat' || q.k === 'healbed');
      const patientBed = p.bed && p.bed.s === b ? furn.filter(q => q.k === 'healbed')[p.bed.i] : null;
      if (patientBed) { x = patientBed.x; y = patientBed.y; ang = patientBed.ang; pose = 'sleep'; }
      else if ((p.inHut === b || (p.bed && p.bed.s === b)) && beds.length) { const q = beds[j % beds.length]; x = q.x + (j >= beds.length ? 12 : 0); y = q.y; ang = 0; pose = 'sleep'; }
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
  if(typeof caveChoiceShow==='function')caveChoiceShow();
}
// Dış çizicideki ağız +yerel y yönünde, r*.92; yapı dönüşünü de izle.
function cavMouth(b, side = 0, out = 0) {
  const a = b.ang || 0, c = Math.cos(a), sn = Math.sin(a), y = b.r * .92 + out;
  return { x: b.x + side * c - y * sn, y: b.y + side * sn + y * c };
}
function cavWalkEnter(fromX, fromY) {
  if (!L || G.inside || G.mount || G.sleep || G.over || L.dead || L.downed || L.grabbed || Math.hypot(L.x-fromX,L.y-fromY)>80) return false;
  for (const b of G.builds) {
    if (b.type !== 'magara' || !enterable(b)) continue;
    const a = b.ang || 0, c = Math.cos(a), sn = Math.sin(a), mouth = b.r * .92;
    const x0=(fromX-b.x)*c+(fromY-b.y)*sn, y0=-(fromX-b.x)*sn+(fromY-b.y)*c;
    const x1=(L.x-b.x)*c+(L.y-b.y)*sn, y1=-(L.x-b.x)*sn+(L.y-b.y)*c;
    if (y0 < mouth || y1 >= mouth || y1 >= y0) continue;
    const t=(y0-mouth)/(y0-y1), side=x0+(x1-x0)*t;
    if (Math.abs(side)>22) continue;
    const yaw=G.yaw, pitch=G.pitch;
    enterBuilding(b);
    if (!G.inside || G.inside.b !== b) return false;
    G.inside.x=inDims(b).w/2+side; G.inside.y=cavTunEnd(b)-3; G.yaw=yaw-a; G.pitch=pitch;
    L.x=b.x;L.y=b.y;L.insideB=b;G.interact=null;G.lookP=null;G.actT=G.actProg=0;
    return true;
  }
  return false;
}
function exitBuilding(walk = false) {
  if (!G.inside) return; const I=G.inside, b=I.b, D=b ? inDims(b) : null, yaw=G.yaw;
  G.inside=null;L.insideB=null;
  if (b && !b.dead) {
    const q=b.type==='magara'?cavMouth(b,clamp(I.x-D.w/2,-22,22),walk?3:26):stnPos(b);
    L.x=q.x;L.y=q.y+(b.type==='magara'?0:16);
  }
  G.yaw=walk&&b&&b.type==='magara'?yaw+(b.ang||0):Math.PI/2+(b&&b.type==='magara'?b.ang||0:0);
  if (!walk) G.pitch=0;
  cavPlaceStop();G.interact=null;G.lookP=null;G.actT=G.actProg=0;pushOut(L,false);
}
function inMove(mx, my, spd, dt) {
  const I = G.inside, D = inDims(I.b); let x = I.x + mx * spd * dt, y = I.y + my * spd * dt;
  const cav = I.b.type === 'magara', te = cav ? cavTunEnd(I.b) : 0;
  if (cav && y >= te && Math.abs(x - D.w / 2) <= 26) { exitBuilding(true); return; }
  // mağarada ağız tüneli yürünür (rampa); dar geçit
  if (cav && y > D.h - 10) { x = clamp(x, D.w / 2 - 30, D.w / 2 + 30); y = Math.min(y, te + 2); }
  else { x = clamp(x, 14, D.w - 14); y = clamp(y, 14, cav && Math.abs(x - D.w / 2) <= 30 ? te + 2 : D.h - 10); }
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
    if (f.k === 'door') { if (b.type !== 'magara') test(f.x, f.y, { kind: 'exit', label: 'Dışarı çık' }, 80); }
    else if (f.k === 'bed' || f.k === 'mat') test(f.x, f.y, { kind: 'sleep', label: goHome() ? 'Uyu' : 'Yatak (gece uyuyabilirsin)' }, 70);
    else if (f.k === 'bench') { const od = G.orders.find(o => o.worker && o.stageAd && !(o.trips > 0)); test(f.x, f.y, { kind: 'craft', label: od ? `Üretim masası — ${ITEMS[od.item].ad}: ${od.stageAd}` : 'Üretim masası' }, 80); }
    else if (f.k === 'crate') test(f.x, f.y, { kind: 'store', label: 'Depo — oda türünü değiştir (I)' }, 60);
  }
  return best;
}

// Geçici yerleştirme durumu kayda girmez; yalnız mevcut mağarada geçerlidir.
const CAV_PLACE = { b: null, recipe: null, ang: 0, point: null, valid: false };
function cavPlaceStop() { CAV_PLACE.b = null; CAV_PLACE.recipe = null; CAV_PLACE.point = null; CAV_PLACE.valid = false; }
function cavPlaceAim() {
  const I = G.inside, S = CAV_PLACE;
  if (!I || I.b !== S.b || I.b.dead || !Object.hasOwn(CAV_FURN_RECIPES, S.recipe)) { cavPlaceStop(); return null; }
  // Bakışın zeminle kesişimi: ufka bakarken erişim mesafesinde tut.
  const yaw = G.yaw || 0, pitch = G.pitch || 0, eye = typeof U3 !== 'undefined' ? U3.eye || 30 : 30;
  let reach = pitch < -.06 ? eye / Math.tan(-pitch) : 145;
  reach = clamp(reach, 45, 145);
  const q = S.point = { x: I.x + Math.cos(yaw) * reach, y: I.y + Math.sin(yaw) * reach };
  S.valid = cavFurnitureCanPlace(I.b, S.recipe, q.x, q.y); return q;
}
function cavPlaceCommit() {
  const q = cavPlaceAim(), S = CAV_PLACE;
  if (!q || !S.valid || G.paused || G.modal || G.sleep || G.over) return null;
  const f = cavFurnitureQueue(S.b, S.recipe, q.x, q.y, S.ang);
  if (f) cavPlaceStop(); return f;
}
function cavPendingLook() {
  const I = G.inside; if (!I || I.b.type !== 'magara' || (G.pitch || 0) > .35) return null;
  let best = null, score = .15;
  for (const f of cavFurnitureSync(I.b).items) {
    if (f.built) continue;
    const dx = f.x - I.x, dy = f.y - I.y, d = Math.hypot(dx, dy);
    if (d < 12 || d > 155) continue;
    const aim = 1 - (dx * Math.cos(G.yaw || 0) + dy * Math.sin(G.yaw || 0)) / d;
    if (aim < score) { best = f; score = aim; }
  }
  return best;
}
