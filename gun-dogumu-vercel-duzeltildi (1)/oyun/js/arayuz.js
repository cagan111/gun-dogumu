'use strict';
// =============================================================
//  ARAYÜZ — girdi, HUD, halk paneli, karakter kartı, üretim,
//           av emri, ekranlar, ana döngü
// =============================================================
const keys = {}; const mouse = { x: 0, y: 0, down: false, right: false, used: false };
const touch = { jx: 0, jy: 0, atk: false, act: false, run: false, shoot: false, id: null, ox: 0, oy: 0 };
const isTouch = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
const UI = { tab: 'g', sel: new Set(), filter: 'all', sideT: 0, hudT: 0, miniT: 0, toolT: 0, craftT: 0, charT: 0, diff: 'normal', char: 0, craftBy: {}, craftTab: 'zanaat' };
const playing = () => G.started && !G.over && L;

// ---- klavye / fare
addEventListener('keydown', e => {
  audioInit();
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  const first = !keys[e.code]; keys[e.code] = true;
  if (e.code === 'KeyN' && first && typeof sesMute === 'function') sesMute();
  if (!playing()) return;
  if (G.sleep) { if (first) wakeUp('Uyandın.'); return; }
  if (e.code === 'Escape' && CAV_PLACE.recipe) { cavPlaceStop(); return; }
  if (e.code === 'KeyR' && first && CAV_PLACE.recipe) { CAV_PLACE.ang = (CAV_PLACE.ang + Math.PI / 2) % TAU; e.preventDefault(); return; }
  if (e.code === 'KeyE' && first && cavPlaceAct()) return;
  if (e.code === 'KeyE' && first) onActPress();
  if (e.code === 'KeyU' && first) trySleep();
  if ((e.code === 'KeyB' || e.code === 'KeyQ') && first) toggleMenu();
  if (e.code === 'KeyX' && first) { G.sneakOn = !G.sneakOn; }
  if (e.code === 'KeyT') toggleTorch();
  if (e.code === 'KeyC') toggleCraft();
  if (e.code === 'KeyM') toggleMap();
  if (e.code === 'KeyH') { toggleSide(); unlockPtr(); }
  if (e.code === 'Tab') unlockPtr();
  if (e.code === 'KeyG') toggleHunt();
  if (e.code === 'KeyI') { if (UI.inB) closeInterior(); else openInterior(G.inside ? G.inside.b : undefined); }
  if (e.code === 'Escape') { if ($('talkM').style.display === 'flex') closeTalk(); else if ($('tools').classList.contains('open')) toggleMenu(false); else if (UI.char) closeChar(); else if (UI.inB) closeInterior(); else if (G.modal) toggleCraft(false); else if (G.placing) cancelPlace(); else if (G.huntMode) G.huntMode = false; else togglePause(); }
  if (e.code === 'KeyP') togglePause();
  const n = parseInt(e.key);
  if (n >= 1 && n <= 9) { const list = BORDER.filter(buildUnlocked); if (list[n - 1]) startPlace(list[n - 1]); }
});
addEventListener('keyup', e => { keys[e.code] = false; });
const locked = () => document.pointerLockElement === cv;
function look(dx, dy, k) { if (!playing() || G.sleep) return; G.yaw = (G.yaw || 0) + dx * k; G.pitch = clamp((G.pitch || 0) - dy * k * 0.8, -1.1, 1.1); }
function unlockPtr() { if (document.pointerLockElement) document.exitPointerLock(); mouse.down = mouse.right = false; }
addEventListener('mousemove', e => { if (locked()) look(e.movementX || 0, e.movementY || 0, 0.0024); });
document.addEventListener('pointerlockchange', () => { if (!locked()) mouse.down = mouse.right = false; $('lockHint').style.display = (!isTouch && playing() && !locked()) ? 'block' : 'none'; });
const lookT = { id: null, x: 0, y: 0 };
cv.addEventListener('pointermove', e => { if (e.pointerId !== lookT.id) return; look(e.clientX - lookT.x, e.clientY - lookT.y, 0.0075); lookT.x = e.clientX; lookT.y = e.clientY; });
const lookEnd = e => { if (e.pointerId === lookT.id) lookT.id = null; };
cv.addEventListener('pointerup', lookEnd); cv.addEventListener('pointercancel', lookEnd);
cv.addEventListener('pointerdown', e => {
  audioInit();
  if (!playing()) return;
  if (G.sleep) { wakeUp('Uyandın.'); return; }
  if (e.pointerType !== 'mouse') {
    if (lookT.id === null) { lookT.id = e.pointerId; lookT.x = e.clientX; lookT.y = e.clientY; try { cv.setPointerCapture(e.pointerId); } catch (_) {} }
    return;
  }
  if (!locked()) { try { const r = cv.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (_) {} return; }
  if (CAV_PLACE.recipe) { if (e.button === 2) cavPlaceStop(); else cavPlaceConfirm(); return; }
  if (G.huntMode && e.button !== 2) { pickHuntTarget(); return; }
  if (e.button === 2) { if (G.placing) cancelPlace(); else mouse.right = true; return; }
  if (G.placing) { tryPlace(); return; }
  mouse.down = true;
});
addEventListener('mouseup', e => { if (e.button === 2) mouse.right = false; else mouse.down = false; });
cv.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('visibilitychange', () => { if (document.hidden && playing()) { saveGame('auto'); if (!G.paused) togglePause(); } });
function togglePause() { if (!playing()) return; unlockPtr(); G.paused = !G.paused; $('pause').style.display = G.paused ? 'flex' : 'none'; }

// ---- av emri
function toggleHunt() {
  if (!playing()) return;
  if (G.hunt) { G.hunt = null; G.huntMode = false; msg('Av emri iptal edildi.', '#ccc', 2); return; }
  G.huntMode = !G.huntMode; if (G.placing) cancelPlace();
  if (G.huntMode) msg(isTouch ? '🎯 Hayvana bak, sonra Saldır düğmesine bas.' : '🎯 Hayvana bak ve tıkla.', '#ffd27a', 4);
}
function pickHuntTarget(sx, sy) {
  let best = null, bd = 0.22;   // nişangâha en yakın hayvan
  for (const d of G.dinos) { if (d.tamed || d.hidden || (d.type === 'taklitci' && !d.revealed)) continue; if (!visible(d.x, d.y, d.r)) continue; const ds = dist(d, L); if (ds > 1300) continue; const dd = Math.abs(angDiff(angTo(L, d), G.yaw)) - Math.atan2(d.r, ds); if (dd < bd) { bd = dd; best = d; } }
  G.huntMode = false;
  if (!best) { msg('Baktığın yerde avlanacak bir şey yok.', '#ccc', 2); return; }
  G.hunt = { t: best };
  const n = members('avci').length;
  msg(n ? `🎯 ${n} avcı ${DINO[best.type].ad} için yola çıktı.${members('takip').length ? ' Takipçilerin de saldıracak.' : ''}` : `🎯 Hedef: ${DINO[best.type].ad}. Ama hiç 🏹 Avcın yok!`, n ? '#ffd27a' : '#e99', 4);
  SFX.pickup();
}

// ---- dokunmatik
if (isTouch) {
  $('touch').style.display = 'block';
  const joy = $('joy'), base = $('knobBase'), knob = $('knob');
  joy.addEventListener('pointerdown', e => { audioInit(); if (G.sleep) { wakeUp('Uyandın.'); return; } touch.id = e.pointerId; touch.ox = e.clientX; touch.oy = e.clientY; base.style.display = 'block'; base.style.left = (e.clientX - 55) + 'px'; base.style.top = (e.clientY - 55 - joy.getBoundingClientRect().top) + 'px'; joy.setPointerCapture(e.pointerId); });
  joy.addEventListener('pointermove', e => { if (e.pointerId !== touch.id) return; let dx = e.clientX - touch.ox, dy = e.clientY - touch.oy; const m = Math.hypot(dx, dy); if (m > 45) { dx *= 45 / m; dy *= 45 / m; } touch.jx = dx / 45; touch.jy = dy / 45; knob.style.left = (31 + dx) + 'px'; knob.style.top = (31 + dy) + 'px'; });
  const end = e => { if (e.pointerId !== touch.id) return; touch.id = null; touch.jx = touch.jy = 0; base.style.display = 'none'; knob.style.left = knob.style.top = '31px'; };
  joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
  const hold = (id, k) => {
    const el = $(id);
    el.addEventListener('pointerdown', e => { audioInit(); e.preventDefault(); if (G.sleep) { wakeUp('Uyandın.'); return; } if (CAV_PLACE.recipe && (k === 'atk' || k === 'shoot')) { cavPlaceConfirm(); return; } if (k === 'act' && cavPlaceAct()) return; if (k === 'atk' && G.huntMode) { pickHuntTarget(); return; } touch[k] = true; if (k === 'atk' && G.placing) { tryPlace(); touch[k] = false; } if (k === 'act') onActPress(); });
    const up = () => touch[k] = false; el.addEventListener('pointerup', up); el.addEventListener('pointerleave', up); el.addEventListener('pointercancel', up);
  };
  hold('tAtk', 'atk'); hold('tAct', 'act'); hold('tRun', 'run'); hold('tShoot', 'shoot');
  $('tTorch').addEventListener('pointerdown', e => { e.preventDefault(); toggleTorch(); });
  $('tMap').addEventListener('pointerdown', e => { e.preventDefault(); toggleMap(); });
  $('tSneak').addEventListener('pointerdown', e => { e.preventDefault(); G.sneakOn = !G.sneakOn; $('tSneak').classList.toggle('act', !!G.sneakOn); });
}

// ---- araç çubuğu
function toggleMenu(force) {
  if (!playing()) return; const t = $('tools'), open = force !== undefined ? force : !t.classList.contains('open');
  t.classList.toggle('open', open); $('menuBtn').classList.toggle('on', open); document.body.classList.toggle('menuOpen', open); if (open) { unlockPtr(); buildTools(); }
}
$('menuBtn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); audioInit(); toggleMenu(); });
$('tools').addEventListener('pointerdown', e => {
  const b = e.target.closest('button'); if (!b) return; e.preventDefault(); audioInit();
  const x = b.dataset.x;
  if (b.dataset.b) { if (G.placing === b.dataset.b) cancelPlace(); else startPlace(b.dataset.b); }
  if (x === 'craft') toggleCraft();
  if (x === 'map') toggleMap();
  if (x === 'torch') toggleTorch();
  if (x === 'hunt') toggleHunt();
  if (x === 'in') openInterior(G.inside ? G.inside.b : undefined);
  if (x === 'sleep') trySleep();
  if (x === 'meal' && G.meal && !L.ate && !G.inside) { const t = G.meal.table; if (Math.hypot(t.x - L.x, t.y - L.y) > 140) msg('Önce sofraya yürü — masa ' + (t.b ? 'mutfağın önünde' : 'ateşin yanında') + '.', '#ffd9a0', 3); else sitAtTable(); }
  if (x === 'chat' && G.gather && !G.inside) { if (dist(L, G.fire) > 320) msg('Ateşin başına yürü; halk orada toplandı.', '#ffd9a0', 3); else joinChat(); }
  if (x === 'sneak') { G.sneakOn = !G.sneakOn; msg(G.sneakOn ? 'Eğildin: sessiz ama yavaşsın.' : 'Doğruldun.', '#cde', 2); }
  if (x === 'people') toggleSide(true);
  if (x === 'self') openChar(L.id);
  if (x === 'auto') { G.autoEq = !G.autoEq; msg(G.autoEq ? 'Eşyalar uygun kişilere kendiliğinden dağıtılacak.' : 'Eşyaları artık sen dağıtıyorsun (kişi kartı → Eşyalar).', '#cde', 3); assignEquip(); }
  if (x === 'gather') { for (const q of G.people) if (!q.leader && !q.child && q.group !== 'takip' && dist(q, L) < 700) { q.prevG = q.group; setGroup(q, 'takip', true); } msg('Yakındaki herkes seni izliyor.', '#cde', 3); G.uiDirty = true; }
  if (x === 'release') { for (const q of G.people) if (q.group === 'takip') setGroup(q, q.prevG && q.prevG !== 'takip' ? q.prevG : 'bos', true); msg('Herkes işine döndü.', '#cde', 3); G.uiDirty = true; }
  if (x !== 'close' && x !== 'auto') toggleMenu(false); else if (x === 'close') toggleMenu(false); else buildTools();
});
const BCATS = [['Barınak', ['cadir', 'kulube']], ['Üretim alanları', ['atolye', 'oktezgah', 'tabakhane', 'kasaphane', 'raf', 'tarla', 'sifahane']], ['Savunma ve ışık', ['cit', 'duvar', 'tuzak', 'mesale', 'kule']], ['Eve dönüş', ['gemi']]];
function buildTools() {
  G.toolsDirty = false;
  if (!$('tools').classList.contains('open')) return;
  const bl = bestLvl('insaat');
  const bb = k => { const B = BUILD[k]; if (!B) return ''; const lk = B.lvl > bl; return `<button data-b="${k}" class="${G.placing === k ? 'on' : ''} ${lk || !canAfford(B.cost) ? 'no' : ''}" title="${B.desc}">${B.ic} ${B.ad}<br><small>${lk ? '🔒 📐' + B.lvl + '. seviye mimar' : costTxt(B.cost)}</small></button>`; };
  const X = (x, t, sub, cls) => `<button data-x="${x}" class="${cls || ''}">${t}${sub ? `<br><small>${sub}</small>` : ''}</button>`;
  let h = `<div class="mhead"><b>Eylemler</b><button data-x="close">✕</button></div>`;
  h += `<div class="cat">Şimdi</div><div class="mrow">`
    + (G.meal && !L.ate ? X('meal', '🍲 Sofraya otur', G.meal.name + ' · masaya gider', '') : '')
    + (G.gather ? X('chat', '🔥 Muhabbete katıl', 'ateş başı · plan, hikâye', '') : '')
    + X('hunt', G.hunt ? '🎯 Avı bırak' : '🎯 Av emri', 'G · hayvana bak', G.hunt || G.huntMode ? 'on' : '')
    + X('sleep', '😴 Uyu', 'U · gece, barınakta', goHome() ? '' : 'no')
    + X('sneak', G.sneakOn ? '🧍 Doğrul' : '🦶 Eğil / sessiz yürü', 'X', G.sneakOn ? 'on' : '')
    + ((G.stock.mesale || 0) > 0 ? X('torch', '🔥 Meşale', 'T', G.torchOn ? 'on' : '') : '')
    + X('map', '🗺️ Harita', 'M') + `</div>`;
  h += `<div class="cat">Halk</div><div class="mrow">`
    + X('people', '👥 Halk paneli', 'H · görev dağıt')
    + X('gather', '👣 Yakındakiler beni izlesin', '')
    + X('release', '↩️ İzleyenler işine dönsün', '')
    + X('self', '🎒 Kendi eşyaların', '')
    + X('auto', G.autoEq ? '🤖 Eşya dağıtımı: otomatik' : '✋ Eşya dağıtımı: elle', 'değiştir', G.autoEq ? 'on' : '') + `</div>`;
  h += `<div class="cat">Üretim ve düzen</div><div class="mrow">`
    + X('craft', '⚒️ Üretim emirleri', 'C' + (G.orders.length ? ' · ' + G.orders.length + ' emir' : ''))
    + X('in', '🏠 Oda düzeni', 'I · mağara / kulübe') + `</div>`;
  for (const [ad, ks] of BCATS) h += `<div class="cat">İnşa — ${ad}</div><div class="mrow">${ks.map(bb).join('')}</div>`;
  { const t = $('tools'), st = t.scrollTop; if (t._h !== h) { t.innerHTML = h; t._h = h; t.scrollTop = st; } }
}
function toggleMap() { const b = $('miniBox'); if (b.style.display === 'none') { b.style.display = 'block'; b.classList.remove('big'); } else if (!b.classList.contains('big')) b.classList.add('big'); else { b.classList.remove('big'); if (innerWidth <= 700) b.style.display = 'none'; } drawMini(); }
$('miniBox').addEventListener('pointerdown', e => {
  e.preventDefault(); const b = $('miniBox');
  if (e.target.id === 'mapClose') { b.classList.remove('big'); if (innerWidth <= 700) b.style.display = 'none'; drawMini(); return; }
  if (!b.classList.contains('big')) { b.classList.add('big'); drawMini(); return; }
  const r = $('mini').getBoundingClientRect();
  sendScouts((e.clientX - r.left) / r.width * WORLD, (e.clientY - r.top) / r.height * WORLD);
});
function sendScouts(x, y) {
  if (!playing()) return;
  const m = members('kasif');
  if (!m.length) { msg('Önce Kâşif grubuna kişi ekle (Halk paneli → 🧭 Kâşif → +).', '#e99', 4); return; }
  G.zone.kasif = { x: clamp(x, 100, WORLD - 100), y: clamp(y, 100, WORLD - 100) };
  for (const p of m) p.stgt = null;
  msg(`🧭 ${m.length} kâşif ${compass(angTo(G.fire, G.zone.kasif))} yönüne yola çıktı. Gece olmadan dönerler.`, '#ffd27a', 4);
  G.uiDirty = true;
}

// ---- halk paneli
function toggleSide(force) { const s = $('side'); const closed = force !== undefined ? !force : !s.classList.contains('closed'); s.classList.toggle('closed', closed); document.body.classList.toggle('sideOpen', !closed && isTouch); $('sideTog').textContent = closed ? '▸' : '▾'; }
$('sideHead').addEventListener('pointerdown', e => { e.preventDefault(); toggleSide(); });
$('side').addEventListener('pointerdown', e => {
  const el = e.target.closest('[data-a],[data-tab],[data-f],[data-bulk]'); if (!el) return;
  e.preventDefault(); audioInit();
  if (el.dataset.tab) { UI.tab = el.dataset.tab; renderSide(); return; }
  if (el.dataset.f) { UI.filter = el.dataset.f; renderSide(); return; }
  if (el.dataset.bulk) { let n = 0; for (const id of UI.sel) { const p = G.people.find(q => q.id === id); if (p) { setGroup(p, el.dataset.bulk); n++; } } msg(`${n} kişi → ${GROUPS[el.dataset.bulk].ic} ${GROUPS[el.dataset.bulk].ad}`, '#cde', 2); UI.sel.clear(); renderSide(); return; }
  const a = el.dataset.a, gEl = el.closest('[data-g]'), g = gEl && gEl.dataset.g, idEl = el.closest('[data-id]'), p = idEl && G.people.find(q => q.id === +idEl.dataset.id);
  if (a === 'plus') plusGroup(g);
  else if (a === 'minus') minusGroup(g);
  else if (a === 'mgr') cycleManager(g);
  else if (a === 'abil') useAbility(g);
  else if (a === 'zone') {
    if (G.zone[g]) clearZone(g);
    else if (g === 'kasif') { const b = $('miniBox'); b.style.display = 'block'; b.classList.add('big'); drawMini(); msg('Haritada bir yere dokun: kâşifler oraya gider.', '#ffd27a', 4); }
    else setZone(g);
  }
  else if (a === 'newg') G.newGroup = GORDER[(GORDER.indexOf(G.newGroup) + 1) % GORDER.length];
  else if (a === 'all') { for (const q of listPeople()) if (!q.child) UI.sel.add(q.id); }
  else if (a === 'none') UI.sel.clear();
  else if (p && a === 'sel') { if (UI.sel.has(p.id)) UI.sel.delete(p.id); else if (!p.child) UI.sel.add(p.id); }
  else if (p && a === 'info') { openChar(p.id); return; }
  renderSide();
});
function listPeople() { return G.people.filter(p => !p.leader && (UI.filter === 'all' || (UI.filter === 'cocuk' ? p.child : p.group === UI.filter && !p.child))); }
function statusOf(p) {
  if (p.grabbed) return '😱'; if (p.desert > 0) return '🏃'; if (p.downed > 0) return `🩸${Math.ceil(p.downed)}`;
  let s = '';
  if (p.bed) s += '⛑️'; else if (p.inHut) s += '💤';
  if (p.injury) s += p.injury.type === 'kanama' ? '🩸' : p.injury.type === 'kirik' ? '🦴' : '🤢';
  if (p.sick) s += '🤒'; if (p.tired) s += '😴'; if (p.fear >= 80) s += '😨'; if (p.post) s += '🗼';
  if (!p.leader && !homeOf(p)) s += '🏚️';
  return s;
}
const topSkill = p => { let b = null, bl = 0; for (const s in SKILLS) { const l = lvl(p, s); if (l > bl) { bl = l; b = s; } } return bl > 1 ? `${SKILLS[b].ic}${bl}` : ''; };
function renderSide() {
  if ($('side').classList.contains('closed')) return;
  $('popTxt').textContent = `${G.people.length} · 🛏️${freeHomes()} boş yer`;
  for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('on', b.dataset.tab === UI.tab);
  const S = sifahaneler(), beds = S.reduce((n, s) => n + (s.beds || []).filter(Boolean).length, 0), bedsT = S.reduce((n, s) => n + bedCount(s), 0);
  const tamed = G.dinos.filter(d => d.tamed);
  const tm = tamed.length ? `<div class="note">🦕 Evcil: ${Object.entries(tamed.reduce((a, d) => { const k = d.pet ? 'Yırtıcı yavrusu' : DINO[d.type].ad; a[k] = (a[k] || 0) + 1; return a; }, {})).map(([k, v]) => `${k} ×${v}`).join(', ')}</div>` : '';
  if (UI.tab === 'g') {
    let h = `<div class="note">Moral <b style="color:${G.morale > 70 ? '#9e9' : G.morale < 30 ? '#f88' : '#eed'}">${Math.round(G.morale)}</b> · ⛑️ ${bedsT ? beds + '/' + bedsT + ' yatak' : 'şifa yeri yok'}${G.meal ? ' · 🍲 yemek vakti' : ''}${G.gather ? ' · 🔥 muhabbet' : ''}${G.planToday ? ' · ' + PLANS[G.planToday].ic + ' ' + PLANS[G.planToday].ad : G.planNext ? ' · yarın: ' + PLANS[G.planNext].ic : ''} · 🤒 ${G.people.filter(p => p.sick).length} · 🏚️ ${homelessCount()}</div>`;
    for (const g of GORDER) {
      const m = members(g), mg = mgr(g), ab = G.abil[g];
      h += `<div class="grp" data-g="${g}"><div class="gh"><span title="${GROUPS[g].desc}">${GROUPS[g].ic} ${GROUPS[g].ad} <b>${m.length}</b></span><span class="gm">${mg ? '★ ' + mg.name + (tr(mg, 'onder') ? ' ⭐' : '') : (g === 'bos' ? '' : '<i>yönetici yok</i>')}</span></div><div class="gb">`;
      if (g !== 'bos') h += `<button data-a="minus">−</button><button data-a="plus">+</button><button data-a="mgr" title="Yönetici ata / değiştir">★</button>`;
      else h += `<span class="hint">Ateşi besler, inşaata ve taşımaya yardım eder</span>`;
      if (ABIL[g]) h += `<button data-a="abil" class="ab ${mg && ab.cd <= 0 ? '' : 'no'} ${ab.act > 0 ? 'on' : ''}" title="${ABIL[g].desc}">⚡ ${ABIL[g].ad}${ab.act > 0 ? ' ' + Math.ceil(ab.act) : ab.cd > 0 ? ' ⏳' + Math.ceil(ab.cd) : ''}</button>`;
      if (['odun', 'tas', 'yiyecek', 'sifaci', 'muhafiz', 'kasif'].includes(g)) h += `<button data-a="zone" class="${mg || g === 'kasif' ? '' : 'no'} ${G.zone[g] ? 'on' : ''}">${g === 'kasif' ? '🗺️' : '📍'}${G.zone[g] ? '✕' : ''}</button>`;
      h += `</div></div>`;
    }
    h += `<div class="grp"><div class="gb"><span class="hint">Yeni gelenler →</span><button data-a="newg">${GROUPS[G.newGroup].ic} ${GROUPS[G.newGroup].ad}</button></div></div>`;
    $('tabG').innerHTML = h + tm; $('tabG').style.display = 'block'; $('tabK').style.display = 'none';
  } else {
    const list = listPeople();
    let h = `<div class="chips"><button data-f="all" class="${UI.filter === 'all' ? 'on' : ''}">Tümü</button>${GORDER.map(g => `<button data-f="${g}" class="${UI.filter === g ? 'on' : ''}" title="${GROUPS[g].ad}">${GROUPS[g].ic}</button>`).join('')}<button data-f="cocuk" class="${UI.filter === 'cocuk' ? 'on' : ''}">👶</button></div>`;
    h += `<div class="bulk"><button data-a="all">Tümünü seç</button><button data-a="none">Temizle</button>${UI.sel.size ? `<span>Seçili ${UI.sel.size} →</span>${GORDER.map(g => `<button data-bulk="${g}" title="${GROUPS[g].ad}">${GROUPS[g].ic}</button>`).join('')}` : '<span class="hint">Seçip toplu aktar · ⓘ karakter kartı</span>'}</div>`;
    for (const p of list) {
      const isM = !p.child && G.managers[p.group] === p.id;
      h += `<div class="pr ${UI.sel.has(p.id) ? 'sel' : ''}" data-id="${p.id}"><span data-a="sel" class="nmw"><span class="ck">${p.child ? '👶' : UI.sel.has(p.id) ? '☑' : '☐'}</span> <span class="nm">${isM ? '★ ' : ''}${p.name}</span> <span class="trs">${p.child ? '' : GROUPS[p.group].ic} ${topSkill(p)}</span> <span class="st">${statusOf(p)}</span></span>`;
      h += `<span class="btns"><button data-a="info">ⓘ</button></span>`;
      h += `<div class="bars"><div class="bar"><i style="width:${p.hp / p.maxhp * 100}%;background:#c44"></i></div><div class="bar fear"><i style="width:${p.fear}%"></i></div></div></div>`;
    }
    if (!list.length) h += '<div class="note">Burada kimse yok.</div>';
    $('tabK').innerHTML = h + tm; $('tabK').style.display = 'block'; $('tabG').style.display = 'none';
  }
  G.uiDirty = false;
}

// ---- karakter kartı
function openChar(id) { unlockPtr(); UI.char = id; $('charM').style.display = 'flex'; G.modal = true; renderChar(); }
function closeChar() { UI.char = 0; $('charM').style.display = 'none'; G.modal = $('craft').style.display === 'flex' || !!UI.inB; }
$('charM').addEventListener('pointerdown', e => {
  if (e.target.id === 'charM') { closeChar(); return; }
  const b = e.target.closest('[data-c]'); if (!b) return; e.preventDefault();
  const p = G.people.find(q => q.id === UI.char); if (!p) { closeChar(); return; }
  const c = b.dataset.c, v = b.dataset.v;
  if (c === 'close') return closeChar();
  if (c === 'grp') setGroup(p, v);
  if (c === 'cmd' && v === 'carry') { const q = woundedNear(p, 2500); if (!q) msg('Yakında taşınacak yaralı yok.', '#ccc', 2); else { p.carryOrder = q.id; msg(`${p.name}, ${acc(q.name)} taşımaya gidiyor.`, '#9fd', 3); } closeChar(); return; }
  if (c === 'cmd') { if (v === 'follow') { if (p.group !== 'takip') p.prevG = p.group; setGroup(p, 'takip'); msg(`${p.name} seni izliyor.`, '#cde', 2); } else { setGroup(p, p.prevG && p.prevG !== 'takip' ? p.prevG : 'bos'); msg(`${p.name} işine döndü.`, '#cde', 2); } closeChar(); return; }
  if (c === 'mgr') setManager(p.group, p);
  if (c === 'ord') addOrder(v, 1, p.id);
  if (c === 'rt') { const ord = [null].concat(GORDER.filter(g => g !== 'bos')); p.routine = p.routine || {}; const cur = p.routine[v] || null; p.routine[v] = ord[(ord.indexOf(cur) + 1) % ord.length]; if (!Object.values(p.routine).some(Boolean)) p.routine = null; }
  if (c === 'give') { if (!giveItem(p, v)) msg('Depoda bundan kalmadı.', '#e99', 2); }
  if (c === 'take') takeItem(p, v);
  if (c === 'jh') p.joinHunt = !p.joinHunt;
  if (c === 'alt') { const ks = Object.keys(ALTS); p.alt = ks[(ks.indexOf(p.alt || 'yiyecek') + 1) % ks.length]; }
  if (c === 'prev' || c === 'next') { const L2 = G.people.filter(q => !q.leader); const i = L2.findIndex(q => q.id === p.id); const n = L2[(i + (c === 'next' ? 1 : -1) + L2.length) % L2.length]; if (n) UI.char = n.id; }
  renderChar(); G.uiDirty = true;
});
function renderChar() {
  const p = G.people.find(q => q.id === UI.char); if (!p) { closeChar(); return; }
  const pt = p.partner && G.people.find(q => q.id === p.partner), home = homeOf(p);
  const kids = G.people.filter(q => q.child && (q.parentA === p.id || q.parentB === p.id));
  const eq = Object.keys(p.eq || {}).filter(k => p.eq[k]).map(k => `${ITEMS[k].ic} ${ITEMS[k].ad}`).join(', ') || '—';
  const task = p.bed ? 'Şifahanede tedavi görüyor' : p.inHut ? 'Uyuyor' : p.carrying ? `${acc(p.carrying.name)} şifahaneye taşıyor` : p.downed > 0 ? 'Yerde, yardım bekliyor!' : p.child ? 'Ateş başında oynuyor' : GROUPS[p.group].desc;
  let h = `<div class="ch"><button data-c="prev">◀</button><b style="font-size:17px">${p.name}</b>${p.child ? ' <span class="hint">çocuk · ' + p.age + '/3 gün</span>' : ''}<span class="res">${statusOf(p)}</span><button data-c="next">▶</button><button data-c="close">✕</button></div><div class="cl">`;
  h += `<div class="cgrid"><div><div class="bar"><i style="width:${p.hp / p.maxhp * 100}%;background:#c44"></i></div><small>Can ${Math.round(p.hp)}/${p.maxhp}</small></div><div><div class="bar fear"><i style="width:${p.fear}%"></i></div><small>Korku ${Math.round(p.fear)}</small></div></div>`;
  if (p.story) h += `<p class="story2">${p.story}</p>`;
  h += `<p><small>${task}</small></p>`;
  h += `<div class="cat">Özellikler</div>` + (p.traits.length ? p.traits.map(t => `<div>${TRAITS[t].ic} <b>${TRAITS[t].ad}</b> — <small>${TRAITS[t].desc}</small></div>`).join('') : '<small>—</small>');
  h += `<div class="cat">Beceriler</div><div class="skills">`;
  for (const s in SKILLS) {
    const l = lvl(p, s), xp = p.sk[s] || 0, a = XPL[l - 1], b = XPL[l] || XPL[9] + 500, f = l >= 10 ? 1 : (xp - a) / (b - a);
    const cur = GROUPS[p.group] && GROUPS[p.group].sk === s;
    h += `<div class="sk ${cur ? 'cur' : ''}"><span>${SKILLS[s].ic} ${SKILLS[s].ad}</span><b>${l}</b><div class="bar"><i style="width:${Math.round(f * 100)}%;background:#d9a94a"></i></div></div>`;
  }
  h += `</div><div class="cat">Hayatı</div><div><small>${home ? `${BUILD[home.type].ic} Evi: ${BUILD[home.type].ad}${home.owners.length > 1 ? ' (paylaşıyor)' : ''}` : '🏚️ Kalacak yeri yok — ateş başında uyuyor'}${pt ? ` · ❤ ${pt.name}` : ''}${kids.length ? ` · 👶 ${kids.map(k => k.name).join(', ')}` : ''}</small></div>`;
  { // eşyalar: kişiye zimmetli; kalanlar depoda
    let ih = '';
    for (const k of OWNABLE) { const has = p.own && p.own[k], fr = freeItems(k); if (!has && fr < 1) continue; if (p.child && k !== 'yatak') continue; ih += has ? `<button data-c="take" data-v="${k}" class="on" title="Geri al, depoya koy">${ITEMS[k].ic} ${ITEMS[k].ad} ✓</button>` : `<button data-c="give" data-v="${k}" title="Depodan ver">${ITEMS[k].ic} ${ITEMS[k].ad} <small>(depoda ${fr})</small></button>`; }
    h += `<div class="cat">Eşyalar — dokun: ver / geri al</div><div class="gsel">${ih || '<small>Depoda verilecek eşya yok. Zanaatkâra ürettir.</small>'}</div>`;
    if (!(p.own && p.own.yatak)) h += `<div><small>🛏️ Yatağı yok; yerde yatıyor.</small></div>`;
  }
  if (p.injury || p.sick) h += `<div><small>Sağlık: ${p.injury ? { kanama: 'kanama', kirik: 'kırık bacak', enfeksiyon: 'enfeksiyon (ilaç gerek)' }[p.injury.type] : ''} ${p.sick ? '· hastalık (' + p.sick.d + '. gün)' : ''}${p.bed ? ' · şifahanede, ' + Math.max(0, p.bedUntil - G.day) + ' gün daha' : ''}</small></div>`;
  if (!p.child && !p.leader) {
    h += `<div class="cat">Emir</div><div class="gsel"><button data-c="cmd" data-v="follow" class="${p.group === 'takip' ? 'on' : ''}">👣 Beni izle</button><button data-c="cmd" data-v="free">↩️ İşine dön</button><button data-c="cmd" data-v="carry">🩹 Yaralıyı taşı</button></div>`;
    h += `<div class="cat">Görev</div><div class="gsel">${GORDER.map(g => `<button data-c="grp" data-v="${g}" class="${p.group === g ? 'on' : ''}" title="${GROUPS[g].desc}">${GROUPS[g].ic} ${GROUPS[g].ad}${GROUPS[g].sk ? ' ' + lvl(p, GROUPS[g].sk) : ''}</button>`).join('')}</div>`;
    h += `<button data-c="mgr" class="wide ${G.managers[p.group] === p.id ? 'on' : ''}">★ ${GROUPS[p.group].ad} grubunun yöneticisi yap</button>`;
    h += `<div class="cat">Günlük rutin</div><div class="gsel">${Object.keys(SLOTS).map(s => { const g = p.routine && p.routine[s]; return `<button data-c="rt" data-v="${s}" class="${g ? 'on' : ''}">${SLOTS[s]}: ${g ? GROUPS[g].ic + ' ' + GROUPS[g].ad : '—'}</button>`; }).join('')}</div><small class="hint">Dokundukça sıradaki mesleğe geçer. Rutin varsa o saatte meslek kendiliğinden değişir; akşam herkes evine döner.</small>`;
    h += `<div class="cat">Av çağrısı</div><div class="gsel"><button data-c="jh" class="${p.joinHunt ? 'on' : ''}">🏹 Av emri verilince ava katıl ${p.joinHunt ? '✓' : ''}</button></div>`;
    h += `<div class="cat">İşi bitince / boşta kalınca</div><div class="gsel"><button data-c="alt">${ALTS[p.alt || 'yiyecek']}</button></div>`;
    if (p.lastMeal !== undefined) h += `<div><small>Son öğün: ${p.lastMeal === 'food' ? '🍲 pişmiş yemek' : p.lastMeal === 'meyve' ? '🫐 meyve' : p.lastMeal === 'et' ? '🍖 çiğ ama temiz et' : p.lastMeal === 'cigEt' ? '🥩 temizlenmemiş et!' : '— aç kaldı'}${p.hunger ? ` · açlık ${p.hunger}` : ''}</small></div>`;
    const by = p.group === 'zanaat' ? 'zanaat' : p.group === 'sifaci' ? 'sifa' : null;
    if (by) {
      h += `<div class="cat">${p.name} için üretim emri</div><div class="gsel">`;
      for (const k of IORDER) { const it = ITEMS[k]; if (it.by !== by) continue; const ok = lvl(p, by) >= it.lvl; h += `<button data-c="ord" data-v="${k}" class="${ok ? '' : 'no'}" title="${it.desc} · ${costTxt(it.cost)}">${it.ic} ${it.ad}${ok ? '' : ' 🔒' + it.lvl}</button>`; }
      h += `</div>`;
      const mine = G.orders.filter(o => o.by === p.id);
      if (mine.length) h += `<div><small>Sırası: ${mine.map(o => `${ITEMS[o.item].ic}×${o.left >= 999 ? '∞' : o.left}`).join(' ')}</small></div>`;
    }
  }
  { const box = $('charBox'), old = box.querySelector('.cl'), st = old && UI.charShown === p.id ? old.scrollTop : 0; box.innerHTML = h + '</div>'; const nw = box.querySelector('.cl'); if (nw) nw.scrollTop = st; UI.charShown = p.id; }
}

// ---- üretim menüsü
function toggleCraft(force) {
  unlockPtr();
  if (!playing()) return;
  const open = force !== undefined ? force : $('craft').style.display !== 'flex';
  $('craft').style.display = open ? 'flex' : 'none'; G.modal = open || !!UI.char;
  if (open) { if (G.placing) cancelPlace(); renderCraft(); }
}
$('craft').addEventListener('pointerdown', e => {
  const b = e.target.closest('[data-o],[data-close],[data-x2],[data-who],[data-ct]'); if (!b) { if (e.target.id === 'craft') toggleCraft(false); return; }
  e.preventDefault();
  if (b.dataset.close !== undefined) { toggleCraft(false); return; }
  if (b.dataset.ct) { UI.craftTab = b.dataset.ct; renderCraft(); return; }
  if (b.dataset.who) { const k = b.dataset.who, list = [0].concat(crafters(ITEMS[k].by).filter(p => lvl(p, ITEMS[k].by) >= ITEMS[k].lvl).map(p => p.id)); const cur = list.indexOf(UI.craftBy[k] || 0); UI.craftBy[k] = list[(cur + 1) % list.length]; renderCraft(); return; }
  if (b.dataset.x2) { cancelOrder(+b.dataset.x2); renderCraft(); return; }
  const [k, n] = b.dataset.o.split(':'); addOrder(k, +n, UI.craftBy[k] || 0); renderCraft();
});
function renderCraft() {
  const by = UI.craftTab;
  let h = `<div class="ch"><b>⚒️ Üretim</b><span class="res">${Object.keys(RES).map(k => `${RES[k]}${G.stock[k] || 0}`).join(' ')}</span><button data-close>✕</button></div>`;
  h += `<div class="ctabs"><button data-ct="zanaat" class="${by === 'zanaat' ? 'on' : ''}">🔨 Zanaatkârlar (${crafters('zanaat').length})</button><button data-ct="sifa" class="${by === 'sifa' ? 'on' : ''}">🌿 Şifacılar (${crafters('sifa').length})</button></div><div class="cl">`;
  if (G.orders.length) {
    h += `<div class="cat">Emirler</div>`;
    for (const o of G.orders) {
      const it = ITEMS[o.item], w = o.worker && G.people.find(p => p.id === o.worker), who = o.by && G.people.find(p => p.id === o.by);
      const wait = !w ? (!o.paid && !canAfford(it.cost) ? 'malzeme bekliyor' : itemBlock(o.item) || 'usta bekliyor') : `${w.name}: ${o.trips > 0 ? 'malzeme getiriyor' : (o.stageAd || 'çalışıyor')}`;
      h += `<div class="card"><div>${it.ic} <b>${it.ad}</b> ×${o.left >= 999 ? '∞' : o.left}${who ? ' · <small>' + who.name + '</small>' : ''}<div class="bar" style="margin-top:4px"><i style="width:${Math.round(o.prog / it.work * 100)}%;background:#d9a94a"></i></div><small>${wait}</small></div><button data-x2="${o.id}">✕</button></div>`;
    }
  }
  h += `<div class="cat">${by === 'zanaat' ? 'Atölye ürünleri' : 'Şifa ürünleri'}</div>`;
  for (const k of IORDER) {
    const it = ITEMS[k]; if (it.by !== by) continue;
    const block = itemBlock(k), who = UI.craftBy[k] ? G.people.find(p => p.id === UI.craftBy[k]) : null;
    const cost = Object.entries(it.cost).map(([r, v]) => `<span class="${(G.stock[r] || 0) >= v ? '' : 'bad'}">${v}${icOf(r)}</span>`).join(' ');
    h += `<div class="card ${block ? 'locked' : ''}"><div><b>${it.ic} ${it.ad}</b> <small>stok ${G.stock[k] || 0} · ${SKILLS[it.by].ic}${it.lvl} · ${cost}</small><br><small>${it.desc}</small>${block ? `<br><small class="bad">🔒 ${block}</small>` : ''}</div>
      <div class="obtns"><button data-who="${k}" title="Kim yapsın?">${who ? who.name : 'Herkes'}</button><button data-o="${k}:1">+1</button><button data-o="${k}:5">+5</button><button data-o="${k}:999" title="Sürekli üret">∞</button></div></div>`;
  }
  $('craftBox').innerHTML = h + '</div>';
  G.craftDirty = false;
}

// ---- iç görünüm: mağara, kulübe ve yapıların odaları
const INB = { sifahane: 'sifa', kasaphane: 'kasap', atolye: 'atolye', cadir: 'yatak' };
const interiorTargets = () => G.builds.filter(b => b.built && !b.dead && (isRoomy(b) || INB[b.type]));
const roomsOf = b => b.type === 'magara' ? ['bos'] : isRoomy(b) ? b.rooms : [INB[b.type]];
function openInterior(b) {
  unlockPtr();
  if (!playing()) return;
  if (!b) b = interiorTargets().filter(x => dist(x, L) < x.r + 220).sort((a, c) => dist(a, L) - dist(c, L))[0] || G.cave;
  if (!b) return;
  if (b.type === 'magara') { closeInterior(); if (!G.inside || G.inside.b !== b) { msg('Eşya yerleştirmek için mağaranın içine gir.', '#cde', 3); return; } cavPlaceStart(); return; }
  UI.inB = b; UI.cavDraft = null; UI.cavNote = ''; UI.cavAngle = 0; G.tutIn = true; $('inM').style.display = 'flex'; G.modal = true; if (G.placing) cancelPlace(); renderInterior();
}
function closeInterior() { UI.inB = null; $('inM').style.display = 'none'; G.modal = !!UI.char || $('craft').style.display === 'flex'; }
function occupants(b) {
  const rooms = roomsOf(b), out = rooms.map(() => []);
  const put = (t, p, k) => { const ids = []; rooms.forEach((r, i) => { if (r === t) ids.push(i); }); if (!ids.length) rooms.forEach((r, i) => { if (r === 'bos') ids.push(i); }); out[ids.length ? ids[(k || 0) % ids.length] : 0].push(p); };
  G.people.filter(p => p.inHut === b).forEach((p, i) => put('yatak', p, Math.floor(i / 4)));
  for (const p of G.people) {
    if (p.inHut === b) continue;
    if (p.bed && p.bed.s === b) { put('sifa', p, Math.floor(p.bed.i / 2)); continue; }
    const here = p.insideB === b || (!isRoomy(b) && p !== L && dist(p, b) < b.r + 40 && !p.moving);
    if (!here) continue;
    const t = G.meal && dist(p, G.meal.table) < 70 ? 'mutfak' : ({ asci: 'mutfak', kasap: 'kasap', zanaat: 'atolye', sifaci: 'sifa' })[p.group] || 'bos';
    put(t, p, 0);
  }
  return out;
}
const IN_HITS = [];
function renderInterior() {
  const b = UI.inB; if (!b || b.dead) { closeInterior(); return; }
  if (b.type === 'magara') { closeInterior(); cavPlaceStart(); return; }
  const c = $('inC'), W = Math.round(Math.min(700, innerWidth * 0.92, innerHeight * 0.5 / 0.56)), H = Math.round(W * 0.56);
  if (c.width !== Math.round(W * DPR)) { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); c.style.width = W + 'px'; c.style.height = H + 'px'; }
  const g = c.getContext('2d'); g.setTransform(DPR, 0, 0, DPR, 0, 0);
  const cave = b.type === 'magara', wood = !cave;
  g.fillStyle = cave ? '#120e0b' : '#2a1c10'; g.fillRect(0, 0, W, H);
  if (cave) { const R = mulberry32(5); for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(${90 + R() * 40},${80 + R() * 30},${70 + R() * 20},${0.06 + R() * 0.08})`; g.beginPath(); g.arc(R() * W, R() * H, 4 + R() * 26, 0, TAU); g.fill(); } }
  const rooms = roomsOf(b), occ = occupants(b), n = rooms.length;
  const cols = n <= 1 ? 1 : n <= 4 ? 2 : 3, rows = Math.ceil(n / cols), pad = 12;
  const cw = (W - pad * (cols + 1)) / cols, ch = (H - pad * (rows + 1)) / rows;
  IN_HITS.length = 0;
  rooms.forEach((t, i) => {
    const cx = pad + (i % cols) * (cw + pad), cy = pad + Math.floor(i / cols) * (ch + pad);
    g.save(); g.beginPath();
    if (cave) { const rr = 26; g.moveTo(cx + rr, cy); g.arcTo(cx + cw, cy, cx + cw, cy + ch, rr); g.arcTo(cx + cw, cy + ch, cx, cy + ch, rr); g.arcTo(cx, cy + ch, cx, cy, rr); g.arcTo(cx, cy, cx + cw, cy, rr); }
    else g.rect(cx, cy, cw, ch);
    const fl = g.createLinearGradient(cx, cy, cx, cy + ch);
    fl.addColorStop(0, cave ? '#3e342a' : '#7a5a36'); fl.addColorStop(1, cave ? '#2a2219' : '#5a4024');
    g.fillStyle = fl; g.fill(); g.clip();
    if (wood) { g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1; for (let y = cy + 10; y < cy + ch; y += 12) { g.beginPath(); g.moveTo(cx, y); g.lineTo(cx + cw, y); g.stroke(); } }
    else { const R = mulberry32(i + 3); g.fillStyle = 'rgba(0,0,0,.18)'; for (let k = 0; k < 30; k++) { g.beginPath(); g.arc(cx + R() * cw, cy + R() * ch, 2 + R() * 6, 0, TAU); g.fill(); } }
    drawRoomFurniture(g, t, cx, cy, cw, ch);
    const lit = g.createRadialGradient(cx + cw / 2, cy + ch / 2, 10, cx + cw / 2, cy + ch / 2, Math.max(cw, ch) * 0.7);
    lit.addColorStop(0, 'rgba(255,170,80,.12)'); lit.addColorStop(1, 'rgba(0,0,0,.45)'); g.fillStyle = lit; g.fillRect(cx, cy, cw, ch);
    g.restore();
    g.strokeStyle = cave ? 'rgba(160,140,110,.35)' : '#3a2410'; g.lineWidth = cave ? 2 : 4; g.strokeRect(cx + (cave ? 4 : 0), cy + (cave ? 4 : 0), cw - (cave ? 8 : 0), ch - (cave ? 8 : 0));
    g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(cx + 6, cy + 6, Math.min(cw - 12, 170), 20);
    g.fillStyle = '#ffd9a0'; g.font = '13px Georgia'; g.textAlign = 'left'; g.fillText(`${ROOMS[t].ic} ${ROOMS[t].ad}`, cx + 11, cy + 21);
    const ps = occ[i], per = Math.max(1, Math.floor((cw - 30) / 46));
    ps.forEach((p, k) => {
      const px = cx + 30 + (k % per) * 46, py = cy + 52 + Math.floor(k / per) * 52;
      if (py > cy + ch - 10) return;
      drawMiniPerson(g, p, px, py);
      IN_HITS.push({ x: px, y: py, id: p.id });
    });
  });
  // alt bilgi
  const homeB = homeCap(b) > 0;
  const res = (b.owners || []).map(id => G.people.find(q => q.id === id)).filter(Boolean);
  let h = `<div class="ch"><b>${BUILD[b.type].ic} ${BUILD[b.type].ad}</b><span class="res">${homeB ? `🛏️ ${households(b)}/${homeCap(b)} hane` : ''} ${roomCount(b, 'depo') ? ' · 📦 depo ' + storeCap() : ''} ${bedCount(b) ? ' · ⛑️ ' + (b.beds || []).filter(Boolean).length + '/' + bedCount(b) + ' yatak' : ''}</span><button data-ix="close">✕</button></div>`;
  if (isRoomy(b)) h += `<div class="cat" style="margin:6px 12px">Odalar — dokunarak türünü değiştir</div><div class="gsel" style="padding:0 12px">${b.rooms.map((r, i) => `<button data-room="${i}" title="${ROOMS[r].desc}">${i + 1}. ${ROOMS[r].ic} ${ROOMS[r].ad}</button>`).join('')}</div>`;
  if (res.length) h += `<div class="cat" style="margin:6px 12px">Burada yaşayanlar</div><div class="gsel" style="padding:0 12px 10px">${res.map(p => `<button data-p="${p.id}">${p.inHut === b ? '💤 ' : ''}${p.name}</button>`).join('')}</div>`;
  h += `<p class="hint" style="padding:0 12px 10px">İçerideki birine dokun: karakter kartı açılır. Sol/sağ ok ile diğer yapılara geç.</p>`;
  $('inInfo').innerHTML = h;
}
const CAV_UI_NAMES = { mat: 'Yer yatağı', bed: 'Yatak', crate: 'Sandık', rack: 'Raf', hearth: 'Ocak', table: 'Masa', bench: 'Zanaat tezgâhı', bowbench: 'Yay tezgâhı', tannery: 'Deri tezgâhı', healbed: 'Tedavi yatağı', herbs: 'Şifa masası', block: 'Kasap kütüğü' };
function cavUiName(f) { const key = f.recipe || (f.k === 'bench' && f.t === 'okcu' ? 'bowbench' : f.k === 'bench' && f.t === 'tabak' ? 'tannery' : f.k); return CAV_UI_NAMES[key] || 'Eşya'; }
// Birinci şahıs eşya yerleştirme: harita/modal yok, dünya çalışmayı sürdürür.
function cavPlaceStart() {
  if (!G.inside || G.inside.b.type !== 'magara' || G.sleep || G.over) return;
  toggleMenu(false); if (G.placing) cancelPlace(); G.huntMode = false;
  CAV_PLACE.b = G.inside.b; CAV_PLACE.recipe = 'bed'; CAV_PLACE.ang = 0;
  mouse.down = mouse.right = false; touch.atk = touch.act = touch.shoot = false;
  cavPlaceAim(); cavPlacePanel();
}
function cavPlaceConfirm() { const f = cavPlaceCommit(); if (f) unlockPtr(); cavPlacePanel(); return f; }
function cavPlaceAct() {
  if (G.paused || G.modal || G.sleep || !G.inside) return false;
  if (CAV_PLACE.recipe) { cavPlaceConfirm(); return true; }
  const f = cavPendingLook(); if (!f) return false;
  UI.cavCancel = f.id; unlockPtr(); cavPlacePanel(); return true;
}
function cavPlacePanel() {
  let el = $('cavPlaceBar');
  if (!el) {
    el = document.createElement('div'); el.id = 'cavPlaceBar';
    el.style.cssText = 'position:fixed;z-index:35;bottom:calc(8px + env(safe-area-inset-bottom,0px));left:50%;transform:translateX(-50%);width:min(460px,calc(100vw - 16px));box-sizing:border-box;padding:6px;background:#17130eeb;border:1px solid #9b835b;border-radius:8px;color:#eadcc0;pointer-events:auto;font:13px Georgia';
    document.body.appendChild(el);
    el.addEventListener('pointerdown', e => e.stopPropagation());
    el.addEventListener('change', e => { if (e.target.id === 'cavRecipe') { CAV_PLACE.recipe = e.target.value; cavPlaceAim(); } });
    el.addEventListener('click', e => {
      const btn = e.target.closest('[data-cav3]'); if (!btn) return;
      const a = btn.dataset.cav3;
      if (a === 'start') cavPlaceStart();
      else if (a === 'rotate') CAV_PLACE.ang = (CAV_PLACE.ang + Math.PI / 2) % TAU;
      else if (a === 'place') cavPlaceConfirm();
      else if (a === 'stop') { cavPlaceStop(); UI.cavCancel = null; }
      else if (a === 'cancel') {
        const f = cavPendingLook();
        if (f && f.id === UI.cavCancel) msg(cavFurnitureCancel(G.inside.b, f.id) ? 'Plan iptal edildi; kullanılmayan malzeme iade edildi.' : 'İade için depoda yer aç.', '#cde', 3);
        UI.cavCancel = null;
      }
      cavPlacePanel();
    });
  }
  el.style.maxWidth = innerWidth >= 640 ? 'calc(100vw - 280px)' : 'calc(100vw - 16px)';
  const active = playing() && G.inside && G.inside.b.type === 'magara' && !G.sleep && !G.paused && !G.modal;
  el.style.display = active ? 'block' : 'none';
  if (!active) { cavPlaceStop(); UI.cavCancel = null; return; }
  if (CAV_PLACE.recipe) cavPlaceAim();
  const S = CAV_PLACE, f = cavPendingLook(), button = (a,t) => `<button data-cav3="${a}" style="height:44px;min-width:44px;flex:0 0 auto;padding:0 8px;white-space:nowrap;background:#3d3325;color:#eadcc0;border:1px solid #9b835b;border-radius:4px">${t}</button>`;
  if (!f || f.id !== UI.cavCancel) UI.cavCancel = null;
  let h;
  if (S.recipe) {
    const def = CAV_FURN_RECIPES[S.recipe];
    h = `<div style="display:flex;align-items:center;gap:4px"><select id="cavRecipe" aria-label="Yerleştirilecek eşya" style="height:44px;min-width:0;flex:1 1 0;width:100%;font-size:13px" title="Eşya seç">${Object.entries(CAV_UI_NAMES).map(([k,n])=>`<option value="${k}" ${k===S.recipe?'selected':''}>${n}</option>`).join('')}</select>${button('rotate','Döndür')}${button('place','Koy')}${button('stop','✕')}</div><div id="cav3Status" style="font-size:11px;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="Bak / yürü · R / tekerlek: döndür · Tık / E: koy · Esc: vazgeç">${costTxt(def.cost)} · ${def.work} sn · ${S.valid?'Uygun':'Çakışıyor'} · ${Math.round(S.ang*180/Math.PI)}°</div>`;
  } else if (UI.cavCancel) {
    const refund = cavFurnitureRefund(f);
    h = `<div>${cavUiName(f)} · %${Math.floor((f.prog||0)*100)}<br>İade: ${refund&&Object.keys(refund).length?costTxt(refund):'yok'}</div>${button('cancel','Planı iptal et')}${button('stop','Vazgeç')}`;
  } else h = button('start','Eşya yerleştir (I)') + (f ? `<div>${cavUiName(f)} · %${Math.floor((f.prog||0)*100)} · E: planı iptal et</div>` : '');
  // Seçenek ve düğme DOM'u aynı kaldığında değiştirme: native select/focus korunur.
  if (el._cavH !== h) { el.innerHTML = h; el._cavH = h; }
}
cv.addEventListener('wheel', e => { if (CAV_PLACE.recipe && !G.modal && !G.paused) { e.preventDefault(); CAV_PLACE.ang = (CAV_PLACE.ang + (e.deltaY > 0 ? 1 : -1)*Math.PI/2 + TAU) % TAU; } }, { passive: false });
function drawRoomFurniture(g, t, x, y, w, h) {
  const R = mulberry32(Math.floor(x * 3 + y));
  if (t === 'yatak') for (let i = 0; i < 4; i++) { const bx = x + 18 + (i % 2) * (w / 2), by = y + h * 0.45 + Math.floor(i / 2) * h * 0.25; g.fillStyle = '#9a8048'; g.fillRect(bx, by, w / 2 - 30, 18); g.fillStyle = ['#7a3a3a', '#3a5a7a', '#5a7a3a', '#7a6a3a'][Math.floor(R() * 4)]; g.fillRect(bx + 14, by + 2, w / 2 - 46, 14); }
  else if (t === 'depo') { for (let i = 0; i < 9; i++) { const bx = x + 16 + R() * (w - 50), by = y + 34 + R() * (h - 60); g.fillStyle = '#7a5a34'; g.fillRect(bx, by, 26, 22); g.strokeStyle = '#4a3018'; g.lineWidth = 2; g.strokeRect(bx, by, 26, 22); g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + 26, by + 22); g.stroke(); } g.fillStyle = '#ffe9b0'; g.font = '12px Georgia'; g.textAlign = 'right'; g.fillText(`🍲${Math.floor(G.stock.food)} 🫐${Math.floor(G.stock.meyve)} 🍖${Math.floor(G.stock.et)} 🪵${G.stock.wood}`, x + w - 8, y + h - 8); }
  else if (t === 'mutfak') { g.fillStyle = '#2a1a10'; g.beginPath(); g.arc(x + 40, y + h * 0.6, 18, 0, TAU); g.fill(); g.fillStyle = '#ff8a30'; g.beginPath(); g.ellipse(x + 40, y + h * 0.6 - 4, 7, 11 + Math.sin(G.now * 9) * 2, 0, 0, TAU); g.fill(); g.fillStyle = '#6a4a2a'; g.fillRect(x + 70, y + h * 0.5, w - 90, 26); const bowls = Math.min(10, Math.floor(G.stock.food || 0)); g.fillStyle = '#d8b880'; for (let i = 0; i < bowls; i++) { g.beginPath(); g.arc(x + 82 + i * ((w - 110) / 10), y + h * 0.5 + 13, 5, 0, TAU); g.fill(); } }
  else if (t === 'sifa') { for (let i = 0; i < 2; i++) { const bx = x + 20 + i * (w / 2), by = y + h * 0.55; g.fillStyle = '#e8e0d0'; g.fillRect(bx, by, w / 2 - 40, 20); } g.fillStyle = '#2a8a5a'; g.fillRect(x + w - 30, y + 12, 6, 18); g.fillRect(x + w - 36, y + 18, 18, 6); }
  else if (t === 'kasap') { g.fillStyle = '#7a5a36'; g.fillRect(x + 20, y + h * 0.55, w - 40, 22); g.fillStyle = '#8a1a14'; for (let i = 0; i < Math.min(6, Math.ceil(G.stock.cigEt || 0)); i++) { g.beginPath(); g.ellipse(x + 34 + i * 22, y + h * 0.55 + 11, 8, 5, 0, 0, TAU); g.fill(); } g.strokeStyle = '#3a2410'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 20, y + 34); g.lineTo(x + w - 20, y + 34); g.stroke(); }
  else if (t === 'atolye') { g.fillStyle = '#8a6a44'; g.fillRect(x + 20, y + h * 0.5, w - 40, 24); g.fillStyle = '#999'; g.fillRect(x + 40, y + h * 0.5 + 6, 18, 4); g.fillRect(x + 70, y + h * 0.5 + 10, 4, 12); g.fillStyle = '#5a3a1e'; for (let i = 0; i < 5; i++) g.fillRect(x + w - 60 + i * 6, y + h * 0.5 - 20, 4, 20); }
}
function drawMiniPerson(g, p, x, y) {
  const lying = p.inHut || p.bed;
  const col = p.leader ? '#8a3a1a' : p.child ? '#b89a6a' : (GROUPS[p.group] || GROUPS.bos).col;
  g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(x + 2, y + 12, 12, 5, 0, 0, TAU); g.fill();
  g.save(); g.translate(x, y); if (lying) g.rotate(Math.PI / 2);
  const s = p.child ? 0.75 : 1; g.scale(s, s);
  g.fillStyle = col; g.beginPath(); g.ellipse(0, 4, 8, 11, 0, 0, TAU); g.fill();
  g.fillStyle = p.skin; g.beginPath(); g.arc(0, -9, 7, 0, TAU); g.fill();
  g.fillStyle = p.hair; g.beginPath(); g.arc(0, -11, 7.2, Math.PI, TAU); g.fill();
  if (!lying && p.work > 0.05) { const w = Math.sin(G.now * 10) * 4; g.strokeStyle = p.skin; g.lineWidth = 3; g.beginPath(); g.moveTo(6, 0); g.lineTo(12, -4 + w); g.stroke(); }
  if (p.bed) { g.fillStyle = 'rgba(230,225,210,.9)'; g.fillRect(-9, 0, 18, 14); }
  g.restore();
  g.fillStyle = '#eadcc0'; g.font = '10px Georgia'; g.textAlign = 'center'; g.fillText(p.name, x, y + 26);
  if (p.inHut) { g.fillStyle = '#cfe'; g.fillText('z', x + 12 + Math.sin(G.now * 2) * 2, y - 14); }
  const st = p.sick ? '🤒' : p.injury ? '🩹' : ''; if (st) { g.font = '11px serif'; g.fillText(st, x + 12, y - 4); }
}
$('inM').addEventListener('pointerdown', e => {
  if (e.target.id === 'inM') { closeInterior(); return; }
  if (e.target.id === 'inC') {
    const r = e.target.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const hit = IN_HITS.find(h => Math.hypot(h.x - x, h.y - y) < 22);
    if (hit) openChar(hit.id);
    return;
  }
  const btn = e.target.closest('[data-ix],[data-room],[data-p],[data-nav]'); if (!btn) return; e.preventDefault();
  if (btn.dataset.ix === 'close') return closeInterior();
  if (btn.dataset.p) return openChar(+btn.dataset.p);
  if (btn.dataset.nav) { const T = interiorTargets(); const i = T.indexOf(UI.inB); UI.inB = T[(i + (+btn.dataset.nav) + T.length) % T.length]; UI.cavDraft = null; UI.cavNote = ''; renderInterior(); return; }
  if (btn.dataset.room !== undefined) {
    const b = UI.inB; if (b.type === 'magara') return;
    const i = +btn.dataset.room, cur = b.rooms[i];
    b.rooms[i] = RORDER[(RORDER.indexOf(cur) + 1) % RORDER.length];
    if (b.type === 'magara' && !b.rooms.includes('yatak') && !G.builds.some(o => o !== b && homeCap(o) > 0)) { msg('Mağarada en az bir yatakhane kalmalı.', '#e99', 3); b.rooms[i] = cur; }
    assignHomes(); assignBeds(); G.uiDirty = true;
    msg(`${BUILD[b.type].ad}: ${i + 1}. oda artık ${ROOMS[b.rooms[i]].ic} ${ROOMS[b.rooms[i]].ad}.`, '#cde', 2);
    renderInterior();
  }
});
// ---- bildirimler
function toast(html) { const t = $('toast'); const d = document.createElement('div'); d.innerHTML = html; t.appendChild(d); setTimeout(() => d.remove(), 5000); }
function renderMsgs() { $('msgs').innerHTML = G.msgs.map(m => `<div style="color:${m.col};opacity:${clamp(m.life, 0, 1)}">${m.t}</div>`).join(''); G.msgDirty = false; }

