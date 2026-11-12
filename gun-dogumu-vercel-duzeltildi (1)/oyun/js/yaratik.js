'use strict';
// =============================================================
//  YARATIKLAR — hareket, hasar, yapay zekâ, evcilleştirme,
//               binme, yumurtalar, oklar, doğurma
// =============================================================

// ---- hareket ve çarpışma
function pushOut(e, isDino) {
  if (e.fly) return null;
  let blocked = null;
  const q = gQuery(e.x, e.y, e.r + 4);
  for (const o of q) {
    if (o.dead) continue;
    if (o.kind === 'lake' && o.frozen) continue;
    if (o.kind === 'build' && !isDino) continue;
    if (o.kind === 'tree' && e.r >= 55) {
      if (!o.stump && Math.hypot(e.x - o.x, e.y - o.y) < e.r) { o.shake = 0.3; if (e.moving && Math.random() < 0.012) { treeDown(o); o.amt = 0; SFX.crash(volOf(o, 1100) * 0.7 + 0.02, panOf(o.x)); } }
      continue;
    }
    const dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy) || 0.01, m = o.r + e.r;
    if (d < m) { e.x = o.x + dx / d * m; e.y = o.y + dy / d * m; if (o.kind === 'build') blocked = o; }
  }
  e.x = clamp(e.x, 30, WORLD - 30); e.y = clamp(e.y, 30, WORLD - 30);
  if (HM && groundH(e.x, e.y) < 0.6 && !frozenLakeAt(e.x, e.y)) seaPush(e);
  return blocked;
}
// Çözülme anında duran lider/halk/hayvan da suyun içinde kalmasın. (Codex)
function clearThawedLake(lake) {
  for (const list of [G.people || [], G.dinos || []]) for (const e of list) {
    if (e.dead || e.fly || e.inHut || e.insideB || e.grabbed || (e === L && G.mount)) continue;
    const dx = e.x - lake.x, dy = e.y - lake.y, rr = lake.r + (e.r || 0);
    if (dx * dx + dy * dy >= rr * rr) continue;
    if (dx * dx + dy * dy < 0.000001) { const a = (e.id || 1) * 2.399963229728653; e.x += Math.cos(a) * 0.01; e.y += Math.sin(a) * 0.01; }
    pushOut(e, !!e.type);
  }
  if (G.mount && L) { L.x = G.mount.x; L.y = G.mount.y; }
}
// yürüyenleri denizden karaya it: yükseklik eğimi boyunca yukarı (düzse kampa doğru)
function seaPush(e) {
  for (let k = 0; k < 16; k++) {
    const h = groundH(e.x, e.y); if (h >= 0.6) return;
    let gx = groundH(e.x + 25, e.y) - groundH(e.x - 25, e.y), gy = groundH(e.x, e.y + 25) - groundH(e.x, e.y - 25), m = Math.hypot(gx, gy);
    if (m < 0.05) { gx = CAMP.x - e.x; gy = CAMP.y - e.y; m = Math.hypot(gx, gy) || 1; }
    const st = clamp((0.6 - h) / 0.2, 3, 60);
    e.x += gx / m * st; e.y += gy / m * st;
  }
}
function steer(e, tx, ty, spd, dt, isDino) {
  let dx = tx - e.x, dy = ty - e.y; const d = Math.hypot(dx, dy);
  if (d < 3) { e.moving = false; return true; }
  if (isDino && e.type !== 'batakci' && biomeFast(e.x, e.y) === 2) spd *= 0.75;
  dx /= d; dy /= d;
  if (e.detour) { const px = -dy * e.detour, py = dx * e.detour; dx = dx * 0.4 + px; dy = dy * 0.4 + py; const m = Math.hypot(dx, dy); dx /= m; dy /= m; }
  const s = Math.min(spd * dt, d), ox = e.x, oy = e.y;
  e.x += dx * s; e.y += dy * s;
  const bl = pushOut(e, isDino); if (isDino) e.bash = bl;
  const moved = Math.hypot(e.x - ox, e.y - oy);
  if (moved < s * 0.3 && !bl) { e.stuck += dt; if (e.stuck > 0.25) { e.detour = Math.random() < 0.5 ? 1 : -1; e.stuck = -0.7; } }
  else if (e.stuck < 0) { e.stuck += dt; if (e.stuck >= 0) e.detour = 0; }
  else e.stuck = Math.max(0, e.stuck - dt);
  e.ang = angLerp(e.ang, Math.atan2(dy, dx), Math.min(1, dt * 10));
  e.moving = true;
  return d < 8;
}
function flyTo(d, tx, ty, spd, dt) {
  const dx = tx - d.x, dy = ty - d.y, dd = Math.hypot(dx, dy);
  if (dd < 2) { d.moving = false; return; }
  const s = Math.min(spd * dt, dd); d.x += dx / dd * s; d.y += dy / dd * s;
  d.x = clamp(d.x, 30, WORLD - 30); d.y = clamp(d.y, 30, WORLD - 30);
  d.ang = angLerp(d.ang, Math.atan2(dy, dx), Math.min(1, dt * 4)); d.moving = true; d.anim += dt * 8;
}
function separate(list) {
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    if (a.inHut || b.inHut || a.grabbed || b.grabbed || a.fly || b.fly || a.hidden || b.hidden || a.mounted || b.mounted) continue;
    const dx = b.x - a.x, dy = b.y - a.y, m = a.r + b.r; if (Math.abs(dx) > m || Math.abs(dy) > m) continue;
    const d = Math.hypot(dx, dy) || 0.01;
    if (d < m) { const k = (m - d) / d * 0.5, wa = b.r / m, wb = a.r / m; a.x -= dx * k * wa; a.y -= dy * k * wa; b.x += dx * k * wb; b.y += dy * k * wb; }
  }
}
const bodyR = t => (t === L && G.mount) ? G.mount.r : (t.r || 11);

// ---- oluşturma
// Ortak doğum kabul kapısı (Codex 6811360397). birthSource geçicidir; v4 yalnız evcilleri saklar.
const BIRTH_NORMAL_SRC = ['normal', 'den', 'herd', 'camp'];
function birthLimits(type) {
  const night = isNight(), sm = DIFF[G.diff].spawn;
  const normals = { kucuk: night ? 3 : 2, yirtici: Math.ceil((night ? 4 : 3) * sm), geceavcisi: Math.ceil(Math.min(2 + G.day / 4, 5) * sm), tukurgec: G.day >= 6 ? 2 : 1,
    kesici: 1, yelken: 1, dev: 0, ordek: 12, gurleyen: 7, boynuzlu: 4, zirhli: 3, uzunboyun: 1, kanatli: 3, batakci: 5, bozkirat: 6,
    taklitci: 0, yamyam: 6 * (G.ccamps || []).filter(c => c.alive).length };
  const extra = { yirtici: G.finale ? 6 : 2, kucuk: G.finale ? 4 : 2, dev: 1, taklitci: 1, yamyam: 8 };
  return { normal: Math.max(0, normals[type] || 0), event: extra[type] || 0 };
}
function birthIsEvent(d) {
  if (d.birthSource) return !BIRTH_NORMAL_SRC.includes(d.birthSource);
  return !!(d.watcher || d.mother || d.raid || d.finale || d.hitrun || d.siege || d.engaged);
}
function birthPopulation(type) {
  let normal = 0, event = 0;
  for (const d of G.dinos) { if (d.dead || d.tamed || d.type !== type) continue; if (birthIsEvent(d)) event++; else normal++; }
  return { normal, event, total: normal + event };
}
function birthRoom(type, source) {
  const lim = birthLimits(type), pop = birthPopulation(type), ev = !BIRTH_NORMAL_SRC.includes(source || 'normal');
  return Math.max(0, Math.min(ev ? lim.event - pop.event : lim.normal - pop.normal, lim.normal + lim.event - pop.total));
}
function admitDino(d, source) {
  if (!d || d.dead || !DINO[d.type] || G.dinos.includes(d)) return false;
  if (!Number.isFinite(d.x) || !Number.isFinite(d.y)) return false;
  source = source || 'normal';
  if (!d.tamed && source !== 'pet' && source !== 'restore' && birthRoom(d.type, source) < 1) return false;
  d.birthSource = source; G.dinos.push(d); return true;
}
function mkDino(type, x, y) {
  const d = DINO[type];
  return { type, x, y, r: d.r, hp: d.hp, maxhp: d.hp, ang: rand(0, TAU), anim: rand(0, 9), atkCd: 0, think: 0, tgt: null, wx: x, wy: y, wt: 0,
    hurt: 0, leave: false, tamed: false, angry: 0, ko: 0, koDone: false, carry: null, carryDmg: 0, orbit: Math.random() < 0.5 ? 1 : -1,
    engaged: false, stepT: 0, rush: 0, roarT: rand(4, 10), blink: rand(1, 5), moving: false, bash: null, trapCd: 0, id: ++G.idc,
    stuck: 0, detour: 0, alt: 0, st: 'idle', poison: 0, scouted: 0, fly: type === 'kanatli', hidden: false,
    alert: 0, alertT: 0, fleeing: false, terr: null };
}
function removeDino(d) {
  if (d.dead && !G.dinos.includes(d)) return;
  d.dead = true;
  const i = G.dinos.indexOf(d); if (i >= 0) G.dinos.splice(i, 1);
  if (d.home && d.home.croc === d) d.home.croc = null;
  if (G.mount === d) dismount(true);
  if (d.carry) dropCarry(d, false);
}

