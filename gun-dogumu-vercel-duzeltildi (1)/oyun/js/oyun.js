'use strict';
// =============================================================
//  OYUN — lider, etkileşim, inşa/zanaat, gün döngüsü, korku
//         olayları, final, kayıt, başarımlar, öğretici, döngü
// =============================================================

function resetState(diff) {
  for (const k of Object.keys(G)) delete G[k];
  Object.assign(G, {
    diff, seed: 0, t: CYCLE * 0.05, day: 1, now: 0, dt: 0,
    stock: { wood: 30, stone: 10, food: 34, bone: 3, hide: 6, herb: 3, poison: 0, crystal: 0, mizrak: 1, balta: 1, kazma: 0, sepet: 0, ok: 0, zok: 0, yay: 0, zirh: 0, mesale: 0, eyer: 0, kemikMizrak: 0, yarikTasi: 0, bandaj: 2, ilac: 1 },
    fire: { x: CAMP.x, y: CAMP.y, fuel: 85, out: false },
    builds: [], people: [], dinos: [], parts: [], texts: [], msgs: [], proj: [], stains: [], tracks: [], rainDrops: [],
    carcs: [], orders: [], hunt: null, huntMode: false, unclean: 0, lcarry: null, oid: 0, eqT: 0, homeT2: 0,
    managers: {}, zone: {}, abil: {}, morale: 60, newGroup: 'bos',
    mount: null, carryEgg: false, eggs: [], torchOn: false, torchFuel: 0,
    shake: 0, red: 0, flash: 0, over: false, won: false, rescue: null, rescueAt: -1, kills: 0, deaths: 0, lost: 0,
    placing: null, flags: {}, stokeT: 0, spawnT: 0, actT: 0, hbT: 0, ambT: 3, uiT: 0, regrowT: 0, postT: 0, expT: 0, achT: 0, saveT: 45,
    interact: null, usedNames: new Set(), started: true, paused: false, modal: false, danger: 0,
    nightPlan: [], nightWeather: 'acik', eproj: [], raid: null, scare: 0, vis: null, campT: 0, weather: { type: 'acik', t: 0 }, mimic: null, finale: null, dayRainAt: -1,
    explored: new Uint8Array(MAPN * MAPN), stats: { fireNights: 0, noLoss: 0, tamed: 0, hunts: 0 }, lossToday: false, fireOutTonight: false,
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
  ['odun', 'avci', 'kasap', 'mimar', 'muhafiz'].forEach((g, i) => {
    const a = i / 5 * TAU + 0.5, p = mkPerson(CAMP.x + Math.cos(a) * 80, CAMP.y + Math.sin(a) * 80, freshName(), false);
    p.group = g; G.people.push(p);
    if (g === 'mimar' && lvl(p, 'insaat') < 2) p.sk.insaat = XPL[1] + 1;
  });
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + 1.2; const b = makeBuild('cadir', CAMP.x + Math.cos(a) * 190, CAMP.y + Math.sin(a) * 170, a + Math.PI); finishBuild(b, true); }
  assignHomes(); assignEquip();
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
    for (const c of G.ccamps) if (c.alive && Math.hypot(c.x - hx, c.y - 12 - hy) < 42) {
      c.totem -= dmgOf(p); hit = true; ftext(c.x, c.y - 50, `Totem ${Math.max(0, Math.round(c.totem))}`, '#fc9');
      if (c.totem <= 0) destroyCamp(c);
    }
    if (hit) { SFX.hit(0.6); G.shake = Math.max(G.shake, 3); }
  }
  // ok
  G.shootCd -= dt;
  const shoot = keys.KeyF || mouse.right || touch.shoot;
  if (shoot && G.shootCd <= 0) {
    if (!(p.eq && p.eq.yay)) { if (!G.flags.noBow) { G.flags.noBow = 1; msg('Yayın yok. Zanaatkârlara Yay ve Ok ürettir (C).', '#ccc', 3); } }
    else {
      if (!mouseAim) { const best = autoAim(420); if (best) aim = angTo(p, best); p.ang = aim; }
      G.shootCd = 0.65; if (shootArrow(p, p.x + Math.cos(aim) * 300, p.y + Math.sin(aim) * 300, 22)) p.swing = 0.2;
    }
  }
  // etkileşim
  G.interact = findInteract();
  const act = keys.KeyE || touch.act;
  const it = G.interact;
  if (act && it && it.kind !== 'mount' && it.kind !== 'info' && it.kind !== 'carry' && it.kind !== 'drop') {
    G.actT += dt;
    const rate = { fire: 0.18, tame: 2.0, tameLong: 2.0, tameFly: 1.5, rescue: 0.6, free: 1.2, revive: 1.5, treat: 1.5, egg: 1.0, rift: 1.5, carc: 0.35, build: 0.25 }[it.kind] || 0.4;
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
  // sırtındaki yaralı
  if (G.lcarry) {
    const q = G.lcarry;
    if (q.dead || q.bed) G.lcarry = null;
    else {
      q.x = p.x - Math.cos(p.ang) * 12; q.y = p.y - Math.sin(p.ang) * 12; q.carriedBy = -1;
      if (q.bedRes && dist(p, q.bedRes.s) < q.bedRes.s.r + 40) { G.lcarry = null; putInBed(q); }
    }
  }
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
  if (G.lcarry) { const q = G.lcarry; G.lcarry = null; q.carriedBy = 0; msg(`${acc(q.name)} yere bıraktın.`, '#ccc', 2); return true; }
  const it = findInteract();
  if (it && it.kind === 'mount') { mount(it.o); return true; }
  if (it && it.kind === 'carry') { G.lcarry = it.o; it.o.carriedBy = -1; if (it.o.inHut) leaveHut(it.o); msg(`${acc(it.o.name)} sırtladın. ${it.o.bedRes ? 'Şifahaneye götür.' : 'Boş yatak yok!'}`, '#9fd', 3); return true; }
  return false;
}
function findInteract() {
  const p = L; let best = null, bd = 1e9;
  const consider = (o, kind, d, label) => { if (d < bd) { bd = d; best = { o, kind, label }; } };
  if (G.mount) return { o: G.mount, kind: 'mount', label: 'İn' };
  if ((G.stock.eyer || 0) > 0) for (const d of G.dinos) if (d.tamed && d.type === 'boynuzlu') { const dd = dist(d, p) - d.r; if (dd < 30) consider(d, 'mount', dd - 50, 'Bin (Boynuzlu)'); }
  for (const q of G.people) {
    if (q === p || q.inHut || q.grabbed) continue;
    const dd = dist(q, p);
    if (q.downed > 0 && dd < 40) consider(q, 'revive', dd - 60, `${acc(q.name)} kaldır — basılı tut`);
    else if (q.bedRes && needsCarry(q) && !q.carriedBy && dd < 40) consider(q, 'carry', dd - 50, `${acc(q.name)} şifahaneye taşı (bas)`);
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
  for (const c of G.carcs) { if (c.dead) continue; const dd = dist(c, p) - c.r; if (dd < 20) consider(c, 'carc', dd + 5, c.meat > 0 ? `Leşten çiğ et kes (${c.meat}) — hastalık riski!` : 'Leşten deri/kemik al'); }
  for (const b of G.builds) if (!b.built) { const dd = dist(b, p) - b.r; if (dd < 24) consider(b, 'build', dd, `${BUILD[b.type].ad} inşasına yardım et (${Math.floor(b.prog / b.need * 100)}%)`); }
  { const dd = dist(G.rift, p) - G.rift.r; if (dd < 70 && !G.finale) consider(G.rift, 'rift', dd - 10, (G.stock.yarikTasi || 0) > 0 ? 'Yarık Taşı’nı yerleştir — son savaş başlar!' : 'Zaman yarığı. Açmak için Yarık Taşı gerekli.'); }
  if (G.rescue) { const dd = dist(G.rescue, p); if (dd < 55) consider(G.rescue, 'rescue', dd - 40, `${acc(G.rescue.name)} kurtar`); }
  for (const c of G.ccamps) c.captives.forEach((cp, k) => { const x = c.x - 30 + k * 24, y = c.y + 34, dd = Math.hypot(x - p.x, y - p.y); if (dd < 45) consider({ x, y, c, k }, 'free', dd - 40, `${gen(cp.p.name)} iplerini çöz`); });
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
  } else if (it.kind === 'carc') {
    if (o.meat > 0) { o.meat--; addStock('food', 1, o.x, o.y); G.unclean = (G.unclean || 0) + (o.rotten ? 3 : 1); }
    else if (o.hide > 0) { o.hide--; addStock('hide', 1, o.x, o.y); } else if (o.bone > 0) { o.bone--; addStock('bone', 1, o.x, o.y); }
    if (o.meat + o.hide + o.bone <= 0) o.dead = true;
    if (!G.flags.rawWarn) { G.flags.rawWarn = 1; msg('Çiğ et hastalık getirebilir. Leşleri bir 🔪 Et Ustası temizlesin.', '#e9a050', 5); }
  } else if (it.kind === 'build') { o.prog += 0.6; SFX.hammer(0.4); if (o.prog >= o.need) finishBuild(o); }
  else if (it.kind === 'tame') {
    if (G.stock.food < 15) { msg('Evcilleştirmek için 15🍖 gerek.', '#e99', 2); return; }
    G.stock.food -= 15; o.tamed = true; o.ko = 0; o.hp = o.maxhp; o.angry = 0; o.tgt = null; tamed(o, 'Boynuzlu artık senin! Kampı koruyacak.' + ((G.stock.eyer || 0) > 0 ? ' Yanında E ile binebilirsin.' : ' Bir Eyer ürettirirsen binebilirsin.'));
  } else if (it.kind === 'tameLong') {
    if (G.stock.food < 25) { msg('Uzunboyun için 25🍖 gerek.', '#e99', 2); return; }
    G.stock.food -= 25; o.tamed = true; o.angry = 0; o.wt = 0; tamed(o, 'Uzunboyun sana güvendi. Kampa yük taşıyacak (odun + taş).');
  } else if (it.kind === 'tameFly') {
    if (G.stock.food < 10) { msg('Kanatlı için 10🍖 gerek.', '#e99', 2); return; }
    G.stock.food -= 10; o.tamed = true; o.leave = false; tamed(o, 'Kanatlı seni seçti! Kampın üstünde dönüp yaklaşan yırtıcıları haber verecek.');
  } else if (it.kind === 'revive' || it.kind === 'treat') treat(o, L);
  else if (it.kind === 'egg') takeEgg(o);
  else if (it.kind === 'free') { if (o.c.captives[o.k]) freeCaptive(o.c, o.k); }
  else if (it.kind === 'rift') { if ((G.stock.yarikTasi || 0) > 0) startFinale(); else msg('Yarık Taşı gerekli: 6. seviye bir zanaatkâr, 25💎 40🪨 40🪵 ve en az 30 kişilik halk.', '#9cf', 6); }
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
const buildUnlocked = t => bestLvl('insaat') >= BUILD[t].lvl;
function startPlace(t) {
  if (!buildUnlocked(t)) { msg(`${BUILD[t].ad} için İnşaat becerisi ${BUILD[t].lvl}. seviyede bir mimar gerekir (şu an en iyi: ${bestLvl('insaat')}).`, '#e99', 4); return; }
  if (!canAfford(BUILD[t].cost)) { msg(`${BUILD[t].ad} için yeterli malzeme yok (${costTxt(BUILD[t].cost)})`, '#e99', 3); return; }
  G.placing = t;
  msg(isTouch ? `${BUILD[t].ad}: Saldır düğmesiyle önüne planla.` : `${BUILD[t].ad}: tıklayarak planla, sağ tık / Esc iptal. Mimarlar inşa eder.`, '#cde', 3);
}
function cancelPlace() { G.placing = null; }
function placePos() {
  if (G.tapPlace) return G.tapPlace;
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
  const b = { x, y, r: BUILD[t].r, kind: 'build', type: t, hp: BUILD[t].hp, maxhp: BUILD[t].hp, occ: [], owners: [], uses: 3, ang: ang || 0, guard: null, shootT: 0, built: false, prog: 0, need: BUILD[t].work, planted: false, g: 0, beds: [0, 0, 0, 0] };
  G.builds.push(b);
  return b;
}
function finishBuild(b, quiet) {
  if (b.built) return;
  b.built = true; b.prog = b.need;
  if (!BUILD[b.type].flat) gAdd(b);
  for (const p of G.people) if (!p.inHut && Math.hypot(p.x - b.x, p.y - b.y) < b.r + p.r) { const a = angTo(b, p); p.x = b.x + Math.cos(a) * (b.r + p.r + 2); p.y = b.y + Math.sin(a) * (b.r + p.r + 2); }
  if (!quiet) { msg(`${BUILD[b.type].ic} ${BUILD[b.type].ad} tamamlandı.`, '#cfe', 3); SFX.build(); }
  if (b.type === 'kule') unlock('kule');
  if (b.type === 'cadir' || b.type === 'sifahane') { assignHomes(); assignBeds(); }
  if (b.type === 'cadir' && !quiet) moraleAdd(2);
  G.uiDirty = true;
}
function tryPlace() {
  const t = G.placing; if (!t) return;
  const p = placePos();
  if (!placeOk(t, p)) { msg('Buraya inşa edilemez.', '#e99', 2); return; }
  if (!canAfford(BUILD[t].cost)) { msg('Malzeme bitti.', '#e99', 2); cancelPlace(); return; }
  pay(BUILD[t].cost); makeBuild(t, p.x, p.y, L.ang); SFX.build();
  if (!members('mimar').length && !G.flags.noMimar) { G.flags.noMimar = 1; msg('Plan hazır. İnşa etmesi için 📐 Mimar ata (boştakiler de yardım eder, sen de E ile yardım edebilirsin).', '#cde', 5); }
  if (!canAfford(BUILD[t].cost) || !['cit', 'duvar', 'tuzak'].includes(t)) cancelPlace();
  G.uiDirty = true;
}
function destroyBuild(b) {
  if (b.dead) return;
  b.dead = true; if (b.built) gDel(b); G.builds.splice(G.builds.indexOf(b), 1);
  if (b.type === 'sifahane') for (const q of G.people) if ((q.bed && q.bed.s === b) || (q.bedRes && q.bedRes.s === b)) releaseBed(q, true);
  if (b.type === 'cadir') for (const q of G.people) if (q.homeT === b) q.homeT = null;
  if (b.guard) { b.guard.post = null; b.guard = null; }
  for (let i = 0; i < 14; i++) G.parts.push({ x: b.x + rand(-b.r, b.r), y: b.y + rand(-b.r, b.r), vx: rand(-80, 80), vy: rand(-80, 80), life: rand(0.5, 1), col: '#6a4a2a', s: rand(2, 5) });
  SFX.hit(0.5); noise(0.6, 0.4, 'lowpass', 800, 100);
  if (b.type === 'cadir') {
    msg('Bir çadır parçalandı!', '#f88', 4);
    for (const p of b.occ) { p.inHut = null; p.x = b.x + rand(-20, 20); p.y = b.y + rand(-20, 20); p.fear = Math.min(100, p.fear + 50); }
    b.occ = [];
  }
  G.uiDirty = true;
}
// ---- üretim emirleri
function crafters(by) { return G.people.filter(p => !p.child && !p.leader && p.group === (by === 'sifa' ? 'sifaci' : 'zanaat')); }
function itemBlock(id) {
  const it = ITEMS[id];
  if (it.reqPop && G.people.length < it.reqPop) return `halk en az ${it.reqPop} kişi olmalı (${G.people.length})`;
  const best = crafters(it.by).reduce((m, p) => Math.max(m, lvl(p, it.by)), 0);
  if (!best) return `${it.by === 'sifa' ? '🌿 Şifacı' : '🔨 Zanaatkâr'} grubunda kimse yok`;
  if (best < it.lvl) return `${SKILLS[it.by].ad} ${it.lvl}. seviye gerekir (en iyi: ${best})`;
  if (it.by === 'zanaat' && !G.builds.some(b => b.type === 'atolye' && b.built)) return 'önce bir 🔨 Atölye inşa et';
  return '';
}
function addOrder(id, n, byId) {
  const b = itemBlock(id);
  if (b && !b.startsWith('önce')) { msg(`${ITEMS[id].ad}: ${b}.`, '#e99', 3); }
  const ex = G.orders.find(o => o.item === id && (o.by || 0) === (byId || 0));
  if (ex) ex.left = Math.min(999, ex.left + n);
  else G.orders.push({ id: ++G.oid, item: id, left: n, prog: 0, paid: false, by: byId || 0, worker: 0 });
  const who = byId ? G.people.find(p => p.id === byId) : null;
  msg(`📋 Üretim emri: ${ITEMS[id].ad}${n > 1 ? (n >= 999 ? ' (sürekli)' : ' ×' + n) : ''}${who ? ' — ' + who.name : ''}`, '#cde', 3);
  G.craftDirty = true; G.uiDirty = true;
}
function cancelOrder(oid) {
  const i = G.orders.findIndex(o => o.id === oid); if (i < 0) return;
  const o = G.orders[i]; if (o.paid) for (const k in ITEMS[o.item].cost) G.stock[k] += ITEMS[o.item].cost[k];
  G.orders.splice(i, 1); G.craftDirty = true;
}
function toggleTorch() {
  if (!(G.stock.mesale > 0)) { msg('El meşalen yok. Zanaatkârlara ürettir (C).', '#ccc', 3); return; }
  if (!G.torchOn && G.torchFuel <= 0) { if (G.stock.wood < 1) { msg('Meşale için odun yok!', '#e99', 2); return; } G.stock.wood--; G.torchFuel = 30; }
  G.torchOn = !G.torchOn; SFX.crackle(0.3);
}

// =============================================================
//  GÜN DÖNGÜSÜ ve KORKU OLAYLARI
// =============================================================
function newDay() {
  G.day++; G.flags = {}; G.devDone = false; G.leaveDone = false; G.mimic = null; G.tracks = []; G.silent = false;
  const kids = G.people.filter(p => p.child).length, ad = G.people.length - kids;
  let tn = 0; for (const d of G.dinos) if (d.tamed) tn += d.type === 'boynuzlu' ? 3 : d.type === 'uzunboyun' ? 5 : 1;
  const need = Math.ceil((ad * 2 + kids + tn) * DIFF[G.diff].eat);
  const rafs = G.builds.filter(b => b.type === 'raf' && b.built).length;
  if (rafs) G.stock.food += rafs * 4;
  if (G.stock.food >= need) { G.stock.food -= need; moraleAdd(4); msg(`☀️ ${G.day}. Gün. Hayattasınız. Halk ${need}🍖 yedi.${rafs ? ` (Raflar +${rafs * 4}🍖)` : ''}`, '#ffe6a0', 6); }
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
  assignHomes();
  let free = emptyTents();
  if (G.people.length > 0 && free > 0 && G.stock.food >= need) {
    let n = 1 + (Math.random() < 0.5 ? 1 : 0) + (G.morale > 65 ? 1 : 0) + (G.day > 4 && Math.random() < 0.4 ? 1 : 0);
    let came = 0;
    while (n > 0 && free > 0) {
      const couple = n >= 2 && Math.random() < 0.3;
      const a = rand(0, TAU), p = mkPerson(CAMP.x + Math.cos(a) * 380, CAMP.y + Math.sin(a) * 380, freshName(), false);
      p.fear = 30; p.group = G.newGroup; G.people.push(p); came++; n--;
      if (couple) {
        const q = mkPerson(p.x + 20, p.y, freshName(), false); q.fear = 30; q.group = G.newGroup; G.people.push(q); came++; n--;
        p.partner = q.id; q.partner = p.id;
        msg(`Bir çift ateşinizi görmüş: ${p.name} ve ${q.name} halkınıza katıldı.`, '#9f9', 6);
      } else msg(`${p.name} ateşinizi görmüş ve halkınıza katıldı (${GROUPS[p.group].ic} ${GROUPS[p.group].ad}).`, '#9f9', 6);
      free--; assignHomes();
    }
    if (came) moraleAdd(2);
  } else if (!free) msg('Ateşinizi gören yabancılar uzaktan baktı... Boş çadır olmadığı için gelmediler. ⛺ Çadır inşa et.', '#ccc', 6);
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
  planNight();
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
function planNight() {
  const d = G.day, ev = [];
  const W = Math.random(); G.nightWeather = W < 0.65 ? 'acik' : W < 0.77 ? 'yagmur' : W < 0.87 ? 'firtina' : 'sis';
  if (d <= 1) { G.nightPlan = ev; return; }
  let n = Math.random() < 0.45 ? 0 : (Math.random() < 0.75 || d < 4 ? 1 : 2);
  if (d === 2 && Math.random() < 0.6) { ev.push({ k: 'dev', at: rand(0.6, 0.8) }); n = Math.max(0, n - 1); }
  const pool = [['taklitci', d >= 4 ? 8 : 0], ['pusu', 30], ['dev', d >= 3 ? 14 : 0], ['yamyam', d >= 3 && G.ccamps.some(c => c.alive) ? 18 : 0], ['sessiz', 14], ['kayip', d >= 3 ? 8 : 0], ['taklit', 10], ['suru', d >= 4 ? 9 : 0]];
  for (let i = 0; i < n; i++) {
    const avail = pool.filter(([k, w]) => w > 0 && !ev.some(e => e.k === k)), tot = avail.reduce((a, b) => a + b[1], 0);
    let s = Math.random() * tot;
    for (const [k, w] of avail) { s -= w; if (s <= 0) { ev.push({ k, at: k === 'kayip' ? 0.9 : rand(0.58, 0.86) }); break; } }
  }
  for (const e of ev) { e.sign = Math.random() < 0.5; e.done = false; }
  G.nightPlan = ev;
}
const hasEv = k => G.nightPlan.find(e => e.k === k);
function edgeVictim() {
  const c = G.people.filter(p => !p.inHut && !p.grabbed && !p.downed && !p.desert);
  if (!c.length) return null;
  // ışığın kenarındakiler ve dışarıdakiler önce
  c.sort((a, b) => (dist(b, G.fire) - fireR() * 0.8) - (dist(a, G.fire) - fireR() * 0.8));
  return Math.random() < 0.7 ? c[0] : pick(c);
}
function runEvent(e) {
  e.done = true;
  if (e.k === 'pusu') { const v = edgeVictim(); if (v) ambush(v, ri(2, 3)); }
  else if (e.k === 'dev') spawnDevEvent(Math.random() < 0.4);
  else if (e.k === 'yamyam') startRaid();
  else if (e.k === 'taklitci') spawnMimicCreature();
  else if (e.k === 'sessiz') {
    const v = edgeVictim(); if (!v) return;
    const a = dist(v, G.fire) > 30 ? angTo(G.fire, v) : rand(0, TAU), d = mkDino('yirtici', v.x + Math.cos(a) * 170, v.y + Math.sin(a) * 170);
    d.rush = 4; d.tgt = v; d.engaged = true; d.silent = true; d.hitrun = true; pushOut(d, true); G.dinos.push(d);
    jumpAt(v.x, v.y, 'Karanlıktan bir şey atıldı!');
  } else if (e.k === 'kayip') {
    const occ = G.people.filter(q => q.inHut && !q.leader);
    if (occ.length) {
      const v = pick(occ), h = v.inHut;
      killPerson(v, null, true);
      G.stains.push({ x: h.x, y: h.y + h.r + 6, r: 12, life: 200 });
      msg(`Şafaktan hemen önce bir kulübenin kapısı gıcırdadı... ${v.name} yatağında yok. Sadece kan izi.`, '#d88', 9);
      for (const q of G.people) q.fear = Math.min(100, q.fear + 20);
    }
  } else if (e.k === 'taklit') {
    const sl = G.people.find(q => q.inHut);
    if (sl) {
      const a = rand(0, TAU), r = rand(650, 850);
      G.mimic = { x: G.fire.x + Math.cos(a) * r, y: G.fire.y + Math.sin(a) * r, name: sl.name, t: 40, sT: 0 };
      msg(`Ormandan bir ses: "${L.name}... ${L.name}... yardım et..." Bu ${gen(sl.name)} sesi. Ama ${sl.name} kulübede uyuyor.`, '#c9b', 9);
    }
  } else if (e.k === 'suru') {
    const pos = spawnPos(950, 1150, G.fire);
    if (pos) { spawnPack('yirtici', ri(6, 9), pos); SFX.screech(0.3, panOf(pos.x)); setTimeout(() => SFX.screech(0.25, panOf(pos.x) * -0.5), 700); }
  }
}
function jumpAt(x, y, text) {
  const d = L ? Math.hypot(L.x - x, L.y - y) : 0;
  if (d < 900) { G.scare = 0.45; G.shake = Math.max(G.shake, 16); SFX.jump(); }
  msg(text, '#ff3a2a', 3);
  for (const p of G.people) if (Math.hypot(p.x - x, p.y - y) < 500) p.fear = Math.min(100, p.fear + 25);
}
function timeEvents() {
  const p = phase(), f = G.flags, nw = G.nightWeather;
  // gündüz işaretleri (her zaman değil — çoğu şey habersiz gelir)
  const dv = hasEv('dev');
  if (dv && dv.sign && p > 0.1 && !f.tracks) { f.tracks = 1; makeTracks(); }
  if (G.tracks.length && !f.trSeen && G.tracks.some(t => dist(t, L) < 140)) { f.trSeen = 1; msg('Devasa ayak izleri... kampa doğru gidiyor.', '#f97', 6); SFX.sting(); }
  const sr = hasEv('suru');
  if (sr && sr.sign && p > 0.28 && !f.silent) { f.silent = 1; G.silent = true; msg('Kuşlar sustu. Orman fazla sessiz...', '#cba', 6); }
  const ym = hasEv('yamyam');
  if (ym && ym.sign && p > 0.33 && !f.paint) { f.paint = 1; msg('Kampın yakınında boyalı el izleri... Birileri sizi izliyor.', '#c98', 6); }
  if ((nw === 'firtina' || nw === 'yagmur') && p > 0.3 && !f.clouds && Math.random() < 0.5) { f.clouds = 1; msg('Ufukta kara bulutlar toplanıyor.', '#9ab', 5); }
  if (G.dayRainAt > 0 && p > G.dayRainAt) { G.dayRainAt = -1; setWeather('yagmur', rand(40, 80)); }
  if (p > 0.40 && !f.a) { f.a = 1; msg('Güneş alçalıyor. Gece için odun stokla!', '#fda', 5); }
  if (p > 0.47 && !f.b) {
    f.b = 1; msg('Hava kararıyor... Herkes ateşin başına.', '#f9a070', 5); SFX.sting();
    if (nw && nw !== 'acik') setWeather(nw, 9999);
  }
  if (p > 0.62 && !f.c) { f.c = 1; if (G.day === 1) msg('Karanlıkta parlayan gözler var. Ateşten uzaklaşma.', '#e88', 6); }
  if (p > 0.66 && G.day >= 2 && !G.rift.found && !G.riftHint) { G.riftHint = true; msg(`${(s => s[0].toLocaleUpperCase('tr') + s.slice(1))(compass(angTo(G.fire, G.rift)))} ufkunda gökyüzü maviye boyanıyor... Orada bir şey var.`, '#9cf', 7); }
  // gece olayları: zamanı bilinmez
  for (const e of G.nightPlan) if (!e.done && p > e.at && p < 0.95) runEvent(e);
  // esirler
  for (const c of G.ccamps) for (let k = c.captives.length - 1; k >= 0; k--) {
    const cp = c.captives[k];
    if (G.day > cp.eatDay || (G.day === cp.eatDay && p > 0.52)) {
      c.captives.splice(k, 1); G.deaths++; G.lossToday = true; moraleAdd(-12);
      G.stains.push({ x: c.x, y: c.y + 20, r: 18, life: 300 });
      SFX.scream(L ? clamp(1 - dist(c, L) / 2500, 0.1, 0.8) : 0.2, panOf(c.x));
      msg(`Uzaklardan, yamyam kampından bir çığlık yükseldi... ${cp.p.name} artık yok.`, '#d66', 8);
      for (const q of G.people) q.fear = Math.min(100, q.fear + 15);
    }
  }
  if (p > 0.93 && !G.leaveDone) {
    G.leaveDone = true;
    for (const d of G.dinos) if (!d.tamed && !d.finale && (d.type === 'yirtici' || d.type === 'dev' || d.type === 'geceavcisi' || d.type === 'taklitci') && !d.mother) d.leave = true;
    for (const d of G.dinos) if (d.type === 'yamyam' && d.raid) d.leave = true;
    if (G.weather.type !== 'acik') setWeather('acik', 0);
    G.silent = false;
    msg('Şafak söküyor. Gölgeler geri çekiliyor...', '#fe9', 5);
  }
  if (G.rescueAt > 0 && p > G.rescueAt && !G.rescue && !f.r) {
    f.r = 1; const pos = spawnPos(900, 1300);
    if (pos) {
      G.rescue = { x: pos.x, y: pos.y, r: 11, name: freshName(), isRescue: true, hp: 60, maxhp: 60, ang: 0, anim: 0, skin: '#d0a078', hair: '#2a1a10', group: 'bos', hurtT: 0, traits: [], id: -1 };
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
  G.stock.yarikTasi--;
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
  const pf = ['id', 'name', 'x', 'y', 'leader', 'child', 'age', 'traits', 'story', 'group', 'hp', 'maxhp', 'fear', 'skin', 'hair', 'injury', 'downed', 'tired', 'watched', 'partner', 'parentA', 'parentB', 'stam', 'seat', 'r', 'sk', 'sick', 'wasDowned', 'bedUntil'];
  let ex = ''; for (let i = 0; i < G.explored.length; i++) ex += G.explored[i] ? '1' : '0';
  return JSON.stringify({
    v: 3, seed: G.seed, diff: G.diff, t: G.t, day: G.day, stock: G.stock, fuel: G.fire.fuel, morale: G.morale, orders: G.orders.map(o => Object.assign({}, o, { worker: 0 })), oid: G.oid, unclean: G.unclean,
    carcs: G.carcs.filter(c => !c.dead).map(c => ({ x: c.x, y: c.y, r: c.r, type: c.type, ang: c.ang, meat: c.meat, bone: c.bone, hide: c.hide, age: c.age, rotten: c.rotten })),
    managers: G.managers, zone: G.zone, newGroup: G.newGroup, torchFuel: G.torchFuel, nightPlan: G.nightPlan, nightWeather: G.nightWeather, weather: G.weather,
    eggs: G.eggs, usedNames: [...G.usedNames], stats: G.stats, idc: G.idc, kills: G.kills, deaths: G.deaths, lost: G.lost,
    devSeenEver: G.devSeenEver, riftFound: G.rift.found, riftHint: G.riftHint, rescueAt: G.rescueAt, dayRainAt: G.dayRainAt,
    flags: G.flags, leaveDone: G.leaveDone, devDone: G.devDone, tut: G.tut.on ? G.tut.step : -1,
    trees: G.trees.map(o => o.amt), rocks: G.rocks.map(o => o.dead ? 0 : o.amt), crystals: G.crystals.map(o => o.dead ? 0 : o.amt),
    bushes: G.bushes.map(o => o.amt), herbs: G.herbs.map(o => o.amt), poisons: G.poisons.map(o => o.amt), nests: G.nests.map(n => n.eggs),
    builds: G.builds.map(b => ({ type: b.type, x: b.x, y: b.y, hp: b.hp, uses: b.uses, ang: b.ang, built: b.built, prog: b.prog, planted: b.planted, g: b.g })),
    people: G.people.filter(p => !p.grabbed).map(p => { const o = {}; for (const k of pf) o[k] = p[k]; o.inHut = p.inHut ? G.builds.indexOf(p.inHut) : -1; o.homeT = p.homeT ? G.builds.indexOf(p.homeT) : -1; o.bed = p.bed ? [G.builds.indexOf(p.bed.s), p.bed.i] : null; return o; }),
    dinos: G.dinos.filter(d => d.tamed).map(d => ({ type: d.type, x: d.x, y: d.y, hp: d.hp, maxhp: d.maxhp, pet: !!d.pet, growth: d.growth || 0, r: d.r, mounted: G.mount === d })),
    explored: ex,
    ccamps: G.ccamps.map(c => ({ alive: c.alive, totem: c.totem, found: c.found, spDay: c.spDay || 0, captives: c.captives.map(cp => { const o = { eatDay: cp.eatDay }; for (const k of pf) o[k] = cp.p[k]; return o; }) }))
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
  Object.assign(G, { t: D.t, day: D.day, morale: D.morale, newGroup: D.newGroup || 'bos', torchFuel: D.torchFuel || 0, nightPlan: D.nightPlan || [], nightWeather: D.nightWeather || 'acik',
    weather: D.weather || { type: 'acik', t: 0 }, eggs: D.eggs || [], stats: Object.assign(G.stats, D.stats || {}), idc: D.idc, kills: D.kills, deaths: D.deaths, lost: D.lost,
    devSeenEver: D.devSeenEver, riftHint: D.riftHint, rescueAt: -1, dayRainAt: D.dayRainAt || -1, flags: D.flags || {}, leaveDone: D.leaveDone, devDone: D.devDone });
  Object.assign(G.stock, D.stock); G.fire.fuel = D.fuel; G.rift.found = !!D.riftFound;
  G.usedNames = new Set(D.usedNames); G.orders = D.orders || []; G.oid = D.oid || 0; G.unclean = D.unclean || 0;
  G.carcs = (D.carcs || []).map(c => Object.assign({ carc: true }, c));
  for (const g of GORDER) { G.managers[g] = (D.managers || {})[g] || null; G.zone[g] = (D.zone || {})[g] || null; }
  D.trees.forEach((a, i) => { const t = G.trees[i]; if (!t) return; t.amt = a; if (a <= 0) treeDown(t); });
  for (const [arr, src] of [[G.rocks, D.rocks], [G.crystals, D.crystals]]) src.forEach((a, i) => { const o = arr[i]; if (!o) return; o.amt = a; if (a <= 0) { o.dead = true; gDel(o); } });
  for (const [arr, src] of [[G.bushes, D.bushes], [G.herbs, D.herbs], [G.poisons, D.poisons]]) src.forEach((a, i) => { if (arr[i]) arr[i].amt = a; });
  D.nests.forEach((e, i) => { if (G.nests[i]) G.nests[i].eggs = e; });
  for (const b of D.builds) { if (!BUILD[b.type]) continue; const o = makeBuild(b.type, b.x, b.y, b.ang); o.hp = b.hp; o.uses = b.uses; o.prog = b.prog || 0; o.planted = !!b.planted; o.g = b.g || 0; if (b.built !== false) finishBuild(o, true); }
  for (const s2 of D.people) {
    const p = mkPerson(s2.x, s2.y, s2.name, s2.leader, s2.child);
    Object.assign(p, s2); p.inHut = null; p.homeT = null; p.bed = null; p.eq = {}; p.sk = Object.assign({}, p.sk || {});
    const ht = G.builds[s2.homeT]; if (s2.homeT >= 0 && ht && ht.type === 'cadir') moveHome(p, ht);
    if (s2.bed) { const sb = G.builds[s2.bed[0]]; if (sb && sb.type === 'sifahane' && sb.built) { sb.beds[s2.bed[1]] = p.id; p.bed = { s: sb, i: s2.bed[1] }; } }
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
  (D.ccamps || []).forEach((s3, i) => {
    const c = G.ccamps[i]; if (!c) return;
    Object.assign(c, { alive: s3.alive, totem: s3.totem, found: s3.found, spDay: s3.spDay });
    c.captives = (s3.captives || []).map(o => { const p = mkPerson(o.x, o.y, o.name, false, o.child); Object.assign(p, o); delete p.eatDay; p.inHut = null; p.grabbed = false; return { p, eatDay: o.eatDay }; });
  });
  assignHomes(); assignEquip(); assignBeds();
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
  if (G.people.length >= 30) unlock('halk30');
  if (exploredPct() >= 0.4) unlock('kasif');
  if (G.day >= 15) unlock('gun15');
  if (G.diff === 'kabus' && G.day >= 10) unlock('kabus');
}
function markExplored(x, y, r, who) {
  const by = who && who !== L && who.name && !who.type ? `🧭 ${who.name}: ` : '';
  const c = Math.ceil(r / MAPC), ci = Math.floor(x / MAPC), cj = Math.floor(y / MAPC);
  for (let j = cj - c; j <= cj + c; j++) for (let i = ci - c; i <= ci + c; i++) {
    if (i < 0 || j < 0 || i >= MAPN || j >= MAPN) continue;
    if (Math.hypot((i + 0.5) * MAPC - x, (j + 0.5) * MAPC - y) < r) G.explored[j * MAPN + i] = 1;
  }
  if (!G.rift.found && Math.hypot(x - G.rift.x, y - G.rift.y) < r + 150) { G.rift.found = true; msg(by + 'Mavi bir ışık... ZAMAN YARIĞI! Buradan eve dönebiliriz. (Zanaat: Yarık Taşı)', '#9cf', 8); SFX.bell(); }
  for (const c of G.ccamps || []) if (!c.found && Math.hypot(x - c.x, y - c.y) < r + 60) { c.found = true; if (c.alive) { msg(by + 'Kafatasları... totemler... bir YAMYAM KAMPI! Haritaya ☠ işaretlendi.', '#f86', 8); SFX.sting(); } }
  for (const n of G.nests) if (!n.found && Math.hypot(x - n.x, y - n.y) < r) n.found = true;
}
const TUT = [
  { t: 'Hareket et: WASD / oklar (telefonda ekranın sol yarısı).', done: () => G.tutMoved > 150 },
  { t: 'Ateşin yanında E basılı tut: ateşe odun at. Ateş sönerse karanlıktaki her şey cesaretlenir.', done: () => G.tutFire > 0 },
  { t: 'Sağdaki HALK panelinde gruplara + ile kişi aktar. Her grubun bir becerisi var; çalıştıkça seviye atlarlar.', done: () => G.tutGroup },
  { t: 'Bir gruba ★ ile yönetici ata: grubu hızlandırır, ⚡ yetenek ve 📍 bölge emri verir.', done: () => GORDER.some(g => G.managers[g]) },
  { t: 'Alttaki 🎯 Av Emri (G) ile bir hayvana dokun: avcılar onu avlar, et ustaları leşi temizler.', done: () => (G.stats.hunts || 0) > 0 || !!G.hunt },
  { t: 'Bir 🔨 Atölye planla (alttaki düğmeler). Mimarlar inşa eder.', done: () => G.builds.some(b => b.type === 'atolye') },
  { t: 'Üretim menüsünü aç (C) ve zanaatkârlara bir emir ver: balta, kazma, ok...', done: () => G.orders.length > 0 || IORDER.some(k => k !== 'mizrak' && k !== 'balta' && k !== 'bandaj' && k !== 'ilac' && G.stock[k] > 0) },
  { t: 'Kâşif grubuna birini ekle (🧭), sonra haritada (M) bilinmeyen bir yere dokun.', done: () => !!G.zone.kasif },
  { t: 'Halkın büyümesi için ⛺ çadır gerekir: her tek kişi ya da çift bir çadırda yaşar. Yarığı açmak için 30 kişi lazım.', done: () => G.builds.filter(b => b.type === 'cadir').length >= 5 },
  { t: 'Gece geliyor. Ateşi doldur, halkını ışıkta tut. İyi şanslar.', done: () => isNight() }
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
    if (G.fire.fuel < 70 && G.stock.wood > 0 && G.people.some(p => !p.leader && !p.inHut && !p.grabbed && !p.downed && !p.bed && dist(p, G.fire) < 280 && p.fear < 90)) { G.stock.wood--; G.fire.fuel = Math.min(100, G.fire.fuel + 9); }
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
  G.vis = visionSources();
  G.eqT -= dt; if (G.eqT <= 0) { G.eqT = 1; assignEquip(); }
  G.homeT2 -= dt; if (G.homeT2 <= 0) { G.homeT2 = 2; assignHomes(); assignBeds(); }
  for (const b of G.builds) if (b.type === 'tarla' && b.built && b.planted && b.g < 1) { b.g = Math.min(1, b.g + dt / (CYCLE * 1.6) * (wt === 'yagmur' || wt === 'firtina' ? 1.4 : 1)); b.tendT = (b.tendT || 0) - dt; }
  for (const c of G.carcs) { c.age += dt; if (!c.rotten && c.age > CYCLE * 1.2 && !G.builds.some(b => b.type === 'raf' && b.built && dist(b, c) < 300)) { c.rotten = true; } if (c.age > CYCLE * 2.5) c.dead = true; }
  G.carcs = G.carcs.filter(c => !c.dead);
  if (isNight() && G.carcs.length && Math.random() < dt * 0.02) { const c = pick(G.carcs); if (dist(c, G.fire) > fireR() + 100) spawnPack('kucuk', ri(2, 4), { x: c.x + rand(-200, 200), y: c.y + rand(-200, 200) }); }
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
    if (k.type !== 'kule' || !k.built) continue;
    k.shootT -= dt;
    if (k.guard && dist(k.guard, k) < 12 && k.shootT <= 0) {
      let foe = null, fd = 320; for (const d of G.dinos) { if (!hostile(d)) continue; const dd = dist(d, k); if (dd < fd) { fd = dd; foe = d; } }
      if (foe) { k.shootT = 1.2; shootArrow(k, foe.x, foe.y, tr(k.guard, 'avci') ? 22 : 15); }
    }
  }
  updProj(dt); updEProj(dt);
  if (G.raid) updRaid(dt);
  G.campT -= dt;
  if (G.campT <= 0) {
    G.campT = 1;
    for (const c of G.ccamps) {
      if (!c.alive) continue;
      const guards = G.dinos.some(d => d.type === 'yamyam' && d.campI === c.i && !d.raid);
      if (!guards && c.spawned && G.day > (c.spDay || 0)) c.spawned = false;
      if (!c.spawned && (visibleK(c.x, c.y, 2.2) || dist(L, c) < 1100)) { spawnGuards(c); c.spDay = G.day; }
    }
  }
  G.spawnT -= dt; if (G.spawnT <= 0) { G.spawnT = 1.5; spawner(); }
  for (const d of G.dinos.slice()) if (!d.tamed && !d.carry && !d.finale && !d.mother && d.campI === undefined && L && dist(d, L) > 2200 && dist(d, G.fire) > 2000) removeDino(d);
  timeEvents(); updMimic(dt); if (G.finale) updFinale(dt);
  if (G.over) return;
  G.postT -= dt; if (G.postT <= 0) { G.postT = 1; assignPosts(); }
  G.expT -= dt; if (G.expT <= 0) { G.expT = 0.4; for (const s of G.vis) if (s.who || s.r > 300) markExplored(s.x, s.y, s.r, s.who); }
  G.achT -= dt; if (G.achT <= 0) { G.achT = 2; checkAch(); updTut(); }
  G.saveT -= dt; if (G.saveT <= 0) { G.saveT = 45; saveGame('auto'); }
  // tehlike → kalp atışı
  let danger = 0;
  for (const d of G.dinos) { if (!hostile(d)) continue; const rr = d.type === 'dev' || d.type === 'yelken' ? 900 : d.type === 'taklitci' ? 600 : d.type === 'yirtici' || d.type === 'yamyam' ? 420 : 240; danger = Math.max(danger, 1 - dist(d, L) / rr); }
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
  G.shake *= Math.pow(0.02, dt); G.red = Math.max(0, G.red - dt); G.scare = Math.max(0, G.scare - dt);
  const before = G.msgs.length; for (const m of G.msgs) m.life -= dt; G.msgs = G.msgs.filter(m => m.life > 0); if (G.msgs.length !== before) G.msgDirty = true;
}
