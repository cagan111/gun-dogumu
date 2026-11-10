'use strict';
// =============================================================
//  HALK — kişiler, özellikler, gruplar, yöneticiler, moral,
//         yaralanmalar, çiftler ve çocuklar
// =============================================================
function pickTraits() {
  const keys = Object.keys(TRAITS), n = Math.random() < 0.45 ? 2 : 1, out = [];
  let guard = 0;
  while (out.length < n && guard++ < 50) {
    const k = pick(keys);
    if (out.includes(k)) continue;
    if (TRAITS[k].ex && out.some(o => TRAITS[k].ex.includes(o))) continue;
    out.push(k);
  }
  return out;
}
function freshName() {
  const free = NAMES.filter(n => !G.usedNames.has(n));
  const n = free.length ? pick(free) : pick(NAMES) + ' ' + pick(['Kara', 'Ak', 'Genç', 'Küçük', 'Uzun']);
  G.usedNames.add(n); return n;
}
function mkPerson(x, y, name, leader, child) {
  const p = {
    id: ++G.idc, name, x, y, r: child ? 8 : 11, leader: !!leader, child: !!child, age: 0,
    traits: leader || child ? [] : pickTraits(), story: leader || child ? '' : pick(STORIES),
    group: leader ? null : 'bos', hp: 60, maxhp: 60, fear: 0, st: 'idle', tgt: null, carry: 0, bag: {}, work: 0,
    ang: rand(0, TAU), anim: 0, atkCd: 0, hurtT: 0, lastHurt: 99, inHut: null,
    skin: pick(['#e0b48a', '#c99068', '#a8754f', '#f0c8a0', '#8a5a3a']), hair: pick(['#2a1a10', '#4a2e18', '#111', '#6a4020', '#8a6a3a', '#bbb']),
    stam: 100, stuck: 0, detour: 0, seat: rand(0, TAU), grabbed: false, desert: 0, moving: false,
    injury: null, downed: 0, tired: false, watched: false, partner: 0, parentA: 0, parentB: 0, post: null, medic: 0, fidx: 0, swing: 0
  };
  p.maxhp = leader ? 100 : child ? 35 : Math.round(60 * (tr(p, 'guclu') ? 1.3 : 1) * (tr(p, 'hasta') ? 0.75 : 1));
  p.hp = p.maxhp;
  return p;
}
const adults = () => G.people.filter(p => !p.child);
const members = g => G.people.filter(p => !p.leader && !p.child && p.group === g);
const hutCount = () => G.builds.filter(b => b.type === 'kulube').length;
const popCap = () => 5 + 3 * hutCount();
const carryCap = p => 5 + (tr(p, 'guclu') ? 3 : 0);
const spearTier = () => G.tech.has('kemikMizrak') ? 3 : G.tech.has('tasMizrak') ? 2 : 1;
const ranged = p => G.tech.has('yay') && (p.leader || tr(p, 'avci'));
const nearSifahane = p => G.builds.some(b => b.type === 'sifahane' && Math.hypot(b.x - p.x, b.y - p.y) < 170);

function pSpeed(p) {
  let s = p.leader ? 150 : 105;
  if (tr(p, 'cevik')) s *= 1.25;
  if (tr(p, 'yasli')) s *= 0.85;
  if (p.tired) s *= 0.8;
  if (p.injury && p.injury.type === 'kirik') s *= 0.5;
  if (p.child) s *= 0.9;
  if (biomeFast(p.x, p.y) === 2) s *= 0.75;
  if (p.group === 'kasif') s *= abilOn('kasif') ? 1.4 : 1.15;
  return s;
}
function moraleMul() { return G.morale > 70 ? 1.15 : G.morale < 30 ? 0.8 : 1; }
function workRate(p) {
  let w = 1;
  if (tr(p, 'caliskan')) w *= 1.3;
  if (tr(p, 'yasli')) w *= 0.9;
  if (p.tired) w *= 0.75;
  w *= grpMul(p.group) * (abilOn(p.group) ? 2 : 1) * moraleMul();
  return w;
}
function dmgOf(p) {
  const t = spearTier();
  let d = p.leader ? [18, 30, 42][t - 1] : [8, 13, 18][t - 1];
  if (tr(p, 'avci')) d *= 1.5;
  if (tr(p, 'guclu')) d *= 1.2;
  if (p.group === 'muhafiz' && abilOn('muhafiz')) d *= 1.6;
  if (p.group === 'takip' && abilOn('takip')) d *= 1.5;
  return d;
}
function moraleAdd(v) { G.morale = clamp(G.morale + v, 0, 100); }

