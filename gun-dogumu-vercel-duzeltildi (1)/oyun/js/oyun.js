'use strict';
// =============================================================
//  OYUN — lider, etkileşim, inşa/zanaat, gün döngüsü, korku
//         olayları, final, kayıt, başarımlar, öğretici, döngü
// =============================================================

function resetState(diff) {
  for (const k of Object.keys(G)) delete G[k];
  Object.assign(G, {
    diff, seed: 0, t: CYCLE * 0.05, day: 1, now: 0, dt: 0,
    stock: { wood: 22, stone: 6, food: 26, bone: 0, hide: 0, herb: 0, poison: 0, crystal: 0, med: 1 },
    fire: { x: CAMP.x, y: CAMP.y, fuel: 85, out: false },
    builds: [], people: [], dinos: [], parts: [], texts: [], msgs: [], proj: [], stains: [], tracks: [], rainDrops: [],
    tech: new Set(), managers: {}, zone: {}, abil: {}, morale: 60, newGroup: 'bos',
    mount: null, carryEgg: false, eggs: [], torchOn: false, torchFuel: 0,
    shake: 0, red: 0, flash: 0, over: false, won: false, rescue: null, rescueAt: -1, kills: 0, deaths: 0, lost: 0,
    placing: null, flags: {}, stokeT: 0, spawnT: 0, actT: 0, hbT: 0, ambT: 3, uiT: 0, regrowT: 0, postT: 0, expT: 0, achT: 0, saveT: 45,
    interact: null, usedNames: new Set(), started: true, paused: false, modal: false, danger: 0,
    nightType: 'normal', weather: { type: 'acik', t: 0 }, mimic: null, mimicAt: -1, finale: null, dayRainAt: -1,
    explored: new Uint8Array(MAPN * MAPN), stats: { fireNights: 0, noLoss: 0, tamed: 0 }, lossToday: false, fireOutTonight: false,
    tut: { on: false, step: 0 }, idc: 0, devDone: false, leaveDone: false, scoutCd: 0, silent: false, devSeenEver: false, riftHint: false,
    tutMoved: 0, tutWood: 0, tutFire: 0, tutGroup: false, uiDirty: true, toolsDirty: true, msgDirty: true, shootCd: 0
  });
  for (const g of GORDER) { G.managers[g] = null; G.zone[g] = null; G.abil[g] = { cd: 0, act: 0 }; }
}
function newGame(diff, tutOn) {
  resetState(diff);
  G.seed = Math.floor(Math.random() * 1e9);
  genWorld(G.seed);
  L = mkPerson(CAMP.x, CAMP.y + 70, 'Sen', true); G.people.push(L);
  ['odun', 'yiyecek', 'muhafiz'].forEach((g, i) => {
    const a = i / 3 * TAU + 0.5, p = mkPerson(CAMP.x + Math.cos(a) * 80, CAMP.y + Math.sin(a) * 80, freshName(), false);
    p.group = g; G.people.push(p);
  });
  G.tut = { on: !!tutOn, step: 0 };
  msg('Ateşi canlı tut. Halkını besle. Gece geldiğinde... ışıktan ayrılma.', '#ffd9a0', 8);
  if (!tutOn) msg('Halkını sağdaki panelden gruplara ayır, yöneticiler ata.', '#bbb', 8);
  markExplored(L.x, L.y, 500);
  onGameStart();
}