// ---- hasar
function hurt(t, dmg, src, poison, isProj) {
  if (!t || t.dead) return;
  if (t.isRescue) { t.hp -= dmg * DIFF[G.diff].dmg; t.hurtT = 0.2; if (t.hp <= 0) rescueDies(t); return; }
  if (t.type) {
    if (t.type === 'kanatli' && t.alt > 0.4 && !isProj) return;
    if (t.type === 'zirhli' && src && !t.tamed) { const ad = angDiff(t.ang, angTo(t, src)); if (!(ad > 0.9 && ad < 2.3)) { dmg *= 0.3; if (Math.random() < 0.3) ftext(t.x, t.y - t.r, 'zırh!', '#ccc'); } }
    if (t.type === 'taklitci' && !t.revealed) reveal(t);
    if (t.type === 'kesici' && src && !src.type) { const al = alliesNear(src, 150); dmg *= al >= 2 ? 1.8 : al === 1 ? 1 : 0.5; if (al >= 2 && !t.retreat) t.retreat = 1.5; }
    // gizli av: farkında olmayan otobura ilk vuruş ×2
    if (DINO[t.type].herb && !t.tamed && !t.alert && !(t.flee > 0) && !(t.angry > 0) && src && !src.type && src.kind !== 'build' && !src.isRescue) {
      dmg *= 2; ftext(t.x, t.y - t.r - 12, 'sessiz vuruş ×2', '#ffe08a');
    }
    if (!t.tamed) { t.alert = G.now || 0.01; t.alertT = 0; }
    t.hp -= dmg; t.hurt = 0.15; if (poison) t.poison = 5;
    { const n = clamp(Math.round(4 + dmg * 0.5), 5, 18), a0 = src ? angTo(src, t) : rand(0, TAU);
      for (let i = 0; i < n; i++) { const a = a0 + rand(-0.9, 0.9), v = rand(40, 190); G.parts.push({ x: t.x, y: t.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.35, 0.9), col: '#7a0d0d', s: rand(2, 5), blood: 1 }); }
      bloodStain(t.x + rand(-t.r, t.r) * 0.6, t.y + rand(-t.r, t.r) * 0.6, clamp(4 + dmg * 0.35, 5, 16)); t.bleedT = 0; }
    if (t.carry && src && src.leader) { t.carryDmg += dmg; if (t.carryDmg >= 70) dropCarry(t, true); }
    if (t.hidden) { t.hidden = false; t.st = 'lunge'; t.lungeT = 5; t.tgt = src; }
    if (!t.tamed) {
      if (t.type === 'boynuzlu') {
        if (t.ko > 0) t.hp = 0;
        else { t.angry = 18; t.tgt = src; if (!t.koDone && t.hp > 0 && t.hp < t.maxhp * 0.3) { t.ko = 30; t.koDone = true; t.angry = 0; msg('Boynuzlu bayıldı! [E] basılı tut: 15🍖 ile evcilleştir — ya da vur ve et al.', '#fe9', 6); } }
      } else if (t.type === 'uzunboyun') { t.angry = 15; t.tgt = src; }
      else if (t.type === 'ordek' || t.type === 'bozkirat') alarmHerd(t, src || L);
      else if (t.type === 'gurleyen' || t.type === 'zirhli') { t.angry = 12; t.tgt = src || L; }
      else if (t.type === 'kanatli') { t.st = 'fly'; t.home = { x: clamp(t.x + rand(-900, 900), 200, WORLD - 200), y: clamp(t.y + rand(-900, 900), 200, WORLD - 200) }; }
      else if (src && !t.leave && src.kind !== 'build') { t.tgt = src; t.engaged = true; }
      if (t.type === 'kucuk' && t.hp < t.maxhp * 0.5) t.leave = true;
    }
    if (t.hp <= 0) killDino(t, src);
    return;
  }
  // ---- insan
  if (src && src.type && guardSafe(t)) return;          // kapı nöbetçisi yaratıklardan zarar görmez
  if (src && src.type) dmg *= DIFF[G.diff].dmg;
  if (t === L && G.mount && !G.mount.dead) { const m = G.mount, md = dmg * 0.6; dmg -= md; m.hp -= md; m.hurt = 0.15; if (m.hp <= 0) killDino(m, src); }
  if (t.eq && t.eq.zirh) dmg *= 0.7;
  if (t.downed > 0) { killPerson(t, src); return; }
  t.hp -= dmg; t.hurtT = 0.2; t.lastHurt = 0; t.fear = Math.min(100, t.fear + 12);
  if (src && src.type && !isProj && !t.bed && !t.inHut) {   // savrulma: büyük yaratık daha uzağa fırlatır
    const a = angTo(src, t), k = clamp((src.r || 15) * 9 + dmg * 4, 120, 620);
    t.kvx = Math.cos(a) * k; t.kvy = Math.sin(a) * k; t.kbT = clamp((src.r || 15) / 60, 0.25, 0.7);
    if ((src.r || 0) > 30) t.fear = Math.min(100, t.fear + 25);
    if (t === L) G.shake = Math.max(G.shake, 10 + (src.r || 15) * 0.3);
  }
  for (let i = 0; i < 6; i++) G.parts.push({ x: t.x, y: t.y, vx: rand(-100, 100), vy: rand(-100, 100), life: rand(0.3, 0.8), col: '#9a1010', s: rand(2, 4) });
  if (t === L) { G.red = 0.6; G.shake = Math.max(G.shake, 8); }
  if (dmg >= 8 && Math.random() < 0.3) injure(t);
  if (t.hp <= 0) { if (t.leader) killPerson(t, src); else downPerson(t); }
}
function rafBonus() { return 1 + 0.25 * Math.min(2, G.builds.filter(b => b.type === 'raf').length); }
function killDino(d, src) {
  if (d.dead) return;
  const def = DINO[d.type];
  if (!d.tamed) {
    G.kills++;
    const hunted = G.hunt && G.hunt.t === d;
    if (hunted || (src && src.group === 'avci')) { G.stats.hunts = (G.stats.hunts || 0) + 1; if (G.stats.hunts >= 10) unlock('avci10'); }
    if (hunted) { G.hunt = null; msg(`🎯 Av başarılı: ${def.ad}! ${members('kasap').length ? 'Et ustaları leşe gidiyor.' : 'Leşi temizleyecek bir 🔪 Et Ustası ata!'}`, '#ffd27a', 5); }
    const dr = def.drop;
    if (dr.meat) G.carcs.push({ x: d.x, y: d.y, r: Math.max(10, d.r), type: d.type, ang: d.ang, meat: dr.meat, bone: dr.bone || 0, hide: dr.hide || 0, age: 0, carc: true, rotten: false });
    else { let k = 0; for (const r in dr) addStock(r, dr[r], d.x, d.y + 14 * k++); }
    if (dr.poison) addStock('poison', dr.poison, d.x, d.y);
    if (d.type === 'taklitci') { unlock('benzeyen'); msg('Benzeyen yere yığıldı. Yüzü... kimsenin yüzü değildi artık.', '#ddd', 7); moraleAdd(15); }
  } else msg(`Evcil ${def.ad}${d.pet ? ' yavrusu' : ''} öldü...`, '#f99', 5);
  if (d.type === 'dev' && !d.tamed) { msg('DEV KAFA DÜŞTÜ! Halkın sana hayranlıkla bakıyor.', '#ffb060', 7); for (const p of G.people) p.fear = 0; moraleAdd(25); unlock('dev'); SFX.roar(0.4); }
  for (let i = 0; i < 16; i++) G.parts.push({ x: d.x, y: d.y, vx: rand(-150, 150), vy: rand(-150, 150), life: rand(0.5, 1.2), col: '#6a0808', s: rand(2, 6) });
  if (d.carry) dropCarry(d, true);
  removeDino(d);
  G.uiDirty = true;
}
function dropCarry(d, rescued) {
  const v = d.carry; d.carry = null; if (!v) return;
  v.grabbed = false;
  if (rescued) { msg(d.type === 'yamyam' ? `${acc(v.name)} yamyamların elinden kurtardın!` : `${v.name} Dev Kafa'nın ağzından kurtuldu!`, '#9f9', 5); v.x = d.x + 30; v.y = d.y; pushOut(v, false); d.leave = true; if (d.type === 'dev') SFX.roar(0.6); moraleAdd(8); }
}
function rescueDies(t) {
  if (G.rescue !== t) return;
  G.rescue = null; t.dead = true;
  G.stains.push({ x: t.x, y: t.y, r: 16, life: 120 });
  msg(`${gen(t.name)} çığlığı kesildi... Geç kaldın.`, '#c88', 5);
  SFX.scream(L ? clamp(1 - dist(t, L) / 1500, 0.1, 0.8) : 0.3, panOf(t.x));
}

// ---- oklar
function shootArrow(src, tx, ty, dmg) {
  let poison = false;
  if ((G.stock.zok || 0) > 0) { G.stock.zok--; poison = true; }
  else if ((G.stock.ok || 0) > 0) G.stock.ok--;
  else { if (src === L && !G.flags.noArrow) { G.flags.noArrow = 1; msg('Ok kalmadı! Zanaatkârlara ok ürettir (C).', '#e99', 3); } return false; }
  const a = Math.atan2(ty - src.y, tx - src.x) + rand(-0.04, 0.04);
  G.proj.push({ x: src.x + Math.cos(a) * 16, y: src.y + Math.sin(a) * 16, vx: Math.cos(a) * 640, vy: Math.sin(a) * 640, dmg, poison, life: 0.7, src: src.kind === 'build' ? null : src, ang: a });
  if (L && dist(src, L) < 600) SFX.arrow();
  return true;
}
function updProj(dt) {
  for (const q of G.proj) {
    q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt;
    for (const d of G.dinos) {
      if (d.tamed || d.dead || d.hidden) continue;
      if (Math.hypot(d.x - q.x, d.y - (q.y + (d.fly ? d.alt * 40 : 0))) < d.r + 5) { hurt(d, q.dmg, q.src, q.poison, true); q.life = 0; break; }
    }
    if (q.life > 0) for (const o of gQuery(q.x, q.y, 6)) if (((o.kind === 'tree' && !o.stump) || ((o.kind === 'rock' || o.kind === 'crystal') && !o.dead)) && Math.hypot(o.x - q.x, o.y - q.y) < o.r) { q.life = 0; break; }
  }
  G.proj = G.proj.filter(q => q.life > 0);
}

// ---- binme
function mount(d) {
  G.mount = d; d.mounted = true; L.x = d.x; L.y = d.y;
  msg('Boynuzlu’ya bindin! [E] ile in. Hızla düşmanlara çarp.', '#fd9', 4); unlock('binici');
}
function dismount(silent) {
  const d = G.mount; G.mount = null;
  if (d) { d.mounted = false; if (L && !d.dead) { L.x = d.x + Math.cos(d.ang + Math.PI / 2) * (d.r + 14); L.y = d.y + Math.sin(d.ang + Math.PI / 2) * (d.r + 14); pushOut(L, false); } }
  if (!silent) msg('İndin.', '#ccc', 2);
}

// ---- av listesi
const guardSafe = p => typeof doorDuty === 'function' && !p.type && !!doorDuty(p);
function preyList() {
  const out = [];
  const gs = typeof doorGuards === 'function' ? doorGuards() : null;   // kapı nöbetçileri av değildir (doorDuty ile aynı küme)
  for (const p of G.people) if (!p.inHut && !p.grabbed && !p.dead && !p.insideB && !(gs ? gs.includes(p) : guardSafe(p))) out.push(p);
  for (const d of G.dinos) if (d.tamed && !d.fly && !d.mounted) out.push(d);
  if (G.rescue && L && dist(G.rescue, L) < 450) out.push(G.rescue);
  return out;
}
function t_dead(t) { return !t || t.dead || t.inHut || t.insideB || guardSafe(t) || t.grabbed || (t.kind === 'build' && (!t.occ || !t.occ.length)) || (t.isRescue && G.rescue !== t) || (t.mounted); }
function isBold(d) {
  if (G.fire.fuel <= 0 || d.mother || d.finale) return true;
  if (d.type === 'kucuk') return false;
  if (d.type === 'yirtici') {
    if (d.rush > 0) return true;
    let pack = 0; for (const o of G.dinos) if (o.type === 'yirtici' && !o.leave && !o.tamed && dist(o, d) < 320) pack++;
    return (G.day >= 5 && pack >= 6) || G.fire.fuel < 18;
  }
  if (d.type === 'dev') return G.fire.fuel < 40 || d.rush > 0;
  if (d.type === 'yelken') return G.fire.fuel < 30 || d.rush > 0;
  if (d.type === 'geceavcisi') { if (d.rush > 0) return true; let pack = 0; for (const o of G.dinos) if (o.type === 'geceavcisi' && !o.leave && dist(o, d) < 260) pack++; return (G.day >= 5 && pack >= 6) || G.fire.fuel < 25; }
  return false;
}

function bloodStain(x, y, r) { G.stains.push({ x, y, r, life: 110 }); if (G.stains.length > 220) G.stains.splice(0, G.stains.length - 220); }
function updDino(d, dt, prey, zones) {
  // yaralı hayvan kan kaybeder: yerde iz bırakır (yaralı avı izle)
  if (!d.tamed && d.hp > 0 && d.hp < d.maxhp * 0.7) {
    d.bleedT = (d.bleedT || 0) - dt;
    if (d.bleedT <= 0) { const sev = 1 - d.hp / d.maxhp; d.bleedT = (d.moving ? 0.5 : 1.6) * (1.3 - sev); bloodStain(d.x + rand(-4, 4), d.y + rand(-4, 4), rand(2.5, 5) * clamp(d.r / 22, 0.7, 2.2));
      G.parts.push({ x: d.x, y: d.y, vx: rand(-12, 12), vy: rand(-12, 12), life: 0.6, col: '#7a0d0d', s: 3, blood: 1, drip: 1 }); }
  }
  d.atkCd -= dt; d.hurt = Math.max(0, d.hurt - dt); d.blink -= dt; if (d.blink < -0.15) d.blink = rand(1.5, 5);
  d.trapCd = Math.max(0, d.trapCd - dt); d.rush = Math.max(0, d.rush - dt); if (d.scouted > 0) d.scouted -= dt; d.frill = Math.max(0, (d.frill || 0) - dt);
  if (d.poison > 0) {
    d.poison -= dt; d.hp -= 6 * dt;
    if (Math.random() < dt * 5) G.parts.push({ x: d.x + rand(-d.r, d.r), y: d.y, vx: 0, vy: -30, life: 0.6, col: '#7c3', s: 3 });
    if (d.hp <= 0) { killDino(d, L); return; }
  }
  if (d.mounted) return;
  if (d.type === 'bozkirat') return updBozkirat(d, dt);
  if (d.type === 'boynuzlu') return updHerb(d, dt);
  if (d.type === 'uzunboyun') return updLong(d, dt);
  if (d.type === 'kanatli') return updFlyer(d, dt);
  if (d.type === 'batakci') return updCroc(d, dt, prey);
  if (d.type === 'yamyam') return updCannibal(d, dt, prey);
  if (d.type === 'ordek' || d.type === 'gurleyen' || d.type === 'zirhli') return updGrazer(d, dt);
  if (d.type === 'taklitci') return updMimicC(d, dt, prey);
  if (d.type === 'kesici') return updKesici(d, dt, prey);
  if (d.pet) return updPet(d, dt);
  return updPred(d, dt, prey, zones);
}