// ---- grup yönetimi
function mgr(g) {
  const id = G.managers[g]; if (!id) return null;
  const p = G.people.find(q => q.id === id);
  return p && p.group === g && !p.downed && !p.grabbed && !p.desert ? p : null;
}
function grpMul(g) { const m = mgr(g); return m ? 1.2 + (tr(m, 'onder') ? 0.25 : 0) + (tr(m, 'yasli') ? 0.15 : 0) : 1; }
const abilOn = g => !!(G.abil[g] && G.abil[g].act > 0);
const mgrScore = p => (tr(p, 'onder') ? 3 : 0) + (tr(p, 'yasli') ? 2 : 0) + (tr(p, 'caliskan') ? 1 : 0) + p.hp / 100;
function setGroup(p, g) {
  if (p.leader || p.child || p.group === g) return;
  if (G.managers[p.group] === p.id) { G.managers[p.group] = null; msg(`${GROUPS[p.group].ad} grubu yöneticisiz kaldı.`, '#ccc', 3); }
  if (p.tgt && p.tgt.claim === p) p.tgt.claim = null;
  if (p.post) { p.post.guard = null; p.post = null; }
  p.tgt = null; p.st = 'idle'; p.group = g;
  if (p.inHut && (g === 'muhafiz' || g === 'takip')) leaveHut(p);
  G.uiDirty = true; G.tutGroup = true;
}
function plusGroup(g) {
  let src = members('bos').filter(p => G.managers.bos !== p.id).pop();
  if (!src) {
    let best = null;
    for (const k of ['odun', 'tas', 'yiyecek', 'sifaci', 'takip']) {
      if (k === g) continue;
      const m = members(k).filter(p => G.managers[k] !== p.id);
      if (m.length > (best ? best.length : 0)) best = m;
    }
    if (best) src = best[best.length - 1];
  }
  if (!src) { msg('Aktarılacak kimse yok. Halkın büyümeli ya da birini boşa almalısın.', '#ccc', 3); return; }
  setGroup(src, g);
}
function minusGroup(g) {
  const m = members(g), free = m.filter(p => G.managers[g] !== p.id);
  const p = free[free.length - 1] || m[0];
  if (p) setGroup(p, 'bos');
}
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
const SHOUT = { odun: 'Baltaları kaldırın!', tas: 'Şu damarı izleyin!', yiyecek: 'Bugün kimse aç yatmayacak!', sifaci: 'Yaralıları bana getirin!', muhafiz: 'Mevzilere! Kimse geçmeyecek!', takip: 'Arkamdan! Saldırın!' };
function useAbility(g) {
  const m = mgr(g);
  if (!m) { msg('Önce bu gruba bir yönetici ata (★).', '#e99', 3); return; }
  const a = G.abil[g];
  if (a.cd > 0) { msg(`${ABIL[g].ad} henüz hazır değil (${Math.ceil(a.cd)} sn).`, '#ccc', 2); return; }
  a.cd = ABIL[g].cd; a.act = ABIL[g].dur;
  if (g === 'yiyecek') { let n = 0; for (const b of G.bushes) if (Math.hypot(b.x - CAMP.x, b.y - CAMP.y) < 900) { b.amt = b.max; n++; } }
  if (g === 'sifaci') for (const p of G.people) if (Math.hypot(p.x - G.fire.x, p.y - G.fire.y) < Math.max(fireR(), 260)) {
    if (p.downed > 0) { p.downed = 0; p.hp = 1; }
    p.hp = Math.min(p.maxhp, p.hp + 40); if (p.injury && p.injury.type === 'kanama') p.injury = null;
  }
  if (g === 'muhafiz') for (const p of members('muhafiz')) p.fear = 0;
  msg(`${m.name}: "${SHOUT[g]}" — ${ABIL[g].ad}`, '#ffd27a', 4);
  SFX.bell(); G.uiDirty = true;
}
function setZone(g) {
  const m = mgr(g);
  if (!m) { msg('Bölge emri için önce bir yönetici ata (★).', '#e99', 3); return; }
  G.zone[g] = { x: L.x, y: L.y };
  const b = BIOME_AD[biomeFast(L.x, L.y)];
  msg(g === 'muhafiz' ? `${m.name}: "Nöbet yeri burası. Muhafızlar burayı tutacak."` : `${m.name}: "${GROUPS[g].ad} grubu buradan (${b}) toplayacak."`, '#fd9', 4);
  G.uiDirty = true;
}
function clearZone(g) { G.zone[g] = null; msg(`${GROUPS[g].ad} grubu kampa yakın çalışmaya döndü.`, '#ccc', 3); G.uiDirty = true; }

