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
    if (o.kind === 'build' && !isDino) continue;
    if (o.kind === 'tree' && e.r >= 55) {
      if (!o.stump && Math.hypot(e.x - o.x, e.y - o.y) < e.r) { o.shake = 0.3; if (e.moving && Math.random() < 0.012) { treeDown(o); o.amt = 0; SFX.crash(volOf(o, 1100) * 0.7 + 0.02, panOf(o.x)); } }
      continue;
    }
    const dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy) || 0.01, m = o.r + e.r;
    if (d < m) { e.x = o.x + dx / d * m; e.y = o.y + dy / d * m; if (o.kind === 'build') blocked = o; }
  }
  e.x = clamp(e.x, 30, WORLD - 30); e.y = clamp(e.y, 30, WORLD - 30);
  return blocked;
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
function mkDino(type, x, y) {
  const d = DINO[type];
  return { type, x, y, r: d.r, hp: d.hp, maxhp: d.hp, ang: rand(0, TAU), anim: rand(0, 9), atkCd: 0, think: 0, tgt: null, wx: x, wy: y, wt: 0,
    hurt: 0, leave: false, tamed: false, angry: 0, ko: 0, koDone: false, carry: null, carryDmg: 0, orbit: Math.random() < 0.5 ? 1 : -1,
    engaged: false, stepT: 0, rush: 0, roarT: rand(4, 10), blink: rand(1, 5), moving: false, bash: null, trapCd: 0, id: ++G.idc,
    stuck: 0, detour: 0, alt: 0, st: 'idle', poison: 0, scouted: 0, fly: type === 'kanatli', hidden: false };
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
    t.hp -= dmg; t.hurt = 0.15; if (poison) t.poison = 5;
    for (let i = 0; i < 5; i++) G.parts.push({ x: t.x, y: t.y, vx: rand(-120, 120), vy: rand(-120, 120), life: rand(0.3, 0.7), col: '#7a0d0d', s: rand(2, 4) });
    if (t.carry && src && src.leader) { t.carryDmg += dmg; if (t.carryDmg >= 70) dropCarry(t, true); }
    if (t.hidden) { t.hidden = false; t.st = 'lunge'; t.lungeT = 5; t.tgt = src; }
    if (!t.tamed) {
      if (t.type === 'boynuzlu') {
        if (t.ko > 0) t.hp = 0;
        else { t.angry = 18; t.tgt = src; if (!t.koDone && t.hp > 0 && t.hp < t.maxhp * 0.3) { t.ko = 30; t.koDone = true; t.angry = 0; msg('Boynuzlu bayıldı! [E] basılı tut: 15🍖 ile evcilleştir — ya da vur ve et al.', '#fe9', 6); } }
      } else if (t.type === 'uzunboyun') { t.angry = 15; t.tgt = src; }
      else if (t.type === 'ordek') alarmHerd(t, src || L);
      else if (t.type === 'gurleyen' || t.type === 'zirhli') { t.angry = 12; t.tgt = src || L; }
      else if (t.type === 'kanatli') { t.st = 'fly'; t.home = { x: clamp(t.x + rand(-900, 900), 200, WORLD - 200), y: clamp(t.y + rand(-900, 900), 200, WORLD - 200) }; }
      else if (src && !t.leave && src.kind !== 'build') { t.tgt = src; t.engaged = true; }
      if (t.type === 'kucuk' && t.hp < t.maxhp * 0.5) t.leave = true;
    }
    if (t.hp <= 0) killDino(t, src);
    return;
  }
  // ---- insan
  if (src && src.type) dmg *= DIFF[G.diff].dmg;
  if (t === L && G.mount && !G.mount.dead) { const m = G.mount, md = dmg * 0.6; dmg -= md; m.hp -= md; m.hurt = 0.15; if (m.hp <= 0) killDino(m, src); }
  if (t.eq && t.eq.zirh) dmg *= 0.7;
  if (t.downed > 0) { killPerson(t, src); return; }
  t.hp -= dmg; t.hurtT = 0.2; t.lastHurt = 0; t.fear = Math.min(100, t.fear + 12);
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
function preyList() {
  const out = [];
  for (const p of G.people) if (!p.inHut && !p.grabbed && !p.dead && !p.insideB) out.push(p);
  for (const d of G.dinos) if (d.tamed && !d.fly && !d.mounted) out.push(d);
  if (G.rescue && L && dist(G.rescue, L) < 450) out.push(G.rescue);
  return out;
}
function t_dead(t) { return !t || t.dead || t.inHut || t.grabbed || (t.kind === 'build' && (!t.occ || !t.occ.length)) || (t.isRescue && G.rescue !== t) || (t.mounted); }
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