// =============================================================
//  LİDER
// =============================================================
function screenToWorld(sx, sy) { return { x: sx + G.camX, y: sy + G.camY }; }
function autoAim(range) {
  let best = null, bd = range;
  for (const d of G.dinos) { if (!hostile(d) && !(d.type === 'boynuzlu' && !d.tamed) && !(d.type === 'uzunboyun' && !d.tamed)) continue; if (d.tamed) continue; const dd = dist(d, L) - d.r; if (dd < bd) { bd = dd; best = d; } }
  return best;
}
function updLeader(dt) {
  const p = L;
  let mx = 0, my = 0;
  if (keys.KeyW || keys.ArrowUp) my -= 1; if (keys.KeyS || keys.ArrowDown) my += 1;
  if (keys.KeyA || keys.ArrowLeft) mx -= 1; if (keys.KeyD || keys.ArrowRight) mx += 1;
  if (touch.jx || touch.jy) { mx = touch.jx; my = touch.jy; }
  const m = Math.hypot(mx, my);
  p.sprinting = (keys.ShiftLeft || keys.ShiftRight || touch.run) && m > 0.1 && p.stam > 1;
  p.stam = clamp(p.stam + (p.sprinting ? -28 : 16) * dt, 0, 100);
  const mouseAim = mouse.used && !isTouch;
  if (G.mount) {
    const d = G.mount; d.ramCd = (d.ramCd || 0) - dt;
    if (m > 0.1) {
      const k = Math.min(1, m), spd = 230 * (p.sprinting ? 1.3 : 1) * (biomeFast(d.x, d.y) === 2 ? 0.8 : 1);
      d.x += mx / m * spd * k * dt; d.y += my / m * spd * k * dt; pushOut(d, true);
      d.ang = angLerp(d.ang, Math.atan2(my, mx), Math.min(1, dt * 8)); d.moving = true; d.anim += dt * 10;
      if (d.ramCd <= 0) for (const e of G.dinos) {
        if (e === d || e.tamed || e.fly || e.hidden) continue;
        if (dist(e, d) < e.r + d.r + 6) {
          hurt(e, 30, p); const a = angTo(d, e), kb = e.type === 'dev' ? 10 : e.type === 'uzunboyun' ? 5 : 50;
          e.x += Math.cos(a) * kb; e.y += Math.sin(a) * kb; d.ramCd = 0.7; SFX.thump(0.5); G.shake = Math.max(G.shake, 4); break;
        }
      }
    } else d.moving = false;
    p.x = d.x; p.y = d.y; p.moving = false;
    if (!mouseAim && m > 0.1) p.ang = d.ang;
  } else {
    p.moving = m > 0.1;
    if (p.moving) {
      const k = Math.min(1, m), spd = pSpeed(p) * (p.sprinting ? 1.6 : 1);
      p.x += mx / m * spd * k * dt; p.y += my / m * spd * k * dt; pushOut(p, false);
      p.anim += dt * (p.sprinting ? 14 : 9); G.tutMoved += spd * k * dt;
      if (!mouseAim) p.ang = angLerp(p.ang, Math.atan2(my, mx), Math.min(1, dt * 12));
    }
  }
  let aim = p.ang;
  if (mouseAim) { const w = screenToWorld(mouse.x, mouse.y); aim = Math.atan2(w.y - p.y, w.x - p.x); p.ang = aim; }
  // yakın dövüş
  p.atkCd -= dt; p.swing = Math.max(0, p.swing - dt);
  const atk = (mouse.down && !G.placing) || keys.Space || touch.atk;
  if (atk && p.atkCd <= 0 && !G.placing) {
    if (!mouseAim) { const best = autoAim(160); if (best) { aim = angTo(p, best); p.ang = aim; } }
    p.atkCd = 0.42; p.swing = 0.2; SFX.swing();
    const reach = G.mount ? 60 : 34, hx = p.x + Math.cos(aim) * reach, hy = p.y + Math.sin(aim) * reach;
    let hit = false;
    for (const d of G.dinos.slice()) {
      if (d.tamed || d.hidden) continue;
      if (Math.hypot(d.x - hx, d.y - hy) < d.r + 30) {
        hurt(d, dmgOf(p), p); hit = true;
        const k = d.type === 'dev' ? 4 : d.type === 'boynuzlu' || d.type === 'uzunboyun' ? 6 : 22;
        d.x += Math.cos(aim) * k; d.y += Math.sin(aim) * k;
      }
    }
    if (hit) { SFX.hit(0.6); G.shake = Math.max(G.shake, 3); }
  }
  // ok
  G.shootCd -= dt;
  const shoot = keys.KeyF || mouse.right || touch.shoot;
  if (shoot && G.shootCd <= 0) {
    if (!G.tech.has('yay')) { if (!G.flags.noBow) { G.flags.noBow = 1; msg('Önce Zanaat menüsünden (C) Ok ve Yay yapmalısın.', '#ccc', 3); } }
    else {
      if (!mouseAim) { const best = autoAim(420); if (best) aim = angTo(p, best); p.ang = aim; }
      G.shootCd = 0.65; shootArrow(p, p.x + Math.cos(aim) * 300, p.y + Math.sin(aim) * 300, 22);
    }
  }
  // etkileşim
  G.interact = findInteract();
  const act = keys.KeyE || touch.act;
  const it = G.interact;
  if (act && it && it.kind !== 'mount' && it.kind !== 'info') {
    G.actT += dt;
    const rate = { fire: 0.18, tame: 2.0, tameLong: 2.0, tameFly: 1.5, rescue: 0.6, revive: 1.5, treat: 1.5, egg: 1.0, rift: 1.5 }[it.kind] || 0.4;
    G.actProg = clamp(G.actT / rate, 0, 1);
    if (G.actT >= rate) { G.actT = 0; doInteract(it); }
    if (it.kind !== 'fire' && it.o) p.ang = angTo(p, it.o);
  } else { G.actT = 0; G.actProg = 0; }
  // meşale
  if (G.torchOn) { G.torchFuel -= dt; if (G.torchFuel <= 0) { if (G.stock.wood > 0) { G.stock.wood--; G.torchFuel = 30; } else { G.torchOn = false; msg('Meşalen söndü! Odun yok.', '#f99', 3); } } }
  // iyileşme ve yaralar
  p.lastHurt += dt; p.hurtT = Math.max(0, p.hurtT - dt);
  if (!(p.injury && p.injury.type === 'enfeksiyon')) {
    if (p.lastHurt > 5 && dist(p, G.fire) < fireR()) p.hp = Math.min(p.maxhp, p.hp + 2 * dt * (nearSifahane(p) ? 2 : 1));
    else if (p.lastHurt > 8) p.hp = Math.min(p.maxhp, p.hp + 0.3 * dt);
  }
  updInjury(p, dt);
  // yumurta teslimi
  if (G.carryEgg && L && dist(L, G.fire) < 130) {
    G.carryEgg = false; G.eggs.push({ hatch: G.day + 1 });
    for (const d of G.dinos) if (d.mother) { d.mother = false; d.leave = !isNight(); }
    msg('Yumurta ateşin sıcağında. Yarın şafakta çatlayacak.', '#ffe39a', 5); unlock('yumurta'); SFX.bell();
  }
}
function onActPress() {
  if (!G.started || G.over || !L) return false;
  if (G.mount) { dismount(false); return true; }
  const it = findInteract();
  if (it && it.kind === 'mount') { mount(it.o); return true; }
  return false;
}
function findInteract() {
  const p = L; let best = null, bd = 1e9;
  const consider = (o, kind, d, label) => { if (d < bd) { bd = d; best = { o, kind, label }; } };
  if (G.mount) return { o: G.mount, kind: 'mount', label: 'İn' };
  if (G.tech.has('eyer')) for (const d of G.dinos) if (d.tamed && d.type === 'boynuzlu') { const dd = dist(d, p) - d.r; if (dd < 30) consider(d, 'mount', dd - 50, 'Bin (Boynuzlu)'); }
  for (const q of G.people) {
    if (q === p || q.inHut || q.grabbed) continue;
    const dd = dist(q, p);
    if (q.downed > 0 && dd < 40) consider(q, 'revive', dd - 60, `${acc(q.name)} kaldır — basılı tut`);
    else if (q.injury && dd < 32 && needsCare(q)) consider(q, 'treat', dd - 20, q.injury.type === 'enfeksiyon' ? `${dat(q.name)} ilaç ver (1💊)` : q.injury.type === 'kirik' ? `${gen(q.name)} kırığını sar` : `${gen(q.name)} yarasını sar`);
  }
  for (const d of G.dinos) {
    if (d.tamed) continue;
    const dd = dist(d, p) - d.r;
    if (d.type === 'boynuzlu' && d.ko > 0 && dd < 40) consider(d, 'tame', dd - 30, 'Evcilleştir (15🍖) — basılı tut');
    if (d.type === 'uzunboyun' && !d.angry && dd < 40) consider(d, 'tameLong', dd - 20, 'Besle, güvenini kazan (25🍖)');
    if (d.type === 'kanatli' && d.st === 'land' && d.alt < 0.2 && dd < 40) consider(d, 'tameFly', dd - 20, 'Sessizce yaklaş, besle (10🍖)');
  }
  if (!G.carryEgg) for (const n of G.nests) if (n.eggs > 0) { const dd = dist(n, p) - n.r; if (dd < 30) consider(n, 'egg', dd - 10, 'Yumurta çal (anneler gelir!)'); }
  { const dd = dist(G.rift, p) - G.rift.r; if (dd < 70 && !G.finale) consider(G.rift, 'rift', dd - 10, G.tech.has('yarikTasi') ? 'Yarık Taşı’nı yerleştir — son savaş başlar!' : 'Zaman yarığı. Açmak için Yarık Taşı gerekli.'); }
  if (G.rescue) { const dd = dist(G.rescue, p); if (dd < 55) consider(G.rescue, 'rescue', dd - 40, `${acc(G.rescue.name)} kurtar`); }
  { const dd = dist(G.fire, p) - 30; if (dd < 50) consider(G.fire, 'fire', dd, G.stock.wood > 0 ? 'Ateşe odun at' : 'Odun yok!'); }
  for (const arr of [G.bushes, G.herbs, G.poisons]) for (const b of arr) { if (b.amt < 1) continue; const dd = dist(b, p) - b.r; if (dd < 26) consider(b, 'gather', dd, { food: 'Meyve topla', herb: 'Şifalı ot topla', poison: 'Zehirli bitki topla' }[b.res]); }
  for (const o of gQuery(p.x, p.y, 70)) {
    if (o.dead || !(o.amt > 0)) continue;
    const dd = dist(o, p) - o.r - p.r;
    if (dd > 20) continue;
    if (o.kind === 'tree' && !o.stump) consider(o, 'gather', dd, 'Odun kes');
    if (o.kind === 'rock') consider(o, 'gather', dd, 'Taş kır');
    if (o.kind === 'crystal') consider(o, 'gather', dd, 'Kristal çıkar');
  }
  return best;
}
function doInteract(it) {
  const o = it.o;
  if (it.kind === 'fire') {
    if (G.stock.wood > 0 && G.fire.fuel < 100) {
      G.stock.wood--; G.fire.fuel = Math.min(100, G.fire.fuel + 9); G.tutFire++; SFX.crackle(0.4);
      for (let i = 0; i < 4; i++) G.parts.push({ x: o.x, y: o.y, vx: rand(-30, 30), vy: rand(-120, -50), life: rand(0.4, 1), col: '#ffb040', s: 2 });
    }
  } else if (it.kind === 'gather') {
    const r = takeRes(o); addStock(r, 1, o.x, o.y);
    if (r === 'wood') { SFX.chop(); o.shake = 0.2; G.tutWood++; } else if (r === 'stone' || r === 'crystal') SFX.rock(); else SFX.pickup();
  } else if (it.kind === 'tame') {
    if (G.stock.food < 15) { msg('Evcilleştirmek için 15🍖 gerek.', '#e99', 2); return; }
    G.stock.food -= 15; o.tamed = true; o.ko = 0; o.hp = o.maxhp; o.angry = 0; o.tgt = null; tamed(o, 'Boynuzlu artık senin! Kampı koruyacak.' + (G.tech.has('eyer') ? ' Yanında E ile binebilirsin.' : ' Eyer yaparsan binebilirsin.'));
  } else if (it.kind === 'tameLong') {
    if (G.stock.food < 25) { msg('Uzunboyun için 25🍖 gerek.', '#e99', 2); return; }
    G.stock.food -= 25; o.tamed = true; o.angry = 0; o.wt = 0; tamed(o, 'Uzunboyun sana güvendi. Kampa yük taşıyacak (odun + taş).');
  } else if (it.kind === 'tameFly') {
    if (G.stock.food < 10) { msg('Kanatlı için 10🍖 gerek.', '#e99', 2); return; }
    G.stock.food -= 10; o.tamed = true; o.leave = false; tamed(o, 'Kanatlı seni seçti! Kampın üstünde dönüp yaklaşan yırtıcıları haber verecek.');
  } else if (it.kind === 'revive' || it.kind === 'treat') treat(o, L);
  else if (it.kind === 'egg') takeEgg(o);
  else if (it.kind === 'rift') { if (G.tech.has('yarikTasi')) startFinale(); else msg(`Yarık Taşı gerekli: 25💎 40🪨 40🪵, Gözetleme Kulesi bilgisi ve en az 12 kişilik halk.`, '#9cf', 5); }
  else if (it.kind === 'rescue') {
    const r = G.rescue; G.rescue = null;
    const p = mkPerson(r.x, r.y, r.name, false); p.group = 'takip'; p.fear = 40; p.hp = Math.max(10, r.hp); G.people.push(p);
    msg(`${r.name} halkına katıldı! (Şimdilik seni takip ediyor)`, '#9f9', 5); SFX.bell(); moraleAdd(6); G.uiDirty = true;
  }
}
function tamed(d, text) { G.stats.tamed++; moraleAdd(5); msg(text, '#9f9', 6); SFX.bell(); if (G.stats.tamed >= 3) unlock('evcil3'); G.uiDirty = true; }

