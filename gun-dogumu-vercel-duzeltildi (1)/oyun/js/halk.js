'use strict';
// =============================================================
//  HALK — kişiler, beceriler, kuşanım, haneler, gruplar,
//         sağlık/şifahane/salgın ve tüm meslek davranışları
// =============================================================
function pickTraits() {
  const keys = Object.keys(TRAITS), n = Math.random() < 0.45 ? 2 : 1, out = [];
  let guard = 0;
  while (out.length < n && guard++ < 50) {
    const k = pick(keys);
    if (out.includes(k) || (TRAITS[k].ex && out.some(o => TRAITS[k].ex.includes(o)))) continue;
    out.push(k);
  }
  return out;
}
function freshName() {
  const free = NAMES.filter(n => !G.usedNames.has(n));
  const n = free.length ? pick(free) : pick(NAMES) + ' ' + pick(['Kara', 'Ak', 'Genç', 'Küçük', 'Uzun', 'Deli']);
  G.usedNames.add(n); return n;
}
function mkPerson(x, y, name, leader, child) {
  const st = leader || child ? { t: '', sk: {} } : pick(STORIES);
  const p = {
    id: ++G.idc, name, x, y, r: child ? 8 : 11, leader: !!leader, child: !!child, age: 0,
    traits: leader || child ? [] : pickTraits(), story: st.t,
    group: leader ? null : 'bos', hp: 60, maxhp: 60, fear: 0, st: 'idle', tgt: null, carry: 0, bag: {}, work: 0,
    ang: rand(0, TAU), anim: 0, atkCd: 0, hurtT: 0, lastHurt: 99, inHut: null,
    skin: pick(['#e0b48a', '#c99068', '#a8754f', '#f0c8a0', '#8a5a3a', '#d8a47a']), hair: pick(['#2a1a10', '#4a2e18', '#111', '#6a4020', '#8a6a3a', '#bbb', '#a0522d']),
    stam: 100, stuck: 0, detour: 0, seat: rand(0, TAU), grabbed: false, desert: 0, moving: false,
    injury: null, downed: 0, tired: false, watched: false, partner: 0, parentA: 0, parentB: 0, post: null, medic: 0, fidx: 0, swing: 0,
    sk: {}, eq: {}, homeT: null, bed: null, bedRes: null, bedUntil: 0, carriedBy: 0, carrying: null, sick: null, wasDowned: false, backT: 0,
    routine: null, alt: 'yiyecek', hunger: 0, ate: true, insideB: null
  };
  for (const s in SKILLS) p.sk[s] = 0;
  for (const s in st.sk) p.sk[s] = XPL[st.sk[s] - 1] + 1;
  if (!leader && !child) p.sk[pick(Object.keys(SKILLS))] += rand(0, 25);
  p.maxhp = leader ? 100 : child ? 35 : Math.round(60 * (tr(p, 'guclu') ? 1.3 : 1) * (tr(p, 'hasta') ? 0.75 : 1));
  p.hp = p.maxhp;
  return p;
}
const members = g => G.people.filter(p => !p.leader && !p.child && p.group === g);
const lvl = (p, s) => s && p.sk ? lvlOfXp(p.sk[s] || 0) : 1;
const bestLvl = s => G.people.reduce((m, p) => Math.max(m, p.child ? 0 : lvl(p, s)), 1);
function addXP(p, s, a) {
  if (!s || !p.sk || p.leader) return;
  const b = lvl(p, s);
  p.sk[s] += a * (tr(p, 'zeki') ? 1.5 : 1) * (tr(p, 'yasli') ? 2 : 1);
  const n = lvl(p, s);
  if (n > b) {
    msg(`⬆ ${p.name} ${SKILLS[s].ad} becerisinde ${n}. seviyeye ulaştı!`, '#ffd27a', 4);
    if (L && dist(p, L) < 800) SFX.levelup();
    if (n >= 5) unlock('usta');
    G.uiDirty = true; G.toolsDirty = true;
  }
}

// ---- kuşanım: stoktaki aletler önceliğe göre dağıtılır
const EQP = { kemikMizrak: ['L', 'avci', 'muhafiz', 'takip'], mizrak: ['L', 'avci', 'muhafiz', 'takip', 'kasif'], yay: ['L', 'avci', 'muhafiz', 'takip'], zirh: ['L', 'muhafiz', 'avci', 'takip', 'kasif'], balta: ['odun'], kazma: ['tas'], sepet: ['yiyecek', 'odun', 'tas', 'kasap', 'ciftci', 'sifaci'] };
// Eşyalar kişiye zimmetlenir (p.own); zimmetlenmeyen depoda durur. G.autoEq açıksa boşta kalan eşya uygun kişilere kendiliğinden dağıtılır.
const OWNABLE = Object.keys(EQP).concat(['yatak']);
function ownedCount(k) { let n = 0; for (const p of G.people) if (p.own && p.own[k]) n++; return n; }
const freeItems = k => Math.max(0, (G.stock[k] || 0) - ownedCount(k));
function giveItem(p, k) { if (freeItems(k) < 1) return false; p.own = p.own || {}; p.own[k] = true; p.eq = Object.assign({}, p.own); return true; }
function takeItem(p, k) { if (p.own) delete p.own[k]; p.eq = Object.assign({}, p.own || {}); }
function autoDistribute() {
  for (const k in EQP) {
    for (const g of EQP[k]) {
      const list = g === 'L' ? (L ? [L] : []) : members(g).sort((a, b) => lvl(b, GROUPS[g].sk) - lvl(a, GROUPS[g].sk));
      for (const p of list) { if (freeItems(k) < 1) break; if (p.own && p.own[k]) continue; if (k === 'mizrak' && p.own && p.own.kemikMizrak) continue; giveItem(p, k); }
    }
  }
  for (const p of G.people) { if (freeItems('yatak') < 1) break; if (!(p.own && p.own.yatak)) giveItem(p, 'yatak'); }
}
function assignEquip() {
  for (const k of OWNABLE) { let over = ownedCount(k) - (G.stock[k] || 0); if (over > 0) for (const p of G.people.slice().reverse()) { if (over <= 0) break; if (p.own && p.own[k]) { delete p.own[k]; over--; } } }
  if (G.autoEq) autoDistribute();
  for (const p of G.people) p.eq = Object.assign({}, p.own || {});
}
const spearTier = p => p && p.eq && p.eq.kemikMizrak ? 3 : p && p.eq && p.eq.mizrak ? 2 : 1;
const arrows = () => (G.stock.ok || 0) + (G.stock.zok || 0);
const ranged = p => !!(p.eq && p.eq.yay) && arrows() > 0;
const nearSifahane = p => G.builds.some(b => b.built && !b.dead && (b.type === 'sifahane' || roomCount(b, 'sifa') > 0) && Math.hypot(b.x - p.x, b.y - p.y) < b.r + 140);

function pSpeed(p) {
  let s = p.leader ? 120 : 84;
  if (p.carry > 0 && !p.leader) s *= 0.82;   // yük taşıyan ağır yürür
  if (typeof terrainMul === 'function') s *= terrainMul(p.x, p.y);
  if (p.sneak) s *= 0.5;
  if (tr(p, 'cevik')) s *= 1.25;
  if (tr(p, 'yasli')) s *= 0.85;
  if (p.tired) s *= 0.8;
  if (p.sick) s *= 0.8;
  if (p.injury && p.injury.type === 'kirik') s *= 0.5;
  if (p.child) s *= 0.9;
  if (p.carrying) s *= 0.75;
  if (biomeFast(p.x, p.y) === 2) s *= 0.75;
  if (p.group === 'kasif') s *= abilOn('kasif') ? 1.4 : 1.15;
  if (p.group === 'avci' && abilOn('avci')) s *= 1.3;
  return s;
}
const moraleMul = () => G.morale > 70 ? 1.15 : G.morale < 30 ? 0.8 : 1;
function workRate(p) {
  const sk = GROUPS[p.group] && GROUPS[p.group].sk;
  let w = skillMul(lvl(p, sk));
  if (tr(p, 'caliskan')) w *= 1.3;
  if (tr(p, 'yasli')) w *= 0.9;
  if (p.tired) w *= 0.75;
  if (p.sick) w *= 0.5;
  if ((p.group === 'odun' && p.eq.balta) || (p.group === 'tas' && p.eq.kazma)) w *= 1.5;
  return w * grpMul(p.group) * (abilOn(p.group) ? 2 : 1) * moraleMul();
}
function dmgOf(p) {
  const t = spearTier(p);
  let d = p.leader ? [18, 30, 42][t - 1] : [8, 13, 18][t - 1];
  if (!p.leader) d *= skillMul(lvl(p, p.group === 'avci' ? 'avcilik' : 'savas'));
  if (tr(p, 'avci')) d *= 1.4;
  if (tr(p, 'guclu')) d *= 1.2;
  if (p.group === 'muhafiz' && abilOn('muhafiz')) d *= 1.6;
  if (p.group === 'takip' && abilOn('takip')) d *= 1.5;
  if (p.group === 'avci' && abilOn('avci')) d *= 1.5;
  return d;
}
const arrowDmg = p => (p.leader ? 22 : 14) * (p.leader ? 1 : skillMul(lvl(p, p.group === 'avci' ? 'avcilik' : 'savas'))) * (tr(p, 'avci') ? 1.4 : 1) * (p.group === 'avci' && abilOn('avci') ? 1.5 : 1);
function moraleAdd(v) { G.morale = clamp(G.morale + v, 0, 100); }