function updDino(d, dt, prey, zones) {
  d.atkCd -= dt; d.hurt = Math.max(0, d.hurt - dt); d.blink -= dt; if (d.blink < -0.15) d.blink = rand(1.5, 5);
  d.trapCd = Math.max(0, d.trapCd - dt); d.rush = Math.max(0, d.rush - dt); if (d.scouted > 0) d.scouted -= dt; d.frill = Math.max(0, (d.frill || 0) - dt);
  if (d.poison > 0) {
    d.poison -= dt; d.hp -= 6 * dt;
    if (Math.random() < dt * 5) G.parts.push({ x: d.x + rand(-d.r, d.r), y: d.y, vx: 0, vy: -30, life: 0.6, col: '#7c3', s: 3 });
    if (d.hp <= 0) { killDino(d, L); return; }
  }
  if (d.mounted) return;
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
    if (d.type === 'yirtici' && night && G.day >= 3 && Math.random() < 0.004 * G.day * DIFF[G.diff].spawn) d.rush = rand(2, 4);
    if (d.type === 'dev' && night && G.day >= 4 && Math.random() < 0.01) d.rush = rand(5, 9);
  }
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
  } else {
    d.wt -= dt;
    if (d.wt <= 0 || Math.hypot(d.wx - d.x, d.wy - d.y) < 20) {
      d.wt = rand(3, 8);
      if (night) { const a = rand(0, TAU), r = fireR() + rand(150, 500); d.wx = G.fire.x + Math.cos(a) * r; d.wy = G.fire.y + Math.sin(a) * r; }
      else { d.wx = d.x + rand(-400, 400); d.wy = d.y + rand(-400, 400); }
    }
    tx = d.wx; ty = d.wy; spd = def.spd * 0.4;
  }
  if (tx !== undefined) {
    d.spdNow = spd;
    steer(d, tx, ty, spd, dt, true); d.anim += dt * spd / 22;
    if (!bold) for (const z of zones) { const dx = d.x - z.x, dy = d.y - z.y, dd = Math.hypot(dx, dy) || 1; if (dd < z.r) { d.x = z.x + dx / dd * z.r; d.y = z.y + dy / dd * z.r; } }
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
  if (isNight()) d.leave = true;
  if (d.leave) { const a = angTo(G.fire, d); steer(d, d.x + Math.cos(a) * 100, d.y + Math.sin(a) * 100, def.spd, dt, true); d.anim += dt * 4; if (!L || dist(d, L) > 1600) removeDino(d); return; }
  wanderSlow(d, dt, def.spd * 0.45);
}
function wanderSlow(d, dt, spd) {
  d.wt -= dt;
  if (d.wt <= 0) { d.wt = rand(5, 12); d.wx = d.x + rand(-300, 300); d.wy = d.y + rand(-300, 300); if (Math.hypot(d.wx - CAMP.x, d.wy - CAMP.y) < 450) { d.wx += 450; } }
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
        if (o.tamed || !DINO[o.type].pred || o.leave) continue;
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
  n.eggs--; G.carryEgg = true;
  const cnt = 2 + (G.day >= 4 ? 1 : 0);
  for (let i = 0; i < cnt; i++) {
    const a = rand(0, TAU), d = mkDino('yirtici', n.x + Math.cos(a) * 320, n.y + Math.sin(a) * 320);
    d.mother = true; d.motherT = 80; d.tgt = L; pushOut(d, true); G.dinos.push(d);
  }
  SFX.screech(0.9, 0); setTimeout(() => SFX.screech(0.7, 0.5), 400);
  msg('Yumurtayı aldın! Anneler çığlık atıyor — kampa koş!', '#ffcf6a', 5);
}