// =============================================================
//  İNŞA ve ZANAAT
// =============================================================
const buildUnlocked = t => !BUILD[t].tech || G.tech.has(BUILD[t].tech);
function startPlace(t) {
  if (!buildUnlocked(t)) { msg(`${BUILD[t].ad} için önce "${TECH[BUILD[t].tech].ad}" bilgisini edin (Zanaat).`, '#e99', 3); return; }
  if (!canAfford(BUILD[t].cost)) { msg(`${BUILD[t].ad} için yeterli malzeme yok (${costTxt(BUILD[t].cost)})`, '#e99', 3); return; }
  G.placing = t;
  msg(isTouch ? `${BUILD[t].ad}: Saldır düğmesiyle önüne yerleştir.` : `${BUILD[t].ad}: tıklayarak yerleştir, sağ tık / Esc iptal.`, '#cde', 3);
}
function cancelPlace() { G.placing = null; }
function placePos() {
  if (mouse.used && !isTouch) { const w = screenToWorld(mouse.x, mouse.y); const dx = w.x - L.x, dy = w.y - L.y, d = Math.hypot(dx, dy); if (d > 220) return { x: L.x + dx / d * 220, y: L.y + dy / d * 220 }; return w; }
  return { x: L.x + Math.cos(L.ang) * (G.mount ? 90 : 60), y: L.y + Math.sin(L.ang) * (G.mount ? 90 : 60) };
}
function placeOk(t, p) {
  const r = BUILD[t].r;
  if (p.x < 60 || p.y < 60 || p.x > WORLD - 60 || p.y > WORLD - 60) return false;
  if (Math.hypot(p.x - G.fire.x, p.y - G.fire.y) < 50 + r) return false;
  for (const o of gQuery(p.x, p.y, r + 10)) { if (o.dead) continue; const wall = o.kind === 'build' && (o.type === 'cit' || o.type === 'duvar') && (t === 'cit' || t === 'duvar'); if (Math.hypot(o.x - p.x, o.y - p.y) < o.r + r - (wall ? 14 : 0)) return false; }
  for (const b of G.builds) if (b.type === 'tuzak' && Math.hypot(b.x - p.x, b.y - p.y) < 30 + r) return false;
  if (G.pools.some(pl => Math.hypot(pl.x - p.x, pl.y - p.y) < pl.r + r)) return false;
  return true;
}
function makeBuild(t, x, y, ang) {
  const b = { x, y, r: BUILD[t].r, kind: 'build', type: t, hp: BUILD[t].hp, maxhp: BUILD[t].hp, occ: [], uses: 3, ang: ang || 0, guard: null, shootT: 0 };
  G.builds.push(b); if (t !== 'tuzak') gAdd(b);
  return b;
}
function tryPlace() {
  const t = G.placing; if (!t) return;
  const p = placePos();
  if (!placeOk(t, p)) { msg('Buraya inşa edilemez.', '#e99', 2); return; }
  if (!canAfford(BUILD[t].cost)) { msg('Malzeme bitti.', '#e99', 2); cancelPlace(); return; }
  pay(BUILD[t].cost); makeBuild(t, p.x, p.y, L.ang); SFX.build();
  if (t === 'kulube') { msg(`Kulübe kuruldu. Nüfus sınırı: ${popCap()}`, '#cfe', 3); moraleAdd(2); }
  if (t === 'kule') unlock('kule');
  if (!canAfford(BUILD[t].cost) || !['cit', 'duvar', 'tuzak'].includes(t)) cancelPlace();
  G.uiDirty = true;
}
function destroyBuild(b) {
  if (b.dead) return;
  b.dead = true; gDel(b); G.builds.splice(G.builds.indexOf(b), 1);
  if (b.guard) { b.guard.post = null; b.guard = null; }
  for (let i = 0; i < 14; i++) G.parts.push({ x: b.x + rand(-b.r, b.r), y: b.y + rand(-b.r, b.r), vx: rand(-80, 80), vy: rand(-80, 80), life: rand(0.5, 1), col: '#6a4a2a', s: rand(2, 5) });
  SFX.hit(0.5); noise(0.6, 0.4, 'lowpass', 800, 100);
  if (b.type === 'kulube') {
    msg('Bir kulübe parçalandı!', '#f88', 4);
    for (const p of b.occ) { p.inHut = null; p.x = b.x + rand(-20, 20); p.y = b.y + rand(-20, 20); p.fear = Math.min(100, p.fear + 50); }
    b.occ = [];
  }
  G.uiDirty = true;
}
function techState(id) {
  const t = TECH[id];
  if (G.tech.has(id) && !t.repeat) return 'done';
  for (const r of t.req) if (!G.tech.has(r)) return 'locked';
  if (t.reqTame && !G.dinos.some(d => d.tamed && d.type === t.reqTame)) return 'locked';
  if (t.reqPop && G.people.length < t.reqPop) return 'locked';
  return canAfford(t.cost) ? 'ok' : 'poor';
}
function lockReason(id) {
  const t = TECH[id], out = [];
  for (const r of t.req) if (!G.tech.has(r)) out.push(`önce ${TECH[r].ad}`);
  if (t.reqTame && !G.dinos.some(d => d.tamed && d.type === t.reqTame)) out.push(`evcil ${DINO[t.reqTame].ad} gerekli`);
  if (t.reqPop && G.people.length < t.reqPop) out.push(`halk en az ${t.reqPop} kişi olmalı (${G.people.length})`);
  return out.join(', ');
}
function craft(id) {
  const s = techState(id);
  if (s === 'done') return;
  if (s === 'locked') { msg(`${TECH[id].ad}: ${lockReason(id)}.`, '#e99', 3); return; }
  if (s === 'poor') { msg(`${TECH[id].ad} için malzeme yetersiz (${costTxt(TECH[id].cost)}).`, '#e99', 3); return; }
  pay(TECH[id].cost);
  if (id === 'ilac') G.stock.med++; else G.tech.add(id);
  if (id === 'elMesalesi') { G.torchOn = true; G.torchFuel = 60; }
  SFX.build(); msg(`${TECH[id].ad} hazır!`, '#cfe', 3);
  G.uiDirty = true; G.toolsDirty = true; G.craftDirty = true;
}
function toggleTorch() {
  if (!G.tech.has('elMesalesi')) { msg('Önce Zanaat menüsünden El Meşalesi yap (6🪵).', '#ccc', 3); return; }
  if (!G.torchOn && G.torchFuel <= 0) { if (G.stock.wood < 1) { msg('Meşale için odun yok!', '#e99', 2); return; } G.stock.wood--; G.torchFuel = 30; }
  G.torchOn = !G.torchOn; SFX.crackle(0.3);
}