// ---- HUD
const WIC = { acik: '', yagmur: '🌧️', firtina: '⛈️', sis: '🌫️', kar: '🌨️' };
function updateHUD() {
  const p = phase(), n = isNight();
  const S = G.season || seasonOf(G.day), lp = precipAt(L.x, L.y), wk = lp ? (lp === 'kar' ? 'kar' : G.weather.type === 'kar' ? 'yagmur' : G.weather.type) : G.weather.type;
  $('dayTxt').textContent = `${G.day}. Gün`;
  $('todTxt').textContent = (n ? '🌑 Gece' : p > 0.42 ? '🌇 Akşam' : '☀️ Gündüz') + ' ' + (WIC[wk] || '') + (G.finale ? ' 🌀' : '');
  { const st = $('seaTxt'); if (st) { st.textContent = `${S.ic} ${S.ad} ${S.day}/${SEASON_LEN} · ${Math.round(tempAt(L.x, L.y))}°C`; st.title = 'Mevsim, mevsimin günü ve bulunduğun yerdeki sıcaklık'; } }
  $('todBar').style.width = (p * 100) + '%';
  const fl = k => Math.floor(G.stock[k] || 0);
  $('res').innerHTML = ['wood', 'stone', 'food', 'meyve', 'et'].map(k => `<span title="${RESN[k]}">${RES[k]} <b>${fl(k)}</b></span>`).join('') + `<span title="Halk · boş yer">👥 <b>${G.people.length}</b><small>/🛏️${freeHomes()}</small></span>`;
  $('res2').innerHTML = ['cigEt', 'bone', 'hide', 'herb', 'poison', 'crystal'].filter(k => G.stock[k] > 0 || k === 'herb').map(k => `<span title="${RESN[k]}">${RES[k]}${fl(k)}</span>`).join('') + ` <span title="Ok">➶${arrows()}</span><span title="İlaç">💊${G.stock.ilac || 0}</span><span title="Sargı">🩹${G.stock.bandaj || 0}</span><span title="Depo sınırı">📦${storeCap()}</span>`;
  $('fireBar').style.width = G.fire.fuel + '%';
  $('morBar').style.width = G.morale + '%';
  $('hpBar').style.width = clamp(L.hp / L.maxhp * 100, 0, 100) + '%';
  $('stBar').style.width = L.stam + '%';
  const it = G.interact;
  $('prompt').textContent = G.huntMode ? '🎯 Avlanacak hayvana dokun / tıkla' : G.placing ? `${BUILD[G.placing].ad} planlanıyor` : G.lcarry ? `🩺 ${acc(G.lcarry.name)} taşıyorsun — şifahaneye götür (E: bırak)` : it ? (isTouch ? '[Topla] ' : '[E] ') + it.label : G.carryEgg ? '🥚 Yumurtayı ateşe götür!' : '';
  if (G.tut.on && G.tut.step < TUT.length) { $('tutBox').style.display = 'block'; $('tutBox').innerHTML = `<b>Öğretici ${G.tut.step + 1}/${TUT.length}</b> ${TUT[G.tut.step].t} <button id="tutSkip">Geç</button>`; }
  else $('tutBox').style.display = 'none';
}
$('tutBox').addEventListener('pointerdown', e => { if (e.target.id === 'tutSkip') { G.tut.on = false; store.set('sonAtesTutDone', '1'); } });
// Eve dönüş hedefi; yalnız mevcut durumdan türetilir, kayda alan eklemez.
function shipGoalInfo(g, build, level) {
  const def = build || {}, cost = def.cost || {}, stock = g.stock || {};
  const count = value => Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
  const day = count(g.day), found = Math.min(3, (g.wrecks || []).filter(w => w && w.found).length);
  const rope = count(stock.halat), cloth = count(stock.yelkenBezi);
  const needRope = count(cost.halat), needCloth = count(cost.yelkenBezi);
  const ship = (g.builds || []).find(b => b && !b.dead && b.type === 'gemi');
  if (ship) {
    const progress = ship.need > 0 ? Math.max(0, Math.min(100, Math.floor((ship.prog || 0) / ship.need * 100))) : 0;
    return { text: ship.built ? '⛵ Gemi hazır — yanına git, eve dön.' : '⛵ Gemi inşa ediliyor: %' + progress,
      title: 'Gemi planlanırken malzemeler stoktan ayrılır; azalan stok hedefi geri almaz.' };
  }
  const people = (g.people || []).length;
  const lvl = count(level), needLevel = count(def.lvl);
  let next;
  if (day < 200) next = '200. güne kadar halkını hayatta tut.';
  else if (found < 3) next = 'Kıyılardaki üç enkazı ara.';
  else if (rope < needRope) next = 'Halat ürettir.';
  else if (cloth < needCloth) next = 'Yelken bezi ürettir.';
  else if (people < 15) next = 'Gemi için en az 15 kişi gerekiyor.';
  else if (lvl < needLevel) next = needLevel + '. seviye inşaat ustası yetiştir.';
  else if (Object.keys(cost).some(k => count(stock[k]) < count(cost[k]))) next = 'Gemi planındaki diğer malzemeleri tamamla.';
  else next = 'Eylemler menüsünden kıyıya Gemi planla.';
  return { text: '⛵ ' + day + '/200 gün · Enkaz ' + found + '/3 · Halat ' + rope + '/' + needRope + ' · Bez ' + cloth + '/' + needCloth,
    title: 'Eve dönüş: ' + next + ' Enkaz sayacı bulunan enkazları, malzeme sayaçları kullanılabilir stoku gösterir.' };
}
function updateShipGoalHUD() {
  const top = $('top'); if (!top) return;
  let node = $('shipGoal');
  if (!node) {
    node = document.createElement('div'); node.id = 'shipGoal';
    node.style.cssText = 'font-size:11px;line-height:1.4;max-width:100%;overflow-wrap:anywhere';
    top.appendChild(node);
    if (!$('shipGoalStyle')) {
      const style = document.createElement('style'); style.id = 'shipGoalStyle';
      style.textContent = '#miniBox:not(.big){top:var(--son-ates-map-top,150px)}';
      document.head.appendChild(style);
    }
  }
  const goal = shipGoalInfo(G, BUILD.gemi, bestLvl('insaat'));
  if (node.textContent !== goal.text) node.textContent = goal.text;
  if (node.title !== goal.title) node.title = goal.title;
  const mini = $('miniBox');
  if (mini && mini.style.display !== 'none' && !mini.classList.contains('big')) {
    const y = Math.max(150, Math.ceil(top.getBoundingClientRect().bottom) + 8) + 'px';
    if (mini.style.getPropertyValue('--son-ates-map-top') !== y) mini.style.setProperty('--son-ates-map-top', y);
  }
}
function hudTick(dt) {
  cavPlacePanel();
  UI.hudT -= dt; if (UI.hudT <= 0) { UI.hudT = 0.15; updateHUD(); renderMsgs(); }
  UI.goalT = (UI.goalT || 0) - dt; if (UI.goalT <= 0) { UI.goalT = 1; updateShipGoalHUD(); }
  else if (G.msgDirty) renderMsgs();
  UI.sideT -= dt; if (UI.sideT <= 0 || (G.uiDirty && UI.sideT < 0.45)) { UI.sideT = 0.6; renderSide(); }
  UI.miniT -= dt; if (UI.miniT <= 0) { UI.miniT = 0.25; drawMini(); }
  UI.toolT -= dt; if (UI.toolT <= 0 || G.toolsDirty) { UI.toolT = 1; buildTools(); }
  if ($('craft').style.display === 'flex') { UI.craftT -= dt; if (UI.craftT <= 0 || G.craftDirty) { UI.craftT = 0.6; renderCraft(); } }
  if (UI.char) { UI.charT -= dt; if (UI.charT <= 0) { UI.charT = 0.7; renderChar(); } }
  if (UI.inB) renderInterior();
}