// ---- kaynak toplama
function nearestRes(p, g) {
  const ref = G.zone[g] || CAMP;
  let lists;
  if (g === 'odun') lists = [G.trees];
  else if (g === 'tas') lists = [G.rocks, G.crystals];
  else if (g === 'yiyecek') lists = [G.bushes];
  else if (g === 'sifaci') lists = (G.stock.herb >= 12 && G.stock.poison < 10) ? [G.poisons, G.herbs] : [G.herbs, G.poisons];
  else return null;
  let best = null, bs = 1e9;
  lists.forEach((arr, li) => {
    for (const o of arr) {
      if (o.dead || o.amt < 1) continue;
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
  if (G.parts) for (let i = 0; i < 10; i++) G.parts.push({ x: t.x + rand(-30, 30), y: t.y + rand(-30, 30), vx: rand(-40, 40), vy: rand(-40, 40), life: rand(0.6, 1.2), col: '#2f5a24', s: rand(3, 6) });
}
function deposit(p) {
  for (const k in p.bag) addStock(k, p.bag[k], p.x, p.y);
  p.bag = {}; p.carry = 0;
}

// ---- tehlike
function hostile(d) {
  if (d.tamed || d.dead) return false;
  if (d.type === 'batakci') return !d.hidden;
  return !!DINO[d.type].pred || d.angry > 0;
}
function nearestThreat(p, range) {
  let best = null, bd = range;
  for (const d of G.dinos) { if (!hostile(d)) continue; const dd = dist(d, p) - d.r; if (dd < bd) { bd = dd; best = d; } }
  return best;
}

// ---- kulübe
function enterHut(p) {
  const h = G.builds.filter(b => b.type === 'kulube' && b.occ.length < 3 && dist(b, p) < 1000).sort((a, b) => dist(a, p) - dist(b, p))[0];
  if (!h) return false;
  if (steer(p, h.x, h.y + h.r + 4, pSpeed(p), G.dt, false) || dist(p, h) < h.r + 16) { h.occ.push(p); p.inHut = h; p.x = h.x; p.y = h.y; }
  return true;
}
function leaveHut(p) { const h = p.inHut; if (!h) return; const i = h.occ.indexOf(p); if (i >= 0) h.occ.splice(i, 1); p.inHut = null; p.x = h.x + rand(-10, 10); p.y = h.y + h.r + 10; }

// ---- yaralanma / tedavi
function injure(p) {
  if (p.injury || p.downed > 0) return;
  const r = Math.random();
  if (r < 0.5) { p.injury = { type: 'kanama', t: 14 }; msg(p === L ? 'Kanıyorsun!' : `${p.name} kanıyor!`, '#f99', 3); }
  else if (r < 0.8) { p.injury = { type: 'kirik', t: 240 }; msg(p === L ? 'Bacağın kırıldı! Yavaşladın.' : `${gen(p.name)} bacağı kırıldı!`, '#f99', 4); }
  else { p.injury = { type: 'enfeksiyon', t: 0 }; msg(p === L ? 'Yaran mikrop kaptı. İlaç lazım.' : `${gen(p.name)} yarası mikrop kaptı. İlaç lazım.`, '#fb9', 4); }
}
function updInjury(p, dt) {
  const j = p.injury;
  if (j) {
    if (j.type === 'kanama') { p.hp -= 1.0 * dt; j.t -= dt; if (j.t <= 0) p.injury = null; }
    else if (j.type === 'enfeksiyon') p.hp -= 0.07 * dt;
    else if (j.type === 'kirik') { j.t -= dt * (nearSifahane(p) ? 3 : 1) * (j.set ? 2 : 1); if (j.t <= 0) { p.injury = null; msg(p === L ? 'Kemiğin kaynadı.' : `${gen(p.name)} kemiği kaynadı.`, '#9f9', 3); } }
  }
  if (p.hp <= 0 && !p.dead) { if (p.leader) killPerson(p, null); else downPerson(p); }
}
function downPerson(p) {
  if (p.downed > 0) { killPerson(p, null); return; }
  p.downed = 25; p.hp = 0; p.fear = 100; p.moving = false;
  if (p.tgt && p.tgt.claim === p) p.tgt.claim = null; p.tgt = null;
  if (p.inHut) leaveHut(p);
  msg(`${p.name} ağır yaralı yere yığıldı! 25 sn içinde yanına gidip [E] ile kaldır.`, '#ff8a6a', 6);
  for (const q of G.people) if (dist(q, p) < 500) q.fear = Math.min(100, q.fear + 10);
  G.uiDirty = true;
}
function needsCare(q) {
  if (q.dead || q.grabbed || q.desert || q.inHut) return false;
  if (q.downed > 0) return true;
  if (q.injury) { if (q.injury.type === 'enfeksiyon') return G.stock.med > 0; if (q.injury.type === 'kirik') return !q.injury.set; return true; }
  return q.hp < q.maxhp * 0.35;
}
function treat(q, healer) {
  if (q.downed > 0) { q.downed = 0; q.hp = Math.max(q.hp, 25); msg(`${q.name} ayağa kaldırıldı.`, '#9f9', 3); }
  else if (q.injury) {
    const t = q.injury.type;
    if (t === 'kanama') { q.injury = null; msg(`${gen(q.name)} yarası sarıldı.`, '#9f9', 2); }
    else if (t === 'enfeksiyon') {
      if (G.stock.med > 0) { G.stock.med--; q.injury = null; msg(`${q.name} ilaçla iyileşti.`, '#9f9', 3); }
      else if (!G.flags.noMed) { G.flags.noMed = 1; msg('İlaç yok! Şifalı ot topla (3🌿 = 1💊).', '#fb9', 4); }
    } else if (t === 'kirik') { q.injury.t = Math.min(q.injury.t, 60); q.injury.set = true; msg(`${gen(q.name)} kırığı sarıldı.`, '#9f9', 2); }
  }
  q.hp = Math.min(q.maxhp, q.hp + (healer && tr(healer, 'sifali') ? 20 : 10));
  q.medic = 0;
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

// ---- dövüş
function chaseAttack(p, foe, dt) {
  const reach = foe.r + p.r + 14;
  if (dist(p, foe) > reach) { steer(p, foe.x, foe.y, pSpeed(p) * 1.4 * (p.group === 'takip' && abilOn('takip') ? 1.3 : 1), dt, false); p.anim += dt * 12; }
  else { p.moving = false; p.ang = angTo(p, foe); if (p.atkCd <= 0) personAttack(p, foe); }
}
function personAttack(p, d) {
  p.atkCd = 0.95; p.swing = 0.2; p.ang = angTo(p, d);
  hurt(d, dmgOf(p), p);
  if (L && dist(p, L) < 500) SFX.hit(0.3);
}
function rangedOrMelee(p, foe, dt) {
  if (ranged(p) && dist(p, foe) < 270 && dist(p, foe) > 40) {
    p.moving = false; p.ang = angTo(p, foe);
    if (p.atkCd <= 0) { p.atkCd = 1.1; shootArrow(p, foe.x, foe.y, 14); }
  } else chaseAttack(p, foe, dt);
}

// ---- korku
function updFear(p, dt, LS, night) {
  if (p.inHut) { p.fear = Math.max(0, p.fear - 12 * dt); return; }
  let fm = tr(p, 'cesur') ? 0.55 : tr(p, 'korkak') ? 1.6 : 1;
  if (p.child) fm *= 1.3;
  if (p.group === 'muhafiz' && abilOn('muhafiz')) fm = 0;
  let inc = 0;
  for (const d of G.dinos) {
    if (!hostile(d)) continue;
    const rng = d.type === 'dev' ? 800 : d.type === 'yirtici' ? 450 : 320;
    const w = d.type === 'dev' ? 45 : d.type === 'yirtici' ? 18 : d.type === 'yamyam' ? 16 : d.type === 'batakci' ? 15 : d.type === 'kucuk' ? 6 : 10;
    const dd = dist(d, p); if (dd < rng) inc += w * (1 - dd / rng);
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
const HOME_GROUPS = ['odun', 'tas', 'yiyecek', 'sifaci', 'kasif', 'bos'];
function updPerson(p, dt, LS) {
  if (p.grabbed) return;
  p.atkCd -= dt; p.hurtT = Math.max(0, p.hurtT - dt); p.lastHurt += dt; p.swing = Math.max(0, p.swing - dt);
  if (p.downed > 0) { p.downed -= dt; p.moving = false; if (p.downed <= 0) { msg(`${p.name} yaralarına yenik düştü.`, '#f77', 5); killPerson(p, null); } return; }
  updInjury(p, dt); if (p.dead || p.downed > 0) return;
  const night = isNight();
  updFear(p, dt, LS, night);
  if (p.lastHurt > 6) {
    let h = 0;
    if (dist(p, G.fire) < fireR() + 20) h = 0.8;
    if (p.inHut) h = 1.2;
    if (nearSifahane(p)) h = Math.max(h, 0.8) * 3;
    if (p.injury && p.injury.type === 'enfeksiyon') h = 0;
    p.hp = Math.min(p.maxhp, p.hp + h * dt);
  }
  if (night && p.group === 'muhafiz') p.watched = true;
  if (p.inHut) { if (!goHome() || !(p.child || HOME_GROUPS.includes(p.group))) leaveHut(p); return; }

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
    msg(`${p.name} dehşete kapıldı ve kaçıyor! Durdurmak için yanına koş!`, '#f9a', 4);
    return;
  }
  const thr = nearestThreat(p, 190);
  // ---- panik
  if (p.fear >= 80 || (p.child && thr)) {
    p.anim += dt * 14;
    const fr = fireR();
    if (fr > 0 && dist(p, G.fire) > fr * 0.55) steer(p, G.fire.x + Math.cos(p.seat) * 50, G.fire.y + Math.sin(p.seat) * 50, pSpeed(p) * 1.4, dt, false);
    else if (thr) { const a = angTo(thr, p); steer(p, p.x + Math.cos(a) * 100, p.y + Math.sin(a) * 100, pSpeed(p) * 1.4, dt, false); }
    else p.moving = false;
    return;
  }
  if (p.child) return updChild(p, dt);
  // ---- kendini savun
  const fighter = p.group === 'muhafiz' || p.group === 'takip';
  if (thr && dist(thr, p) - thr.r < 26 && p.atkCd <= 0 && (fighter || thr.type === 'kucuk' || p.fear < 50)) personAttack(p, thr);

  switch (p.group) {
    case 'muhafiz': return updGuard(p, dt);
    case 'takip': return updFollow(p, dt);
    case 'sifaci': return updHealer(p, dt, thr);
    case 'kasif': return updScout(p, dt, thr);
    case 'bos': return updIdle(p, dt);
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
  p.tgt = null; p.st = 'idle';
  if (p.carry > 0) { if (dist(p, G.fire) < 90) deposit(p); else { steer(p, G.fire.x, G.fire.y, pSpeed(p) * 1.15, dt, false); p.anim += dt * 9; return; } }
  if (enterHut(p)) { p.anim += dt * 8; return; }
  sitByFire(p, dt, 75);
}
function updChild(p, dt) {
  if (goHome()) { if (enterHut(p)) return; return sitByFire(p, dt, 45); }
  const par = G.people.find(q => q.id === p.parentA || q.id === p.parentB);
  if (par && !par.inHut && dist(par, G.fire) < Math.max(fireR(), 260)) {
    if (dist(p, par) > 30) { steer(p, par.x + 18, par.y + 10, pSpeed(p), dt, false); p.anim += dt * 10; } else p.moving = false;
    return;
  }
  p.wt = (p.wt || 0) - dt;
  if (p.wt <= 0) { p.wt = rand(3, 7); p.seat = rand(0, TAU); p.sr = rand(45, 110); }
  sitByFire(p, dt, p.sr || 60);
}
function updIdle(p, dt) {
  if (goHome()) return homeBehavior(p, dt);
  p.wt = (p.wt || 0) - dt;
  if (p.wt <= 0) { p.wt = rand(5, 12); p.seat = rand(0, TAU); p.sr = rand(70, 140); }
  sitByFire(p, dt, p.sr || 90);
}
function updGather(p, dt, g, thr) {
  if (goHome()) return homeBehavior(p, dt);
  if (thr && thr.type !== 'kucuk' && p.fear > 35) { steer(p, G.fire.x, G.fire.y, pSpeed(p) * 1.35, dt, false); p.anim += dt * 12; return; }
  const spd = pSpeed(p);
  if (p.st === 'return' || p.carry >= carryCap(p)) {
    p.st = 'return';
    if (steer(p, G.fire.x + Math.cos(p.seat) * 55, G.fire.y + Math.sin(p.seat) * 55, spd, dt, false) || dist(p, G.fire) < 70) { deposit(p); p.st = 'idle'; }
    p.anim += dt * 9; return;
  }
  if (!p.tgt || p.tgt.dead || p.tgt.amt < 1) {
    if (p.tgt && p.tgt.claim === p) p.tgt.claim = null;
    p.tgt = nearestRes(p, g); if (p.tgt) p.tgt.claim = p; p.work = 0;
    if (!p.tgt) { if (p.carry > 0) p.st = 'return'; else updIdle(p, dt); return; }
  }
  const o = p.tgt, reach = o.r + p.r + 6;
  if (dist(p, o) > reach) { steer(p, o.x, o.y, spd, dt, false); p.anim += dt * 9; return; }
  p.moving = false; p.ang = angTo(p, o);
  p.work += dt * workRate(p); p.anim += dt * 4;
  if (p.work >= 1.1) {
    p.work = 0;
    const r = takeRes(o); p.bag[r] = (p.bag[r] || 0) + 1; p.carry++;
    if (L && dist(p, L) < 500) { if (r === 'wood') SFX.chop(); else if (r === 'stone' || r === 'crystal') SFX.rock(); }
    if (o.kind === 'tree') o.shake = 0.2;
    if (o.amt < 1 || o.dead) p.tgt = null;
    if (p.carry >= carryCap(p) || !p.tgt) p.st = 'return';
  }
}
function pickScoutTarget(p) {
  const z = G.zone.kasif, c = z || CAMP, R = z ? 900 : 2900;
  let best = null, bs = 1e9;
  for (let k = 0; k < 70; k++) {
    const a = rand(0, TAU), r = Math.sqrt(Math.random()) * R, x = clamp(c.x + Math.cos(a) * r, 100, WORLD - 100), y = clamp(c.y + Math.sin(a) * r, 100, WORLD - 100);
    if (exploredAt(x, y)) continue;
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
  if (!t || Math.hypot(t.x - p.x, t.y - p.y) < 50 || p.stT <= 0 || (p.stCheck <= 0 && exploredAt(t.x, t.y))) {
    if (!t || p.stCheck <= 0 || p.stT <= 0 || Math.hypot(t.x - p.x, t.y - p.y) < 50) { p.stgt = pickScoutTarget(p); p.stT = 60; p.stCheck = 2; }
  }
  steer(p, p.stgt.x, p.stgt.y, pSpeed(p), dt, false); p.anim += dt * 10;
}
function updHealer(p, dt, thr) {
  const pat = findPatient(p);
  const nightOk = pat && (!goHome() || dist(pat, G.fire) < fireR() + 150);
  if (pat && nightOk) {
    if (p.tgt && p.tgt.claim === p) p.tgt.claim = null; p.tgt = null;
    pat.medic = p.id;
    if (dist(p, pat) > 22) { steer(p, pat.x, pat.y, pSpeed(p) * 1.2, dt, false); p.anim += dt * 10; p.treatT = 0; return; }
    p.moving = false; p.ang = angTo(p, pat);
    p.treatT = (p.treatT || 0) + dt * (tr(p, 'sifali') ? 2 : 1) * grpMul('sifaci');
    if (p.treatT >= 2) { p.treatT = 0; treat(pat, p); }
    return;
  }
  if (goHome()) return homeBehavior(p, dt);
  // ilaç yap
  if (G.stock.herb >= 3 && G.stock.med < 3 && dist(p, G.fire) < 200) {
    if (dist(p, G.fire) > 60) { steer(p, G.fire.x, G.fire.y, pSpeed(p), dt, false); p.anim += dt * 9; return; }
    p.moving = false; p.brew = (p.brew || 0) + dt * grpMul('sifaci');
    if (p.brew >= 3) { p.brew = 0; G.stock.herb -= 3; G.stock.med++; ftext(p.x, p.y - 16, '+1 💊', '#bfe'); }
    return;
  }
  updGather(p, dt, 'sifaci', thr);
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
  if (foe && !(foe.type === 'dev' && p.fear > 55 && !ab)) return rangedOrMelee(p, foe, dt);
  p.seat += dt * 0.18;
  const pr = z ? 140 : (ab ? baseR * 0.5 : baseR * 0.72);
  steer(p, c.x + Math.cos(p.seat) * pr, c.y + Math.sin(p.seat) * pr, 75, dt, false); p.anim += dt * 6;
}
function updFollow(p, dt) {
  const hc = abilOn('takip'), range = hc ? 450 : 230;
  let foe = null, fd = range;
  for (const d of G.dinos) { if (!hostile(d)) continue; const dd = dist(d, L); if (dd < fd) { fd = dd; foe = d; } }
  if (foe && !(foe.type === 'dev' && p.fear > 50 && !hc)) return rangedOrMelee(p, foe, dt);
  const ring = p.fidx < 6 ? 0 : 1, n = ring ? 10 : 6, i = p.fidx % n;
  const off = (i / n) * TAU, rr = (G.mount ? 70 : 45) + ring * 32;
  const tx = L.x + Math.cos(off + L.ang + Math.PI) * rr, ty = L.y + Math.sin(off + L.ang + Math.PI) * rr;
  if (Math.hypot(p.x - tx, p.y - ty) > 16) { steer(p, tx, ty, dist(p, L) > 160 ? pSpeed(p) * 1.7 : pSpeed(p) * 1.35, dt, false); p.anim += dt * 10; } else p.moving = false;
}
function assignPosts() {
  const guards = members('muhafiz').filter(p => !p.downed && !p.desert);
  for (const g of guards) if (g.post && (g.post.dead || g.post.guard !== g)) g.post = null;
  for (const k of G.builds) {
    if (k.type !== 'kule') continue;
    if (k.guard && (k.guard.dead || k.guard.group !== 'muhafiz' || k.guard.downed || k.guard.post !== k)) k.guard = null;
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
    if (!G.people.length) { gameOver(); return; }
    const cand = G.people.filter(q => !q.child);
    const pool = cand.length ? cand : G.people;
    const nl = pool.slice().sort((a, b) => (b.hp + (tr(b, 'onder') ? 50 : 0)) - (a.hp + (tr(a, 'onder') ? 50 : 0)))[0];
    for (const g in G.managers) if (G.managers[g] === nl.id) G.managers[g] = null;
    if (nl.inHut) leaveHut(nl);
    if (nl.post) { nl.post.guard = null; nl.post = null; }
    nl.leader = true; nl.group = null; nl.maxhp = 100; nl.hp = Math.max(nl.hp, 60); nl.fear = 0; nl.downed = 0; nl.child = false; nl.r = 11;
    L = nl;
    msg(`Liderin öldü... Halk ${gen(nl.name)} etrafında toplandı. Artık sen ${cop(nl.name)}.`, '#ffb', 8);
    SFX.sting();
  } else if (!silent && !p.child) msg(`${p.name} öldü.`, '#f77', 5);
  if (!G.people.length) gameOver();
}

// ---- şafak: yorgunluk, hastalık, çiftler, doğumlar, çocuklar, isyan
function halkDawn() {
  let tired = 0;
  for (const p of G.people) { p.tired = !!p.watched && !tr(p, 'uykusuz'); p.watched = false; if (p.tired) tired++; }
  if (tired) msg(`${tired} muhafız gece nöbetinden yorgun: bugün yavaşlar.`, '#bbb', 4);
  for (const p of G.people) {
    if (p.child || p.injury || p.leader) continue;
    if (Math.random() < (tr(p, 'hasta') ? 0.15 : 0.02)) { p.injury = { type: 'enfeksiyon', t: 0 }; msg(`${p.name} hastalandı. İlaç gerekiyor.`, '#fb9', 4); }
  }
  // çocuklar büyür
  for (const p of G.people) if (p.child) {
    p.age++;
    if (p.age >= 3) {
      p.child = false; p.r = 11; p.traits = pickTraits(); p.story = `Bu kampta doğdu; başka bir dünya bilmiyor.`;
      p.maxhp = Math.round(60 * (tr(p, 'guclu') ? 1.3 : 1) * (tr(p, 'hasta') ? 0.75 : 1)); p.hp = p.maxhp; p.group = G.newGroup;
      msg(`${p.name} büyüdü ve ${GROUPS[p.group].ad} grubuna katıldı.`, '#9f9', 5); moraleAdd(5);
    }
  }
  // çiftler
  const singles = G.people.filter(p => !p.child && !p.partner);
  if (singles.length >= 2 && Math.random() < 0.3) {
    const a = pick(singles), b = pick(singles.filter(q => q !== a));
    a.partner = b.id; b.partner = a.id;
    msg(`${a.name} ve ${b.name} birbirine yakınlaştı. ❤`, '#f9c', 5); moraleAdd(3);
  }
  // doğumlar
  const done = new Set();
  for (const a of G.people) {
    if (!a.partner || done.has(a.id)) continue;
    const b = G.people.find(q => q.id === a.partner); if (!b) continue;
    done.add(a.id); done.add(b.id);
    if (G.people.length < popCap() && G.morale >= 45 && G.stock.food >= 10 && Math.random() < 0.2) {
      const c = mkPerson(G.fire.x + rand(-40, 40), G.fire.y + rand(30, 60), freshName(), false, true);
      c.parentA = a.id; c.parentB = b.id; c.group = null; G.people.push(c);
      msg(`${a.name} ve ${gen(b.name)} bir bebeği oldu: ${c.name}! 👶`, '#ffd0e0', 6); moraleAdd(8); unlock('cocuk');
    }
  }
  // isyan
  const ad = G.people.filter(p => !p.child && !p.leader);
  if (G.morale < 20 && ad.length >= 4 && Math.random() < 0.5) {
    const th = pick(ad.filter(p => !Object.values(G.managers).includes(p.id)) .concat([])) || pick(ad);
    const steal = Math.floor(G.stock.food * 0.3);
    G.stock.food -= steal; G.lost++;
    msg(`${th.name} gece ${steal}🍖 çalıp kaçtı. Halk sana artık güvenmiyor.`, '#f96', 7);
    removePerson(th); moraleAdd(-5);
  } else if (G.morale < 20) msg('Halkın morali çok düşük. Fısıltılar başladı...', '#fb9', 5);
  G.uiDirty = true;
}