// =============================================================
//  GÜN DÖNGÜSÜ ve KORKU OLAYLARI
// =============================================================
function decideNight() {
  if (G.day <= 1) return 'normal';
  if (G.day === 2) return 'dev';
  const o = [['normal', 35], ['dev', 14 + G.day * 2], ['avci', 16], ['firtina', 12], ['sis', 10], ['yagmur', 10]];
  let s = o.reduce((a, b) => a + b[1], 0) * Math.random();
  for (const [k, w] of o) { s -= w; if (s <= 0) return k; }
  return 'normal';
}
function newDay() {
  G.day++; G.flags = {}; G.devDone = false; G.leaveDone = false; G.mimic = null; G.tracks = []; G.silent = false;
  const kids = G.people.filter(p => p.child).length, ad = G.people.length - kids;
  let tn = 0; for (const d of G.dinos) if (d.tamed) tn += d.type === 'boynuzlu' ? 3 : d.type === 'uzunboyun' ? 5 : 1;
  const need = Math.ceil((ad * 2 + kids + tn) * DIFF[G.diff].eat);
  const rafs = G.builds.filter(b => b.type === 'raf').length;
  if (rafs) G.stock.food += rafs * 3;
  if (G.stock.food >= need) { G.stock.food -= need; moraleAdd(4); msg(`☀️ ${G.day}. Gün. Hayattasınız. Halk ${need}🍖 yedi.${rafs ? ` (Raflar +${rafs * 3}🍖)` : ''}`, '#ffe6a0', 6); }
  else {
    G.stock.food = 0; moraleAdd(-20);
    msg(`☀️ ${G.day}. Gün... ama yiyecek yetmedi. Açlık herkesi zayıflattı!`, '#f99', 6);
    for (const p of G.people.slice()) if (!p.dead) hurt(p, p.child ? 8 : 18, null);
  }
  G.stats.fireNights = G.fireOutTonight ? 0 : G.stats.fireNights + 1; G.fireOutTonight = false;
  G.stats.noLoss = G.lossToday ? 0 : G.stats.noLoss + 1; G.lossToday = false;
  SFX.bell();
  halkDawn();
  // yeni gelenler
  if (G.people.length > 0 && G.people.length < popCap() && G.stock.food >= need) {
    let n = (Math.random() < 0.65 ? 1 : 0) + (G.morale > 70 && Math.random() < 0.5 ? 1 : 0) + (G.day > 3 && Math.random() < 0.3 ? 1 : 0);
    for (let i = 0; i < n && G.people.length < popCap(); i++) {
      const a = rand(0, TAU), p = mkPerson(CAMP.x + Math.cos(a) * 380, CAMP.y + Math.sin(a) * 380, freshName(), false);
      p.fear = 30; p.group = G.newGroup; G.people.push(p);
      msg(`${p.name} ateşinizi görmüş ve halkınıza katıldı (${GROUPS[p.group].ic} ${GROUPS[p.group].ad}).`, '#9f9', 6);
    }
    if (n) moraleAdd(2);
  } else if (G.people.length >= popCap()) msg('Yeni gelenler için yer yok. Kulübe inşa et.', '#ccc', 5);
  // yumurtalar ve yavrular
  const keep = [];
  for (const e of G.eggs) {
    if (e.hatch <= G.day) {
      const d = mkDino('yirtici', G.fire.x + rand(-40, 40), G.fire.y + rand(30, 50));
      Object.assign(d, { tamed: true, pet: true, growth: 0, hp: 30, maxhp: 30, r: 9 }); G.dinos.push(d);
      G.stats.tamed++; if (G.stats.tamed >= 3) unlock('evcil3');
      msg('Yumurta çatladı! Bir yırtıcı yavrusu seni annesi sandı. Peşinden gelecek, büyüdükçe güçlenecek.', '#ffe39a', 7); SFX.baby();
    } else keep.push(e);
  }
  G.eggs = keep;
  for (const d of G.dinos) if (d.pet) { d.growth = Math.min(1, (d.growth || 0) + 0.34); d.maxhp = Math.round(30 + 50 * d.growth); d.hp = d.maxhp; }
  G.nightType = decideNight();
  G.dayRainAt = Math.random() < 0.2 ? rand(0.1, 0.32) : -1;
  G.rescueAt = Math.random() < 0.55 ? rand(0.1, 0.3) : -1;
  checkAch();
  saveGame('dawn');
  G.uiDirty = true;
}
function makeTracks() {
  const a = rand(0, TAU); let x = G.fire.x + Math.cos(a) * 1050, y = G.fire.y + Math.sin(a) * 1050;
  const ang = a + Math.PI;
  for (let i = 0; i < 16; i++) {
    const side = i % 2 ? 1 : -1;
    G.tracks.push({ x: x + Math.cos(ang + Math.PI / 2) * 22 * side, y: y + Math.sin(ang + Math.PI / 2) * 22 * side, a: ang });
    x += Math.cos(ang) * 42; y += Math.sin(ang) * 42;
  }
}
function timeEvents() {
  const p = phase(), f = G.flags, nt = G.nightType;
  // gündüz işaretleri
  if (nt === 'dev' && p > 0.1 && !f.tracks) { f.tracks = 1; makeTracks(); }
  if (G.tracks.length && !f.trSeen && G.tracks.some(t => dist(t, L) < 140)) { f.trSeen = 1; msg('Devasa ayak izleri... kampa doğru gidiyor. Bu gece bir şey gelecek.', '#f97', 6); SFX.sting(); }
  if (nt === 'avci' && p > 0.28 && !f.silent) { f.silent = 1; G.silent = true; msg('Kuşlar sustu. Orman fazla sessiz...', '#cba', 6); }
  if ((nt === 'firtina' || nt === 'yagmur') && p > 0.3 && !f.clouds) { f.clouds = 1; msg('Ufukta kara bulutlar toplanıyor.', '#9ab', 5); }
  if (nt === 'sis' && p > 0.36 && !f.mist) { f.mist = 1; msg('Bataklıktan soğuk bir nem yükseliyor...', '#abb', 5); }
  if (G.dayRainAt > 0 && p > G.dayRainAt) { G.dayRainAt = -1; setWeather('yagmur', rand(40, 80)); }
  if (p > 0.40 && !f.a) { f.a = 1; msg('Güneş alçalıyor. Gece için odun stokla!', '#fda', 5); }
  if (p > 0.47 && !f.b) {
    f.b = 1; msg('Hava kararıyor... Herkes ateşin başına.', '#f9a070', 5); SFX.sting();
    if (nt === 'firtina' || nt === 'yagmur' || nt === 'sis') setWeather(nt, 9999);
    if (nt === 'avci') msg('Bu gece av gecesi. Sürüler toplanıyor.', '#e98', 5);
    G.mimicAt = G.day >= 2 && Math.random() < 0.35 ? rand(0.65, 0.82) : -1;
  }
  if (p > 0.62 && !f.c) { f.c = 1; if (G.day === 1) msg('Karanlıkta parlayan gözler var. Ateşten uzaklaşma.', '#e88', 6); }
  if (p > 0.66 && G.day >= 2 && !G.rift.found && !G.riftHint) { G.riftHint = true; msg(`${(s => s[0].toLocaleUpperCase('tr') + s.slice(1))(compass(angTo(G.fire, G.rift)))} ufkunda gökyüzü maviye boyanıyor... Orada bir şey var.`, '#9cf', 7); }
  if (G.mimicAt > 0 && p > G.mimicAt && !G.mimic) {
    G.mimicAt = -1;
    const sl = G.people.find(q => q.inHut);
    if (sl) {
      const a = rand(0, TAU), r = rand(650, 850);
      G.mimic = { x: G.fire.x + Math.cos(a) * r, y: G.fire.y + Math.sin(a) * r, name: sl.name, t: 40, sT: 0 };
      msg(`Ormandan bir ses: "${L.name}... ${L.name}... yardım et..." Bu ${gen(sl.name)} sesi. Ama ${sl.name} kulübede uyuyor.`, '#c9b', 9);
    }
  }
  if (p > 0.9 && !f.miss) {
    f.miss = 1;
    if (G.day >= 3 && Math.random() < 0.12) {
      const occ = G.people.filter(q => q.inHut && !q.leader);
      if (occ.length) {
        const v = pick(occ), h = v.inHut;
        killPerson(v, null, true); G.lossToday = true;
        G.stains.push({ x: h.x, y: h.y + h.r + 6, r: 12, life: 200 });
        msg(`Şafaktan hemen önce bir kulübenin kapısı gıcırdadı... ${v.name} yatağında yok. Sadece kan izi.`, '#d88', 9);
        for (const q of G.people) q.fear = Math.min(100, q.fear + 20);
      }
    }
  }
  if (p > 0.93 && !G.leaveDone) {
    G.leaveDone = true;
    for (const d of G.dinos) if (!d.tamed && !d.finale && (d.type === 'yirtici' || d.type === 'dev') && !d.mother) d.leave = true;
    if (G.weather.type !== 'acik') setWeather('acik', 0);
    G.silent = false;
    msg('Şafak söküyor. Gölgeler geri çekiliyor...', '#fe9', 5);
  }
  if (G.rescueAt > 0 && p > G.rescueAt && !G.rescue && !f.r) {
    f.r = 1; const pos = spawnPos(900, 1300);
    if (pos) {
      G.rescue = { x: pos.x, y: pos.y, r: 11, name: freshName(), isRescue: true, hp: 60, maxhp: 60, ang: 0, anim: 0, skin: '#d0a078', hair: '#2a1a10', group: 'bos', hurtT: 0, traits: [] };
      msg(`Uzaklardan bir çığlık! Biri yardım istiyor — işarete git (${G.rescue.name}).`, '#9cf', 7);
      SFX.scream(0.25, panOf(pos.x));
      if (Math.random() < 0.7) { const a = rand(0, TAU); spawnPack('kucuk', ri(2, 3), { x: pos.x + Math.cos(a) * 380, y: pos.y + Math.sin(a) * 380 }); }
    }
  }
  if (G.rescue && p > 0.6) { msg(`${gen(G.rescue.name)} sesi karanlıkta kayboldu...`, '#c88', 5); G.rescue = null; }
}
function updMimic(dt) {
  const m = G.mimic; if (!m) return;
  m.t -= dt; m.sT -= dt;
  if (m.sT <= 0) { m.sT = 6; SFX.mimic(volOf(m, 1500) * 0.8 + 0.08, panOf(m.x)); }
  if (dist(L, m) < 160) {
    for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + rand(-0.3, 0.3); const d = mkDino('yirtici', L.x + Math.cos(a) * 230, L.y + Math.sin(a) * 230); d.rush = 6; d.tgt = L; d.engaged = true; pushOut(d, true); G.dinos.push(d); }
    msg('Bu... o değildi.', '#f66', 5); SFX.screech(0.9, 0); G.mimic = null;
  } else if (m.t <= 0) G.mimic = null;
}