// ---- ses ve gizlilik
// kişinin çıkardığı gürültü: 0 (çömelip duran) … 1 (koşan); yağmur sesi bastırır
// Rüzgârın açısı, estiği yönü gösterir. Koku noktaları kısa ömürlü ve sınırlıdır. (Codex)
function updScent(dt) {
  if (!G.wind) G.wind = { a: rand(0, TAU), s: 0.55, ta: rand(0, TAU), ts: 0.55, t: 0 };
  if (!G.scents) G.scents = [];
  const w = G.wind;
  w.t -= dt;
  if (w.t <= 0) { w.t = rand(12, 25); w.ta = w.a + rand(-0.8, 0.8); w.ts = rand(0.3, 1); }
  w.a = angLerp(w.a, w.ta, Math.min(1, dt * 0.035));
  w.s += (w.ts - w.s) * Math.min(1, dt * 0.08);
  // Yağmur eski izi yıkar; kar biraz daha uzun tutar (Codex). Yağış sorgusu iz başına saniyede bir.
  for (const q of G.scents) {
    q.washT = (q.washT || 0) - dt;
    if (q.washT <= 0) { q.washT = 1; const local = typeof precipAt === 'function' ? precipAt(q.x, q.y) : null; q.washRate = local === 'yagmur' ? (G.weather && G.weather.type === 'firtina' ? 5 : 3) : local === 'kar' ? 0.8 : 1; }
    q.age += dt * q.washRate;
  }
  G.scents = G.scents.filter(q => q.age < 24 && q.src && !q.src.dead);
  for (const p of G.people) {
    if (p.dead || p.inHut || p.insideB || p.grabbed || guardSafe(p)) continue;
    p.scentT = (p.scentT || 0) - dt;
    const moving = p.moving || p.sprinting;
    if (p.scentT > 0 || (!moving && Math.random() > dt * 0.12)) continue;
    const strong = (p.haul === 'et' || p.haul === 'cigEt' ? 1.7 : 1) * (p.hp < p.maxhp * 0.5 ? 1.65 : 1);
    p.scentT = (moving ? rand(0.65, 1.05) : rand(1.8, 2.8)) / strong;
    G.scents.push({ x: p.x + rand(-5, 5), y: p.y + rand(-5, 5), age: 0, power: strong, src: p });
  }
  if (G.scents.length > 200) G.scents.splice(0, G.scents.length - 200);
}
// Pozitif "along": hayvan rüzgâr altında; negatif: rüzgâr üstünde.
function scentReach(d, src, base, power) {
  if (!G.wind || !src || guardSafe(src)) return 0;
  const dx = d.x - src.x, dy = d.y - src.y, dd = Math.hypot(dx, dy) || 1;
  const wx = Math.cos(G.wind.a), wy = Math.sin(G.wind.a);
  const down = clamp((dx * wx + dy * wy) / dd, -1, 1);
  const cross = Math.abs(dx * wy - dy * wx);
  const plume = base * (0.42 + G.wind.s * 0.38) * (down > 0 ? 1 + down * 1.25 : 1 + down * 0.55) * (power || 1);
  if (cross > plume * (0.3 + Math.max(0, down) * 0.55)) return 0;
  return plume;
}
function smellsP(d, p, base) {
  if (!p || p.dead || p.inHut || p.insideB || p.grabbed || guardSafe(p)) return false;
  let power = 1;
  if (p.haul === 'et' || p.haul === 'cigEt') power *= 1.7;
  if (p.hp < p.maxhp * 0.5) power *= 1.65;
  return dist(d, p) < scentReach(d, p, base, power);
}
// En güçlü taze izi seçer; yaşlı izler zayıflar ve kaybolur.
function scentTrailFor(d, base) {
  if (!G.scents || !G.scents.length || !G.wind) return null;
  let best = null, bestScore = 0;
  for (let i = G.scents.length - 1; i >= 0; i--) {
    const q = G.scents[i];
    if (!q.src || q.src.dead || guardSafe(q.src)) continue;
    if (d.terr && Math.hypot(q.x - d.terr.x, q.y - d.terr.y) > d.terr.r) continue;
    const freshness = clamp(1 - q.age / 24, 0, 1);
    if (freshness <= 0) continue;
    const reach = scentReach(d, q, base * freshness, q.power), dd = Math.hypot(d.x - q.x, d.y - q.y);
    if (dd >= reach) continue;
    const score = freshness * q.power * (1 - dd / Math.max(1, reach));
    if (score > bestScore) { bestScore = score; best = q; }
  }
  return best;
}
function noiseOf(p) {
  if (!p || p.dead) return 0;
  let n;
  if (p.type) n = p.moving ? 0.6 : 0.2;                               // evcil yaratık
  else if ((p === L && G.mount) || p.mounted) n = 0.9;
  else if (p.sprinting) n = 1;
  else if (p.sneak) n = p.moving ? 0.2 : 0;
  else n = p.moving ? 0.6 : 0.25;
  const w = G.weather && G.weather.type;
  if (w === 'yagmur' || w === 'firtina') n *= 0.7;
  else if (w === 'kar') n *= 0.8;   // kar sesi yutar
  return n;
}
// görüş: yaratığın önündeki ~120° koni; çömelen daha zor, ovanın uzun otlarında çömelen neredeyse görünmez
function seesP(d, p, range) {
  let r = range;
  if (p.sneak && !p.sprinting) { r *= 0.5; if (biomeFast(p.x, p.y) === 4) r = Math.min(r, 70); }
  const dx = p.x - d.x, dy = p.y - d.y, dd = Math.hypot(dx, dy);
  return dd < r && angDiff(d.ang, Math.atan2(dy, dx)) < Math.PI / 3;
}
// yırtıcı bu kişiyi fark eder mi: duyarak, önündeyse görerek, çok yakındaysa kokusundan
function predNotices(d, t, dd, sense) {
  return dd < sense * noiseOf(t) || dd < Math.max(60, sense * 0.22 * (t.sneak ? 0.6 : 1)) || smellsP(d, t, sense * 0.72) || seesP(d, t, sense * 0.55);
}
// kamptan uzaklığa ve biyoma göre vahşilik: 0 kamp çevresi … ~1 derin orman/sis
function wildness(x, y) {
  const dc = Math.hypot(x - G.fire.x, y - G.fire.y), k = clamp((dc - 1900) / 1600, 0, 1);
  const b = biomeFast(x, y);
  return k * (b === 0 ? (dc > 3200 ? 1 : 0.6) : b === 1 ? 0.9 : b === 2 ? 1 : b === 3 ? 1.2 : b === 4 ? 0.45 : b === 5 ? 0.25 : 0);
}

function updPred(d, dt, prey, zones) {
  const def = DINO[d.type], night = isNight() || !!G.finale;
  if (d.mother) { d.motherT -= dt; if (d.motherT <= 0) d.mother = false; }
  if (d.siege) {
    const b = d.siege;
    if (b.dead || !isNight()) { d.siege = null; d.leave = true; return; }
    if (dist(d, b) > d.r + b.r + 6) {
      steer(d, b.x, b.y, def.spd * 0.8, dt, true); d.anim += dt * 10;
      if (d.bash && d.atkCd <= 0) { const f = d.bash; d.atkCd = def.cd; f.hp -= def.dmg; f.hit = 0.2; SFX.hit(L ? clamp(1 - dist(f, L) / 700, 0, 0.5) : 0.2); if (f.hp <= 0) destroyBuild(f); }
    } else if (d.atkCd <= 0) {
      d.atkCd = def.cd; b.hp -= def.dmg * 1.5; b.hit = 0.2; G.shake = Math.max(G.shake, L && dist(b, L) < 500 ? 4 : 0);
      SFX.hit(L ? clamp(1 - dist(b, L) / 900, 0.05, 0.6) : 0.2);
      if (b.hp <= 0) destroyBuild(b);
      else if (Math.random() < 0.25) for (const q of b.occ.slice()) { leaveHut(q); q.fear = Math.min(100, q.fear + 40); }
    }
    return;
  }
  if (d.retreat > 0) { d.retreat -= dt; const fr = d.tgt && !d.tgt.dead ? d.tgt : G.fire, a = angTo(fr, d); steer(d, d.x + Math.cos(a) * 100, d.y + Math.sin(a) * 100, def.spd, dt, true); d.anim += dt * 12; return; }
  // karanlıkta duran bir çift göz: yalnızca izler, yaklaşılınca kaybolur
  if (d.watcher > 0) {
    d.watcher -= dt; d.moving = false; d.ang = angLerp(d.ang, angTo(d, G.fire), Math.min(1, dt * 2));
    if (d.watcher <= 0 || !isNight() || d.hurt > 0 || G.people.some(p => !p.inHut && !p.insideB && Math.hypot(p.x - d.x, p.y - d.y) < 300)) { d.watcher = 0; d.leave = true; }
    return;
  }
  if (d.type === 'geceavcisi' && !isNight() && !G.finale) d.leave = true;
  if (d.type === 'yelken' && d.home && d.tgt && !d.tgt.dead && Math.hypot(d.tgt.x - d.home.x, d.tgt.y - d.home.y) > 750) { d.tgt = null; d.wx = d.home.x; d.wy = d.home.y; }
  if (d.type === 'yelken' && L) { d.growlT = (d.growlT || rand(5, 10)) - dt; if (d.growlT <= 0) { d.growlT = rand(10, 20); const dd = dist(d, L); if (dd < 1100) SFX.growl(clamp(1 - dd / 1100, 0.1, 0.9), panOf(d.x)); } }
  if (d.type === 'geceavcisi' && L && Math.random() < dt * 0.15 && dist(d, L) < 800) SFX.chitter(clamp(1 - dist(d, L) / 800, 0.05, 0.5), panOf(d.x));
  // dev ayak sesleri ve kükreme
  if (d.type === 'dev' && L) {
    if (d.moving) { d.stepT -= dt * (d.spdNow || def.spd) / def.spd; if (d.stepT <= 0) { d.stepT = 0.75; const dd = dist(d, L); if (dd < 1300) { const v = 1 - dd / 1300; SFX.thump(0.5 * v * v + 0.03); G.shake = Math.max(G.shake, 7 * v * v); } } }
    d.roarT -= dt;
    if (d.roarT <= 0) { d.roarT = rand(9, 18); const dd = dist(d, L); SFX.roar(clamp(1 - dd / 2200, 0.1, 1), panOf(d.x)); if (dd < 900) for (const p of G.people) p.fear = Math.min(100, p.fear + 15 * (1 - dd / 900)); }
  }
  // ağzında kurban
  if (d.carry) {
    const v = d.carry, a = angTo(G.fire, d);
    steer(d, d.x + Math.cos(a) * 200, d.y + Math.sin(a) * 200, def.spd * 1.15, dt, true); d.anim += dt * 6;
    v.x = d.x + Math.cos(d.ang) * d.r * 1.3; v.y = d.y + Math.sin(d.ang) * d.r * 1.3;
    if (Math.random() < dt * 0.6 && L) SFX.scream(clamp(1 - dist(d, L) / 1300, 0.08, 0.6), panOf(d.x));
    if (dist(d, G.fire) > 1400 && (!L || dist(d, L) > 700)) {
      msg(`${gen(v.name)} çığlıkları karanlıkta kesildi...`, '#c88', 6);
      v.grabbed = false; d.carry = null; killPerson(v, d, true); removeDino(d);
    }
    return;
  }
  if (d.leave && !d.mother) {
    const a = angTo(G.fire, d); d.spdNow = def.spd * 0.9;
    steer(d, d.x + Math.cos(a) * 200, d.y + Math.sin(a) * 200, d.spdNow, dt, true); d.anim += dt * 8;
    if (!L || (dist(d, L) > 1500 && dist(d, G.fire) > 1300)) removeDino(d);
    return;
  }
  // hedef seçimi
  d.think -= dt;
  const bold = isBold(d);
  if (d.think <= 0) {
    d.think = rand(0.35, 0.7);
    let sense = night ? def.nsense : def.sense;
    if (G.weather.type === 'sis') sense *= 0.7;
    if (d.mother || d.finale) sense = 2000;
    let best = null, bs = 1e9;
    if (d.mother && G.carryEgg && L) best = L;
    else for (const t of prey) {
      const dd = dist(d, t); if (dd > sense) continue;
      // sessiz yürüyeni duymaz; ama önündeyse görür
      if (!t.type && !t.isRescue && d.tgt !== t && !(d.rush > 0) && !d.finale && !predNotices(d, t, dd, sense)) continue;
      // bölgesel yırtıcı kendi topraklarından çıkmaz
      if (d.terr && !(d.rush > 0) && Math.hypot(t.x - d.terr.x, t.y - d.terr.y) > d.terr.r) continue;
      // küçükler ürkektir: yalnız gecede tek kalanı ya da yaralıyı kollar
      if (d.type === 'kucuk' && !bold && !t.type && !(t.downed > 0) && !(night && alliesNear(t, 220) === 0)) continue;
      let s = dd; if (!bold && inSafe(t.x, t.y, zones)) s += 500; if (t.tamed && d.type === 'kucuk') s += 800;
      if ((d.type === 'kucuk' || d.type === 'tukurgec') && !bold && (dist(t, G.fire) < 450 || alliesNear(t, 160) >= 2)) continue;
      if (t.leader) s += 40;
      if (t.downed > 0) s -= 120;
      if (s < bs) { bs = s; best = t; }
    }
    if (!best && d.type === 'dev' && bold) for (const b of G.builds) if (b.type === 'cadir' && b.occ.length) { const s = dist(d, b); if (s < sense) { best = b; break; } }
    if (best && !d.engaged) {
      d.engaged = true;
      if (!d.silent)
      if (L && dist(d, L) < 1000) { const v = clamp(1 - dist(d, L) / 1000, 0.1, 0.8); if (d.type === 'yirtici') SFX.screech(v, panOf(d.x)); else if (d.type === 'kucuk') SFX.chirp(v, panOf(d.x)); }
    }
    d.tgt = best;
    d.scent = best ? null : scentTrailFor(d, sense * 0.9);
    if (!d.terr && d.type === 'yirtici' && night && G.day >= 3 && Math.random() < 0.004 * G.day * DIFF[G.diff].spawn) d.rush = rand(2, 4);
    if (d.type === 'dev' && night && G.day >= 4 && Math.random() < 0.01) d.rush = rand(5, 9);
  }
  if (d.terr && d.tgt && !(d.rush > 0) && Math.hypot(d.tgt.x - d.terr.x, d.tgt.y - d.terr.y) > d.terr.r * 1.25) { d.tgt = null; d.engaged = false; }
  const t = !t_dead(d.tgt) ? d.tgt : null;
  let tx, ty, spd = def.spd * (d.mother ? 1.15 : 1);
  if (t) {
    const tSafe = !bold && inSafe(t.x, t.y, zones);
    if (tSafe) {
      const z = tSafe, a0 = Math.atan2(d.y - z.y, d.x - z.x) + d.orbit * dt * (d.type === 'dev' ? 0.12 : 0.35);
      const rr = z.r + d.r + 40 + Math.sin(G.now * 0.7 + d.id) * 25;
      tx = z.x + Math.cos(a0) * rr; ty = z.y + Math.sin(a0) * rr; spd = def.spd * 0.45;
      if (Math.random() < dt * 0.1) d.orbit *= -1;
      if (d.type === 'yirtici' && Math.random() < dt * 0.04 && L && dist(d, L) < 800) SFX.screech(0.15, panOf(d.x));
    } else {
      tx = t.x; ty = t.y;
      if (d.type === 'yirtici') { const side = (d.id % 3 - 1) * 0.6, dd = dist(d, t); if (dd > 120) { const a = angTo(t, d) + side; tx = t.x + Math.cos(a) * dd * 0.5; ty = t.y + Math.sin(a) * dd * 0.5; } }
      const reach = d.r + bodyR(t) + 8, dd = dist(d, t);
      d.spitCd = (d.spitCd || 0) - dt;
      if (d.type === 'tukurgec' && dd > 70 && dd < 240 && d.spitCd <= 0) {
        d.spitCd = rand(2.5, 4); d.frill = 0.7; d.ang = angTo(d, t);
        const a = angTo(d, t); G.eproj.push({ x: d.x + Math.cos(a) * d.r, y: d.y + Math.sin(a) * d.r, vx: Math.cos(a) * 330, vy: Math.sin(a) * 330, dmg: 5, life: 0.9, src: d });
        SFX.spit(volOf(d, 700) + 0.05, panOf(d.x)); tx = undefined; d.moving = false;
      } else if (dd < reach) {
        d.moving = false; d.ang = angLerp(d.ang, angTo(d, t), Math.min(1, dt * 8));
        if (d.atkCd <= 0) dinoAttack(d, t);
        tx = undefined;
      }
    }
  } else if (d.scent && d.scent.age < 24 && d.scent.src && !d.scent.src.dead && !guardSafe(d.scent.src) && Math.hypot(d.scent.x - d.x, d.scent.y - d.y) > 18) {
    tx = d.scent.x; ty = d.scent.y; spd = def.spd * (0.3 + 0.25 * clamp(1 - d.scent.age / 24, 0, 1));   // koku izini takip (Codex)
  } else {
    d.scent = null;
    d.wt -= dt;
    if (d.wt <= 0 || Math.hypot(d.wx - d.x, d.wy - d.y) < 20) {
      d.wt = rand(3, 8);
      if (d.terr) { const a = rand(0, TAU), r = rand(0, d.terr.r * (night ? 0.75 : 0.5)); d.wx = d.terr.x + Math.cos(a) * r; d.wy = d.terr.y + Math.sin(a) * r; }
      else if (night) { const a = rand(0, TAU), r = fireR() + rand(150, 500); d.wx = G.fire.x + Math.cos(a) * r; d.wy = G.fire.y + Math.sin(a) * r; }
      else { d.wx = d.x + rand(-400, 400); d.wy = d.y + rand(-400, 400); }
      if (isSea(d.wx, d.wy)) { d.wx = (d.wx + G.fire.x) / 2; d.wy = (d.wy + G.fire.y) / 2; }
    }
    tx = d.wx; ty = d.wy; spd = def.spd * 0.4;
  }
  if (tx !== undefined) {
    d.spdNow = spd;
    steer(d, tx, ty, spd, dt, true); d.anim += dt * spd / 22;
    for (const z of zones) { if (bold && !z.guard) continue; const dx = d.x - z.x, dy = d.y - z.y, dd = Math.hypot(dx, dy) || 1; if (dd < z.r) { d.x = z.x + dx / dd * z.r; d.y = z.y + dy / dd * z.r; } }
    if (d.bash && d.atkCd <= 0 && ((t && !inSafe(t.x, t.y, zones)) || d.type === 'dev' || bold)) { const b = d.bash; d.atkCd = def.cd; b.hp -= def.dmg * (d.type === 'dev' ? 2 : 1); b.hit = 0.2; SFX.hit(L ? clamp(1 - dist(b, L) / 700, 0, 0.5) : 0.2); if (b.hp <= 0) destroyBuild(b); }
  }
  checkTraps(d);
}
function checkTraps(d) {
  if (d.trapCd > 0 || d.fly) return;
  for (const b of G.builds) if (b.type === 'tuzak' && b.built && Math.hypot(b.x - d.x, b.y - d.y) < b.r + d.r) {
    d.trapCd = 1; hurt(d, 45, null); b.uses--; SFX.hit(0.5);
    if (d.type === 'kucuk') d.leave = true;
    if (b.uses <= 0) { b.dead = true; G.builds.splice(G.builds.indexOf(b), 1); }
    break;
  }
}
function dinoAttack(d, t) {
  const def = DINO[d.type]; d.atkCd = def.cd * rand(0.85, 1.15);
  if (t.kind === 'build') { t.hp -= def.dmg * 2; t.hit = 0.2; G.shake = Math.max(G.shake, 4); SFX.hit(0.5); if (t.hp <= 0) destroyBuild(t); return; }
  if (t.isRescue) { hurt(t, def.dmg, d); return; }
  if (d.type === 'dev' && !t.leader && !t.type && Math.random() < 0.55) {
    t.grabbed = true; t.grabT = 12; t.downed = 0; d.carry = t; d.carryDmg = 0;
    if (t.tgt && t.tgt.claim === t) t.tgt.claim = null;
    msg(`DEV KAFA ${acc(t.name).toLocaleUpperCase('tr')} KAPTI!! Peşinden git ve vur!`, '#ff5040', 6);
    SFX.scream(1); SFX.roar(0.8); G.shake = 14;
    for (const p of G.people) p.fear = Math.min(100, p.fear + 30);
    return;
  }
  hurt(t, (d.pet ? 5 + 10 * d.growth : def.dmg) * rand(0.8, 1.2), d);
  if (d.hitrun) { d.leave = true; d.rush = 0; }
  if (L && dist(d, L) < 700) SFX.hit(0.4);
  if (d.type === 'yirtici' && Math.random() < 0.3) { const a = angTo(t, d); d.x += Math.cos(a) * 30; d.y += Math.sin(a) * 30; }
  if (d.type === 'geceavcisi') d.retreat = rand(0.8, 1.6);
}