// ---- gruplar ve yöneticiler
function mgr(g) {
  const id = G.managers[g]; if (!id) return null;
  const p = G.people.find(q => q.id === id);
  return p && p.group === g && !p.downed && !p.grabbed && !p.desert && !p.bed ? p : null;
}
function grpMul(g) { const m = mgr(g); return m ? 1.2 + (tr(m, 'onder') ? 0.25 : 0) + (tr(m, 'yasli') ? 0.15 : 0) + (lvl(m, GROUPS[g].sk) - 1) * 0.03 : 1; }
const abilOn = g => !!(G.abil[g] && G.abil[g].act > 0);
const mgrScore = p => (tr(p, 'onder') ? 3 : 0) + (tr(p, 'yasli') ? 2 : 0) + lvl(p, GROUPS[p.group] && GROUPS[p.group].sk) * 0.8 + p.hp / 100;
function setGroup(p, g, quiet) {
  if (p.leader || p.child || p.group === g) return;
  if (G.managers[p.group] === p.id) { G.managers[p.group] = null; if (!quiet) msg(`${GROUPS[p.group].ad} grubu yöneticisiz kaldı.`, '#ccc', 3); }
  if (p.tgt && p.tgt.claim === p) p.tgt.claim = null;
  if (p.post) { p.post.guard = null; p.post = null; }
  for (const o of G.orders) if (o.worker === p.id) o.worker = 0;
  if (p.carrying) dropCarried(p);
  p.tgt = null; p.st = p.carry > 0 ? 'return' : 'idle'; p.group = g; p.stgt = null;
  if (p.inHut && (g === 'muhafiz' || g === 'takip')) leaveHut(p);
  G.uiDirty = true; if (!quiet) G.tutGroup = true;
}
function plusGroup(g) {
  let src = members('bos').filter(p => G.managers.bos !== p.id && !p.bed).pop();
  if (!src) {
    let best = null;
    for (const k of ['odun', 'tas', 'yiyecek', 'ciftci', 'takip']) {
      if (k === g) continue;
      const m = members(k).filter(p => G.managers[k] !== p.id && !p.bed);
      if (m.length > (best ? best.length : 0)) best = m;
    }
    if (best) src = best[best.length - 1];
  }
  if (!src) { msg('Aktarılacak kimse yok. Halkın büyümeli ya da birini boşa almalısın.', '#ccc', 3); return; }
  setGroup(src, g);
}
function minusGroup(g) { const m = members(g), free = m.filter(p => G.managers[g] !== p.id); const p = free[free.length - 1] || m[0]; if (p) setGroup(p, 'bos'); }
function setManager(g, p) {
  if (p.group !== g) setGroup(p, g);
  G.managers[g] = p.id;
  msg(`${p.name} artık ${GROUPS[g].ad} grubunun yöneticisi${tr(p, 'onder') ? ' ⭐' : ''}.`, '#fd9', 3);
  G.uiDirty = true;
}
function cycleManager(g) {
  const m = members(g);
  if (!m.length) { msg(`${GROUPS[g].ad} grubunda kimse yok.`, '#ccc', 2); return; }
  const s = m.slice().sort((a, b) => mgrScore(b) - mgrScore(a));
  const cur = s.findIndex(p => p.id === G.managers[g]);
  setManager(g, s[(cur + 1) % s.length]);
}
const SHOUT = { odun: 'Baltaları kaldırın!', tas: 'Şu damarı izleyin!', yiyecek: 'Bugün kimse aç yatmayacak!', avci: 'İzini sürün, kaçırmayın!', kasap: 'Bıçakları bileyin!', ciftci: 'Toprak bizi doyuracak!', sifaci: 'Yaralıları bana getirin!', zanaat: 'Ustalığınızı gösterin!', mimar: 'Herkes tuğla taşısın!', kasif: 'Ufkun ötesine!', muhafiz: 'Mevzilere! Kimse geçmeyecek!', takip: 'Arkamdan! Saldırın!' };
function useAbility(g) {
  const m = mgr(g);
  if (!m) { msg('Önce bu gruba bir yönetici ata (★).', '#e99', 3); return; }
  const a = G.abil[g];
  if (a.cd > 0) { msg(`${ABIL[g].ad} henüz hazır değil (${Math.ceil(a.cd)} sn).`, '#ccc', 2); return; }
  a.cd = ABIL[g].cd; a.act = ABIL[g].dur;
  if (g === 'yiyecek') for (const b of G.bushes) if (Math.hypot(b.x - CAMP.x, b.y - CAMP.y) < 900) b.amt = b.max;
  if (g === 'ciftci') for (const b of G.builds) if (b.type === 'tarla' && b.planted) b.g = Math.min(1, b.g + 0.5);
  if (g === 'sifaci') for (const p of G.people) if (Math.hypot(p.x - G.fire.x, p.y - G.fire.y) < Math.max(fireR(), 260) || p.bed) {
    if (p.downed > 0) { p.downed = 0; p.hp = 1; p.wasDowned = true; }
    p.hp = Math.min(p.maxhp, p.hp + 40); if (p.injury && p.injury.type === 'kanama') p.injury = null;
  }
  if (g === 'muhafiz') for (const p of members('muhafiz')) p.fear = 0;
  if (g === 'asci') G.feastNext = true;
  msg(`${m.name}: "${SHOUT[g]}" — ${ABIL[g].ad}`, '#ffd27a', 4);
  SFX.bell(); G.uiDirty = true;
}
function setZone(g) {
  const m = mgr(g);
  if (!m) { msg('Bölge emri için önce bir yönetici ata (★).', '#e99', 3); return; }
  G.zone[g] = { x: L.x, y: L.y };
  msg(g === 'muhafiz' ? `${m.name}: "Nöbet yeri burası."` : `${m.name}: "${GROUPS[g].ad} grubu buradan (${BIOME_AD[biomeFast(L.x, L.y)]}) çalışacak."`, '#fd9', 4);
  G.uiDirty = true;
}
function clearZone(g) { G.zone[g] = null; msg(`${GROUPS[g].ad} grubu kampa yakın çalışmaya döndü.`, '#ccc', 3); G.uiDirty = true; }

// ---- kaynaklar
function nearestRes(p, g) {
  const ref = G.zone[g] || CAMP;
  let lists;
  if (g === 'odun') lists = [G.trees];
  else if (g === 'tas') lists = p.eq.kazma ? [G.rocks, G.crystals] : [G.rocks];
  else if (g === 'yiyecek') lists = [G.bushes];
  else if (g === 'sifaci') lists = (G.stock.herb >= 14 && G.stock.poison < 10) ? [G.poisons, G.herbs] : [G.herbs, G.poisons];
  else return null;
  let best = null, bs = 1e9;
  lists.forEach((arr, li) => {
    for (const o of arr) {
      if (o.dead || o.amt < 1 || o.stump) continue;
      const dr = Math.hypot(o.x - ref.x, o.y - ref.y); if (dr > 1600) continue;
      let s = Math.hypot(o.x - p.x, o.y - p.y) + dr * 0.6 + li * 300;
      if (o.kind === 'crystal') s -= 350;
      if (o.claim && o.claim !== p && !o.claim.dead) s += 250;
      if (s < bs) { bs = s; best = o; }
    }
  });
  return best;
}
function takeRes(o) {
  o.amt--; const r = o.res;
  if (o.amt <= 0) {
    if (o.kind === 'tree') treeDown(o);
    else if (o.kind === 'rock' || o.kind === 'crystal') { o.dead = true; gDel(o); }
    o.claim = null;
  }
  return r;
}
function treeDown(t) {
  if (t.stump) return;
  t.stump = true; gDel(t); t.r = 9; gAdd(t);
  if (G.parts) for (let i = 0; i < 12; i++) G.parts.push({ x: t.x + rand(-30, 30), y: t.y + rand(-40, 10), vx: rand(-40, 40), vy: rand(-40, 40), life: rand(0.6, 1.4), col: pick(['#2f5a24', '#3d6a2c', '#24481c']), s: rand(3, 6) });
}
function deposit(p, mult = 1) {
  for (const k in p.bag) addStock(k, k === 'food' ? Math.round(p.bag[k] * mult) : p.bag[k], p.x, p.y);
  p.bag = {}; p.carry = 0;
}
// malzemeler ilgili depoya taşınır: en yakın depo odalı yapı (kapısı), yoksa ateşin yanı
function depotOf(p) {
  let best = null, bd = 1e9;
  for (const b of G.builds) { if (!b.built || b.dead || !isRoomy(b) || roomCount(b, 'depo') < 1) continue; const d = dist(b, p); if (d < bd) { bd = d; best = b; } }
  if (!best) return G.fire;
  if (!best._dp) best._dp = { x: best.x, y: best.y + best.r * 0.85 + 30 };
  return best._dp;
}
// tek seferde taşınan yük: bir kütük (3 odun) ya da bir kucak taş (2); meyve/ot sepetle
const tripCap = (p, g) => g === 'odun' ? 3 + (tr(p, 'guclu') ? 1 : 0) : g === 'tas' ? 2 + (tr(p, 'guclu') ? 1 : 0) : carryCap(p);
const carryCap = p => 5 + (tr(p, 'guclu') ? 3 : 0) + (p.eq && p.eq.sepet ? 4 : 0);

// ---- tehlike
function hostile(d) {
  if (d.tamed || d.dead) return false;
  if (d.type === 'batakci') return !d.hidden;
  if (d.type === 'taklitci') return !!d.revealed;
  return !!DINO[d.type].pred || d.angry > 0;
}
function nearestThreat(p, range) {
  let best = null, bd = range;
  for (const d of G.dinos) { if (!hostile(d)) continue; const dd = dist(d, p) - d.r; if (dd < bd) { bd = dd; best = d; } }
  return best;
}

// ---- haneler: çadır = 1 hane; mağara/kulübe yatakhanesi = 2 hane
const roomCount = (b, t) => (b.rooms || []).filter(r => r === t).length;
const homeBuildings = () => G.builds.filter(b => b.built && !b.dead && (b.type === 'cadir' || roomCount(b, 'yatak') > 0));
const tents = homeBuildings;
const homeCap = b => b.type === 'cadir' ? 1 : roomCount(b, 'yatak') * 2;
function households(b) {
  const ids = b.owners || []; let n = 0;
  for (const id of ids) {
    const q = G.people.find(x => x.id === id); if (!q) continue;
    if (q.partner && ids.includes(q.partner) && q.partner < q.id) continue;
    if ((q.parentA && ids.includes(q.parentA)) || (q.parentB && ids.includes(q.parentB))) continue;
    n++;
  }
  return n;
}
const hasRoom = b => households(b) < homeCap(b);
function homeOf(p) {
  if (p.leader) return null;
  if (p.child) { const par = G.people.find(q => (q.id === p.parentA || q.id === p.parentB) && !q.leader && q.homeT); return par ? par.homeT : null; }
  return p.homeT && !p.homeT.dead ? p.homeT : null;
}
function moveHome(p, t) {
  if (p.homeT && p.homeT.owners) { const i = p.homeT.owners.indexOf(p.id); if (i >= 0) p.homeT.owners.splice(i, 1); }
  p.homeT = t; if (t && !t.owners.includes(p.id)) t.owners.push(p.id);
}
function assignHomes() {
  const T = homeBuildings();
  for (const p of G.people) if (p.homeT && (p.homeT.dead || !p.homeT.built || homeCap(p.homeT) === 0)) moveHome(p, null);
  for (const t of T) t.owners = (t.owners || []).filter(id => { const q = G.people.find(x => x.id === id); return q && q.homeT === t; });
  for (const t of T) while (households(t) > homeCap(t)) { const id = t.owners[t.owners.length - 1]; const q = G.people.find(x => x.id === id); if (!q) { t.owners.pop(); continue; } moveHome(q, null); }
  for (const p of G.people) {
    if (p.leader || p.child || !p.partner) continue;
    const q = G.people.find(x => x.id === p.partner); if (!q || q.leader) continue;
    if (p.homeT && q.homeT !== p.homeT && (!q.homeT || q.id > p.id)) moveHome(q, p.homeT);
    else if (!p.homeT && q.homeT) moveHome(p, q.homeT);
  }
  for (const p of G.people) {
    if (p.leader || p.child || p.homeT) continue;
    const par = G.people.find(x => (x.id === p.parentA || x.id === p.parentB) && x.homeT);
    if (par) { moveHome(p, par.homeT); continue; }
    const t = T.find(hasRoom);
    if (t) moveHome(p, t);
  }
}
const freeHomes = () => homeBuildings().reduce((n, b) => n + Math.max(0, homeCap(b) - households(b)), 0);
const emptyTents = freeHomes;
const homelessCount = () => G.people.filter(p => !p.leader && !homeOf(p)).length;
// ---- istasyonlar: bağımsız yapı ya da mağara/kulübe odası
const STN = { kasap: 'kasaphane', atolye: 'atolye', okcu: 'oktezgah', tabak: 'tabakhane', sifa: 'sifahane', mutfak: '' };
const isRoomy = b => b.type === 'magara' || b.type === 'kulube';
function stations(type) { return G.builds.filter(b => b.built && !b.dead && (b.type === STN[type] || (b.rooms && b.rooms.includes(type)))); }
function station(type, from) { const S = stations(type); if (!S.length) return null; const f = from || G.fire; return S.sort((a, b) => dist(a, f) - dist(b, f))[0]; }
const stnPos = b => isRoomy(b) ? { x: b.x, y: b.y + b.r * 0.85 } : { x: b.x, y: b.y + (b.r || 30) + 8 };
function atStation(p, b, dt) {
  const sp = stnPos(b), tx = sp.x + Math.cos(p.seat) * (isRoomy(b) ? 14 : 10), ty = sp.y;
  if (Math.hypot(p.x - tx, p.y - ty) > 12) { steer(p, tx, ty, pSpeed(p), dt, false); p.anim += dt * 9; return false; }
  p.moving = false; p.ang = angTo(p, b); if (isRoomy(b)) p.insideB = b;
  return true;
}
function storeCap() { let n = 0; for (const b of G.builds) if (b.built && !b.dead) n += roomCount(b, 'depo'); return 200 + 150 * n; }
function enterHut(p) {
  const h = homeOf(p); if (!h) return false;
  const ey = isRoomy(h) ? h.y + h.r * 0.85 : h.y + h.r + 4;
  if (steer(p, h.x, ey, pSpeed(p), G.dt, false) || Math.hypot(p.x - h.x, p.y - ey) < 16) { if (!h.occ.includes(p)) h.occ.push(p); p.inHut = h; p.x = h.x; p.y = h.y; }
  return true;
}
function leaveHut(p) { const h = p.inHut; if (!h) return; const i = h.occ.indexOf(p); if (i >= 0) h.occ.splice(i, 1); p.inHut = null; p.x = h.x + rand(-10, 10); p.y = h.y + h.r + 10; }