// =============================================================
//  FİNAL — zaman yarığı
// =============================================================
function startFinale() {
  G.tech.delete('yarikTasi');
  G.finale = { t: 100, waveT: 3, devDone: false };
  msg('Yarık Taşı yerine oturdu. Gökyüzü yarıldı! 100 saniye dayan — yarığın yanında kal!', '#9cf', 8);
  SFX.roar(0.7); SFX.sting(); G.shake = 12;
  for (const p of G.people) p.fear = Math.min(100, p.fear + 20);
}
function updFinale(dt) {
  const F = G.finale; F.t -= dt; F.waveT -= dt;
  if (F.waveT <= 0) {
    F.waveT = 7;
    const n = ri(2, 3) + Math.floor((100 - F.t) / 30);
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), d = mkDino(Math.random() < 0.25 ? 'kucuk' : 'yirtici', G.rift.x + Math.cos(a) * 560, G.rift.y + Math.sin(a) * 560);
      d.finale = true; d.rush = 99; pushOut(d, true); G.dinos.push(d);
    }
  }
  if (F.t < 60 && !F.devDone) {
    F.devDone = true; const a = rand(0, TAU), d = mkDino('dev', G.rift.x + Math.cos(a) * 700, G.rift.y + Math.sin(a) * 700);
    d.finale = true; d.rush = 99; G.dinos.push(d); SFX.roar(1); msg('DEV KAFA YARIĞA KOŞUYOR!', '#f64', 5);
  }
  if (F.t <= 0) {
    if (L && dist(L, G.rift) < 450) victory();
    else { msg('Yarık kapandı... Lider yanında değildi. Yeni bir Yarık Taşı gerekecek.', '#c9b', 7); G.finale = null; }
  }
}
function victory() {
  G.over = true; G.won = true; unlock('kurtulus');
  const saved = G.people.filter(p => dist(p, G.rift) < 520), left = G.people.length - saved.length;
  store.del('sonAtesKayit'); store.del('sonAtesSafak');
  SFX.win();
  showVictory(saved, left);
}
function gameOver() {
  if (G.over) return;
  G.over = true;
  if (G.day > +(store.get('sonAtesRekor') || 0)) store.set('sonAtesRekor', G.day);
  if (G.diff !== 'kolay') store.del('sonAtesKayit');
  setTimeout(showGameOver, 2500);
}