// ---- otoburlar
function nearestFoeOf(center, range, self) {
  let foe = null, fd = 1e9;
  for (const o of G.dinos) { if (o === self || !hostile(o)) continue; const dc = dist(o, center); if (dc < range) { const dd = dist(o, self); if (dd < fd) { fd = dd; foe = o; } } }
  return foe;
}
function updHerb(d, dt) {
  const def = DINO.boynuzlu;
  if (d.ko > 0) { d.ko -= dt; d.moving = false; if (d.ko <= 0) { d.angry = 10; msg('Boynuzlu ayıldı... ve çok öfkeli.', '#fc9', 3); } return; }
  if (d.tamed) {
    d.hp = Math.min(d.maxhp, d.hp + 1.5 * dt);
    const foe = nearestFoeOf(G.fire, Math.max(fireR(), 200) + 250, d);
    if (foe) {
      if (dist(d, foe) > d.r + foe.r + 10) { steer(d, foe.x, foe.y, def.spd * 1.8, dt, true); d.anim += dt * 8; }
      else if (d.atkCd <= 0) { d.atkCd = def.cd; hurt(foe, def.dmg + 8, d); const a = angTo(d, foe); foe.x += Math.cos(a) * 20; foe.y += Math.sin(a) * 20; SFX.hit(0.5); }
      return;
    }
    d.wt -= dt; if (d.wt <= 0) { d.wt = rand(4, 9); const a = rand(0, TAU), r = rand(120, 220); d.wx = G.fire.x + Math.cos(a) * r; d.wy = G.fire.y + Math.sin(a) * r; }
    if (Math.hypot(d.wx - d.x, d.wy - d.y) > 10) { steer(d, d.wx, d.wy, def.spd * 0.5, dt, true); d.anim += dt * 3; } else d.moving = false;
    return;
  }
  if (d.angry > 0) {
    d.angry -= dt; const t = d.tgt;
    if (!t_dead(t)) {
      if (dist(d, t) > d.r + bodyR(t) + 6) { steer(d, t.x, t.y, def.spd * 2.3, dt, true); d.anim += dt * 10; }
      else if (d.atkCd <= 0) { d.atkCd = def.cd; hurt(t, def.dmg, d); if (!t.type) { const a = angTo(d, t); t.x += Math.cos(a) * 40; t.y += Math.sin(a) * 40; pushOut(t, false); } SFX.thump(0.4); }
      return;
    }
  }
  if (isNight() && dist(d, G.fire) < 1800) d.leave = true;
  if (d.leave) { const a = angTo(G.fire, d); steer(d, d.x + Math.cos(a) * 100, d.y + Math.sin(a) * 100, def.spd, dt, true); d.anim += dt * 4; if (!L || dist(d, L) > 1600) removeDino(d); return; }
  if (fleeStep(d, dt, 1.8)) return;
  if (preyAware(d, dt)) return;
  wanderSlow(d, dt, def.spd * 0.45);
}
// ---- kaçış: tehditten uzağa (denize değil), sürü halinde
function fleeStep(d, dt, mul) {
  d.fleeing = d.flee > 0;
  if (!d.fleeing) return false;
  d.flee -= dt;
  const from = d.fleeFrom && !d.fleeFrom.dead ? d.fleeFrom : G.fire;
  let a = angTo(from, d) + Math.sin(G.now + d.id) * 0.3;
  for (let k = 0; k < 6; k++) { const aa = a + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.6; if (!isSea(d.x + Math.cos(aa) * 220, d.y + Math.sin(aa) * 220)) { a = aa; break; } }
  steer(d, d.x + Math.cos(a) * 200, d.y + Math.sin(a) * 200, DINO[d.type].spd * mul, dt, true); d.anim += dt * 12;
  if (d.flee <= 0) { d.fleeing = false; d.calmT = rand(3, 6); }
  return true;
}
// ---- av hayvanının kulakları ve gözleri
const PREY_HEAR = { bozkirat: 580, ordek: 420, gurleyen: 450, boynuzlu: 420, zirhli: 400, uzunboyun: 520 };
function preyNotices(d, p, dd) {
  const hear = PREY_HEAR[d.type] || 440;
  if (dd < hear * noiseOf(p)) return true;
  if (smellsP(d, p, hear * 0.65)) return true;
  const sr = 380 * (isNight() ? 0.55 : 1) * (G.weather && G.weather.type === 'sis' ? 0.6 : 1);
  return seesP(d, p, sr);
}
// önce başını kaldırıp sese bakar (~1.2 sn, d.alert = zaman), sonra sürüce kaçar ya da (sıkışınca) saldırır
function preyAware(d, dt) {
  if (d.alertT > 0) {
    d.alertT -= dt; d.moving = false;
    const s = d.alertSrc;
    if (s && !s.dead) d.ang = angLerp(d.ang, angTo(d, s), Math.min(1, dt * 5));
    if (d.alertT <= 0) {
      const dd = s && !s.dead && !s.inHut && !s.insideB ? dist(d, s) : 1e9;
      if (dd < 140 || (dd < 1e8 && preyNotices(d, s, dd * 0.8))) preyReact(d, s, dd);
      else { d.alert = 0; d.alertSrc = null; d.calmT = 1.5; }        // boş alarm: otlamaya döner
    }
    return true;
  }
  if (d.calmT > 0) d.calmT -= dt;
  if (d.alert && !(d.flee > 0) && !(d.angry > 0) && G.now - d.alert > 9) d.alert = 0;
  d.lookT = (d.lookT || 0) - dt;
  if (d.lookT > 0 || d.calmT > 0) return false;
  d.lookT = rand(0.2, 0.35);
  let thr = null, td = 1e9;
  for (const p of G.people) {
    if (p.inHut || p.bed || p.insideB || p.grabbed || p.dead) continue;
    const dd = dist(p, d); if (dd < 600 && dd < td && preyNotices(d, p, dd)) { thr = p; td = dd; }
  }
  if (!thr) for (const o of G.dinos) if (!o.tamed && !o.hidden && !o.watcher && DINO[o.type].pred && o.campI === undefined && dist(o, d) < 300) { thr = o; td = dist(o, d); break; }
  if (!thr) return false;
  if (thr.type || td < 60) { preyReact(d, thr, td); return d.flee > 0 || d.angry > 0; }
  d.alert = G.now || 0.01; d.alertT = 1.2; d.alertSrc = thr; d.moving = false;
  return true;
}
function preyReact(d, src, dd) {
  d.alert = G.now || 0.01; d.alertT = 0;
  const near = dist(d, G.fire) > 500;
  if (d.type === 'gurleyen' && !src.type && dd < 160 && near) { d.angry = 6; d.tgt = src; SFX.honk(volOf(d, 700) * 0.6, panOf(d.x)); return; }
  if (d.type === 'zirhli' && dd < 140) { d.angry = 6; d.tgt = src; return; }
  if (d.type === 'boynuzlu' && dd < 100 && !src.type && near) { d.angry = 8; d.tgt = src; return; }
  alarmHerd(d, src);
}
function wanderSlow(d, dt, spd) {
  d.wt -= dt;
  if (d.wt <= 0) {
    d.wt = rand(5, 12) * (isNight() ? 2 : 1);
    const c = d.terr && Math.hypot(d.x - d.terr.x, d.y - d.terr.y) > d.terr.r * 0.7 ? d.terr : d;
    d.wx = c.x + rand(-300, 300); d.wy = c.y + rand(-300, 300);
    if (Math.hypot(d.wx - CAMP.x, d.wy - CAMP.y) < 450) { d.wx += 450; }
    if (isSea(d.wx, d.wy)) { d.wx = d.x + (CAMP.x - d.x) * 0.05; d.wy = d.y + (CAMP.y - d.y) * 0.05; }
  }
  if (isNight()) spd *= 0.5;                                      // gece sürü dinlenir
  if (Math.hypot(d.wx - d.x, d.wy - d.y) > 10) { steer(d, d.wx, d.wy, spd, dt, true); d.anim += dt * 3; } else d.moving = false;
}
function updLong(d, dt) {
  const def = DINO.uzunboyun;
  if (d.tamed) {
    d.hp = Math.min(d.maxhp, d.hp + 2 * dt);
    d.haulT = (d.haulT === undefined ? 40 : d.haulT) - dt;
    if (d.haulT <= 0) { d.haulT = 40; if (!isNight()) { addStock('wood', 3, d.x, d.y); addStock('stone', 2, d.x, d.y + 16); } }
    d.wt -= dt; if (d.wt <= 0) { d.wt = rand(8, 15); const a = rand(0, TAU), r = rand(280, 380); d.wx = G.fire.x + Math.cos(a) * r; d.wy = G.fire.y + Math.sin(a) * r; }
    if (Math.hypot(d.wx - d.x, d.wy - d.y) > 10) { steer(d, d.wx, d.wy, def.spd, dt, true); d.anim += dt * 2; } else d.moving = false;
    return;
  }
  if (d.angry > 0) {
    d.angry -= dt; const t = d.tgt;
    if (!t_dead(t)) {
      if (dist(d, t) < d.r + bodyR(t) + 40) {
        d.moving = false; d.ang = angLerp(d.ang, angTo(d, t) + Math.PI, Math.min(1, dt * 3));
        if (d.atkCd <= 0) { d.atkCd = def.cd; hurt(t, def.dmg, d); if (!t.type) { const a = angTo(d, t); t.x += Math.cos(a) * 60; t.y += Math.sin(a) * 60; pushOut(t, false); } SFX.thump(0.6); }
      } else { steer(d, t.x, t.y, def.spd * 1.4, dt, true); d.anim += dt * 4; }
      return;
    }
  }
  if (fleeStep(d, dt, 1.5)) return;
  if (preyAware(d, dt)) return;
  wanderSlow(d, dt, def.spd * 0.6);
}
function updFlyer(d, dt) {
  const def = DINO.kanatli;
  if (d.tamed) {
    d.alt = Math.min(1, d.alt + dt);
    d.oa = (d.oa || 0) + dt * 0.45;
    flyTo(d, G.fire.x + Math.cos(d.oa) * 260, G.fire.y + Math.sin(d.oa) * 260, def.spd, dt);
    d.scoutT = (d.scoutT || 0) - dt;
    if (d.scoutT <= 0) {
      d.scoutT = 2; let n = 0, sx = 0, sy = 0;
      for (const o of G.dinos) {
        if (o.tamed || !DINO[o.type].pred || o.leave || o.watcher) continue;
        const dd = dist(o, G.fire);
        if (dd < 1150 && dd > fireR() + 40) { o.scouted = 6; if (o.type !== 'kucuk') { n++; sx += o.x; sy += o.y; } }
      }
      if (n && G.scoutCd <= 0) { G.scoutCd = 25; msg(`🦅 Kanatlı çığlık atıyor: ${compass(Math.atan2(sy / n - G.fire.y, sx / n - G.fire.x))} yönünden ${n} yırtıcı yaklaşıyor!`, '#9cf', 5); SFX.chirp(0.5); }
    }
    return;
  }
  if (isNight() && !d.leave) { d.leave = true; d.st = 'fly'; }
  if (d.leave) { d.alt = Math.min(1, d.alt + dt); const a = angTo(G.fire, d); flyTo(d, d.x + Math.cos(a) * 200, d.y + Math.sin(a) * 200, def.spd, dt); if (!L || dist(d, L) > 1600) removeDino(d); return; }
  if (d.st === 'land') {
    d.alt = Math.max(0, d.alt - dt * 0.8); d.moving = false; d.landT -= dt;
    if (d.landT <= 0 || (L && dist(L, d) < 230 && L.sprinting) || d.hurt > 0) { d.st = 'fly'; SFX.flap(volOf(d, 700) * 0.6, panOf(d.x)); }
    return;
  }
  d.alt = Math.min(1, d.alt + dt);
  d.oa = (d.oa === undefined ? rand(0, TAU) : d.oa) + dt * 0.5 * d.orbit;
  if (!d.orR) d.orR = rand(180, 320);
  flyTo(d, d.home.x + Math.cos(d.oa) * d.orR, d.home.y + Math.sin(d.oa) * d.orR, def.spd * 0.7, dt);
  d.flyT -= dt;
  if (d.flyT <= 0) { d.flyT = rand(20, 35); d.st = 'land'; d.landT = rand(14, 26); }
}
function updCroc(d, dt, prey) {
  const def = DINO.batakci, h = d.home;
  if (!h) { removeDino(d); return; }
  if (d.st === 'hide') {
    d.hidden = true; d.moving = false;
    d.x += (h.x - d.x) * dt * 0.5; d.y += (h.y - d.y) * dt * 0.5;
    d.think -= dt;
    if (d.think <= 0) {
      d.think = 0.3;
      for (const t of prey) {
        if (t.type) continue;
        if (dist(t, d) < 150 && Math.hypot(t.x - h.x, t.y - h.y) < h.r + 130) {
          d.st = 'lunge'; d.lungeT = 4; d.tgt = t; d.hidden = false;
          SFX.splash(volOf(d, 900) + 0.1, panOf(d.x));
          if (!G.flags.croc) { G.flags.croc = 1; msg('Sudan bir şey fırladı! Bataklık havuzlarından uzak dur!', '#cf8', 5); }
          break;
        }
      }
    }
    return;
  }
  if (d.st === 'lunge') {
    d.lungeT -= dt; const t = d.tgt;
    if (t_dead(t) || d.lungeT <= 0 || Math.hypot(d.x - h.x, d.y - h.y) > h.r + 300) d.st = 'back';
    else {
      const reach = d.r + bodyR(t) + 6;
      if (dist(d, t) > reach) { steer(d, t.x, t.y, def.spd, dt, true); d.anim += dt * 12; }
      else { d.moving = false; if (d.atkCd <= 0) dinoAttack(d, t); }
    }
    return;
  }
  if (steer(d, h.x, h.y, def.spd * 0.5, dt, true) || Math.hypot(d.x - h.x, d.y - h.y) < 12) { d.st = 'hide'; d.think = 2; }
  d.anim += dt * 6;
}
function updPet(d, dt) {
  const g = d.growth || 0; d.r = 9 + 9 * g;
  let foe = null, fd = 260;
  for (const o of G.dinos) { if (o === d || !hostile(o)) continue; const dd = dist(o, L); if (dd < fd) { fd = dd; foe = o; } }
  if (foe) {
    if (dist(d, foe) > d.r + foe.r + 6) { steer(d, foe.x, foe.y, 240, dt, true); d.anim += dt * 12; }
    else { d.moving = false; if (d.atkCd <= 0) { d.atkCd = 0.8; hurt(foe, 5 + 10 * g, L); } }
    return;
  }
  const tx = L.x + Math.cos(L.ang + Math.PI * 0.75) * 40, ty = L.y + Math.sin(L.ang + Math.PI * 0.75) * 40;
  if (Math.hypot(d.x - tx, d.y - ty) > 14) { steer(d, tx, ty, dist(d, L) > 150 ? 280 : 190, dt, true); d.anim += dt * 12; } else d.moving = false;
}