// ---- yaralanma, tedavi, şifahane, salgın
function injure(p) {
  if (p.injury || p.downed > 0) return;
  const r = Math.random();
  if (r < 0.5) { p.injury = { type: 'kanama', t: 14 }; msg(p === L ? 'Kanıyorsun!' : `${p.name} kanıyor!`, '#f99', 3); }
  else if (r < 0.8) { p.injury = { type: 'kirik', t: 240 }; msg(p === L ? 'Bacağın kırıldı! Yavaşladın.' : `${gen(p.name)} bacağı kırıldı! Şifahaneye taşınmalı.`, '#f99', 4); }
  else { p.injury = { type: 'enfeksiyon', t: 0 }; msg(p === L ? 'Yaran mikrop kaptı. İlaç lazım.' : `${gen(p.name)} yarası mikrop kaptı. İlaç lazım.`, '#fb9', 4); }
}
function makeSick(p, why) {
  if (!p || p.sick || p.dead) return false;
  p.sick = { d: 0, med: false };
  msg(`🤒 ${p.name} ${why || 'ateşler içinde yanıyor'}.`, '#dfa060', 5);
  return true;
}
function updInjury(p, dt) {
  const j = p.injury;
  if (j) {
    if (j.type === 'kanama') { p.hp -= 1.0 * dt; j.t -= dt; if (j.t <= 0) p.injury = null; }
    else if (j.type === 'enfeksiyon') p.hp -= (p.bed ? 0.02 : 0.07) * dt;
    else if (j.type === 'kirik') { j.t -= dt * (p.bed ? 3 : nearSifahane(p) ? 2 : 1) * (j.set ? 2 : 1); if (j.t <= 0) { p.injury = null; msg(p === L ? 'Kemiğin kaynadı.' : `${gen(p.name)} kemiği kaynadı.`, '#9f9', 3); } }
  }
  if (p.sick && p.hp > p.maxhp * 0.4) p.hp -= 0.03 * dt;
  if (p.sick && Math.random() < dt * 0.05 && L && dist(p, L) < 400) SFX.cough(0.3, panOf(p.x));
  if (p.hp <= 0 && !p.dead) { if (p.leader) killPerson(p, null); else downPerson(p); }
}
function downPerson(p) {
  if (p.downed > 0) { killPerson(p, null); return; }
  if (p.carrying) dropCarried(p);
  p.downed = 25; p.hp = 0; p.fear = 100; p.moving = false;
  if (p.tgt && p.tgt.claim === p) p.tgt.claim = null; p.tgt = null;
  if (p.inHut) leaveHut(p);
  msg(`${p.name} ağır yaralı yere yığıldı! 25 sn içinde yanına gidip [E] ile kaldır.`, '#ff8a6a', 6);
  for (const q of G.people) if (dist(q, p) < 500) q.fear = Math.min(100, q.fear + 10);
  G.uiDirty = true;
}
function needsCare(q) {
  if (q.dead || q.grabbed || q.desert || q.inHut || q.bed || q.carriedBy) return false;
  if (q.downed > 0) return true;
  if (q.injury) { if (q.injury.type === 'enfeksiyon') return (G.stock.ilac || 0) > 0; if (q.injury.type === 'kirik') return !q.injury.set; return true; }
  return false;
}
function bedCount(b) { return b.type === 'sifahane' ? 4 : roomCount(b, 'sifa') * 2; }
const sifahaneler = () => G.builds.filter(b => b.built && !b.dead && bedCount(b) > 0);
function treat(q, healer) {
  if (q.downed > 0) { q.downed = 0; q.hp = Math.max(q.hp, 25); q.wasDowned = true; msg(`${q.name} ayağa kaldırıldı${sifahaneler().length ? ' — şifahanede dinlenmeli' : ''}.`, '#9f9', 3); }
  else if (q.injury) {
    const t = q.injury.type;
    if (t === 'kanama') { q.injury = null; if ((G.stock.bandaj || 0) > 0) { G.stock.bandaj--; q.hp = Math.min(q.maxhp, q.hp + 15); } msg(`${gen(q.name)} yarası sarıldı.`, '#9f9', 2); }
    else if (t === 'enfeksiyon') {
      if ((G.stock.ilac || 0) > 0) { G.stock.ilac--; q.injury = null; msg(`${q.name} ilaçla iyileşti.`, '#9f9', 3); }
      else if (!G.flags.noMed) { G.flags.noMed = 1; msg('İlaç yok! Şifacılara ilaç ürettir (3🌿 = 1💊).', '#fb9', 4); }
    } else if (t === 'kirik') { q.injury.t = Math.min(q.injury.t, 90); q.injury.set = true; msg(`${gen(q.name)} kırığı sarıldı.`, '#9f9', 2); }
  }
  q.hp = Math.min(q.maxhp, q.hp + (healer && tr(healer, 'sifali') ? 20 : 10));
  q.medic = 0;
  if (healer && !healer.leader) addXP(healer, 'sifa', 6);
}
function findPatient(p) {
  let best = null, bd = 1400;
  for (const q of G.people) {
    if (!needsCare(q) || (q.medic && q.medic !== p.id)) continue;
    const d = dist(q, p) - (q.downed > 0 ? 400 : 0);
    if (d < bd) { bd = d; best = q; }
  }
  return best;
}
const bedPos = (s, i) => s.type === 'sifahane' ? { x: s.x - 18 + (i % 2) * 36, y: s.y - 6 + Math.floor(i / 2) * 18 } : { x: s.x + ((i % 4) - 1.5) * 10, y: s.y + s.r * 0.55 };
function needsBed(q) {
  if (q.leader || q.bed || q.dead || q.grabbed || q.downed > 0 || (q.child && !q.sick)) return false;
  return !!((q.injury && q.injury.type !== 'kanama') || q.sick || q.wasDowned || q.hp < q.maxhp * 0.3);
}
const needsCarry = q => q.wasDowned || (q.injury && q.injury.type === 'kirik');
function assignBeds() {
  const S = sifahaneler();
  for (const s of S) { const n = bedCount(s); s.beds = s.beds || []; while (s.beds.length < n) s.beds.push(0); while (s.beds.length > n) { const id = s.beds.pop(); const q = G.people.find(x => x.id === id); if (q) releaseBed(q, true); } for (let i = 0; i < n; i++) { const id = s.beds[i]; if (id && !G.people.some(q => q.id === id && (q.bed || q.bedRes))) s.beds[i] = 0; } }
  for (const q of G.people) {
    if (q.bedRes && (q.bedRes.s.dead || !needsBed(q))) { q.bedRes.s.beds[q.bedRes.i] = 0; q.bedRes = null; }
    if (!needsBed(q) || q.bedRes) continue;
    let slot = null;
    for (const s of S) { const i = s.beds.indexOf(0); if (i >= 0) { slot = { s, i }; break; } }
    if (!slot) break;
    slot.s.beds[slot.i] = q.id; q.bedRes = slot;
  }
}
function putInBed(q) {
  const r = q.bedRes; if (!r || r.s.dead) return;
  q.bed = r; q.bedRes = null; q.carriedBy = 0; if (q.inHut) leaveHut(q);
  const d = (q.injury && q.injury.type === 'kirik') ? 2 : q.sick ? 2 : 1;
  q.bedUntil = G.day + d; q.wasDowned = false; q.tgt = null; q.st = 'idle';
  const bp = bedPos(r.s, r.i); q.x = bp.x; q.y = bp.y;
  msg(`⛑️ ${q.name} şifahanede yatıyor (${d} gün tedavi).`, '#9fd', 4); G.uiDirty = true;
}
function releaseBed(q, quiet) {
  if (q.bed) { q.bed.s.beds[q.bed.i] = 0; q.y = q.bed.s.y + q.bed.s.r + 14; q.bed = null; if (!quiet) msg(`${q.name} şifahaneden iyileşmiş olarak çıktı.`, '#9f9', 3); }
  if (q.bedRes) { q.bedRes.s.beds[q.bedRes.i] = 0; q.bedRes = null; }
}
function dropCarried(c) { const q = c.carrying; c.carrying = null; if (q) q.carriedBy = 0; }
function carrierStep(p, dt) {
  const q = p.carrying; if (!q || q.dead || !q.bedRes) { dropCarried(p); return false; }
  const bp = bedPos(q.bedRes.s, q.bedRes.i);
  const arrived = steer(p, bp.x, bp.y + 26, pSpeed(p), dt, false) || dist(p, q.bedRes.s) < q.bedRes.s.r + 20;
  p.anim += dt * 9;
  q.x = p.x - Math.cos(p.ang) * 10; q.y = p.y - Math.sin(p.ang) * 10;
  if (arrived) { p.carrying = null; putInBed(q); if (!p.leader) addXP(p, 'sifa', 4); }
  return true;
}
function pickCarry(p) {
  for (const q of G.people) if (q.bedRes && needsCarry(q) && !q.carriedBy && !q.bed && q.downed <= 0 && !q.grabbed && G.lcarry !== q && dist(q, p) < 1600) return q;
  return null;
}
function tryCarryJob(p, dt) {
  if (p.carrying) return carrierStep(p, dt);
  const q = pickCarry(p); if (!q) return false;
  if (dist(p, q) > 20) { steer(p, q.x, q.y, pSpeed(p) * 1.2, dt, false); p.anim += dt * 10; return true; }
  q.carriedBy = p.id; p.carrying = q; if (q.inHut) leaveHut(q);
  return true;
}

// ---- dövüş
function chaseAttack(p, foe, dt) {
  const reach = foe.r + p.r + 14;
  if (dist(p, foe) > reach) { steer(p, foe.x, foe.y, pSpeed(p) * 1.4 * (p.group === 'takip' && abilOn('takip') ? 1.3 : 1), dt, false); p.anim += dt * 12; }
  else { p.moving = false; p.ang = angTo(p, foe); if (p.atkCd <= 0) personAttack(p, foe); }
}
function personAttack(p, d) {
  p.atkCd = 0.95; p.swing = 0.2; p.ang = angTo(p, d);
  hurt(d, dmgOf(p), p);
  addXP(p, p.group === 'avci' ? 'avcilik' : 'savas', 2);
  if (L && dist(p, L) < 500) SFX.hit(0.3);
}
function rangedOrMelee(p, foe, dt) {
  if (ranged(p) && dist(p, foe) < 270 && dist(p, foe) > 40) {
    p.moving = false; p.ang = angTo(p, foe);
    if (p.atkCd <= 0) { p.atkCd = 1.1; shootArrow(p, foe.x, foe.y, arrowDmg(p)); addXP(p, 'savas', 1); }
  } else chaseAttack(p, foe, dt);
}

// ---- korku
const FEARW = { kesici: [500, 30], dev: [800, 45], yelken: [650, 35], taklitci: [500, 50], yirtici: [450, 18], yamyam: [400, 16], batakci: [320, 15], geceavcisi: [380, 12], kucuk: [320, 6] };
function updFear(p, dt, LS, night) {
  if (p.inHut || p.bed) { p.fear = Math.max(0, p.fear - 12 * dt); return; }
  let fm = tr(p, 'cesur') ? 0.55 : tr(p, 'korkak') ? 1.6 : 1;
  if (p.child) fm *= 1.3;
  if (p.group === 'muhafiz' && abilOn('muhafiz')) fm = 0;
  let inc = 0;
  for (const d of G.dinos) {
    if (!hostile(d)) continue;
    const fw = FEARW[d.type] || [320, 10];
    const dd = dist(d, p); if (dd < fw[0]) inc += fw[1] * (1 - dd / fw[0]);
  }
  const lit = lightLevel(p.x, p.y, LS) > 0.4;
  if (night && !lit) inc += 6;
  if (night && G.fire.fuel <= 0) inc += 6;
  if (G.weather.type === 'firtina') inc += 1.5;
  let dec = 0;
  if (lit && dist(p, G.fire) < fireR()) dec += 7;
  if (!night) dec += 5;
  if (L && L !== p && dist(p, L) < 160) dec += 4;
  if (G.morale > 70) dec += 1;
  p.fear = clamp(p.fear + (inc * fm - dec) * dt, 0, 100);
}