// =============================================================
//  KAYIT
// =============================================================
function serialize() {
  const pf = ['id', 'name', 'x', 'y', 'leader', 'child', 'age', 'traits', 'story', 'group', 'hp', 'maxhp', 'fear', 'skin', 'hair', 'injury', 'downed', 'tired', 'watched', 'partner', 'parentA', 'parentB', 'stam', 'seat', 'r'];
  let ex = ''; for (let i = 0; i < G.explored.length; i++) ex += G.explored[i] ? '1' : '0';
  return JSON.stringify({
    v: 2, seed: G.seed, diff: G.diff, t: G.t, day: G.day, stock: G.stock, fuel: G.fire.fuel, morale: G.morale, tech: [...G.tech],
    managers: G.managers, zone: G.zone, newGroup: G.newGroup, torchFuel: G.torchFuel, nightType: G.nightType, weather: G.weather,
    eggs: G.eggs, usedNames: [...G.usedNames], stats: G.stats, idc: G.idc, kills: G.kills, deaths: G.deaths, lost: G.lost,
    devSeenEver: G.devSeenEver, riftFound: G.rift.found, riftHint: G.riftHint, rescueAt: G.rescueAt, dayRainAt: G.dayRainAt,
    flags: G.flags, leaveDone: G.leaveDone, devDone: G.devDone, tut: G.tut.on ? G.tut.step : -1,
    trees: G.trees.map(o => o.amt), rocks: G.rocks.map(o => o.dead ? 0 : o.amt), crystals: G.crystals.map(o => o.dead ? 0 : o.amt),
    bushes: G.bushes.map(o => o.amt), herbs: G.herbs.map(o => o.amt), poisons: G.poisons.map(o => o.amt), nests: G.nests.map(n => n.eggs),
    builds: G.builds.map(b => ({ type: b.type, x: b.x, y: b.y, hp: b.hp, uses: b.uses, ang: b.ang })),
    people: G.people.filter(p => !p.grabbed).map(p => { const o = {}; for (const k of pf) o[k] = p[k]; o.inHut = p.inHut ? G.builds.indexOf(p.inHut) : -1; return o; }),
    dinos: G.dinos.filter(d => d.tamed).map(d => ({ type: d.type, x: d.x, y: d.y, hp: d.hp, maxhp: d.maxhp, pet: !!d.pet, growth: d.growth || 0, r: d.r, mounted: G.mount === d })),
    explored: ex
  });
}
function saveGame(kind) {
  if (!G.started || G.over || G.diff === 'kabus' || G.finale || !L) return;
  try {
    const s = serialize();
    store.set('sonAtesKayit', s);
    if (kind === 'dawn' && G.diff === 'kolay') store.set('sonAtesSafak', s);
  } catch (e) { }
}
function loadGame(s) {
  const D = JSON.parse(s);
  resetState(D.diff);
  G.seed = D.seed; genWorld(G.seed);
  Object.assign(G, { t: D.t, day: D.day, morale: D.morale, newGroup: D.newGroup || 'bos', torchFuel: D.torchFuel || 0, nightType: D.nightType || 'normal',
    weather: D.weather || { type: 'acik', t: 0 }, eggs: D.eggs || [], stats: Object.assign(G.stats, D.stats || {}), idc: D.idc, kills: D.kills, deaths: D.deaths, lost: D.lost,
    devSeenEver: D.devSeenEver, riftHint: D.riftHint, rescueAt: -1, dayRainAt: D.dayRainAt || -1, flags: D.flags || {}, leaveDone: D.leaveDone, devDone: D.devDone });
  Object.assign(G.stock, D.stock); G.fire.fuel = D.fuel; G.rift.found = !!D.riftFound;
  G.tech = new Set(D.tech); G.usedNames = new Set(D.usedNames);
  for (const g of GORDER) { G.managers[g] = (D.managers || {})[g] || null; G.zone[g] = (D.zone || {})[g] || null; }
  D.trees.forEach((a, i) => { const t = G.trees[i]; if (!t) return; t.amt = a; if (a <= 0) treeDown(t); });
  for (const [arr, src] of [[G.rocks, D.rocks], [G.crystals, D.crystals]]) src.forEach((a, i) => { const o = arr[i]; if (!o) return; o.amt = a; if (a <= 0) { o.dead = true; gDel(o); } });
  for (const [arr, src] of [[G.bushes, D.bushes], [G.herbs, D.herbs], [G.poisons, D.poisons]]) src.forEach((a, i) => { if (arr[i]) arr[i].amt = a; });
  D.nests.forEach((e, i) => { if (G.nests[i]) G.nests[i].eggs = e; });
  for (const b of D.builds) { const o = makeBuild(b.type, b.x, b.y, b.ang); o.hp = b.hp; o.uses = b.uses; }
  for (const s2 of D.people) {
    const p = mkPerson(s2.x, s2.y, s2.name, s2.leader, s2.child);
    Object.assign(p, s2); p.inHut = null;
    if (s2.inHut >= 0) { const h = G.builds[s2.inHut]; if (h && h.type === 'kulube' && h.occ.length < 3) { h.occ.push(p); p.inHut = h; } }
    G.people.push(p); if (p.leader) L = p;
  }
  if (!L) L = G.people[0];
  for (const s2 of D.dinos) {
    const d = mkDino(s2.type, s2.x, s2.y);
    Object.assign(d, { hp: s2.hp, maxhp: s2.maxhp, tamed: true, pet: s2.pet, growth: s2.growth, r: s2.r || d.r });
    if (d.fly) { d.alt = 1; d.home = { x: d.x, y: d.y }; }
    G.dinos.push(d);
    if (s2.mounted) { G.mount = d; d.mounted = true; }
  }
  if (D.explored) for (let i = 0; i < D.explored.length && i < G.explored.length; i++) G.explored[i] = D.explored[i] === '1' ? 1 : 0;
  G.tut = D.tut >= 0 ? { on: true, step: D.tut } : { on: false, step: 0 };
  msg(`Kayıt yüklendi: ${G.day}. gün.`, '#cfe', 4);
  onGameStart();
}