// ---- yumurta
function takeEgg(n) {
  if (!n || !(n.eggs > 0)) return;
  n.eggs--; G.carryEgg = true;
  const count = 2 + (G.day >= 4 ? 1 : 0), guards = [];
  const existing = G.dinos.filter(d => d.type === 'yirtici' && !d.dead && !d.tamed && !d.carry && !d.siege && !d.finale && !d.mounted).sort((a, b) => dist(a, n) - dist(b, n));
  for (const d of existing.slice(0, count)) { if (!d.birthSource) d.birthSource = birthIsEvent(d) ? 'legacy-event' : 'normal'; d.mother = true; d.motherT = 80; d.tgt = L; d.leave = false; d.watcher = 0; d.retreat = 0; d.hitrun = false; d.rush = 80; d.engaged = true; guards.push(d); }
  for (let i = guards.length; i < count; i++) {
    if (birthRoom('yirtici', 'mother') < 1) break;
    const a = rand(0, TAU), d = mkDino('yirtici', n.x + Math.cos(a) * 320, n.y + Math.sin(a) * 320);
    d.mother = true; d.motherT = 80; d.tgt = L; d.rush = 80; pushOut(d, true);
    if (admitDino(d, 'mother')) guards.push(d);
  }
  SFX.screech(0.9, 0); setTimeout(() => SFX.screech(0.7, 0.5), 400);
  msg(guards.length ? 'Yumurtayı aldın! Anneler çığlık atıyor — kampa koş!' : 'Yumurtayı aldın. Ormandaki çığlıklar ürkütücü biçimde yaklaşıyor.', '#ffcf6a', 5);
}