// ---- doğurma
function spawnPos(minR = 850, maxR = 1150, around) {
  const c = around || L;
  for (let k = 0; k < 30; k++) {
    const a = rand(0, TAU), r = rand(minR, maxR), x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r;
    if (x < 80 || y < 80 || x > WORLD - 80 || y > WORLD - 80) continue;
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
function spawnPack(type, n, pos) {
  if (pos === undefined) pos = spawnPos();
  if (!pos) return [];
  const out = [];
  for (let i = 0; i < n; i++) { const d = mkDino(type, pos.x + rand(-60, 60), pos.y + rand(-60, 60)); pushOut(d, true); G.dinos.push(d); out.push(d); d.herdL = out[0]; }
  return out;
}
function spawnFlyer(pos) {
  const d = mkDino('kanatli', pos.x, pos.y); d.home = { x: pos.x, y: pos.y }; d.alt = 1; d.st = 'fly'; d.flyT = rand(5, 20); G.dinos.push(d); return d;
}
function ambush(v, n, type, text) {
  const a = dist(v, G.fire) > 60 ? angTo(G.fire, v) + rand(-1.3, 1.3) : rand(0, TAU), out = [];
  for (let i = 0; i < n; i++) {
    const aa = a + rand(-0.7, 0.7), r = rand(160, 250), d = mkDino(type || 'yirtici', v.x + Math.cos(aa) * r, v.y + Math.sin(aa) * r);
    pushOut(d, true); d.rush = 6; d.tgt = v; d.engaged = true; d.silent = true; G.dinos.push(d); out.push(d);
  }
  jumpAt(v.x, v.y, text || 'PUSU!');
  SFX.screech(L ? clamp(1 - dist(v, L) / 1000, 0.2, 1) : 0.4, panOf(v.x));
  return out;
}
function spawner() {
  const cnt = {}; for (const d of G.dinos) if (!d.tamed && !d.leave && d.campI === undefined) cnt[d.type] = (cnt[d.type] || 0) + 1;
  const c = k => cnt[k] || 0;
  const day = G.day, n = isNight(), sm = DIFF[G.diff].spawn, lb = biomeFast(L.x, L.y);
  if (!n) {
    if (c('boynuzlu') < 4 && Math.random() < 0.25) spawnPack('boynuzlu', 1, spawnPosBiome([0, 2]));
    if (c('uzunboyun') < 1 && Math.random() < 0.02) spawnPack('uzunboyun', 1, spawnPosBiome([0, 2], 700, 1100));
    if (c('kanatli') < 3 && Math.random() < 0.2) { const pos = spawnPosBiome([1], 500, 1100); if (pos) spawnFlyer(pos); }
    if (c('kucuk') < (2 + day / 2) * sm && Math.random() < 0.08) spawnPack('kucuk', ri(2, 4));
    if (c('ordek') < 9 && Math.random() < 0.14) spawnPack('ordek', ri(3, 6), spawnPosBiome([0, 2], 700, 1200));
    if (c('gurleyen') < 5 && Math.random() < 0.06) spawnPack('gurleyen', ri(2, 4), spawnPosBiome([0, 1], 700, 1200));
    if (c('zirhli') < 2 && Math.random() < 0.03) spawnPack('zirhli', 1, spawnPosBiome([0, 1], 800, 1200));
    if (c('tukurgec') < 1 + day / 4 && Math.random() < 0.03 * sm) spawnPack('tukurgec', ri(1, 2), spawnPosBiome([0, 2]));
    if (lb === 3 && c('yirtici') < 4 * sm && Math.random() < 0.1) spawnPack('yirtici', ri(2, 3), spawnPos(500, 800));
    // nadir gündüz pususu: kamptan uzaktaki birine
    if (day >= 2 && Math.random() < 0.006 * sm) {
      const far = G.people.filter(p => !p.inHut && !p.grabbed && !p.child && !p.downed && dist(p, G.fire) > 750);
      if (far.length) ambush(pick(far), ri(2, 3), Math.random() < 0.3 ? 'tukurgec' : 'yirtici');
    }
  } else {
    if (c('kucuk') < (3 + day / 2) * sm && Math.random() < 0.08) spawnPack('kucuk', ri(2, 4));
    if (c('yirtici') < Math.min(1 + day * 0.5, 4) * sm && Math.random() < 0.035) spawnPack('yirtici', ri(1, 2));
    if (c('tukurgec') < 2 && Math.random() < 0.015 * sm) spawnPack('tukurgec', 1, spawnPosBiome([0, 2]));
    if (day >= 2 && c('geceavcisi') < Math.min(day, 8) * sm && Math.random() < 0.04) spawnPack('geceavcisi', ri(2, 3 + Math.floor(day / 4)));
  }
  if (day >= 4 && c('yelken') < 1 && Math.random() < 0.003 * sm) {
    const W = G.pools.concat(G.lakes).filter(w => { const d = Math.hypot(w.x - L.x, w.y - L.y); return d > 700 && d < 1500; });
    if (W.length) { const w = pick(W), a = rand(0, TAU), d = mkDino('yelken', w.x + Math.cos(a) * (w.r + 40), w.y + Math.sin(a) * (w.r + 40)); d.home = { x: w.x, y: w.y }; pushOut(d, true); G.dinos.push(d); }
  }
  if (day >= 3 && c('kesici') < (day >= 7 ? 2 : 1) && Math.random() < (n ? 0.012 : 0.004) * sm) {
    const pos = spawnPosBiome([0, 3], 750, 1100) || spawnPos(800, 1100);
    if (pos) for (const d of spawnPack('kesici', 1, pos)) d.silent = true;
  }
  if (c('batakci') < 5 && Math.random() < 0.3) {
    const pools = G.pools.filter(pl => !pl.croc && Math.hypot(pl.x - L.x, pl.y - L.y) < 1300 && Math.hypot(pl.x - L.x, pl.y - L.y) > 450);
    if (pools.length) { const pl = pick(pools), d = mkDino('batakci', pl.x, pl.y); d.home = pl; pl.croc = d; d.hidden = true; d.st = 'hide'; G.dinos.push(d); }
  }
}
function spawnDevEvent(sudden) {
  const pos = sudden ? spawnPos(480, 600, G.fire) : spawnPos(1100, 1300);
  if (!pos) return;
  const d = spawnPack('dev', 1, pos)[0];
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
  for (let i = 0; i < n; i++) { const a = i / n * TAU, d = mkDino('yamyam', c.x + Math.cos(a) * 110, c.y + Math.sin(a) * 110); d.campI = c.i; d.pa = a; G.dinos.push(d); }
  c.spawned = true;
}
function startRaid() {
  const live = G.ccamps.filter(c => c.alive); if (!live.length) return false;
  const c = live.sort((a, b) => dist(a, G.fire) - dist(b, G.fire))[0];
  const a0 = angTo(G.fire, c), n = Math.min(8, 3 + Math.floor(G.day / 3));
  G.raid = { t: 0, charged: false, grabbed: 0, campI: c.i };
  for (let i = 0; i < n; i++) {
    const a = a0 + rand(-0.5, 0.5), r = rand(850, 1000), d = mkDino('yamyam', G.fire.x + Math.cos(a) * r, G.fire.y + Math.sin(a) * r);
    d.campI = c.i; d.raid = true; d.raidT = 75; d.silent = true; pushOut(d, true); G.dinos.push(d);
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
  for (const o of G.dinos) if (o.type === d.type && !o.tamed && dist(o, d) < 320) { if (!(o.flee > 0)) any = true; o.flee = rand(4, 7); o.fleeFrom = thr; }
  if (any) SFX.honk(volOf(d, 900) + 0.03, panOf(d.x));
}
function updGrazer(d, dt) {
  const def = DINO[d.type];
  d.swing = Math.max(0, (d.swing || 0) - dt);
  if (isNight() && !d.leave && Math.random() < dt * 0.03) d.leave = true;
  if (d.leave) { const a = angTo(G.fire, d); steer(d, d.x + Math.cos(a) * 150, d.y + Math.sin(a) * 150, def.spd * 0.9, dt, true); d.anim += dt * 5; if (!L || dist(d, L) > 1700) removeDino(d); return; }
  if (d.flee > 0) {
    d.flee -= dt; const from = d.fleeFrom && !d.fleeFrom.dead ? d.fleeFrom : G.fire, a = angTo(from, d) + Math.sin(G.now + d.id) * 0.3;
    steer(d, d.x + Math.cos(a) * 200, d.y + Math.sin(a) * 200, def.spd * 2, dt, true); d.anim += dt * 12; return;
  }
  const dc = dist(d, G.fire);
  if (dc < 430 && !(d.angry > 0)) { const a = angTo(G.fire, d); steer(d, d.x + Math.cos(a) * 120, d.y + Math.sin(a) * 120, def.spd, dt, true); d.anim += dt * 5; return; }
  d.lookT = (d.lookT || 0) - dt;
  if (d.lookT <= 0) {
    d.lookT = 0.5;
    if (d.type === 'ordek') {
      let thr = null;
      for (const p of G.people) if (!p.inHut && !p.bed && dist(p, d) < (p.moving ? 230 : 150)) { thr = p; break; }
      if (!thr) for (const o of G.dinos) if (DINO[o.type].pred && !o.tamed && dist(o, d) < 300) { thr = o; break; }
      if (thr) alarmHerd(d, thr);
    } else if (d.type === 'gurleyen' && !(d.angry > 0) && dc > 500) {
      for (const p of G.people) if (!p.inHut && !p.bed && dist(p, d) < 115) { d.angry = 6; d.tgt = p; SFX.honk(volOf(d, 700) * 0.6, panOf(d.x)); break; }
    }
  }
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
  G.dinos.push(d); return d;
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
      const dd = dist(d, t); if (dd > (isNight() ? def.nsense : def.sense)) continue;
      const s = dd + al * 300 + (t.leader ? 150 : 0);
      if (s < bs) { bs = s; best = t; }
    }
    d.tgt = best;
  }
  const t = !t_dead(d.tgt) && !d.tgt.type ? d.tgt : null;
  if (!t) {
    d.wt -= dt;
    if (d.wt <= 0 || Math.hypot(d.wx - d.x, d.wy - d.y) < 20) { d.wt = rand(4, 9); const a = rand(0, TAU), r = Math.max(fireR(), 300) + rand(250, 550); d.wx = G.fire.x + Math.cos(a) * r; d.wy = G.fire.y + Math.sin(a) * r; }
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