// =============================================================
//  BAŞARIMLAR, KEŞİF, ÖĞRETİCİ
// =============================================================
let ACHSET = (() => { try { return new Set(JSON.parse(store.get('sonAtesBasarim') || '[]')); } catch (e) { return new Set(); } })();
function unlock(k) {
  if (ACHSET.has(k) || !ACH[k]) return;
  ACHSET.add(k); store.set('sonAtesBasarim', JSON.stringify([...ACHSET]));
  toast(`🏆 Başarım: <b>${ACH[k].ad}</b> — ${ACH[k].desc}`); SFX.ach();
}
function exploredPct() { let n = 0; for (let i = 0; i < G.explored.length; i++) n += G.explored[i]; return n / G.explored.length; }
function checkAch() {
  if (G.stats.noLoss >= 10) unlock('kayipsiz');
  if (G.stats.fireNights >= 5) unlock('ates');
  if (G.stats.tamed >= 3) unlock('evcil3');
  if (G.people.length >= 20) unlock('halk20');
  if (exploredPct() >= 0.4) unlock('kasif');
  if (G.day >= 15) unlock('gun15');
  if (G.diff === 'kabus' && G.day >= 10) unlock('kabus');
}
function markExplored(x, y, r) {
  const c = Math.ceil(r / MAPC), ci = Math.floor(x / MAPC), cj = Math.floor(y / MAPC);
  for (let j = cj - c; j <= cj + c; j++) for (let i = ci - c; i <= ci + c; i++) {
    if (i < 0 || j < 0 || i >= MAPN || j >= MAPN) continue;
    if (Math.hypot((i + 0.5) * MAPC - x, (j + 0.5) * MAPC - y) < r) G.explored[j * MAPN + i] = 1;
  }
  if (!G.rift.found && Math.hypot(x - G.rift.x, y - G.rift.y) < r + 150) { G.rift.found = true; msg('Mavi bir ışık... ZAMAN YARIĞI! Buradan eve dönebiliriz. (Zanaat: Yarık Taşı)', '#9cf', 8); SFX.bell(); }
  for (const n of G.nests) if (!n.found && Math.hypot(x - n.x, y - n.y) < r) n.found = true;
}
const TUT = [
  { t: 'Hareket et: WASD / oklar (telefonda ekranın sol yarısı).', done: () => G.tutMoved > 150 },
  { t: 'Bir ağaca yaklaş ve E basılı tut (telefonda Topla): 5 odun kes.', done: () => G.tutWood >= 5 },
  { t: 'Ateşin yanında E basılı tut: ateşe odun at.', done: () => G.tutFire > 0 },
  { t: 'Sağdaki HALK panelinde bir grubun + düğmesine bas: kişi aktar.', done: () => G.tutGroup },
  { t: 'Bir gruba ★ ile yönetici ata. Yönetici grubu hızlandırır ve özel emir (⚡, 📍) verir.', done: () => GORDER.some(g => G.managers[g]) },
  { t: 'Zanaat menüsünü aç (C ya da ⚒️) ve Taş Mızrak yap.', done: () => G.tech.has('tasMizrak') },
  { t: 'Bir Kulübe inşa et (alttaki 🛖 ya da 1): +3 nüfus, güvenli uyku.', done: () => G.builds.some(b => b.type === 'kulube') },
  { t: 'Gece geliyor. Ateşi doldur, halkını ışıkta tut. Haritayı (M) açıp çevreyi keşfet. İyi şanslar.', done: () => isNight() }
];
function updTut() {
  const T = G.tut; if (!T.on) return;
  while (T.step < TUT.length && TUT[T.step].done()) { T.step++; if (T.step < TUT.length) SFX.pickup(); }
  if (T.step >= TUT.length) { T.on = false; store.set('sonAtesTutDone', '1'); }
}