// ---- doğurma
// Yuvalar dünya tohumundan yeniden üretildiği için ayrıca kaydedilmez.
function denHash(type, x, y) {
  let h = ((G.seed || 1) ^ (x * 374761393) ^ (y * 668265263) ^
    (type.length * 2246822519)) | 0;
  for (let i = 0; i < type.length; i++) h = Math.imul(h ^ type.charCodeAt(i), 1597334677);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function makeDen(type, biome, minH, r) {
  let best = null, bestScore = -1;
  for (let y = 240; y < WORLD - 240; y += 240) {
    for (let x = 240; x < WORLD - 240; x += 240) {
      if (Math.hypot(x - G.fire.x, y - G.fire.y) < 1900) continue;
      if (biomeFast(x, y) !== biome || isSea(x, y) || groundH(x, y) < minH) continue;
      if (G.lakes.some(l => Math.hypot(l.x - x, l.y - y) < l.r + 90)) continue;
      const score = denHash(type, x, y) + wildness(x, y) * 0.45;
      if (score > bestScore) {
        bestScore = score;
        best = { type, x, y, r, biome, prey: 0, predators: 0 };
      }
    }
  }
  return best;
}

function initDens() {
  if (G.dens && G.densFire === G.fire) return;
  G.dens = []; G.densFire = G.fire;
  const defs = [
    ['geceavcisi', 1, 250, 1050],
    ['yirtici', 0, 18, 1050],
    ['kesici', 3, 1, 1250]
  ];
  for (const q of defs) {
    const den = makeDen(q[0], q[1], q[2], q[3]);
    if (den) G.dens.push(den);
  }

  let pool = null, poolScore = -1;
  for (const p of G.pools) {
    if (Math.hypot(p.x - G.fire.x, p.y - G.fire.y) < 1900) continue;
    if (biomeFast(p.x, p.y) !== 2) continue;
    const score = denHash('batakci', p.x | 0, p.y | 0);
    if (score > poolScore) { poolScore = score; pool = p; }
  }
  if (pool) {
    G.dens.push({
      type: 'batakci', x: pool.x, y: pool.y,
      r: Math.max(850, pool.r + 500), biome: 2,
      prey: 0, predators: 0, pool
    });
  }
}

function denBalance(den) {
  let prey = 0, predators = 0;
  for (const d of G.dinos) {
    if (d.dead || d.tamed || d.leave || d.watcher || d.campI !== undefined) continue;
    if (DINO[d.type].herb && Math.hypot(d.x - den.x, d.y - den.y) < 1550) prey++;
    if (d.type === den.type && Math.hypot(d.x - den.x, d.y - den.y) < 1900) predators++;
  }
  den.prey = prey;
  den.predators = predators;
  den.roam = prey < 2 ? den.r * 1.55 : prey < 4 ? den.r * 1.25 : den.r;
  return den;
}

function denFor(type) {
  initDens();
  let best = null, bd = Infinity;
  for (const den of G.dens) {
    if (den.type !== type) continue;
    denBalance(den);
    const dd = L ? Math.hypot(den.x - L.x, den.y - L.y) : 0;
    if (dd < bd) { bd = dd; best = den; }
  }
  return best;
}

function bindDen(d, den) {
  d.den = den;
  d.terr = den ? { x: den.x, y: den.y, r: den.roam || den.r } : null;
}

function spawnPos(minR = 850, maxR = 1150, around) {
  const c = around || L;
  for (let k = 0; k < 30; k++) {
    const a = rand(0, TAU), r = rand(minR, maxR), x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r;
    if (x < 80 || y < 80 || x > WORLD - 80 || y > WORLD - 80 || isSea(x, y)) continue;
    if (Math.hypot(x - G.fire.x, y - G.fire.y) < Math.max(fireR(), 320) + 300) continue;
    if (G.lakes.some(l => Math.hypot(l.x - x, l.y - y) < l.r + 40)) continue;
    return { x, y };
  }
  return null;
}
function spawnPosBiome(bs, minR, maxR) {
  for (let k = 0; k < 12; k++) { const p = spawnPos(minR, maxR); if (p && bs.includes(biomeFast(p.x, p.y))) return p; }
  return null;
}
function spawnPack(type, n, pos, source = 'normal') {
  if (pos === undefined) pos = spawnPos();
  if (!pos || !Number.isFinite(n)) return [];
  const out = [], count = Math.max(0, Math.min(Math.floor(n), birthRoom(type, source)));
  for (let i = 0; i < count; i++) { const d = mkDino(type, pos.x + rand(-60, 60), pos.y + rand(-60, 60)); pushOut(d, true); if (!admitDino(d, source)) continue; d.herdL = out[0] || d; out.push(d); }
  return out;
}
function spawnFlyer(pos) {
  const d = mkDino('kanatli', pos.x, pos.y); d.home = { x: pos.x, y: pos.y }; d.alt = 1; d.st = 'fly'; d.flyT = rand(5, 20); return admitDino(d, 'normal') ? d : null;
}
function ambush(v, n, type, text) {
  type = type || 'yirtici';
  if (!v || !Number.isFinite(n)) return [];
  const count = Math.max(0, Math.min(Math.floor(n), birthRoom(type, 'ambush'))), out = [];
  if (!count) return out;
  const a = dist(v, G.fire) > 60 ? angTo(G.fire, v) + rand(-1.3, 1.3) : rand(0, TAU);
  for (let i = 0; i < count; i++) { const aa = a + rand(-0.7, 0.7), r = rand(160, 250), d = mkDino(type, v.x + Math.cos(aa) * r, v.y + Math.sin(aa) * r); pushOut(d, true); d.rush = 6; d.tgt = v; d.engaged = true; d.silent = true; if (admitDino(d, 'ambush')) out.push(d); }
  if (out.length) { jumpAt(v.x, v.y, text || 'PUSU!'); SFX.screech(L ? clamp(1 - dist(v, L) / 1000, 0.2, 1) : 0.4, panOf(v.x)); }
  return out;
}
// Yuva kaynaklı normal doğumlar: yerel kapasite ve bütün haritadaki tür sınırı.
function denSpawnRoom(type, n, den) {
  if (!den || den.prey < 2 || !Number.isFinite(n) || n < 1) return 0;
  if (type === 'geceavcisi' && (!isNight() || G.day < 2)) return 0;
  if (type === 'kesici' && G.day < 3) return 0;
  if (!['yirtici', 'geceavcisi', 'kesici'].includes(type)) return 0;
  const local = Math.max(1, Math.floor(den.prey / 3)) - den.predators;
  return Math.max(0, Math.min(Math.floor(n), local, birthRoom(type, 'den')));
}
// Merkez doğru biyomda; beden çevresinden beş örnek karada kalsın.
function denSpotOK(type, p, den) {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
  const radius = DINO[type].r || 0;
  if (p.x < 80 + radius || p.y < 80 + radius ||
      p.x > WORLD - 80 - radius || p.y > WORLD - 80 - radius) return false;
  if (Math.hypot(p.x - G.fire.x, p.y - G.fire.y) < 1900 + radius) return false;
  if (biomeFast(p.x, p.y) !== den.biome) return false;
  const minH = type === 'geceavcisi' ? 250 : type === 'yirtici' ? 18 : 1;
  if (groundH(p.x, p.y) < minH) return false;
  if (G.lakes.some(l => Math.hypot(l.x - p.x, l.y - p.y) < l.r + radius + 40)) return false;
  for (const v of [[0, 0], [radius, 0], [-radius, 0], [0, radius], [0, -radius]]) {
    if (isSea(p.x + v[0], p.y + v[1]) || groundH(p.x + v[0], p.y + v[1]) < 0.6) return false;
  }
  return true;
}
// spawnPack'ın ±60 saçılması yerine her bireyi son konumunda doğrula.
function spawnDenPack(type, n, den, minW) {
  const out = [];
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 12; k++) {
      const a = rand(0, TAU), rr = rand(35, 120);
      const p = { x: den.x + Math.cos(a) * rr, y: den.y + Math.sin(a) * rr };
      if (!denSpotOK(type, p, den) || wildness(p.x, p.y) < minW) continue;
      const d = mkDino(type, p.x, p.y), blocked = pushOut(d, true);
      if (blocked || !denSpotOK(type, d, den) || wildness(d.x, d.y) < minW) continue;
      d.wx = d.x; d.wy = d.y; d.herdL = out[0] || d;
      if (!admitDino(d, 'den')) { den.predators += out.length; return out; }
      bindDen(d, den); out.push(d);
      break;
    }
  }
  den.predators += out.length;
  return out;
}
// Bölgesel doğurma imzası korunur; senaryolu spawnPack/pusu akışları değişmez.
function spawnTerr(type, n, bs, minW, r = 1100, minR = 800, maxR = 1250) {
  if (type === 'yirtici' || type === 'geceavcisi' || type === 'kesici') {
    const den = denFor(type);
    if (!den || (L && Math.hypot(den.x - L.x, den.y - L.y) > 2100)) return [];
    const cap = denSpawnRoom(type, n, den);
    return cap > 0 ? spawnDenPack(type, cap, den, minW) : [];
  }
  for (let k = 0; k < 10; k++) {
    const p = spawnPos(minR, maxR); if (!p) continue;
    if (bs && !bs.includes(biomeFast(p.x, p.y))) continue;
    if (wildness(p.x, p.y) < minW) continue;
    const out = spawnPack(type, n, p), terr = { x: p.x, y: p.y, r };
    for (const d of out) d.terr = terr;
    return out;
  }
  return [];
}
// otlayan sürüler: önce ova, yoksa orman
function spawnHerd(type, n, bs, minR = 700, maxR = 1250) {
  for (const b of bs) {
    const p = spawnPosBiome([b], minR, maxR); if (!p) continue;
    const out = spawnPack(type, n, p), terr = { x: p.x, y: p.y, r: 900 };
    for (const d of out) d.terr = terr;
    return out;
  }
  return [];
}
function spawner() {
  initDens();
  for (const den of G.dens) denBalance(den);
  for (const d of G.dinos) {
    if (!d.den || d.dead || d.tamed) continue;
    denBalance(d.den);
    if (!d.terr) d.terr = { x: d.den.x, y: d.den.y, r: d.den.roam };
    else {
      d.terr.x = d.den.x;
      d.terr.y = d.den.y;
      d.terr.r = d.den.roam;
    }
  }

  const cnt = {}; for (const d of G.dinos) if (!d.tamed && (!d.leave || DINO[d.type].herb) && d.campI === undefined && !d.watcher) cnt[d.type] = (cnt[d.type] || 0) + 1;
  const c = k => cnt[k] || 0;
  const day = G.day, n = isNight(), sm = DIFF[G.diff].spawn, R = Math.random;
  if (!n && c('bozkirat') < 6 && R() < 0.025) spawnBozkirat(ri(2, 3));
  // ---- av hayvanları: yaygın, sürü halinde; ovada daha çok
  if (c('ordek') < 12 && R() < 0.12) spawnHerd('ordek', ri(4, 7), R() < 0.7 ? [4, 0] : [0, 4]);
  if (c('gurleyen') < 7 && R() < 0.05) spawnHerd('gurleyen', ri(3, 5), R() < 0.6 ? [4, 0, 1] : [0, 1]);
  if (c('boynuzlu') < 4 && R() < (n ? 0.02 : 0.1)) spawnHerd('boynuzlu', ri(1, 3), [4, 0, 2]);
  if (c('zirhli') < 3 && R() < 0.03) spawnHerd('zirhli', ri(1, 2), [4, 0]);
  if (c('uzunboyun') < 1 && R() < 0.006) spawnHerd('uzunboyun', 1, [4], 900, 1400);
  if (!n && c('kanatli') < 3 && R() < 0.15) { const pos = spawnPosBiome([1, 5], 500, 1100); if (pos) spawnFlyer(pos); }
  // ---- yırtıcılar: yerel av kapasitesi yoksa çoğalmaz; az avda daha geniş dolaşır
  if (c('kucuk') < (n ? 3 : 2) && R() < 0.04) spawnTerr('kucuk', ri(2, 3), null, 0.35, 900);

  const yd = denFor('yirtici');
  if (yd && yd.prey >= 2 && yd.predators < Math.min((n ? 4 : 3) * sm, Math.max(1, Math.floor(yd.prey / 3))) &&
      R() < (n ? 0.035 : 0.025)) {
    spawnTerr('yirtici', ri(1, 3), [0], 0.55);
  }

  const gd = denFor('geceavcisi');
  if (n && day >= 2 && gd && gd.prey >= 2 &&
      gd.predators < Math.min(Math.min(2 + day / 4, 5) * sm, Math.max(1, Math.floor(gd.prey / 3))) &&
      R() < 0.03) {
    spawnTerr('geceavcisi', ri(1, 2), [1], 0.6);
  }

  if (c('tukurgec') < (day >= 6 ? 2 : 1) && R() < 0.005 * sm) spawnTerr('tukurgec', 1, [0, 2], 0.8, 700);

  const kd = denFor('kesici');
  if (day >= 3 && kd && kd.prey >= 3 && kd.predators < 1 &&
      R() < (n ? 0.008 : 0.003) * sm) {
    for (const d of spawnTerr('kesici', 1, [3], 0.75, 1300)) d.silent = true;
  }

  if (day >= 4 && c('yelken') < 1 && R() < 0.0015 * sm) {
    const W = G.pools.concat(G.lakes).filter(w => { const d = Math.hypot(w.x - L.x, w.y - L.y); return d > 700 && d < 1500 && wildness(w.x, w.y) > 0.5; });
    if (W.length) { const w = pick(W), a = rand(0, TAU), d = mkDino('yelken', w.x + Math.cos(a) * (w.r + 40), w.y + Math.sin(a) * (w.r + 40)); d.home = { x: w.x, y: w.y }; pushOut(d, true); admitDino(d, 'normal'); }
  }

  const bd = denFor('batakci');
  if (bd && bd.pool && !bd.pool.croc && bd.prey >= 2 &&
      (!L || Math.hypot(bd.x - L.x, bd.y - L.y) < 1500) &&
      c('batakci') < 5 && R() < 0.3) {
    const pl = bd.pool, d = mkDino('batakci', pl.x, pl.y);
    d.home = pl; d.hidden = true; d.st = 'hide';
    if (admitDino(d, 'den')) { pl.croc = d; bindDen(d, bd); }
  }
  // nadir gündüz pususu: yalnızca vahşi topraklarda dolaşan birine
  if (!n && day >= 3 && R() < 0.004 * sm) {
    const far = G.people.filter(p => !p.inHut && !p.grabbed && !p.child && !p.downed && dist(p, G.fire) > 1800 && wildness(p.x, p.y) > 0.5);
    if (far.length) ambush(pick(far), ri(2, 3), 'yirtici');
  }
  // ---- gece: çoğu gece yalnızca uzak sesler ve arada bir karanlıkta bir çift göz
  if (n) {
    G.ambSndT = (G.ambSndT === undefined ? rand(15, 40) : G.ambSndT) - 1.5;
    if (G.ambSndT <= 0) {
      G.ambSndT = rand(25, 60); const v = rand(0.05, 0.14), pn = rand(-1, 1), k = R();
      if (k < 0.35) SFX.growl(v, pn); else if (k < 0.6) SFX.chitter(v * 1.5, pn); else if (k < 0.85) SFX.screech(v * 0.6, pn); else SFX.roar(v * 0.5, pn);
    }
    if (G.eyesDay !== day && R() < 0.008) {
      G.eyesDay = day;
      const a = rand(0, TAU), r = Math.max(fireR(), 300) + rand(480, 700), x = G.fire.x + Math.cos(a) * r, y = G.fire.y + Math.sin(a) * r;
      if (!isSea(x, y)) {
        const kk = R() < 0.6 ? 2 : 1;
        for (let i = 0; i < kk; i++) { const d = mkDino(R() < 0.7 ? 'yirtici' : 'kucuk', x + i * 40, y + i * 25); d.watcher = rand(20, 40); d.silent = true; d.engaged = true; pushOut(d, true); admitDino(d, 'watcher'); }
      }
    }
  }
}
function spawnDevEvent(sudden) {
  const pos = sudden ? spawnPos(480, 600, G.fire) : spawnPos(1100, 1300);
  if (!pos) return;
  const d = spawnPack('dev', 1, pos, 'dev-event')[0];
  if (!d) return;
  if (sudden) { d.rush = 5; jumpAt(d.x, d.y, 'DEV KAFA!'); SFX.roar(1, panOf(d.x)); }
  else { SFX.roar(0.5, panOf(pos.x)); msg(G.devSeenEver ? 'Yer titriyor. Dev Kafa geri döndü.' : 'Yer titriyor. Ağaçlar yarılıyor. Bu... ne?', '#ff7050', 7); }
  G.devSeenEver = true;
  for (const q of G.people) q.fear = Math.min(100, q.fear + 25);
}