// ---- ekranlar
function saveInfo() { const s = store.get('sonAtesKayit4'); if (!s) return null; try { const d = JSON.parse(s); if (d.v !== 4) return null; return { day: d.day, diff: d.diff, s }; } catch (e) { return null; } }
function startScreen() {
  G.started = false; $('hud').style.display = 'none';
  const sv = saveInfo(), tutDone = store.get('sonAtesTutDone');
  const achList = Object.entries(ACH).map(([k, a]) => `<div class="${ACHSET.has(k) ? 'got' : ''}">${ACHSET.has(k) ? '🏆' : '🔒'} <b>${a.ad}</b> — ${a.desc}</div>`).join('');
  const best = +(store.get('sonAtesRekor') || 0);
  $('screenBox').innerHTML = `<h1>SON ATEŞ</h1>
  <p class="story">Bir fırtına. Kör edici bir ışık. Uyandığınızda gökyüzünde tanımadığınız kanatlar,<br>ormanda tanımadığınız sesler vardı. Dokuz kişisiniz. Bir mağaranız, bir ateşiniz var.<br>Geminiz kayalıklarda parçalandı; enkazı adanın kıyılarına dağıldı.<br><b>Ve gece yaklaşıyor.</b></p>
  ${sv ? `<button id="cont" class="big">DEVAM ET <small>(${sv.day}. gün · ${DIFF[sv.diff] ? DIFF[sv.diff].ad : ''})</small></button><br>` : ''}
  <div class="diffs">${Object.entries(DIFF).map(([k, d]) => `<button data-d="${k}" class="${UI.diff === k ? 'on' : ''}">${d.ad}</button>`).join('')}</div>
  <p class="ddesc" id="ddesc">${DIFF[UI.diff].desc}</p>
  <label class="chk"><input type="checkbox" id="tutChk" ${tutDone ? '' : 'checked'}> Öğretici ile başla</label><br>
  <button id="go" class="big">${sv ? 'YENİ OYUN' : 'ATEŞİ YAK'}</button>
  ${best ? `<p>En uzun hayatta kalma: <b>${best} gün</b></p>` : ''}
  <details><summary>Nasıl oynanır?</summary><div class="keys">${isTouch ? `<b>Sol taraf</b> yürü · <b>sağ tarafı sürükle</b> etrafa bak · <b>😴 Uyu</b> gece barınağın yanında · <b>Saldır</b> mızrak · <b>Ok</b> yay · <b>Topla/Kullan</b> toplama, ateş, tedavi, taşıma, evcilleştirme, binme` : `<b>Fare</b> etrafa bak (ekrana tıkla; Esc/Tab bırakır) · <b>U</b> gece uyu · <b>WASD</b> hareket · <b>Shift</b> koş · <b>Fare/Boşluk</b> mızrak · <b>F / sağ tık</b> ok<br><b>E</b> (basılı) topla · ateşe odun · tedavi · inşaata yardım · kurtar · (bas) bin/in, yaralı taşı<br><b>G</b> av emri · <b>C</b> üretim · <b>M</b> harita · <b>H</b> halk paneli · <b>1-9</b> inşa planı · <b>T</b> meşale · <b>P</b> duraklat`}<br>
  <b>Halk</b>: 13 meslek grubu. Herkes yaptığı işte seviye atlar (1-10). Karakter kartından (ⓘ) becerileri gör, görev ve doğrudan üretim emri ver.<br>
  <b>Yiyecek</b>: asıl kaynak avcılık. 🎯 ile bir hayvan seç; avcılar mesafeyi koruyarak avlar. Leşi 🔪 Et Ustası temizlemezse çiğ et salgın getirebilir. Tarlalar da ekilebilir.<br>
  <b>Mağara ve odalar</b>: halk mağarada başlar. <b>I</b> ile mağaranın, kulübenin ve diğer yapıların içini gör, odalara görev ver (yatakhane, depo, mutfak, şifa, et temizleme, atölye), içeriden karakter seç.<br>
  <b>Yemek</b>: leş → taşıyıcılar → 🔪 et ustası temizler → 🍲 aşçı pişirir. Öğle ve akşam yemek vakti herkes masaya gelir. Çiğ et hastalık getirebilir.<br>
  <b>Barınma</b>: her tek kişi ya da çift bir yerde yaşar (çadır = 1 hane, yatakhane odası = 2 hane). Yer yoksa yeni insanlar gelmez. Çitsiz evler nadiren saldırıya uğrar.<br>
  <b>Sağlık</b>: yaralılar şifahaneye taşınır, günlerce tedavi görür. Salgınlar nadiren öldürür ama yayılır.<br>
  <b>Bilinmezlik</b>: sadece halkının gördüğünü görürsün. Geceler çoğu zaman sessizdir... ama her zaman değil. Yüzü tanıdık gelen her şeye güvenme.<br>
  <b>Hedef</b>: adada en az 200 gün hayatta kal, kıyılardaki 3 gemi enkazını bul, halat ve yelken bezi ürettir, usta bir mimarla kıyıya ⛵ Gemi kur ve halkınla eve dön.</div></details>
  <details><summary>Başarımlar (${ACHSET.size}/${Object.keys(ACH).length})</summary><div class="achs">${achList}</div></details>
  <p style="font-size:12px;color:#776">🎧 Kulaklıkla oyna.</p>`;
  $('screen').style.display = 'flex';
  for (const b of document.querySelectorAll('.diffs button')) b.onclick = () => { UI.diff = b.dataset.d; for (const x of document.querySelectorAll('.diffs button')) x.classList.toggle('on', x === b); $('ddesc').textContent = DIFF[UI.diff].desc; };
  $('go').onclick = () => { audioInit(); newGame(UI.diff, $('tutChk').checked); };
  if (sv) $('cont').onclick = () => { audioInit(); try { loadGame(sv.s); } catch (e) { console.error(e); store.del('sonAtesKayit4'); startScreen(); } };
}
function onGameStart() {
  $('screen').style.display = 'none'; $('hud').style.display = 'block'; $('pause').style.display = 'none';
  G.started = true; G.paused = false; G.modal = false; $('craft').style.display = 'none'; $('charM').style.display = 'none'; UI.char = 0; $('inM').style.display = 'none'; UI.inB = null;
  UI.sel.clear(); UI.filter = 'all';
  if (innerWidth <= 700 || innerHeight <= 520) { toggleSide(false); $('miniBox').style.display = 'none'; } else { toggleSide(true); $('miniBox').style.display = 'block'; }
  $('miniBox').classList.remove('big');
  buildTools(); renderSide(); updateHUD(); UI.goalT = 0; updateShipGoalHUD();
}
function showGameOver() {
  const dawn = G.diff === 'kolay' && store.get('sonAtesSafak4');
  $('screenBox').innerHTML = `<h1 style="color:#c33;text-shadow:0 0 30px #600">KARANLIK</h1>
  <p class="story">Ateşin son közü de söndü. Ormanın sesleri, sanki hiçbir şey olmamış gibi devam etti.</p>
  <p><b>${G.day}</b> gün hayatta kaldınız · <b>${G.kills}</b> yaratık · <b>${G.stats.hunts || 0}</b> av · <b>${G.deaths}</b> ölü · <b>${G.lost}</b> kayıp</p>
  <p>Rekor: <b>${store.get('sonAtesRekor') || G.day} gün</b></p>
  ${dawn ? '<button id="dawn" class="big">SON ŞAFAKTAN DEVAM</button><br>' : ''}
  <button id="again" class="big">YENİDEN DENE</button><br><button id="menu">Ana menü</button>`;
  $('screen').style.display = 'flex'; $('hud').style.display = 'none';
  if (dawn) $('dawn').onclick = () => loadGame(dawn);
  $('again').onclick = () => newGame(G.diff, false);
  $('menu').onclick = startScreen;
}
function showVictory(saved, left) {
  $('screenBox').innerHTML = `<h1 style="color:#9cf;text-shadow:0 0 30px #36f">EVE DÖNÜŞ</h1>
  <p class="story">Yelkenler rüzgârla doldu. Arkada, ormanın içinde, bir ateş hâlâ yanıyordu.</p>
  <p><b>${saved.length}</b> kişi gemiye bindi: ${saved.map(p => p.name).join(', ')}.</p>
  ${left ? `<p class="story">${left} kişi geride, kampta kaldı. Onlar bu dünyanın ilk köyünü kuracak.</p>` : ''}
  <p><b>${G.day}</b> gün · <b>${G.kills}</b> yaratık · <b>${G.deaths}</b> kayıp · ${DIFF[G.diff].ad}</p>
  <button id="menu" class="big">ANA MENÜ</button>`;
  $('screen').style.display = 'flex'; $('hud').style.display = 'none';
  $('menu').onclick = startScreen;
}

// ---- döngü
const TEMPO = 0.78;   // oyunun genel hızı: daha ağır, daha yavaş bir hava
let lastT = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  if (G.started && L) {
    if (!G.paused && !G.over && !G.modal) { if (G.sleep) { for (let i = 0; i < 10 * DAYK && G.sleep; i++) update(0.05); } else update(dt * TEMPO); }
    $('sleepV').style.display = G.sleep ? 'flex' : 'none';
    if (L) { render(); hudTick(dt); }
  }
  if (typeof sesTick === 'function') sesTick(dt);
  requestAnimationFrame(loop);
}
makeGround();
startScreen();
requestAnimationFrame(loop);
window.__G = G; window.__getL = () => L;