// =============================================================
//  ANA GÜNCELLEME
// =============================================================
function update(dt) {
  G.now += dt; G.dt = dt;
  const prevP = phase(); G.t += dt; if (phase() < prevP) newDay();
  if (G.over) return;
  const LS = lights(), zones = safeZones();
  // ateş
  const wt = G.weather.type;
  G.fire.fuel = Math.max(0, G.fire.fuel - dt * (isNight() ? 0.3 : 0.14) * DIFF[G.diff].burn * (wt === 'yagmur' ? 1.8 : wt === 'firtina' ? 2.2 : 1));
  G.stokeT -= dt;
  if (G.stokeT <= 0) {
    G.stokeT = 1;
    if (G.fire.fuel < 70 && G.stock.wood > 0 && G.people.some(p => !p.leader && !p.inHut && !p.grabbed && !p.downed && dist(p, G.fire) < 160 && p.fear < 85)) { G.stock.wood--; G.fire.fuel = Math.min(100, G.fire.fuel + 9); }
  }
  if (G.fire.fuel <= 0 && !G.fire.out) { G.fire.out = true; msg('ATEŞ SÖNDÜ! Karanlık her yerde...', '#ff4030', 6); SFX.sting(); if (isNight()) { G.fireOutTonight = true; moraleAdd(-10); } }
  if (G.fire.fuel > 0 && G.fire.out) { G.fire.out = false; msg('Ateş yeniden canlandı.', '#fd9', 3); }
  // yeniden büyüme
  G.regrowT -= dt;
  if (G.regrowT <= 0) {
    G.regrowT = 2;
    if (!isNight()) { for (const b of G.bushes) if (b.amt < b.max && Math.random() < 0.03) b.amt++; for (const b of G.herbs) if (b.amt < b.max && Math.random() < 0.012) b.amt++; for (const b of G.poisons) if (b.amt < b.max && Math.random() < 0.01) b.amt++; }
  }
  for (const g of GORDER) { const a = G.abil[g]; a.cd = Math.max(0, a.cd - dt); a.act = Math.max(0, a.act - dt); }
  G.scoutCd -= dt;
  updWeather(dt);
  updLeader(dt);
  for (const p of G.people.slice()) if (p !== L && !p.dead) updPerson(p, dt, LS);
  if (G.over) return;
  const prey = preyList();
  for (const d of G.dinos.slice()) if (!d.dead) updDino(d, dt, prey, zones);
  separate(G.people); separate(G.dinos);
  for (const p of G.people) if (!p.inHut && !p.grabbed && p !== L) pushOut(p, false);
  if (G.mount) { L.x = G.mount.x; L.y = G.mount.y; }
  // kuleler
  for (const k of G.builds) {
    if (k.type !== 'kule') continue;
    k.shootT -= dt;
    if (k.guard && dist(k.guard, k) < 12 && k.shootT <= 0) {
      let foe = null, fd = 320; for (const d of G.dinos) { if (!hostile(d)) continue; const dd = dist(d, k); if (dd < fd) { fd = dd; foe = d; } }
      if (foe) { k.shootT = 1.2; shootArrow(k, foe.x, foe.y, tr(k.guard, 'avci') ? 22 : 15); }
    }
  }
  updProj(dt);
  G.spawnT -= dt; if (G.spawnT <= 0) { G.spawnT = 1.5; spawner(); }
  for (const d of G.dinos.slice()) if (!d.tamed && !d.carry && !d.finale && !d.mother && L && dist(d, L) > 2200 && dist(d, G.fire) > 2000) removeDino(d);
  timeEvents(); updMimic(dt); if (G.finale) updFinale(dt);
  if (G.over) return;
  G.postT -= dt; if (G.postT <= 0) { G.postT = 1; assignPosts(); }
  G.expT -= dt; if (G.expT <= 0) { G.expT = 0.4; markExplored(L.x, L.y, G.mount ? 450 : 380); }
  G.achT -= dt; if (G.achT <= 0) { G.achT = 2; checkAch(); updTut(); }
  G.saveT -= dt; if (G.saveT <= 0) { G.saveT = 45; saveGame('auto'); }
  // tehlike → kalp atışı
  let danger = 0;
  for (const d of G.dinos) { if (!hostile(d)) continue; const rr = d.type === 'dev' ? 900 : d.type === 'yirtici' ? 420 : 220; danger = Math.max(danger, 1 - dist(d, L) / rr); }
  G.danger = clamp(danger, 0, 1);
  G.hbT -= dt; if (G.danger > 0.15 && G.hbT <= 0) { G.hbT = 1.1 - G.danger * 0.65; SFX.heart(0.25 + G.danger * 0.5); }
  // ortam sesleri
  if (A.ctx) {
    const n = darkness(); A.wind.gain.setTargetAtTime(0.04 + n * 0.06 + (wt === 'firtina' ? 0.08 : 0), A.ctx.currentTime, 1); A.drone.gain.setTargetAtTime(n * 0.05 + G.danger * 0.08, A.ctx.currentTime, 1);
    G.ambT -= dt;
    if (G.ambT <= 0) {
      G.ambT = rand(2, 7);
      if (isNight()) {
        if (Math.random() < 0.5) SFX.rustle(rand(0.1, 0.3), rand(-1, 1));
        if (Math.random() < 0.15) SFX.screech(0.06, rand(-1, 1));
        if (Math.random() < 0.08 && G.day >= 2) msg(pick(['Çalılarda bir şey kıpırdadı...', 'Bir dal kırıldı. Çok yakında.', 'Biri... nefes mi alıyor?', 'Gözler. Ateşin ötesinde gözler.', 'Bir an için her şey sustu.']), '#998', 3);
      } else if (!G.silent && Math.random() < 0.6) SFX.bird();
    }
    if (dist(L, G.fire) < 300 && G.fire.fuel > 0 && Math.random() < dt * 6) SFX.crackle(0.05 * (1 - dist(L, G.fire) / 300));
  }
  // efektler
  for (const q of G.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.92; q.vy *= 0.92; q.life -= dt; }
  G.parts = G.parts.filter(q => q.life > 0);
  if (G.parts.length > 600) G.parts.splice(0, G.parts.length - 600);
  if (G.fire.fuel > 0 && Math.random() < dt * 14) G.parts.push({ x: G.fire.x + rand(-10, 10), y: G.fire.y - 5, vx: rand(-15, 15), vy: rand(-90, -40), life: rand(0.5, 1.4), col: pick(['#ffb040', '#ff7020', '#ffe080']), s: rand(1, 2.5) });
  for (const t of G.texts) { t.y -= 25 * dt; t.life -= dt; } G.texts = G.texts.filter(t => t.life > 0);
  for (const s of G.stains) s.life -= dt; G.stains = G.stains.filter(s => s.life > 0);
  for (const t of G.trees) if (t.shake > 0) t.shake -= dt;
  for (const b of G.builds) if (b.hit > 0) b.hit -= dt;
  G.shake *= Math.pow(0.02, dt); G.red = Math.max(0, G.red - dt);
  const before = G.msgs.length; for (const m of G.msgs) m.life -= dt; G.msgs = G.msgs.filter(m => m.life > 0); if (G.msgs.length !== before) G.msgDirty = true;
}