// ---- ana kişi güncellemesi
const HOME_GROUPS = ['odun', 'tas', 'yiyecek', 'kasap', 'asci', 'ciftci', 'sifaci', 'zanaat', 'mimar', 'kasif', 'bos', 'avci'];
function updPerson(p, dt, LS) {
  p.insideB = null; if (p.group !== 'avci') p.sneak = false;
  p.stageAd = null;
  p.haul = p.carry > 0 ? (Object.keys(p.bag)[0] || 'mat') : null;   // görünür yük: wood → omuzda kütük, stone → kucakta taş, meyve/herb → sepet, et/cigEt → et
  if (p.grabbed) return;
  p.atkCd -= dt; p.hurtT = Math.max(0, p.hurtT - dt); p.lastHurt += dt; p.swing = Math.max(0, p.swing - dt);
  if (p.work > 0 && p.moving) p.work = 0;
  if (p.downed > 0) { p.downed -= dt; p.moving = false; if (p.downed <= 0) { msg(`${p.name} yaralarına yenik düştü.`, '#f77', 5); killPerson(p, null); } return; }
  updInjury(p, dt); if (p.dead || p.downed > 0) return;
  if (p.bed) {
    if (p.bed.s.dead) { releaseBed(p, true); return; }
    const bp = bedPos(p.bed.s, p.bed.i); p.x = bp.x; p.y = bp.y; p.moving = false; p.ang = -Math.PI / 2;
    if (isRoomy(p.bed.s)) p.insideB = p.bed.s;
    const tended = G.people.some(h => h.group === 'sifaci' && !h.bed && dist(h, p.bed.s) < 90);
    if (!(p.injury && p.injury.type === 'enfeksiyon')) p.hp = Math.min(p.maxhp, p.hp + (tended ? 3 : 1.8) * dt);
    p.fear = Math.max(0, p.fear - 10 * dt);
    return;
  }
  if (p.carriedBy) { if (!G.people.some(c => c.id === p.carriedBy && c.carrying === p) && !(G.lcarry === p)) p.carriedBy = 0; else return; }
  const night = isNight();
  updFear(p, dt, LS, night);
  // yaralı çalışmaz: kırığı olan yerinde bekler (taşınır), diğerleri mağaraya/ateşe çekilip dinlenir; şifacı yanına gelir
  if (!p.carrying && (p.injury || p.hp < p.maxhp * 0.4) && !(p.fear > 60)) {
    p.work = 0; p.sneak = false; if (p.tgt && p.tgt.claim === p) p.tgt.claim = null; p.tgt = null; p.carryOrder = 0;
    if (!members('sifaci').length && !G.flags.noHealer) { G.flags.noHealer = 1; msg(`🩹 ${p.name} yaralı ve çalışamıyor. Şifacın yok: birini 🌿 Şifacı yap ya da yanına gidip kendin sar.`, '#f99', 6); }
    const broken = p.injury && p.injury.type === 'kirik';
    if (broken || p.wasDowned) { p.moving = false; p.stageAd = 'Yaralı — taşınmayı bekliyor'; return; }
    if (p.bedRes) { const bp = bedPos(p.bedRes.s, p.bedRes.i); if (Math.hypot(p.x - bp.x, p.y - bp.y) > 30 && dist(p, p.bedRes.s) > p.bedRes.s.r + 20) { steer(p, bp.x, bp.y + 20, pSpeed(p) * 0.6, dt, false); p.anim += dt * 6; } else putInBed(p); p.stageAd = 'Yaralı — şifa yerine gidiyor'; return; }
    const rp = depotOf(p); p.stageAd = 'Yaralı — dinleniyor';
    if (Math.hypot(p.x - rp.x, p.y - rp.y) > 40) { steer(p, rp.x + Math.cos(p.seat) * 20, rp.y + 10, pSpeed(p) * 0.6, dt, false); p.anim += dt * 6; } else { p.moving = false; p.hp = Math.min(p.maxhp, p.hp + 0.6 * dt); }
    return;
  }
  if (p.lastHurt > 6 && !(p.injury && p.injury.type === 'enfeksiyon')) {
    let h = 0;
    if (dist(p, G.fire) < fireR() + 20) h = 0.8;
    if (p.inHut) h = 1.2;
    if (nearSifahane(p)) h = Math.max(h, 0.8) * 2;
    p.hp = Math.min(p.maxhp, p.hp + h * dt);
  }
  if (night && p.group === 'muhafiz') p.watched = true;
  if (p.inHut) { if (!goHome() || !(p.child || HOME_GROUPS.includes(p.group)) || p.bedRes) leaveHut(p); return; }
  if (p.bedRes && !needsCarry(p)) {
    const bp = bedPos(p.bedRes.s, p.bedRes.i);
    if (steer(p, bp.x, bp.y + 24, pSpeed(p), dt, false) || dist(p, p.bedRes.s) < p.bedRes.s.r + 16) putInBed(p);
    p.anim += dt * 8; return;
  }
  if (p.bedRes && needsCarry(p)) { p.moving = false; return; }
  // ---- karanlığa kaçış
  if (p.desert > 0) {
    p.desert += dt; const a = p.desertAng;
    if (L && dist(p, L) < 45) { p.desert = 0; p.fear = 55; msg(`${acc(p.name)} yakaladın. Titreyerek sana sarıldı.`, '#9f9', 4); return; }
    steer(p, p.x + Math.cos(a) * 200, p.y + Math.sin(a) * 200, 165, dt, false); p.anim += dt * 14;
    if (p.desert > 7 || dist(p, L) > 1100) {
      G.lost++; G.lossToday = true; moraleAdd(-6);
      msg(`${p.name} karanlığa koştu... ve bir daha görülmedi.`, '#c9a', 6);
      setTimeout(() => { if (A.ctx && !G.over) SFX.scream(0.25, rand(-1, 1)); }, rand(2500, 6000));
      removePerson(p);
      for (const q of G.people) q.fear = Math.min(100, q.fear + 10);
    }
    return;
  }
  if (!p.child && p.fear >= 99 && night && lightLevel(p.x, p.y, LS) < 0.3 && Math.random() < 0.05 * dt) {
    p.desert = 0.01; p.desertAng = angTo(G.fire, p) + rand(-0.8, 0.8);
    if (p.carrying) dropCarried(p);
    msg(`${p.name} dehşete kapıldı ve kaçıyor! Durdurmak için yanına koş!`, '#f9a', 4);
    return;
  }
  const thr = nearestThreat(p, 190);
  if (p.fear >= 80 || (p.child && thr)) {
    if (p.carrying) dropCarried(p);
    p.anim += dt * 14;
    const fr = fireR();
    if (fr > 0 && dist(p, G.fire) > fr * 0.55) steer(p, G.fire.x + Math.cos(p.seat) * 50, G.fire.y + Math.sin(p.seat) * 50, pSpeed(p) * 1.4, dt, false);
    else if (thr) { const a = angTo(thr, p); steer(p, p.x + Math.cos(a) * 100, p.y + Math.sin(a) * 100, pSpeed(p) * 1.4, dt, false); }
    else p.moving = false;
    return;
  }
  if (G.meal && !p.ate && !p.carrying && !p.desert && !(p.post) && dist(p, G.meal.table) < 3600 && !(thr && dist(thr, p) < 150)) return mealStep(p, dt);
  if (p.child) return updChild(p, dt);
  if (p.carryOrder) { if (carryOrderStep(p, dt)) return; p.carryOrder = 0; }
  applyRoutine(p);
  const fighter = p.group === 'muhafiz' || p.group === 'takip' || p.group === 'avci';
  if (thr && dist(thr, p) - thr.r < 26 && p.atkCd <= 0 && (fighter || thr.type === 'kucuk' || p.fear < 50)) personAttack(p, thr);
  if (p.joinHunt && p.group !== 'avci' && G.hunt && G.hunt.t && !G.hunt.t.dead && !goHome() && p.hp > p.maxhp * 0.5) return updHunter(p, dt, thr);
  switch (p.group) {
    case 'balik': return updFisher(p, dt);
    case 'muhafiz': return updGuard(p, dt);
    case 'takip': return updFollow(p, dt);
    case 'sifaci': return updHealer(p, dt, thr);
    case 'kasif': return updScout(p, dt, thr);
    case 'avci': return updHunter(p, dt, thr);
    case 'kasap': return updButcher(p, dt, thr);
    case 'asci': return updCook(p, dt);
    case 'ciftci': return updFarmer(p, dt);
    case 'zanaat': return updCrafter(p, dt);
    case 'mimar': return updArchitect(p, dt);
    case 'bos': return updIdle(p, dt, true);
    default: return updGather(p, dt, p.group, thr);
  }
}
function sitByFire(p, dt, r) {
  const sx = G.fire.x + Math.cos(p.seat) * r, sy = G.fire.y + Math.sin(p.seat) * r;
  if (Math.hypot(p.x - sx, p.y - sy) > 10) { steer(p, sx, sy, pSpeed(p) * 1.1, dt, false); p.anim += dt * 9; }
  else { p.moving = false; p.ang = angTo(p, G.fire); }
}
function homeBehavior(p, dt) {
  if (p.tgt && p.tgt.claim === p) p.tgt.claim = null;
  p.tgt = null; if (p.st !== 'return') p.st = 'idle';
  if (p.carrying) { carrierStep(p, dt); return; }
  if (p.carry > 0) { if (dist(p, depotOf(p)) < 90) deposit(p); else { steer(p, depotOf(p).x, depotOf(p).y, pSpeed(p) * 1.15, dt, false); p.anim += dt * 9; return; } }
  if (enterHut(p)) { p.anim += dt * 8; return; }
  sitByFire(p, dt, 75);
}
function updChild(p, dt) {
  if (goHome()) { if (enterHut(p)) return; return sitByFire(p, dt, 45); }
  const par = G.people.find(q => q.id === p.parentA || q.id === p.parentB);
  if (par && !par.inHut && !par.bed && dist(par, G.fire) < Math.max(fireR(), 260)) {
    if (dist(p, par) > 30) { steer(p, par.x + 18, par.y + 10, pSpeed(p), dt, false); p.anim += dt * 10; } else p.moving = false;
    return;
  }
  p.wt = (p.wt || 0) - dt;
  if (p.wt <= 0) { p.wt = rand(3, 7); p.seat = rand(0, TAU); p.sr = rand(45, 110); }
  sitByFire(p, dt, p.sr || 60);
}
// ---- günlük rutin, yedek iş, yemek vakti, et taşıma
const ALTS = { balik: '🎣 Balık tut', yiyecek: '🫐 Meyve topla', odun: '🪓 Odun kes', tas: '⛏️ Taş kır', tasima: '🥩 Leşten et taşı', mimar: '📐 İnşaata yardım', bos: '💤 Dinlen' };
function applyRoutine(p) {
  if (!p.routine || p.child || p.leader) return;
  const ph = phase(), slot = ph < 0.16 ? 'sabah' : ph < 0.31 ? 'ogle' : ph < 0.46 ? 'ikindi' : null;
  if (!slot) return;
  const g = p.routine[slot];
  if (g && p.group !== g) setGroup(p, g, true);
}
function altJob(p, dt) {
  const a = p.alt || 'yiyecek';
  if (goHome()) return homeBehavior(p, dt);
  if (a === 'odun' || a === 'tas' || a === 'yiyecek') return updGather(p, dt, a, null, true);
  if (a === 'balik') return updFisher(p, dt);
  if (a === 'tasima') { if (haulJob(p, dt)) return; return updIdle(p, dt, true); }
  if (a === 'mimar') { if (updBuilder(p, dt, true)) return; return updIdle(p, dt, true); }
  return updIdle(p, dt, true);
}
function haulJob(p, dt) {
  const st = station('kasap', p) || G.fire;
  if (p.st === 'haul' && p.carry > 0) {
    const sp = stnPos(st);
    if (steer(p, sp.x + Math.cos(p.seat) * 14, sp.y, pSpeed(p), dt, false) || Math.hypot(p.x - sp.x, p.y - sp.y) < 30) { deposit(p); p.st = 'idle'; }
    p.anim += dt * 9; return true;
  }
  let c = p.tgt && p.tgt.carc && !p.tgt.dead && p.tgt.meat + p.tgt.bone + p.tgt.hide > 0 ? p.tgt : null;
  if (!c) p.tgt = c = nearestCarcass(p);
  if (!c) { if (p.carry > 0 && p.bag.cigEt) { p.st = 'haul'; return true; } return false; }
  if (dist(p, c) > c.r + 12) { steer(p, c.x, c.y, pSpeed(p), dt, false); p.anim += dt * 9; return true; }
  p.moving = false; p.ang = angTo(p, c); p.work += dt * (0.8 + 0.4 * skillMul(lvl(p, 'kasaplik')));
  if (p.work >= 0.7) {
    p.work = 0.01;
    const k = c.meat > 0 ? 'cigEt' : c.hide > 0 ? 'hide' : 'bone';
    if (k === 'cigEt') c.meat--; else if (k === 'hide') c.hide--; else c.bone--;
    p.bag[k] = (p.bag[k] || 0) + 1; p.carry++;
    if (c.meat + c.bone + c.hide <= 0) { c.dead = true; p.tgt = null; p.st = 'haul'; }
    if (p.carry >= carryCap(p) + 3) p.st = 'haul';
  }
  return true;
}
function tablePos() { const k = station('mutfak'); return k ? { x: k.x, y: k.y + k.r * 0.85 + 14, b: k } : { x: G.fire.x, y: G.fire.y + 46, b: null }; }
function takeMeal(n) { for (const k of ['food', 'meyve', 'et', 'cigEt']) if ((G.stock[k] || 0) >= n) { G.stock[k] -= n; return k; } return null; }
function eatMeal(p) {
  p.ate = true; p.mealT = 0;
  const src = takeMeal(p.child ? 0.5 : 1);
  p.lastMeal = src;
  if (!src) { p.hunger = (p.hunger || 0) + 1; return; }
  p.hunger = 0;
  if (src === 'food') { p.hp = Math.min(p.maxhp, p.hp + 6 + (G.meal && G.meal.feast ? 25 : 0)); }
  if (src === 'cigEt') G.unclean = (G.unclean || 0) + 1;
}
function mealStep(p, dt) {
  const t = G.meal.table, sx = t.x + Math.cos(p.seat) * 40, sy = t.y + Math.sin(p.seat) * 20;
  if (Math.hypot(p.x - sx, p.y - sy) > 12) { steer(p, sx, sy, pSpeed(p) * 1.15, dt, false); p.anim += dt * 9; return; }
  p.moving = false; p.ang = angTo(p, t); p.work = 0;
  if (t.b && isRoomy(t.b)) p.insideB = t.b;
  p.mealT = (p.mealT || 0) + dt;
  if (p.mealT > 3) eatMeal(p);
}
function stageSay(p, ad) { if (p.stageAd !== ad && p._lastSt !== ad && L && dist(p, L) < 400 && !p.insideB) ftext(p.x, p.y - 44, ad, '#e8d4b0'); p._lastSt = ad; p.stageAd = ad; }
function updCook(p, dt) {
  if (goHome()) return homeBehavior(p, dt);
  const k = station('mutfak', p), st = k || G.fire;
  const canCook = (G.stock.et || 0) >= 1 || (G.stock.meyve || 0) >= 2, full = (G.stock.food || 0) >= storeCap();
  if (!p.batch && !p.cookGot && (!canCook || full)) {
    if (!G.flags.cookSaid) { G.flags.cookSaid = 1; msg(full ? `🍲 ${p.name}: "Yemek hazır, depo dolu. Başka işe bakıyorum."` : `🍲 ${p.name}: "Pişirecek malzeme kalmadı! ${(G.stock.food || 0) < G.people.length ? 'Yemek de yetmeyecek. ' : ''}Başka işe bakıyorum."`, full ? '#cde' : '#f99', 6); if (!full) SFX.bell && SFX.bell(); }
    return altJob(p, dt);
  }
  // 1) malzemeyi depodan getir
  if (!p.batch) {
    const dp = depotOf(p), sp = k ? stnPos(k) : { x: G.fire.x + 30, y: G.fire.y + 26 }, same = Math.hypot(dp.x - sp.x, dp.y - sp.y) < 80;
    if (!p.cookGot) {
      if (Math.hypot(p.x - dp.x, p.y - dp.y) > 26) { steer(p, dp.x, dp.y, pSpeed(p), dt, false); p.anim += dt * 9; stageSay(p, 'Depoya gidiyor'); return; }
      p.moving = false; p.work = 1; p.cookW = (p.cookW || 0) + dt; stageSay(p, 'Depodan malzeme alıyor'); if (p.cookW < (same ? 2 : 0.8)) return;
      p.cookW = 0;
      const ne = Math.min(3, Math.floor(G.stock.et || 0)), nm = ne ? 0 : Math.min(6, Math.floor((G.stock.meyve || 0) / 2) * 2);
      if (!ne && !nm) return;
      if (ne) G.stock.et -= ne; else G.stock.meyve -= nm;
      p.cookGot = { et: ne, meyve: nm, out: ne ? ne * 2 : nm }; p.carry = 2; G.uiDirty = true;
    }
    if (!same && Math.hypot(p.x - sp.x, p.y - sp.y) > 30) { steer(p, sp.x, sp.y, pSpeed(p) * 0.9, dt, false); p.anim += dt * 8; stageSay(p, 'Malzemeyi mutfağa taşıyor'); return; }
    p.carry = 0; p.batch = p.cookGot; p.cookGot = null; p.cook = 0;
  }
  // 2) ocak başında aşama aşama pişir
  if (!(k ? atStation(p, k, dt) : (dist(p, G.fire) < 50 || (steer(p, G.fire.x + 30, G.fire.y + 26, pSpeed(p), dt, false), false)))) { p.anim += dt * 9; return; }
  p.moving = false; p.work = 1; p.cook += dt * workRate(p) * (k ? 1 : 0.7);
  const B = p.batch, T = 1.5 * B.out, f = p.cook / T;
  stageSay(p, f < 0.28 ? (B.et ? 'Et doğranıyor' : 'Meyveler ayıklanıyor') : f < 0.42 ? 'Ateş harlanıyor' : f < 0.85 ? 'Kazan karıştırılıyor' : 'Yemek masaya konuyor');
  if (f > 0.4 && Math.random() < dt * 3) G.parts.push({ x: st.x + rand(-8, 8), y: (k ? stnPos(k).y : st.y) - 10, vx: rand(-5, 5), vy: -25, life: 0.8, col: 'rgba(230,230,230,.5)', s: 3 });
  if (p.cook >= T) {
    let n = B.out; if (lvl(p, 'asci') >= 4 && Math.random() < 0.5) n += Math.ceil(B.out / 6);
    addStock('food', n, p.x, p.y); addXP(p, 'asci', B.out); p.batch = null; p.cook = 0; G.flags.cookSaid = 0;
  }
}
function updIdle(p, dt, helper) {
  if (goHome()) return homeBehavior(p, dt);
  if (p.carry > 0) { if (dist(p, depotOf(p)) < 80) deposit(p); else { steer(p, depotOf(p).x, depotOf(p).y, pSpeed(p), dt, false); p.anim += dt * 9; return; } }
  if (helper) {
    if (tryCarryJob(p, dt)) return;
    if (updBuilder(p, dt)) return;
    if (p.group === 'bos' && haulJob(p, dt)) return;
  }
  p.wt = (p.wt || 0) - dt;
  if (p.wt <= 0) { p.wt = rand(5, 12); p.seat = rand(0, TAU); p.sr = rand(70, 140); }
  sitByFire(p, dt, p.sr || 90);
}
function updGather(p, dt, g, thr, isAlt) {
  if (goHome()) return homeBehavior(p, dt);
  if (thr && thr.type !== 'kucuk' && p.fear > 35) { steer(p, G.fire.x, G.fire.y, pSpeed(p) * 1.35, dt, false); p.anim += dt * 12; return; }
  const spd = pSpeed(p);
  if (p.st === 'return' || p.carry >= tripCap(p, g)) {
    p.st = 'return';
    if (steer(p, depotOf(p).x + Math.cos(p.seat) * 55, depotOf(p).y + Math.sin(p.seat) * 55, spd, dt, false) || dist(p, depotOf(p)) < 70) { deposit(p); p.st = 'idle'; }
    p.anim += dt * 9; return;
  }
  if (!p.tgt || p.tgt.dead || p.tgt.amt < 1 || p.tgt.stump) {
    if (p.tgt && p.tgt.claim === p) p.tgt.claim = null;
    p.tgt = nearestRes(p, g); if (p.tgt) p.tgt.claim = p; p.work = 0;
    if (!p.tgt && !isAlt && g !== p.alt) { altJob(p, dt); return; }
    if (!p.tgt) { if (p.carry > 0) p.st = 'return'; else if (isAlt) updIdle(p, dt, true); else altJob(p, dt); return; }
  }
  const o = p.tgt, reach = o.r + p.r + 6;
  if (dist(p, o) > reach) { steer(p, o.x, o.y, spd, dt, false); p.anim += dt * 9; return; }
  p.moving = false; p.ang = angTo(p, o);
  p.work += dt * workRate(p); p.anim += dt * 4;
  if (p.work >= 1.1) {
    p.work = 0.01;
    const r = takeRes(o); p.bag[r] = (p.bag[r] || 0) + 1; p.carry++;
    addXP(p, g === 'sifaci' ? 'sifa' : 'toplama', 1);
    if (L && dist(p, L) < 500) { if (r === 'wood') SFX.chop(); else if (r === 'stone' || r === 'crystal') SFX.rock(); }
    if (o.kind === 'tree') o.shake = 0.2;
    if (o.amt < 1 || o.dead) p.tgt = null;
    if (p.carry >= tripCap(p, g) || !p.tgt) p.st = 'return';
  }
}
function updHealer(p, dt, thr) {
  const night = goHome();
  const pat = findPatient(p);
  if (pat && (!night || dist(pat, G.fire) < fireR() + 150)) {
    if (p.carrying) dropCarried(p);
    if (p.tgt && p.tgt.claim === p) p.tgt.claim = null; p.tgt = null;
    pat.medic = p.id;
    if (dist(p, pat) > 22) { steer(p, pat.x, pat.y, pSpeed(p) * 1.2, dt, false); p.anim += dt * 10; p.treatT = 0; return; }
    p.moving = false; p.ang = angTo(p, pat); p.work = 1;
    p.treatT = (p.treatT || 0) + dt * (tr(p, 'sifali') ? 2 : 1) * grpMul('sifaci') * skillMul(lvl(p, 'sifa'));
    if (p.treatT >= 2) { p.treatT = 0; treat(pat, p); }
    return;
  }
  if (tryCarryJob(p, dt)) return;
  const S = sifahaneler().sort((a, b) => dist(a, p) - dist(b, p))[0];
  const bedP = S ? G.people.filter(q => q.bed && q.bed.s === S) : [];
  if (bedP.length) {
    const needy = bedP.find(q => (G.stock.ilac || 0) > 0 && ((q.injury && q.injury.type === 'enfeksiyon') || (q.sick && !q.sick.med)));
    if (needy || night) {
      if (!atStation(p, S, dt)) return;
      p.moving = false; p.work = needy ? 1 : 0; p.tendT = (p.tendT || 0) + dt * skillMul(lvl(p, 'sifa'));
      if (needy && p.tendT >= 4) {
        p.tendT = 0; G.stock.ilac--; addXP(p, 'sifa', 5);
        if (needy.injury && needy.injury.type === 'enfeksiyon') { needy.injury = null; msg(`${p.name}, ${dat(needy.name)} ilaç verdi. Enfeksiyon geçti.`, '#9f9', 3); }
        else if (needy.sick) needy.sick.med = true;
      }
      return;
    }
  }
  if (night) return homeBehavior(p, dt);
  const stn = S || G.fire;
  if (workOrder(p, dt, 'sifa', stn)) return;
  if (G.stock.herb >= 3 && (G.stock.ilac || 0) < 3 && lvl(p, 'sifa') >= 2 && dist(p, stn) < 260) {
    if (dist(p, stn) > 50) { steer(p, stn.x, stn.y + 30, pSpeed(p), dt, false); p.anim += dt * 9; return; }
    p.moving = false; p.work = 1; p.brew = (p.brew || 0) + dt * grpMul('sifaci') * skillMul(lvl(p, 'sifa'));
    if (p.brew >= 6) { p.brew = 0; G.stock.herb -= 3; G.stock.ilac = (G.stock.ilac || 0) + 1; ftext(p.x, p.y - 16, '+1 💊', '#bfe'); addXP(p, 'sifa', 4); }
    return;
  }
  updGather(p, dt, 'sifaci', thr);
}
function pickScoutTarget(p) {
  const z = G.zone.kasif, c = z || CAMP, R = z ? 900 : 4200;
  let best = null, bs = 1e9;
  for (let k = 0; k < 70; k++) {
    const a = rand(0, TAU), r = Math.sqrt(Math.random()) * R, x = clamp(c.x + Math.cos(a) * r, 100, WORLD - 100), y = clamp(c.y + Math.sin(a) * r, 100, WORLD - 100);
    if (exploredAt(x, y) || isSea(x, y)) continue;
    const s = Math.hypot(x - p.x, y - p.y) + Math.hypot(x - c.x, y - c.y) * 0.5;
    if (s < bs) { bs = s; best = { x, y }; }
  }
  if (!best) { const a = rand(0, TAU), r = rand(100, z ? 400 : 1500); best = { x: clamp(c.x + Math.cos(a) * r, 100, WORLD - 100), y: clamp(c.y + Math.sin(a) * r, 100, WORLD - 100) }; }
  return best;
}
function updScout(p, dt, thr) {
  if (goHome()) { p.stgt = null; return homeBehavior(p, dt); }
  if (thr && thr.type !== 'kucuk' && dist(thr, p) < 280) { steer(p, G.fire.x, G.fire.y, pSpeed(p) * 1.4, dt, false); p.anim += dt * 14; p.stgt = null; return; }
  p.stCheck = (p.stCheck || 0) - dt; p.stT = (p.stT || 0) - dt;
  const t = p.stgt;
  if (!t || Math.hypot(t.x - p.x, t.y - p.y) < 50 || p.stT <= 0 || (p.stCheck <= 0 && exploredAt(t.x, t.y))) { p.stgt = pickScoutTarget(p); p.stT = 60; p.stCheck = 2; }
  steer(p, p.stgt.x, p.stgt.y, pSpeed(p), dt, false); p.anim += dt * 10;
  addXP(p, 'kesif', dt * 0.4);
}
function updGuard(p, dt) {
  const ab = abilOn('muhafiz'), z = G.zone.muhafiz, c = z || G.fire;
  const baseR = Math.max(fireR(), 160), defR = z ? 380 : baseR + 220;
  if (p.post && !p.post.dead) {
    const k = p.post;
    if (dist(p, k) > 6) { steer(p, k.x, k.y, pSpeed(p) * 1.2, dt, false); p.anim += dt * 9; } else { p.moving = false; p.x = k.x; p.y = k.y; }
    return;
  }
  let foe = null, fd = 1e9;
  for (const d of G.dinos) { if (!hostile(d)) continue; if (dist(d, c) < defR) { const dd = dist(d, p); if (dd < fd) { fd = dd; foe = d; } } }
  const dp = doorDuty(p);
  if (foe && dp && Math.hypot(foe.x - dp.x, foe.y - dp.y) > 260) foe = null;   // kapı nöbetçisi yerinden uzaklaşmaz
  if (foe && !((foe.type === 'dev' || foe.type === 'yelken') && p.fear > 55 && !ab)) return rangedOrMelee(p, foe, dt);
  if (dp) {
    if (Math.hypot(p.x - dp.x, p.y - dp.y) > 5) { steer(p, dp.x, dp.y, pSpeed(p), dt, false); p.anim += dt * 9; }
    else { p.moving = false; p.ang = angLerp(p.ang, Math.PI / 2 + Math.sin(G.now * 0.4 + p.id) * 0.5, Math.min(1, dt * 3)); }
    return;
  }
  p.seat += dt * 0.18;
  const pr = z ? 140 : (ab ? baseR * 0.5 : baseR * 0.72);
  steer(p, c.x + Math.cos(p.seat) * pr, c.y + Math.sin(p.seat) * pr, 75, dt, false); p.anim += dt * 6;
}
function updFollow(p, dt) {
  const hc = abilOn('takip'), range = hc ? 450 : 230;
  const ht = G.hunt && G.hunt.t && !G.hunt.t.dead ? G.hunt.t : null;
  let foe = ht && dist(ht, L) < 600 ? ht : null, fd = range;
  if (!foe) for (const d of G.dinos) { if (!hostile(d)) continue; const dd = dist(d, L); if (dd < fd) { fd = dd; foe = d; } }
  if (foe && !((foe.type === 'dev' || foe.type === 'yelken') && p.fear > 50 && !hc)) return rangedOrMelee(p, foe, dt);
  const ring = p.fidx < 6 ? 0 : 1, n = ring ? 10 : 6, i = p.fidx % n;
  const off = (i / n) * TAU, rr = (G.mount ? 70 : 45) + ring * 32;
  const tx = L.x + Math.cos(off + L.ang + Math.PI) * rr, ty = L.y + Math.sin(off + L.ang + Math.PI) * rr;
  if (Math.hypot(p.x - tx, p.y - ty) > 16) { steer(p, tx, ty, dist(p, L) > 160 ? pSpeed(p) * 1.7 : pSpeed(p) * 1.35, dt, false); p.anim += dt * 10; } else p.moving = false;
}
// ---- avcı: hedefi kuşatır, mesafeyi korur, saldırıya uğrayınca geri çekilir
function huntTarget(p) {
  if (G.hunt && G.hunt.t && !G.hunt.t.dead && !G.hunt.t.tamed) return G.hunt.t;
  if (isNight()) return null;
  if (foodTotal() >= 20 + G.people.length * 4) { p.autoT = null; return null; }
  p.autoCheck = (p.autoCheck || 0) - G.dt;
  if (!p.autoT || p.autoT.dead || p.autoCheck <= 0) {
    p.autoCheck = 3; let best = null, bs = 1e9;
    for (const d of G.dinos) {
      if (d.tamed || d.dead || !DINO[d.type].herb || d.type === 'uzunboyun' || d.ko > 0) continue;
      if (d.type === 'zirhli' && lvl(p, 'avcilik') < 3) continue;
      if (!visible(d.x, d.y, d.r)) continue;
      const dc = dist(d, G.fire); if (dc > 3400) continue;
      const s = dist(d, p) + dc * 0.3 + (d.type === 'ordek' ? -200 : 0);
      if (s < bs) { bs = s; best = d; }
    }
    p.autoT = best;
  }
  return p.autoT;
}
function updHunter(p, dt, thr) {
  if (p.hp < p.maxhp * 0.35) { steer(p, G.fire.x, G.fire.y, pSpeed(p) * 1.3, dt, false); p.anim += dt * 12; return; }
  const t = huntTarget(p);
  if (!t) {
    p.sneak = false;
    if (goHome()) return homeBehavior(p, dt);
    if (thr) return rangedOrMelee(p, thr, dt);
    if (haulJob(p, dt)) return;
    p.seat += dt * 0.12; const rr = Math.max(fireR(), 200) * 1.15;
    steer(p, G.fire.x + Math.cos(p.seat) * rr, G.fire.y + Math.sin(p.seat) * rr, 70, dt, false); p.anim += dt * 6; return;
  }
  const hs = members('avci'), idx = Math.max(0, hs.indexOf(p)), n = Math.max(1, hs.length);
  const dd = dist(p, t);
  p.sneak = !DINO[t.type].pred && !t.fleeing && !(t.angry > 0) && dd < 520 && dd > 150;   // ava sessizce yaklaş
  const charging = (t.tgt === p) && angDiff(t.ang, angTo(t, p)) < 0.9 && (t.angry > 0 || !!DINO[t.type].pred);
  if (ranged(p)) {
    const want = 170 + t.r, a = angTo(t, p) + (idx - (n - 1) / 2) * 0.4;
    if (dd < want * 0.6 || (charging && dd < want)) { const fa = angTo(t, p) + (idx % 2 ? 0.5 : -0.5); steer(p, p.x + Math.cos(fa) * 100, p.y + Math.sin(fa) * 100, pSpeed(p) * 1.35, dt, false); p.anim += dt * 12; return; }
    if (dd > want * 1.35) { steer(p, t.x + Math.cos(a) * want, t.y + Math.sin(a) * want, pSpeed(p) * 1.2, dt, false); p.anim += dt * 11; return; }
    p.moving = false; p.ang = angTo(p, t);
    if (p.atkCd <= 0) { p.atkCd = 1.15 / skillMul(lvl(p, 'avcilik')); p.swing = 0.2; shootArrow(p, t.x, t.y, arrowDmg(p)); addXP(p, 'avcilik', 2); }
    return;
  }
  const side = t.type === 'zirhli' ? Math.PI / 2 * (idx % 2 ? 1 : -1) : Math.PI + (idx - (n - 1) / 2) * 0.55;
  const a = t.ang + side, reach = t.r + p.r + 12;
  if (p.backT > 0) { p.backT -= dt; const fa = angTo(t, p); steer(p, p.x + Math.cos(fa) * 80, p.y + Math.sin(fa) * 80, pSpeed(p) * 1.3, dt, false); p.anim += dt * 12; return; }
  if (charging && dd < t.r + 90) { p.backT = 1.0; return; }
  if (dd > reach) {
    const far = dd > reach + 70;
    steer(p, far ? t.x + Math.cos(a) * (reach + 20) : t.x, far ? t.y + Math.sin(a) * (reach + 20) : t.y, pSpeed(p) * 1.3, dt, false); p.anim += dt * 12; return;
  }
  p.moving = false; p.ang = angTo(p, t);
  if (p.atkCd <= 0) { personAttack(p, t); if (Math.random() < 0.5) p.backT = 0.6; }
}
// ---- et ustası
function nearestCarcass(p) {
  let best = null, bs = 1e9;
  for (const c of G.carcs) {
    if (c.dead || c.meat + c.bone + c.hide <= 0 || c.rotten) continue;
    if (dist(c, G.fire) > 1900) continue;
    if (G.dinos.some(d => hostile(d) && d.type !== 'kucuk' && dist(d, c) < 220)) continue;
    const s = dist(c, p);
    if (s < bs) { bs = s; best = c; }
  }
  return best;
}
function updButcher(p, dt, thr) {
  if (goHome() && !(p.carry > 0)) return homeBehavior(p, dt);
  if (thr && thr.type !== 'kucuk' && p.fear > 30) { steer(p, G.fire.x, G.fire.y, pSpeed(p) * 1.35, dt, false); p.anim += dt * 12; return; }
  const st = station('kasap', p);
  if ((G.stock.cigEt || 0) >= 1 && !(p.st === 'haul' && p.carry > 0)) {
    const ok = st ? atStation(p, st, dt) : (dist(p, G.fire) < 60 || (steer(p, G.fire.x - 30, G.fire.y + 30, pSpeed(p), dt, false), false));
    if (!ok) { p.anim += dt * 9; return; }
    p.moving = false; p.work = 1; p.clean = (p.clean || 0) + dt * workRate(p);
    stageSay(p, p.clean < 0.45 ? 'Deri yüzülüyor' : p.clean < 0.9 ? 'Et kemikten ayrılıyor' : 'Et temizleniyor');
    if (p.clean >= 1.3) {
      p.clean = 0; G.stock.cigEt--;
      const n = st ? 1.25 : 1; G.stock.et = Math.min(storeCap(), (G.stock.et || 0) + n);
      if (Math.random() < 0.25) ftext(p.x, p.y - 16, '+🍖', '#ffe9b0');
      addXP(p, 'kasaplik', 1.5);
      if (Math.random() < 0.3) G.parts.push({ x: p.x + 8, y: p.y, vx: rand(-30, 30), vy: rand(-30, 30), life: 0.4, col: '#7a0d0d', s: 2 });
    }
    return;
  }
  if (haulJob(p, dt)) return;
  altJob(p, dt);
}
// ---- çiftçi
function updFarmer(p, dt) {
  if (goHome() && !(p.carry > 0)) return homeBehavior(p, dt);
  if (p.st === 'return') {
    if (steer(p, depotOf(p).x + Math.cos(p.seat) * 55, depotOf(p).y + Math.sin(p.seat) * 55, pSpeed(p), dt, false) || dist(p, depotOf(p)) < 70) { deposit(p); p.st = 'idle'; }
    p.anim += dt * 9; return;
  }
  const F = G.builds.filter(b => b.type === 'tarla' && b.built && !b.dead);
  const jobOf = b => b.planted && b.g >= 1 ? 3 : !b.planted ? 2 : (b.tendT || 0) <= 0 ? 1 : 0;
  let f = p.tgt && p.tgt.type === 'tarla' && !p.tgt.dead ? p.tgt : null;
  if (!f || jobOf(f) === 0) {
    let best = null, bs = -1e9;
    for (const b of F) { const j = jobOf(b); if (!j) continue; const s = j * 1000 - dist(b, p) - (b.claim && b.claim !== p && !b.claim.dead ? 600 : 0); if (s > bs) { bs = s; best = b; } }
    if (p.tgt && p.tgt.claim === p) p.tgt.claim = null;
    p.tgt = f = best; if (f) f.claim = p; p.work = 0;
  }
  if (!f) {
    if (!F.length && !G.flags.noField) { G.flags.noField = 1; msg('Çiftçilerin çalışması için bir 🌾 Tarla inşa et.', '#e9c', 4); }
    return altJob(p, dt);
  }
  const job = jobOf(f);
  const spot = { x: f.x + Math.cos(p.seat) * f.r * 0.5, y: f.y + Math.sin(p.seat) * f.r * 0.4 };
  if (Math.hypot(p.x - spot.x, p.y - spot.y) > 12) { steer(p, spot.x, spot.y, pSpeed(p), dt, false); p.anim += dt * 9; return; }
  p.moving = false; p.work += dt * workRate(p); p.anim += dt * 4;
  const need = job === 3 ? 6 : job === 2 ? 5 : 4;
  if (p.work >= need) {
    p.work = 0.01; f.claim = null; p.tgt = null;
    if (job === 3) { const n = Math.round(14 * skillMul(lvl(p, 'tarim'))); p.bag.meyve = (p.bag.meyve || 0) + n; p.carry += n; f.planted = false; f.g = 0; p.st = 'return'; addXP(p, 'tarim', 8); ftext(f.x, f.y - 20, 'Hasat!', '#ffe08a'); }
    else if (job === 2) { f.planted = true; f.g = 0; addXP(p, 'tarim', 3); }
    else { f.g = Math.min(1, f.g + 0.06 * skillMul(lvl(p, 'tarim'))); f.tendT = 30; addXP(p, 'tarim', 2); }
  }
}
// ---- üretim (zanaatkâr / şifacı)
function canDoOrder(p, o) {
  const it = ITEMS[o.item];
  if (o.by && o.by !== p.id) return false;
  if (lvl(p, it.by) < it.lvl) return false;
  if (it.reqPop && G.people.length < it.reqPop) return false;
  if (o.worker && o.worker !== p.id && G.people.some(q => q.id === o.worker && q.group === p.group && !q.dead && !q.bed)) return false;
  return true;
}
function workOrder(p, dt, by, stn) {
  const o = G.orders.find(o => ITEMS[o.item].by === by && canDoOrder(p, o) && (o.paid || canAfford(ITEMS[o.item].cost)) && (by !== 'zanaat' || station(ITEMS[o.item].stn || 'atolye', p)));
  if (!o) return false;
  if (by === 'zanaat') stn = station(ITEMS[o.item].stn || 'atolye', p);
  o.worker = p.id;
  const it0 = ITEMS[o.item];
  if (!o.paid && o.trips === undefined) { o.trips = Math.min(3, Math.max(1, Object.keys(it0.cost).length)); o.leg = 'get'; }
  if (o.trips > 0) {
    const dp = depotOf(p), sp = stn.kind === 'build' ? stnPos(stn) : stn, same = Math.hypot(dp.x - sp.x, dp.y - sp.y) < 80;
    if (o.leg === 'get') {
      if (Math.hypot(p.x - dp.x, p.y - dp.y) > 26) { steer(p, dp.x, dp.y, pSpeed(p), dt, false); p.anim += dt * 9; return true; }
      if (!o.paid) { if (!canAfford(it0.cost)) { o.trips = undefined; return false; } pay(it0.cost); o.paid = true; G.uiDirty = true; }
      p.moving = false; o.wait = (o.wait || 0) + dt; if (o.wait < (same ? 2.2 : 0.8)) { p.work = 1; return true; }
      o.wait = 0; p.carry = 2; o.leg = 'bring';
    }
    if (o.leg === 'bring') {
      if (!same && Math.hypot(p.x - sp.x, p.y - sp.y) > 30) { steer(p, sp.x, sp.y, pSpeed(p) * 0.9, dt, false); p.anim += dt * 8; return true; }
      p.carry = 0; o.trips--; o.leg = 'get';
      if (o.trips > 0) return true;
    }
  }
  if (stn.kind === 'build') { if (!atStation(p, stn, dt)) return true; }
  else if (dist(p, stn) > (stn.r || 30) + 24) { steer(p, stn.x + Math.cos(p.seat) * 10, stn.y + (stn.r || 30) + 10, pSpeed(p), dt, false); p.anim += dt * 9; return true; }
  p.moving = false; p.ang = angTo(p, stn); p.work = 1;
  const it = ITEMS[o.item];
  if (!o.paid) { pay(it.cost); o.paid = true; }
  o.prog += dt * skillMul(lvl(p, by)) * grpMul(p.group) * (abilOn(p.group) ? 2 : 1) * (tr(p, 'caliskan') ? 1.3 : 1) * (p.sick ? 0.5 : 1);
  if (Math.random() < dt * 2.5 && L && dist(p, L) < 450) SFX.hammer(0.25);
  p.stageAd = o.stageAd || null;
  // aşama aşama: çoklu eşyalar (ok ×10) tek tek, her biri üç adımda yapılır
  { const q = it.qty || 1, per = it.work / q, done = Math.min(q, Math.floor(o.prog / per)), f = (o.prog - done * per) / per, sts = stagesOf(o.item), si = Math.min(sts.length - 1, Math.floor(f * sts.length));
    const key = done * 10 + si;
    if (o.stageKey !== key) { o.stageKey = key; o.stage = si; o.unit = done; o.stageAd = sts[si] + (q > 1 ? ` (${Math.min(q, done + 1)}/${q})` : ''); if (L && dist(p, L) < 400 && !p.insideB) ftext(p.x, p.y - 44, o.stageAd, '#e8d4b0'); G.craftDirty = true; }
    if (q > 1 && done > (o.made || 0) && done < q) { addStock(o.item, done - (o.made || 0), stn.x, stn.y); o.made = done; G.uiDirty = true; }
  }
  if (o.prog >= it.work) {
    addStock(o.item, (it.qty || 1) - (o.made || 0), stn.x, stn.y); o.made = 0; o.stageKey = -1; o.stage = 0; o.stageAd = '';
    o.prog = 0; o.paid = false; o.trips = undefined; o.left--; o.worker = 0;
    addXP(p, by, it.work * 0.7);
    if (o.item === 'yarikTasi') { msg('🌀 YARIK TAŞI HAZIR! Yarığa götür ve E ile etkinleştir.', '#9cf', 8); SFX.bell(); }
    if (o.left <= 0) G.orders.splice(G.orders.indexOf(o), 1);
    G.uiDirty = true; G.craftDirty = true;
  }
  return true;
}
function updCrafter(p, dt) {
  if (goHome()) return homeBehavior(p, dt);
  const st = station('atolye', p) || station('okcu', p) || station('tabak', p);
  if (!st) {
    if (!G.flags.noAtolye && G.orders.some(o => ITEMS[o.item].by === 'zanaat')) { G.flags.noAtolye = 1; msg('Zanaatkârların çalışması için bir 🔨 Atölye inşa et.', '#e99', 5); }
    return altJob(p, dt);
  }
  if (!workOrder(p, dt, 'zanaat', st)) altJob(p, dt);
}
// ---- mimar / inşaat
function blueprintFor(p) {
  let best = null, bd = 1e9;
  for (const b of G.builds) {
    if (b.built || b.dead || (b.type !== 'gemi' && dist(b, G.fire) > 2200)) continue;
    const d = dist(b, p) + dist(b, G.fire) * 0.3;
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}
function updBuilder(p, dt, any) {
  const b = blueprintFor(p); if (!b) return false;
  if (p.group !== 'mimar' && !any && dist(b, G.fire) > 900 && !abilOn('mimar')) return false;
  if (dist(p, b) > b.r + 16) { steer(p, b.x + Math.cos(p.seat) * (b.r + 10), b.y + Math.sin(p.seat) * (b.r + 10), pSpeed(p), dt, false); p.anim += dt * 9; return true; }
  p.moving = false; p.ang = angTo(p, b); p.work = 1;
  const rate = (p.group === 'mimar' ? skillMul(lvl(p, 'insaat')) * grpMul('mimar') : 0.6) * (abilOn('mimar') ? 2 : 1) * (p.sick ? 0.5 : 1);
  b.prog += dt * rate;
  addXP(p, 'insaat', dt * (p.group === 'mimar' ? 0.6 : 0.2));
  if (Math.random() < dt * 2 && L && dist(p, L) < 500) SFX.hammer(0.3);
  if (b.prog >= b.need) finishBuild(b);
  return true;
}
function updArchitect(p, dt) {
  if (goHome()) { const b = blueprintFor(p); if (!(b && dist(b, G.fire) < fireR())) return homeBehavior(p, dt); }
  if (!updBuilder(p, dt)) altJob(p, dt);
}
function assignPosts() {
  const guards = members('muhafiz').filter(p => !p.downed && !p.desert && !p.bed);
  for (const g of guards) if (g.post && (g.post.dead || g.post.guard !== g)) g.post = null;
  for (const k of G.builds) {
    if (k.type !== 'kule' || !k.built) continue;
    if (k.guard && (k.guard.dead || k.guard.group !== 'muhafiz' || k.guard.downed || k.guard.post !== k || k.guard.bed)) k.guard = null;
    if (!k.guard) { const g = guards.filter(q => !q.post).sort((a, b) => dist(a, k) - dist(b, k))[0]; if (g) { k.guard = g; g.post = k; } }
  }
  members('takip').forEach((p, i) => p.fidx = i);
}

// ---- ölüm / ayrılma
function removePerson(p) {
  p.dead = true;
  const i = G.people.indexOf(p); if (i >= 0) G.people.splice(i, 1);
  if (p.inHut) { const o = p.inHut.occ, j = o.indexOf(p); if (j >= 0) o.splice(j, 1); p.inHut = null; }
  if (p.tgt && p.tgt.claim === p) p.tgt.claim = null;
  if (p.post) p.post.guard = null;
  releaseBed(p, true);
  if (p.carrying) dropCarried(p);
  if (p.carriedBy || G.lcarry === p) { const c = G.people.find(q => q.carrying === p); if (c) c.carrying = null; if (G.lcarry === p) G.lcarry = null; p.carriedBy = 0; }
  if (p.homeT) moveHome(p, null);
  for (const o of G.orders) { if (o.worker === p.id) o.worker = 0; if (o.by === p.id) o.by = 0; }
  for (const g in G.managers) if (G.managers[g] === p.id) { G.managers[g] = null; if (!G.over) msg(`${GROUPS[g].ad} grubu yöneticisini kaybetti.`, '#ccc', 3); }
  const pt = G.people.find(q => q.id === p.partner); if (pt) { pt.partner = 0; pt.fear = Math.min(100, pt.fear + 40); }
  G.uiDirty = true;
}
function killPerson(p, src, silent) {
  if (p.dead) return;
  G.deaths++; G.lossToday = true;
  const wasLeader = p === L;
  removePerson(p);
  if (!silent) {
    SFX.scream(L && !wasLeader ? clamp(1 - dist(p, L) / 1400, 0.15, 1) : 1, wasLeader ? 0 : panOf(p.x));
    for (const q of G.people) q.fear = Math.min(100, q.fear + (dist(q, p) < 600 ? 35 : 18));
    for (let k = 0; k < 20; k++) G.parts.push({ x: p.x, y: p.y, vx: rand(-140, 140), vy: rand(-140, 140), life: rand(0.6, 1.4), col: '#8a0a0a', s: rand(2, 5) });
  }
  G.stains.push({ x: p.x, y: p.y, r: rand(14, 22), life: 150 });
  moraleAdd(p.child ? -20 : wasLeader ? -15 : -10);
  if (p.child && !silent) msg(`Küçük ${p.name} öldü. Kampa ağır bir sessizlik çöktü.`, '#f77', 7);
  if (wasLeader) {
    if (G.mount) dismount(true);
    G.lcarry = null;
    if (!G.people.length) { gameOver(); return; }
    const cand = G.people.filter(q => !q.child), pool = cand.length ? cand : G.people;
    const nl = pool.slice().sort((a, b) => (b.hp + (tr(b, 'onder') ? 50 : 0)) - (a.hp + (tr(a, 'onder') ? 50 : 0)))[0];
    for (const g in G.managers) if (G.managers[g] === nl.id) G.managers[g] = null;
    if (nl.inHut) leaveHut(nl);
    releaseBed(nl, true);
    if (nl.carrying) dropCarried(nl);
    if (nl.post) { nl.post.guard = null; nl.post = null; }
    if (nl.homeT) moveHome(nl, null);
    nl.leader = true; nl.group = null; nl.maxhp = 100; nl.hp = Math.max(nl.hp, 60); nl.fear = 0; nl.downed = 0; nl.child = false; nl.r = 11;
    L = nl;
    msg(`Liderin öldü... Halk ${gen(nl.name)} etrafında toplandı. Artık sen ${cop(nl.name)}.`, '#ffb', 8);
    SFX.sting();
  } else if (!silent && !p.child) msg(`${p.name} öldü.`, '#f77', 5);
  if (!G.people.length) gameOver();
}

// ---- şafak
function halkDawn() {
  let tired = 0;
  for (const p of G.people) { p.tired = !!p.watched && !tr(p, 'uykusuz'); p.watched = false; if (p.tired) tired++; }
  if (tired && G.day % 5 === 2) msg(`${tired} muhafız gece nöbetinden yorgun: bugün yavaşlar. İkinci bir muhafız nöbeti paylaşır.`, '#bbb', 4);
  for (const p of G.people.slice()) if (p.bed && G.day >= p.bedUntil && !(p.injury && p.injury.type !== 'kanama') && !p.sick && p.hp >= p.maxhp * 0.6) releaseBed(p);
  // salgın
  let spread = 0;
  for (const p of G.people.filter(q => q.sick)) {
    p.sick.d++;
    const inBed = !!p.bed;
    if (Math.random() < (inBed ? 0.01 : 0.04)) { msg(`${p.name} hastalığa yenik düştü.`, '#d77', 6); killPerson(p, null, true); continue; }
    if (Math.random() < 0.25 + (inBed ? 0.3 : 0) + (p.sick.med ? 0.25 : 0)) { p.sick = null; msg(`${p.name} hastalığı atlattı.`, '#9f9', 4); continue; }
    p.sick.med = false;
    if (!inBed && spread < 2) { const c = G.people.filter(q => !q.sick && !q.leader && !q.bed && dist(q, p) < 400); if (c.length && Math.random() < 0.25) { spread++; makeSick(pick(c), `${dat(p.name)} bakarken hastalandı`); } }
  }
  if (G.unclean > 0 && Math.random() < Math.min(0.6, G.unclean * 0.025)) {
    const c = G.people.filter(q => !q.sick && !q.child);
    const n = Math.min(c.length, ri(1, 2));
    for (let i = 0; i < n; i++) makeSick(c.splice(Math.floor(Math.random() * c.length), 1)[0], 'temizlenmemiş etten zehirlendi');
    if (n) msg('Salgın! Et ustası olmadan işlenen et hastalık getirdi.', '#e9a050', 6);
  }
  G.unclean = Math.floor((G.unclean || 0) * 0.3);
  if (G.day >= 5 && Math.random() < 0.03) { const c = G.people.filter(q => !q.sick && !q.child); if (c.length) makeSick(pick(c), 'bataklık hummasına yakalandı'); }
  for (const p of G.people) if (!p.child && !p.leader && !p.sick && tr(p, 'hasta') && Math.random() < 0.1) makeSick(p, 'yine hastalandı');
  // çocuklar
  for (const p of G.people) if (p.child) {
    p.age++;
    if (p.age >= 12) {
      p.child = false; p.r = 11; p.traits = pickTraits(); p.story = 'Bu kampta doğdu; başka bir dünya bilmiyor.';
      p.maxhp = Math.round(60 * (tr(p, 'guclu') ? 1.3 : 1) * (tr(p, 'hasta') ? 0.75 : 1)); p.hp = p.maxhp; p.group = G.newGroup;
      const par = G.people.find(q => q.id === p.parentA || q.id === p.parentB);
      if (par) for (const s in SKILLS) p.sk[s] = Math.max(p.sk[s], Math.floor((par.sk[s] || 0) * 0.3));
      msg(`${p.name} büyüdü ve ${GROUPS[p.group].ad} grubuna katıldı.`, '#9f9', 5); moraleAdd(5);
    }
  }
  // çiftler
  const singles = G.people.filter(p => !p.child && !p.partner);
  if (singles.length >= 2 && Math.random() < 0.05) {
    const a = pick(singles), opts = singles.filter(q => q !== a && !(q.parentA && q.parentA === a.parentA));
    const b = opts.length ? pick(opts) : null;
    if (b) { a.partner = b.id; b.partner = a.id; msg(`${a.name} ve ${b.name} birbirine yakınlaştı. ❤ Artık aynı çadırı paylaşacaklar.`, '#f9c', 5); moraleAdd(3); }
  }
  // doğumlar: çiftin bir çadırı olmalı
  const done = new Set();
  for (const a of G.people.slice()) {
    if (!a.partner || done.has(a.id)) continue;
    const b = G.people.find(q => q.id === a.partner); if (!b) continue;
    done.add(a.id); done.add(b.id);
    const home = homeOf(a) || homeOf(b);
    const kids = G.people.filter(q => q.child && (q.parentA === a.id || q.parentB === a.id)).length;
    if (home && G.morale >= 40 && foodTotal() >= 10 && kids < 2 && Math.random() < 0.03) {
      const c = mkPerson(home.x + rand(-20, 20), home.y + 30, freshName(), false, true);
      c.parentA = a.id; c.parentB = b.id; c.group = null; G.people.push(c);
      msg(`${a.name} ve ${gen(b.name)} bir bebeği oldu: ${c.name}! 👶`, '#ffd0e0', 6); moraleAdd(8); unlock('cocuk');
    }
  }
  const hl = homelessCount();
  if (hl > 0) { moraleAdd(-Math.min(8, hl)); msg(`${hl} kişi çadırsız, ateş başında üşüyerek uyudu. Çadır inşa et.`, '#bbb', 4); }
  // isyan
  const ad = G.people.filter(p => !p.child && !p.leader);
  if (G.morale < 20 && ad.length >= 4 && Math.random() < 0.5) {
    const th = pick(ad.filter(p => !Object.values(G.managers).includes(p.id))) || pick(ad);
    const steal = Math.floor(G.stock.food * 0.3);
    G.stock.food -= steal; G.lost++; G.lossToday = true;
    msg(`${th.name} gece ${steal}🍖 çalıp kaçtı. Halk sana artık güvenmiyor.`, '#f96', 7);
    removePerson(th); moraleAdd(-5);
  } else if (G.morale < 20) msg('Halkın morali çok düşük. Fısıltılar başladı...', '#fb9', 5);
  G.uiDirty = true;
}

// ---- kapı nöbeti: gece, görev yeri olmayan muhafızlardan biri (4+ ise ikisi) mağaranın kapısında bekler
function doorBuilding() { return (G.cave && !G.cave.dead && G.cave.built) ? G.cave : null; }
function doorGuards() {
  if (!goHome() || !doorBuilding()) return [];
  const ms = members('muhafiz').filter(p => !p.dead && !(p.downed > 0) && !p.bed && !p.grabbed && !(p.post && !p.post.dead));
  return ms.slice(0, ms.length >= 4 ? 2 : 1);
}
function doorDuty(p) {
  const gs = doorGuards(), i = gs.indexOf(p); if (i < 0) return null;
  const b = doorBuilding(), q = stnPos(b);
  return { x: q.x + (gs.length > 1 ? (i ? 26 : -26) : 22), y: q.y + 16 };
}
function doorGuard() {
  const b = doorBuilding(); if (!b) return null; const q = stnPos(b);
  return doorGuards().find(p => Math.hypot(p.x - q.x, p.y - q.y) < 90) || null;
}

// ---- emirle yaralı taşıma: kamptan uzakta, liderin emriyle biri yaralıyı sırtlayıp şifa yerine (yoksa mağaraya) götürür
function woundedNear(p, R) {
  let best = null, bd = R;
  for (const q of G.people) { if (q === p || q.dead || q.grabbed || q.bed || q.carriedBy || G.lcarry === q) continue; if (!(needsCarry(q) || q.downed > 0 || (q.hp < q.maxhp * 0.35))) continue; const d = dist(q, p); if (d < bd) { bd = d; best = q; } }
  return best;
}
function carryOrderStep(p, dt) {
  if (p.carrying) {
    const q = p.carrying; if (!q || q.dead) { p.carrying = null; return false; }
    if (q.bedRes) return carrierStep(p, dt);
    const dp = depotOf(p), arrived = steer(p, dp.x, dp.y, pSpeed(p), dt, false) || Math.hypot(p.x - dp.x, p.y - dp.y) < 30;
    p.anim += dt * 9; q.x = p.x - Math.cos(p.ang) * 10; q.y = p.y - Math.sin(p.ang) * 10;
    if (arrived) { p.carrying = null; q.carriedBy = 0; msg(`${p.name}, ${acc(q.name)} kampa getirdi.`, '#9fd', 3); return false; }
    return true;
  }
  const q = G.people.find(z => z.id === p.carryOrder && !z.dead && !z.bed && !z.grabbed); if (!q) return false;
  if (dist(p, q) > 20) { steer(p, q.x, q.y, pSpeed(p) * 1.25, dt, false); p.anim += dt * 11; return true; }
  if (q.downed > 0) { q.downed = 0; q.hp = Math.max(q.hp, 8); q.wasDowned = true; }
  q.carriedBy = p.id; p.carrying = q; if (q.inHut) leaveHut(q); assignBeds();
  return true;
}
// ---- savrulma: yaratık vurunca insan geriye fırlar
function kbStep(p, dt) {
  if (!(p.kbT > 0)) return;
  p.kbT -= dt; p.x += p.kvx * dt; p.y += p.kvy * dt; p.kvx *= Math.pow(0.02, dt); p.kvy *= Math.pow(0.02, dt);
  p.tilt = Math.max(0, p.kbT * 2); if (p !== L) pushOut(p, false);
  if (p.kbT <= 0) { p.tilt = 0; if (p === L) pushOut(p, false); }
}

// ---- balıkçı: en yakın suyun kıyısında balık tutar, balığı depoya taşır
function fishSpot(p) {
  if (p.fspot && p.fspotT > G.now && !(p.fspot.lake && p.fspot.lake.frozen)) return p.fspot;
  let best = null, bd = 1e9;
  for (const l of G.lakes) { if (l.frozen) continue; const d = dist(l, G.fire) * 0.6 + dist(l, p); if (dist(l, G.fire) < 3200 && d < bd) { bd = d; const a = angTo(l, p) + ((p.id * 0.7) % 1 - 0.5); best = { x: l.x + Math.cos(a) * (l.r + 10), y: l.y + Math.sin(a) * (l.r + 10), fx: l.x, fy: l.y, lake: l }; } }
  if (!best && G.harbor && dist(G.harbor, G.fire) < 7000) best = { x: G.harbor.x, y: G.harbor.y, fx: G.harbor.x + Math.cos(G.harbor.a || 0) * 80, fy: G.harbor.y + Math.sin(G.harbor.a || 0) * 80 };
  p.fspot = best; p.fspotT = G.now + 60; return best;
}
function updFisher(p, dt) {
  if (goHome()) return homeBehavior(p, dt);
  if (p.fear > 45) { steer(p, G.fire.x, G.fire.y, pSpeed(p) * 1.3, dt, false); p.anim += dt * 12; return; }
  if (p.carry >= 4 || (p.carry > 0 && p.st === 'return')) {
    p.st = 'return'; const dp = depotOf(p);
    if (steer(p, dp.x, dp.y, pSpeed(p), dt, false) || Math.hypot(p.x - dp.x, p.y - dp.y) < 34) { deposit(p); p.st = 'idle'; }
    p.anim += dt * 9; return;
  }
  const sp = fishSpot(p);
  if (!sp && G.lakes.some(l => l.frozen && dist(l, G.fire) < 3200)) { if (!G.flags.lakeIce) { G.flags.lakeIce = 1; msg('🧊 Göl donmuş — balıkçılar balık tutamıyor, başka işe yardım ediyor.', '#cfe8ff', 5); } return updIdle(p, dt, true); }
  if (!sp) { if (!G.flags.noWater) { G.flags.noWater = 1; msg('Yakında balık tutulacak su yok. Balıkçılar boşta.', '#e99', 4); } return updIdle(p, dt, true); }
  if (Math.hypot(p.x - sp.x, p.y - sp.y) > 14) { steer(p, sp.x, sp.y, pSpeed(p), dt, false); p.anim += dt * 9; return; }
  p.moving = false; p.ang = Math.atan2(sp.fy - p.y, sp.fx - p.x); p.work = 1;
  p.fishT = (p.fishT || 0) + dt * skillMul(lvl(p, 'avcilik')) * (abilOn('balik') ? 2 : 1) * (isNight() ? 0.5 : 1);
  if (p.fishT >= 11) { p.fishT = 0; p.bag.et = (p.bag.et || 0) + 1; p.carry++; addXP(p, 'avcilik', 3); ftext(p.x, p.y - 30, '🐟', '#9cf'); }
}