// ---- düşman tükürükleri
function updEProj(dt) {
  if (!G.eproj.length) return;
  const prey = preyList();
  for (const q of G.eproj) {
    q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt;
    for (const t of prey) {
      if (Math.hypot(t.x - q.x, t.y - q.y) < bodyR(t) + 5) {
        hurt(t, q.dmg, q.src);
        if (!t.type && !t.isRescue && !t.injury && !t.dead && Math.random() < 0.3) { t.injury = { type: 'enfeksiyon', t: 0 }; msg(t === L ? 'Zehirli tükürük! Yaran mikrop kaptı.' : `${dat(t.name)} zehirli tükürük isabet etti!`, '#bf8', 4); }
        q.life = 0; break;
      }
    }
  }
  G.eproj = G.eproj.filter(q => q.life > 0);
}

// =============================================================
//  YAMYAMLAR
// =============================================================
function spawnGuards(c) {
  const n = 3 + Math.min(3, Math.floor(G.day / 3));
  for (let i = 0; i < n; i++) { const a = i / n * TAU, d = mkDino('yamyam', c.x + Math.cos(a) * 110, c.y + Math.sin(a) * 110); d.campI = c.i; d.pa = a; admitDino(d, 'camp'); }
  c.spawned = true;
}
function startRaid() {
  const live = G.ccamps.filter(c => c.alive); if (!live.length) return false;
  const c = live.sort((a, b) => dist(a, G.fire) - dist(b, G.fire))[0];
  const a0 = angTo(G.fire, c), n = Math.min(8, 3 + Math.floor(G.day / 3));
  if (birthRoom('yamyam', 'raid') < 1) return false;
  G.raid = { t: 0, charged: false, grabbed: 0, campI: c.i };
  for (let i = 0; i < n; i++) {
    const a = a0 + rand(-0.5, 0.5), r = rand(850, 1000), d = mkDino('yamyam', G.fire.x + Math.cos(a) * r, G.fire.y + Math.sin(a) * r);
    d.campI = c.i; d.raid = true; d.raidT = 75; d.silent = true; pushOut(d, true); admitDino(d, 'raid');
  }
  if (Math.random() < 0.5) { SFX.drum(0.15, panOf(G.fire.x + Math.cos(a0) * 900)); msg('Uzaklardan... davul sesleri.', '#c98', 4); }
  return true;
}
function updRaid(dt) {
  const R = G.raid; R.t += dt;
  const raiders = G.dinos.filter(d => d.type === 'yamyam' && d.raid && !d.leave);
  if (!raiders.length) { G.raid = null; return; }
  if (!R.charged) {
    const near = raiders.filter(d => dist(d, G.fire) < fireR() + 230).length;
    if (R.t > 28 || near >= Math.ceil(raiders.length * 0.6)) {
      R.charged = true;
      for (const d of raiders) d.charge = true;
      const d0 = raiders[0];
      SFX.warcry(1, panOf(d0.x)); jumpAt(d0.x, d0.y, 'YAMYAM BASKINI!');
      for (const p of G.people) p.fear = Math.min(100, p.fear + 30);
    }
  }
}
function captiveArrive(c, v) {
  removePerson(v); v.dead = false; v.grabbed = false; v.downed = 0;
  c.captives.push({ p: v, eatDay: phase() < 0.45 ? G.day : G.day + 1 });
  c.found = true; moraleAdd(-8);
  msg(`Yamyamlar ${acc(v.name)} kamplarına götürdü! ☠ Ertesi akşama kadar kurtarmazsan...`, '#ff6a4a', 8);
}
function freeCaptive(c, k) {
  const v = c.captives.splice(k, 1)[0].p;
  Object.assign(v, { x: c.x - 40 + rand(-10, 10), y: c.y + 50, group: 'takip', fear: 60, hp: Math.max(v.hp, 20), tgt: null, st: 'idle', carry: 0, bag: {}, dead: false, grabbed: false, inHut: null, post: null });
  G.people.push(v); moraleAdd(8); G.uiDirty = true;
  msg(`${acc(v.name)} kurtardın! Titreyerek peşinden geliyor.`, '#9f9', 5); SFX.bell();
}
function destroyCamp(c) {
  c.alive = false; c.totem = 0;
  while (c.captives.length) freeCaptive(c, 0);
  for (const d of G.dinos) if (d.type === 'yamyam' && d.campI === c.i) { d.leave = true; d.raid = false; }
  addStock('food', 30, c.x, c.y); addStock('bone', 12, c.x, c.y + 14); addStock('hide', 10, c.x, c.y + 28);
  moraleAdd(15); SFX.crash(0.8, 0); SFX.bell();
  msg('Yamyam totemi yıkıldı! Kamp dağıldı. Halkın bu gece biraz daha rahat uyuyacak.', '#ffd27a', 7);
}
function updCannibal(d, dt, prey) {
  const def = DINO.yamyam, c = G.ccamps[d.campI];
  d.swing = Math.max(0, (d.swing || 0) - dt);
  if (d.carry) {
    const v = d.carry;
    if (!c || !c.alive) { dropCarry(d, true); d.leave = true; return; }
    steer(d, c.x, c.y, def.spd * 0.95, dt, true); d.anim += dt * 9;
    v.x = d.x - Math.cos(d.ang) * 12; v.y = d.y - Math.sin(d.ang) * 12;
    if (Math.random() < dt * 0.4 && L) SFX.scream(clamp(1 - dist(d, L) / 1300, 0.05, 0.5), panOf(d.x));
    if (dist(d, c) < 60) { d.carry = null; captiveArrive(c, v); d.raid = false; d.charge = false; d.silent = false; }
    return;
  }
  if (d.leave) {
    if (c && c.alive) { steer(d, c.x, c.y, def.spd, dt, true); d.anim += dt * 10; if (dist(d, c) < 110) { d.leave = false; d.raid = false; d.charge = false; d.silent = false; } }
    else { const a = angTo(G.fire, d); steer(d, d.x + Math.cos(a) * 200, d.y + Math.sin(a) * 200, def.spd, dt, true); d.anim += dt * 10; if (!L || dist(d, L) > 1600) removeDino(d); }
    return;
  }
  d.think -= dt;
  let t = !t_dead(d.tgt) ? d.tgt : null;
  if (d.raid) {
    d.raidT -= dt; if (d.raidT <= 0) { d.leave = true; return; }
    if (!d.charge) {
      const a = angTo(G.fire, d) + Math.sin(G.now * 0.3 + d.id) * 0.3, R = fireR() + 150;
      steer(d, G.fire.x + Math.cos(a) * R, G.fire.y + Math.sin(a) * R, def.spd * 0.6, dt, true); d.anim += dt * 6;
      return;
    }
    if (d.think <= 0) {
      d.think = 0.4; let best = null, bs = 1e9;
      for (const q of prey) { if (q.type) continue; const s = dist(d, q) + (q.leader ? 160 : 0) - (q.child ? 120 : 0); if (s < bs) { bs = s; best = q; } }
      d.tgt = t = best;
    }
  } else {
    if (!c || !c.alive) { d.leave = true; return; }
    if (d.think <= 0) {
      d.think = 0.5; let best = null, bs = def.sense;
      for (const q of prey) { if (dist(q, c) > 520) continue; const dd = dist(q, d); if (dd < bs) { bs = dd; best = q; } }
      if (best && !d.tgt) SFX.warcry(volOf(d, 900) * 0.7, panOf(d.x));
      d.tgt = t = best;
    }
    if (!t) { d.pa = (d.pa || 0) + dt * 0.25; steer(d, c.x + Math.cos(d.pa) * 120, c.y + Math.sin(d.pa) * 120, def.spd * 0.35, dt, true); d.anim += dt * 4; return; }
    if (dist(t, c) > 650) { d.tgt = null; return; }
  }
  if (!t) return;
  const reach = d.r + bodyR(t) + 8;
  if (dist(d, t) > reach) { steer(d, t.x, t.y, def.spd * (d.charge ? 1.15 : 1), dt, true); d.anim += dt * 11; return; }
  d.moving = false; d.ang = angTo(d, t);
  if (d.atkCd > 0) return;
  d.atkCd = def.cd * rand(0.85, 1.15); d.swing = 0.25;
  const R = G.raid;
  if (!t.leader && !t.type && !t.isRescue && Math.random() < (d.raid ? 0.4 : 0.25) && (!R || R.grabbed < 2)) {
    t.grabbed = true; t.grabT = 12; t.downed = 0; d.carry = t; if (R) R.grabbed++;
    if (t.tgt && t.tgt.claim === t) t.tgt.claim = null;
    if (t.inHut) leaveHut(t);
    msg(`YAMYAMLAR ${acc(t.name).toLocaleUpperCase('tr')} SÜRÜKLÜYOR! Peşlerinden git!`, '#ff5040', 6);
    SFX.scream(1, panOf(t.x)); for (const p of G.people) p.fear = Math.min(100, p.fear + 20);
    return;
  }
  hurt(t, def.dmg * rand(0.8, 1.2), d);
  if (L && dist(d, L) < 700) SFX.hit(0.4);
}

// =============================================================
//  OTLAYANLAR: Ördekgaga (sürü, kaçar), Kafakalkan (bölgeci, toslar), Zırhlı (kuyruk topuzu)
// =============================================================
function alarmHerd(d, thr) {
  if (!thr) return;
  let any = false;
  for (const o of G.dinos) if (!o.tamed && !(o.angry > 0) && (o.type === d.type ? dist(o, d) < 320 : DINO[o.type].herb && o.type !== 'uzunboyun' && dist(o, d) < 200)) {
    if (!(o.flee > 0)) any = true; o.flee = rand(4, 7); o.fleeFrom = thr; o.fleeing = true; o.alert = G.now || 0.01; o.alertT = 0;
  }
  if (any) SFX.honk(volOf(d, 900) + 0.03, panOf(d.x));
}
// Bozkır Atı: barışçıl, ürkek çayır otoburu; binme/evcilleştirme bu pakette yok.
function updBozkirat(d, dt) {
  const def = DINO.bozkirat;
  d.angry = 0; // savunma için zırhlı kuyruğu saldırısına düşmesin
  if (fleeStep(d, dt, 1.6) || preyAware(d, dt)) return;
  if (dist(d, G.fire) < 500) {
    const a = angTo(G.fire, d);
    steer(d, d.x + Math.cos(a) * 160, d.y + Math.sin(a) * 160, def.spd * 0.75, dt, true);
    d.anim += dt * 6; return;
  }
  const lead = d.herdL;
  if (lead && lead !== d && !lead.dead && dist(d, lead) > 110) {
    steer(d, lead.x + Math.cos(d.id) * 45, lead.y + Math.sin(d.id) * 45, def.spd * 0.55, dt, true);
    d.anim += dt * 4; return;
  }
  wanderSlow(d, dt, def.spd * 0.3);
}
function spawnBozkirat(n) {
  const out = [], cap = 6;
  const count = G.dinos.filter(d => !d.dead && d.type === 'bozkirat').length;
  n = Math.min(Math.max(0, Math.floor(n) || 0), cap - count);
  if (!(n > 0)) return out;
  const center = spawnPosBiome([4], 600, 1600);
  if (!center) return out;
  function valid(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 35 || y < 35 || x > WORLD - 35 || y > WORLD - 35) return false;
    if (biomeFast(x, y) !== 4 || isSea(x, y) || groundH(x, y) < 0.8 || Math.hypot(x - G.fire.x, y - G.fire.y) < 650) return false;
    if ([...G.pools, ...G.lakes].some(w => Math.hypot(x - w.x, y - w.y) < w.r + DINO.bozkirat.r + 8)) return false;
    const h = groundH(x, y);
    return [[20, 0], [-20, 0], [0, 20], [0, -20]].every(v => Math.abs(groundH(x + v[0], y + v[1]) - h) < 10);
  }
  for (let k = 0; k < 18 && out.length < n; k++) {
    const x = center.x + rand(-70, 70), y = center.y + rand(-70, 70);
    if (!valid(x, y)) continue;
    const d = mkDino('bozkirat', x, y); pushOut(d, true);
    if (!valid(d.x, d.y)) continue;
    if (gQuery(d.x, d.y, d.r + 4).some(o => !o.dead && Math.hypot(d.x - o.x, d.y - o.y) < d.r + o.r)) continue;
    if (G.dinos.some(o => !o.dead && Math.hypot(d.x - o.x, d.y - o.y) < d.r + o.r + 4)) continue;
    d.terr = { x: center.x, y: center.y, r: 550 };
    if (admitDino(d, 'normal')) { d.herdL = out[0] || d; out.push(d); }
  }
  return out;
}

function updGrazer(d, dt) {
  const def = DINO[d.type];
  d.swing = Math.max(0, (d.swing || 0) - dt);
  if (isNight() && !d.leave && dist(d, G.fire) < 1800 && Math.random() < dt * 0.03) d.leave = true;
  if (d.leave) { const a = angTo(G.fire, d); steer(d, d.x + Math.cos(a) * 150, d.y + Math.sin(a) * 150, def.spd * 0.9, dt, true); d.anim += dt * 5; if (!L || dist(d, L) > 1700) removeDino(d); return; }
  if (fleeStep(d, dt, d.type === 'zirhli' ? 1.3 : 2)) return;
  const dc = dist(d, G.fire);
  if (dc < 430 && !(d.angry > 0)) { const a = angTo(G.fire, d); steer(d, d.x + Math.cos(a) * 120, d.y + Math.sin(a) * 120, def.spd, dt, true); d.anim += dt * 5; return; }
  if (!(d.angry > 0) && preyAware(d, dt)) return;
  if (d.angry > 0) {
    d.angry -= dt; const t = d.tgt;
    if (!t_dead(t)) {
      if (d.type === 'gurleyen') {
        if (dist(d, G.fire) < 380 && !(d.tgt && G.hunt && G.hunt.t === d)) { d.angry = 0; return; }
        if (d.hp < d.maxhp * 0.35) { d.flee = 6; d.fleeFrom = t; d.angry = 0; return; }
        const reach = d.r + bodyR(t) + 6;
        if (dist(d, t) > reach) { steer(d, t.x, t.y, def.spd * 2.2, dt, true); d.anim += dt * 12; }
        else if (d.atkCd <= 0) { d.atkCd = def.cd; hurt(t, def.dmg, d); if (!t.type) { const a = angTo(d, t); t.x += Math.cos(a) * 50; t.y += Math.sin(a) * 50; pushOut(t, false); } SFX.thump(0.4); d.angry = Math.min(d.angry, 2.5); }
        return;
      }
      // zırhlı: kuyruğunu saldırgana çevirir
      const dd = dist(d, t);
      d.ang = angLerp(d.ang, angTo(d, t) + Math.PI, Math.min(1, dt * 2)); d.moving = true; d.anim += dt * 2;
      if (dd > d.r + bodyR(t) + 60) { const a = angTo(t, d); steer(d, d.x + Math.cos(a) * 40, d.y + Math.sin(a) * 40, def.spd * 0.5, dt, true); d.ang = angLerp(d.ang, angTo(d, t) + Math.PI, 0.5); }
      if (dd < d.r + bodyR(t) + 48 && angDiff(d.ang + Math.PI, angTo(d, t)) < 0.9 && d.atkCd <= 0) {
        d.atkCd = def.cd; d.swing = 0.4; hurt(t, def.dmg, d);
        if (!t.type) { const a = angTo(d, t); t.x += Math.cos(a) * 70; t.y += Math.sin(a) * 70; pushOut(t, false); }
        SFX.thump(0.7); G.shake = Math.max(G.shake, L && dist(d, L) < 400 ? 6 : 0);
      }
      return;
    }
  }
  const hl = d.herdL && !d.herdL.dead && d.herdL !== d ? d.herdL : null;
  if (hl && dist(d, hl) > 70 + d.r) { steer(d, hl.x + Math.cos(d.id) * 50, hl.y + Math.sin(d.id) * 50, def.spd * 0.7, dt, true); d.anim += dt * 4; return; }
  wanderSlow(d, dt, def.spd * 0.4);
}
// =============================================================
//  BENZEYEN — kamptan birinin kılığına giren şey
// =============================================================
function reveal(d) {
  if (d.revealed) return;
  d.revealed = true;
  SFX.shriek(1, panOf(d.x));
  jumpAt(d.x, d.y, `O ${d.disguise.name.toLocaleUpperCase('tr')} DEĞİL!`);
  for (const p of G.people) p.fear = Math.min(100, p.fear + (dist(p, d) < 500 ? 45 : 20));
}
function spawnMimicCreature() {
  const vs = G.people.filter(p => !p.leader && !p.child); if (!vs.length) return null;
  const v = pick(vs), pos = spawnPos(650, 800, G.fire); if (!pos) return null;
  const d = mkDino('taklitci', pos.x, pos.y);
  d.disguise = { name: v.name, skin: v.skin, hair: v.hair, group: v.group }; d.revealed = false; d.kills = 0;
  return admitDino(d, 'mimic') ? d : null;
}
function updMimicC(d, dt, prey) {
  const def = DINO.taklitci;
  if (d.leave) { const a = angTo(G.fire, d); steer(d, d.x + Math.cos(a) * 200, d.y + Math.sin(a) * 200, 230, dt, true); d.anim += dt * 14; if (!L || dist(d, L) > 1300) removeDino(d); return; }
  if (!isNight() && !d.revealed) { d.leave = true; return; }
  if (!d.revealed) {
    d.jerk = (d.jerk || 0) - dt;
    if (d.jerk <= 0) { d.jerk = rand(0.4, 1.4); d.pause = Math.random() < 0.3 ? rand(0.3, 1.4) : 0; d.tilt = rand(-0.7, 0.7); }
    if (d.pause > 0) { d.pause -= dt; d.moving = false; return; }
    let best = null, bs = 1e9;
    for (const t of prey) { if (t.type || t.isRescue) continue; const s = dist(d, t) - (dist(t, G.fire) > fireR() * 0.7 ? 300 : 0) + (t.leader ? 200 : 0); if (s < bs) { bs = s; best = t; } }
    d.tgt = best;
    steer(d, best ? best.x : G.fire.x, best ? best.y : G.fire.y, 72, dt, true); d.anim += dt * 7;
    if (best && dist(d, best) < 58) reveal(d);
    return;
  }
  let t = !t_dead(d.tgt) && !d.tgt.type ? d.tgt : null;
  if (!t) { let bd = 520; for (const q of prey) { if (q.type) continue; const dd = dist(q, d); if (dd < bd) { bd = dd; t = q; } } d.tgt = t; }
  if (!t) { d.leave = true; return; }
  const reach = d.r + bodyR(t) + 8;
  if (dist(d, t) > reach) { steer(d, t.x, t.y, def.spd * 2.2, dt, true); d.anim += dt * 16; return; }
  d.moving = false; d.ang = angTo(d, t);
  if (d.atkCd <= 0) {
    d.atkCd = def.cd; d.swing = 0.3;
    hurt(t, def.dmg * rand(0.9, 1.1), d); SFX.hit(0.8);
    if (t.dead || t.downed > 0) d.kills++;
    if (d.kills >= 2 || d.hp < d.maxhp * 0.4) { d.leave = true; msg('Benzeyen karanlığa geri süzüldü... Bir gün yine gelecek.', '#bbb', 6); }
  }
}

// =============================================================
//  KESİCİ — yalnız kalanı avlar; 2-3 kişi bir aradaysa geri çekilir
// =============================================================
function alliesNear(p, r) { let n = 0; for (const q of G.people) if (q !== p && !q.child && !q.downed && !q.inHut && !q.bed && !q.insideB && dist(q, p) < r) n++; return n; }
function updKesici(d, dt, prey) {
  const def = DINO.kesici;
  if (d.leave) { const a = angTo(G.fire, d); steer(d, d.x + Math.cos(a) * 200, d.y + Math.sin(a) * 200, def.spd * 0.8, dt, true); d.anim += dt * 12; if (!L || dist(d, L) > 1500) removeDino(d); return; }
  if (d.hp < d.maxhp * 0.35 || (d.kills || 0) >= 2) { d.leave = true; return; }
  if (d.retreat > 0) {
    d.retreat -= dt; d.dash = 0;
    const fr = d.tgt && !d.tgt.dead ? d.tgt : G.fire, a = angTo(fr, d) + Math.sin(G.now + d.id) * 0.4;
    steer(d, d.x + Math.cos(a) * 120, d.y + Math.sin(a) * 120, def.spd * 0.8, dt, true); d.anim += dt * 14; return;
  }
  d.think -= dt;
  const zones = safeZones();
  if (d.think <= 0 && !(d.dash > 0)) {
    d.think = 0.6; let best = null, bs = 1e9;
    for (const t of prey) {
      if (t.type || t.isRescue) continue;
      if (G.fire.fuel > 0 && inSafe(t.x, t.y, zones)) continue;
      const al = alliesNear(t, 150); if (al >= 2) continue;
      if (d.terr && Math.hypot(t.x - d.terr.x, t.y - d.terr.y) > d.terr.r) continue;
      const sense = isNight() ? def.nsense : def.sense, dd = dist(d, t); if (dd > sense) continue;
      if (d.tgt !== t && !predNotices(d, t, dd, sense)) continue;
      const s = dd + al * 300 + (t.leader ? 150 : 0);
      if (s < bs) { bs = s; best = t; }
    }
    d.tgt = best;
  }
  if (d.terr && d.tgt && !(d.dash > 0) && Math.hypot(d.tgt.x - d.terr.x, d.tgt.y - d.terr.y) > d.terr.r * 1.25) d.tgt = null;
  const t = !t_dead(d.tgt) && !d.tgt.type ? d.tgt : null;
  if (!t) {
    d.wt -= dt;
    if (d.wt <= 0 || Math.hypot(d.wx - d.x, d.wy - d.y) < 20) {
      d.wt = rand(4, 9); const C = d.terr || G.fire, a = rand(0, TAU), r = d.terr ? rand(0, d.terr.r * 0.7) : Math.max(fireR(), 300) + rand(250, 550);
      d.wx = C.x + Math.cos(a) * r; d.wy = C.y + Math.sin(a) * r;
      if (isSea(d.wx, d.wy)) { d.wx = (d.wx + G.fire.x) / 2; d.wy = (d.wy + G.fire.y) / 2; }
    }
    steer(d, d.wx, d.wy, def.spd * 0.3, dt, true); d.anim += dt * 5; return;
  }
  const dd = dist(d, t);
  if (!(d.dash > 0)) {
    if (dd > 240) { steer(d, t.x, t.y, def.spd * 0.42, dt, true); d.anim += dt * 6; return; }
    d.dash = 2.4;
    if (L && dist(t, L) < 650) jumpAt(t.x, t.y, 'KESİCİ!'); else msg(`Uzaklardan bir çığlık... ${dat(t.name)} bir şey saldırıyor!`, '#f77', 4);
    SFX.screech(L ? clamp(1 - dist(d, L) / 900, 0.2, 1) : 0.3, panOf(d.x));
  }
  d.dash -= dt;
  if (alliesNear(t, 140) >= 2) { d.retreat = rand(2.5, 4); SFX.chitter(L ? clamp(1 - dist(d, L) / 800, 0.1, 0.6) : 0.2, panOf(d.x)); if (!G.flags.kesiciHint) { G.flags.kesiciHint = 1; msg('Kesici kalabalığı görünce geri çekildi. Birlikte durun!', '#fd9', 5); } return; }
  if (dd > d.r + bodyR(t) + 8) { steer(d, t.x, t.y, def.spd, dt, true); d.anim += dt * 16; if (d.dash <= 0) d.retreat = 2; return; }
  d.moving = false; d.ang = angTo(d, t);
  if (d.atkCd <= 0) {
    d.atkCd = def.cd; d.dash = 0;
    hurt(t, def.dmg * rand(0.9, 1.15), d);
    if (!t.dead && !t.injury && t.hp > 0 && Math.random() < 0.5) t.injury = { type: 'kanama', t: 14 };
    if (t.dead || t.downed > 0) d.kills = (d.kills || 0) + 1;
    SFX.hit(0.8); d.retreat = rand(2.5, 4);
  }
}
