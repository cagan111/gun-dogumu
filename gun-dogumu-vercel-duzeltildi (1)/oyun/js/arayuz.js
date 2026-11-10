'use strict';
// =============================================================
//  ARAYÜZ — girdi, HUD, halk paneli, zanaat, ekranlar, döngü
// =============================================================
const keys = {}; const mouse = { x: 0, y: 0, down: false, right: false, used: false };
const touch = { jx: 0, jy: 0, atk: false, act: false, run: false, shoot: false, id: null, ox: 0, oy: 0 };
const isTouch = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
const UI = { tab: 'g', sel: new Set(), filter: 'all', open: new Set(), sideT: 0, hudT: 0, miniT: 0, toolT: 0, craftT: 0, diff: 'normal' };
const playing = () => G.started && !G.over && L;

// ---- klavye / fare
addEventListener('keydown', e => {
  audioInit();
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  const first = !keys[e.code]; keys[e.code] = true;
  if (!playing()) return;
  if (e.code === 'KeyE' && first) onActPress();
  if (e.code === 'KeyT') toggleTorch();
  if (e.code === 'KeyC') toggleCraft();
  if (e.code === 'KeyM') toggleMap();
  if (e.code === 'KeyH') toggleSide();
  if (e.code === 'Escape') { if (G.modal) toggleCraft(false); else if (G.placing) cancelPlace(); else togglePause(); }
  if (e.code === 'KeyP') togglePause();
  const n = parseInt(e.key);
  if (n >= 1 && n <= 9) { const list = BORDER.filter(buildUnlocked); if (list[n - 1]) startPlace(list[n - 1]); }
});
addEventListener('keyup', e => { keys[e.code] = false; });
cv.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.used = true; });
cv.addEventListener('mousedown', e => {
  audioInit(); mouse.x = e.clientX; mouse.y = e.clientY; mouse.used = true;
  if (e.button === 2) { if (G.placing) cancelPlace(); else mouse.right = true; return; }
  if (G.placing) { tryPlace(); return; }
  mouse.down = true;
});
addEventListener('mouseup', e => { if (e.button === 2) mouse.right = false; else mouse.down = false; });
cv.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('visibilitychange', () => { if (document.hidden && playing()) { saveGame('auto'); if (!G.paused) togglePause(); } });
function togglePause() { if (!playing()) return; G.paused = !G.paused; $('pause').style.display = G.paused ? 'flex' : 'none'; }

// ---- dokunmatik
if (isTouch) {
  $('touch').style.display = 'block';
  const joy = $('joy'), base = $('knobBase'), knob = $('knob');
  joy.addEventListener('pointerdown', e => { audioInit(); touch.id = e.pointerId; touch.ox = e.clientX; touch.oy = e.clientY; base.style.display = 'block'; base.style.left = (e.clientX - 55) + 'px'; base.style.top = (e.clientY - 55 - (innerHeight - joy.offsetHeight)) + 'px'; joy.setPointerCapture(e.pointerId); });
  joy.addEventListener('pointermove', e => { if (e.pointerId !== touch.id) return; let dx = e.clientX - touch.ox, dy = e.clientY - touch.oy; const m = Math.hypot(dx, dy); if (m > 45) { dx *= 45 / m; dy *= 45 / m; } touch.jx = dx / 45; touch.jy = dy / 45; knob.style.left = (31 + dx) + 'px'; knob.style.top = (31 + dy) + 'px'; });
  const end = e => { if (e.pointerId !== touch.id) return; touch.id = null; touch.jx = touch.jy = 0; base.style.display = 'none'; knob.style.left = knob.style.top = '31px'; };
  joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
  const hold = (id, k) => {
    const el = $(id);
    el.addEventListener('pointerdown', e => { audioInit(); e.preventDefault(); touch[k] = true; if (k === 'atk' && G.placing) { tryPlace(); touch[k] = false; } if (k === 'act') onActPress(); });
    const up = () => touch[k] = false; el.addEventListener('pointerup', up); el.addEventListener('pointerleave', up); el.addEventListener('pointercancel', up);
  };
  hold('tAtk', 'atk'); hold('tAct', 'act'); hold('tRun', 'run'); hold('tShoot', 'shoot');
  $('tTorch').addEventListener('pointerdown', e => { e.preventDefault(); toggleTorch(); });
  $('tMap').addEventListener('pointerdown', e => { e.preventDefault(); toggleMap(); });
}

// ---- araç çubuğu
$('tools').addEventListener('pointerdown', e => {
  const b = e.target.closest('button'); if (!b) return; e.preventDefault(); audioInit();
  if (b.dataset.b) { if (G.placing === b.dataset.b) cancelPlace(); else startPlace(b.dataset.b); }
  if (b.dataset.x === 'craft') toggleCraft();
  if (b.dataset.x === 'map') toggleMap();
  if (b.dataset.x === 'torch') toggleTorch();
});
function buildTools() {
  const t = $('tools');
  t.innerHTML = BORDER.filter(buildUnlocked).map(k => `<button data-b="${k}" class="${G.placing === k ? 'on' : ''} ${canAfford(BUILD[k].cost) ? '' : 'no'}" title="${BUILD[k].desc}">${BUILD[k].ic} ${BUILD[k].ad}<br><small>${costTxt(BUILD[k].cost)}</small></button>`).join('')
    + `<button data-x="craft" class="hl">⚒️ Zanaat<br><small>[C]</small></button>`
    + (G.tech.has('elMesalesi') ? `<button data-x="torch" class="${G.torchOn ? 'on' : ''}">🔥 Meşale<br><small>[T]</small></button>` : '')
    + `<button data-x="map">🗺️ Harita<br><small>[M]</small></button>`;
  G.toolsDirty = false;
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
function toggleSide(force) { const s = $('side'); const closed = force !== undefined ? !force : !s.classList.contains('closed'); s.classList.toggle('closed', closed); $('sideTog').textContent = closed ? '▸' : '▾'; }
$('sideHead').addEventListener('pointerdown', e => { e.preventDefault(); toggleSide(); });
$('side').addEventListener('pointerdown', e => {
  const el = e.target.closest('[data-a],[data-tab],[data-f],[data-bulk]'); if (!el) return;
  e.preventDefault(); audioInit();
  if (el.dataset.tab) { UI.tab = el.dataset.tab; renderSide(); return; }
  if (el.dataset.f) { UI.filter = el.dataset.f; renderSide(); return; }
  if (el.dataset.bulk) { for (const id of UI.sel) { const p = G.people.find(q => q.id === id); if (p) setGroup(p, el.dataset.bulk); } msg(`${UI.sel.size} kişi → ${GROUPS[el.dataset.bulk].ic} ${GROUPS[el.dataset.bulk].ad}`, '#cde', 2); UI.sel.clear(); renderSide(); return; }
  const a = el.dataset.a, g = el.closest('[data-g]') && el.closest('[data-g]').dataset.g, idEl = el.closest('[data-id]'), p = idEl && G.people.find(q => q.id === +idEl.dataset.id);
  if (a === 'plus') plusGroup(g);
  else if (a === 'minus') minusGroup(g);
  else if (a === 'mgr') cycleManager(g);
  else if (a === 'abil') useAbility(g);
  else if (a === 'zone') {
    if (G.zone[g]) clearZone(g);
    else if (g === 'kasif') { const b = $('miniBox'); b.style.display = 'block'; b.classList.add('big'); drawMini(); msg('Haritada bir yere dokun: kâşifler oraya gider.', '#ffd27a', 4); }
    else setZone(g);
  }
  else if (a === 'newg') { const opts = GORDER; G.newGroup = opts[(opts.indexOf(G.newGroup) + 1) % opts.length]; }
  else if (a === 'all') { for (const q of listPeople()) if (!q.child) UI.sel.add(q.id); }
  else if (a === 'none') UI.sel.clear();
  else if (p && a === 'sel') { if (UI.sel.has(p.id)) UI.sel.delete(p.id); else if (!p.child) UI.sel.add(p.id); }
  else if (p && a === 'job') setGroup(p, GORDER[(GORDER.indexOf(p.group) + 1) % GORDER.length]);
  else if (p && a === 'mk') setManager(p.group, p);
  else if (p && a === 'info') { if (UI.open.has(p.id)) UI.open.delete(p.id); else UI.open.add(p.id); }
  renderSide();
});
function listPeople() { return G.people.filter(p => !p.leader && (UI.filter === 'all' || (UI.filter === 'cocuk' ? p.child : p.group === UI.filter && !p.child))); }
function statusOf(p) {
  if (p.grabbed) return '😱 kapıldı!'; if (p.desert > 0) return '🏃 kaçıyor'; if (p.downed > 0) return `🩸 yerde ${Math.ceil(p.downed)}sn`;
  let s = ''; if (p.inHut) s += '💤'; if (p.injury) s += p.injury.type === 'kanama' ? '🩸' : p.injury.type === 'kirik' ? '🦴' : '🤢'; if (p.tired) s += '😴'; if (p.fear >= 80) s += '😨'; if (p.post) s += '🗼'; if (p.group === 'kasif' && !p.inHut && dist(p, G.fire) > 700) s += '🧭' + Math.round(dist(p, G.fire) / 100) * 100 + 'm';
  return s;
}
function renderSide() {
  if ($('side').classList.contains('closed')) return;
  $('popTxt').textContent = `${G.people.length}/${popCap()}`;
  for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('on', b.dataset.tab === UI.tab);
  const tamed = G.dinos.filter(d => d.tamed);
  const tm = tamed.length ? `<div class="note">🦕 Evcil: ${Object.entries(tamed.reduce((a, d) => { const k = d.pet ? 'Yırtıcı yavrusu' : DINO[d.type].ad; a[k] = (a[k] || 0) + 1; return a; }, {})).map(([k, v]) => `${k} ×${v}`).join(', ')}</div>` : '';
  if (UI.tab === 'g') {
    let h = `<div class="note">Moral: <b style="color:${G.morale > 70 ? '#9e9' : G.morale < 30 ? '#f88' : '#eed'}">${Math.round(G.morale)}</b> · Lider: <b>${L.name}</b></div>`;
    for (const g of GORDER) {
      const m = members(g), mg = mgr(g), ab = G.abil[g];
      h += `<div class="grp" data-g="${g}"><div class="gh"><span>${GROUPS[g].ic} ${GROUPS[g].ad} <b>${m.length}</b></span><span class="gm">${mg ? '★ ' + mg.name + (tr(mg, 'onder') ? ' ⭐' : '') : (g === 'bos' ? '' : '<i>yönetici yok</i>')}</span></div>`;
      h += `<div class="gb">${g !== 'bos' ? `<button data-a="minus" title="Bir kişiyi boşa al">−</button><button data-a="plus" title="Bir kişi ekle (önce boştakiler)">+</button><button data-a="mgr" title="Yönetici ata / değiştir">★</button>` : '<span class="hint">Ateşi besler, dinlenir</span>'}`;
      if (ABIL[g]) h += `<button data-a="abil" class="ab ${mg && ab.cd <= 0 ? '' : 'no'} ${ab.act > 0 ? 'on' : ''}" title="${ABIL[g].desc}">⚡ ${ABIL[g].ad}${ab.act > 0 ? ' ' + Math.ceil(ab.act) : ab.cd > 0 ? ' ⏳' + Math.ceil(ab.cd) : ''}</button>`;
      if (['odun', 'tas', 'yiyecek', 'sifaci', 'muhafiz', 'kasif'].includes(g)) h += `<button data-a="zone" class="${mg || g === 'kasif' ? '' : 'no'} ${G.zone[g] ? 'on' : ''}" title="${G.zone[g] ? 'Hedefi kaldır' : g === 'kasif' ? 'Haritadan keşif hedefi seç' : 'Grubu şu an bulunduğun yere gönder (yönetici gerekir)'}">${g === 'kasif' ? '🗺️' : '📍'}${G.zone[g] ? '✕' : ''}</button>`;
      h += `</div></div>`;
    }
    h += `<div class="grp"><div class="gb"><span class="hint">Yeni gelenler →</span><button data-a="newg">${GROUPS[G.newGroup].ic} ${GROUPS[G.newGroup].ad}</button></div></div>`;
    $('tabG').innerHTML = h + tm; $('tabG').style.display = 'block'; $('tabK').style.display = 'none';
  } else {
    const list = listPeople();
    let h = `<div class="chips"><button data-f="all" class="${UI.filter === 'all' ? 'on' : ''}">Tümü</button>${GORDER.map(g => `<button data-f="${g}" class="${UI.filter === g ? 'on' : ''}">${GROUPS[g].ic}</button>`).join('')}<button data-f="cocuk" class="${UI.filter === 'cocuk' ? 'on' : ''}">👶</button></div>`;
    h += `<div class="bulk"><button data-a="all">Tümünü seç</button><button data-a="none">Temizle</button>${UI.sel.size ? `<span>Seçili ${UI.sel.size} →</span>${GORDER.map(g => `<button data-bulk="${g}" title="${GROUPS[g].ad}">${GROUPS[g].ic}</button>`).join('')}` : '<span class="hint">Seçip toplu aktar</span>'}</div>`;
    for (const p of list) {
      const isM = G.managers[p.group] === p.id && !p.child, pt = p.partner && G.people.find(q => q.id === p.partner);
      h += `<div class="pr ${UI.sel.has(p.id) ? 'sel' : ''}" data-id="${p.id}"><span data-a="sel" class="nmw"><span class="ck">${p.child ? '👶' : UI.sel.has(p.id) ? '☑' : '☐'}</span> <span class="nm">${isM ? '★ ' : ''}${p.name}</span> <span class="trs">${p.traits.map(t => TRAITS[t].ic).join('')}</span> <span class="st">${statusOf(p)}</span></span>`;
      h += p.child ? `<span class="hint">çocuk · ${p.age}/3 gün</span>` : `<span class="btns"><button data-a="job" class="job" title="Grubu değiştir">${GROUPS[p.group].ic}</button><button data-a="mk" class="${isM ? 'on' : ''}" title="Grubunun yöneticisi yap">★</button><button data-a="info">ⓘ</button></span>`;
      h += `<div class="bars"><div class="bar"><i style="width:${p.hp / p.maxhp * 100}%;background:#c44"></i></div><div class="bar fear"><i style="width:${p.fear}%"></i></div></div>`;
      if (UI.open.has(p.id)) h += `<div class="info">${p.story ? `<i>${p.story}</i><br>` : ''}${p.traits.map(t => `${TRAITS[t].ic} <b>${TRAITS[t].ad}</b>: ${TRAITS[t].desc}`).join('<br>')}${pt ? `<br>❤ ${pt.name} ile birlikte` : ''}${p.injury ? `<br>Yara: ${{ kanama: 'kanama', kirik: 'kırık bacak', enfeksiyon: 'enfeksiyon (ilaç gerek)' }[p.injury.type]}` : ''}</div>`;
      h += `</div>`;
    }
    if (!list.length) h += '<div class="note">Burada kimse yok.</div>';
    $('tabK').innerHTML = h + tm; $('tabK').style.display = 'block'; $('tabG').style.display = 'none';
  }
  G.uiDirty = false;
}

// ---- zanaat
function toggleCraft(force) {
  if (!playing()) return;
  const open = force !== undefined ? force : $('craft').style.display !== 'flex';
  $('craft').style.display = open ? 'flex' : 'none'; G.modal = open;
  if (open) { if (G.placing) cancelPlace(); renderCraft(); }
}
$('craft').addEventListener('pointerdown', e => {
  const b = e.target.closest('[data-t],[data-close]'); if (!b) { if (e.target.id === 'craft') toggleCraft(false); return; }
  e.preventDefault();
  if (b.dataset.close !== undefined) { toggleCraft(false); return; }
  craft(b.dataset.t); renderCraft();
});
function renderCraft() {
  const cats = {};
  for (const id of TORDER) (cats[TECH[id].kat] = cats[TECH[id].kat] || []).push(id);
  let h = `<div class="ch"><b>⚒️ Zanaat ve Bilgi</b><span class="res">${Object.keys(RES).map(k => `${RES[k]}${G.stock[k]}`).join(' ')}</span><button data-close>✕</button></div><div class="cl">`;
  for (const [cat, ids] of Object.entries(cats)) {
    h += `<div class="cat">${cat}</div>`;
    for (const id of ids) {
      const t = TECH[id], s = techState(id);
      const cost = Object.entries(t.cost).map(([k, v]) => `<span class="${(G.stock[k] || 0) >= v ? '' : 'bad'}">${v}${RES[k]}</span>`).join(' ');
      h += `<div class="card ${s}"><div><b>${t.ad}</b> <small>${cost}</small><br><small>${t.desc}</small>${s === 'locked' ? `<br><small class="bad">🔒 ${lockReason(id)}</small>` : ''}</div>${s === 'done' ? '<span class="ok">✓</span>' : `<button data-t="${id}" class="${s === 'ok' ? '' : 'no'}">${t.repeat ? 'Yap' : 'Öğren'}</button>`}</div>`;
    }
  }
  $('craftBox').innerHTML = h + '</div>';
  G.craftDirty = false;
}

// ---- bildirimler
function toast(html) { const t = $('toast'); const d = document.createElement('div'); d.innerHTML = html; t.appendChild(d); setTimeout(() => d.remove(), 5000); }
function renderMsgs() { $('msgs').innerHTML = G.msgs.map(m => `<div style="color:${m.col};opacity:${clamp(m.life, 0, 1)}">${m.t}</div>`).join(''); G.msgDirty = false; }

// ---- HUD
const WIC = { acik: '', yagmur: '🌧️', firtina: '⛈️', sis: '🌫️' };
function updateHUD() {
  const p = phase(), n = isNight();
  $('dayTxt').textContent = `${G.day}. Gün`;
  $('todTxt').textContent = (n ? '🌑 Gece' : p > 0.42 ? '🌇 Akşam' : '☀️ Gündüz') + ' ' + WIC[G.weather.type] + (G.finale ? ' 🌀' : '');
  $('todBar').style.width = (p * 100) + '%';
  $('res').innerHTML = ['wood', 'stone', 'food'].map(k => `<span>${RES[k]} <b>${G.stock[k]}</b></span>`).join('') + `<span>👥 <b>${G.people.length}/${popCap()}</b></span>`;
  $('res2').innerHTML = ['bone', 'hide', 'herb', 'poison', 'crystal', 'med'].filter(k => G.stock[k] > 0 || ['herb', 'med'].includes(k)).map(k => `<span title="${RESN[k]}">${RES[k]}${G.stock[k]}</span>`).join('');
  $('fireBar').style.width = G.fire.fuel + '%';
  $('morBar').style.width = G.morale + '%';
  $('hpBar').style.width = clamp(L.hp / L.maxhp * 100, 0, 100) + '%';
  $('stBar').style.width = L.stam + '%';
  const it = G.interact;
  $('prompt').textContent = G.placing ? `${BUILD[G.placing].ad} yerleştiriliyor` : it ? (isTouch ? '[Topla] ' : '[E] ') + it.label : G.carryEgg ? '🥚 Yumurtayı ateşe götür!' : '';
  if (G.tut.on && G.tut.step < TUT.length) { $('tutBox').style.display = 'block'; $('tutBox').innerHTML = `<b>Öğretici ${G.tut.step + 1}/${TUT.length}</b> ${TUT[G.tut.step].t} <button id="tutSkip">Geç</button>`; }
  else $('tutBox').style.display = 'none';
}
$('tutBox').addEventListener('pointerdown', e => { if (e.target.id === 'tutSkip') { G.tut.on = false; store.set('sonAtesTutDone', '1'); } });
function hudTick(dt) {
  UI.hudT -= dt; if (UI.hudT <= 0) { UI.hudT = 0.15; updateHUD(); renderMsgs(); }
  else if (G.msgDirty) renderMsgs();
  UI.sideT -= dt; if (UI.sideT <= 0 || (G.uiDirty && UI.sideT < 0.45)) { UI.sideT = 0.6; renderSide(); }
  UI.miniT -= dt; if (UI.miniT <= 0) { UI.miniT = 0.25; drawMini(); }
  UI.toolT -= dt; if (UI.toolT <= 0 || G.toolsDirty) { UI.toolT = 1; buildTools(); }
  if (G.modal) { UI.craftT -= dt; if (UI.craftT <= 0) { UI.craftT = 0.6; renderCraft(); } }
}

// ---- ekranlar
function saveInfo() { const s = store.get('sonAtesKayit'); if (!s) return null; try { const d = JSON.parse(s); return { day: d.day, diff: d.diff, s }; } catch (e) { return null; } }
function startScreen() {
  G.started = false; $('hud').style.display = 'none';
  const sv = saveInfo(), tutDone = store.get('sonAtesTutDone');
  const achList = Object.entries(ACH).map(([k, a]) => `<div class="${ACHSET.has(k) ? 'got' : ''}">${ACHSET.has(k) ? '🏆' : '🔒'} <b>${a.ad}</b> — ${a.desc}</div>`).join('');
  const best = +(store.get('sonAtesRekor') || 0);
  $('screenBox').innerHTML = `<h1>SON ATEŞ</h1>
  <p class="story">Bir fırtına. Kör edici bir ışık. Uyandığınızda gökyüzünde tanımadığınız kanatlar,<br>ormanda tanımadığınız sesler vardı. Dört kişisiniz. Bir ateşiniz var.<br>Uzaklarda bir yerde, sizi buraya getiren yarık hâlâ parlıyor.<br><b>Ve gece yaklaşıyor.</b></p>
  ${sv ? `<button id="cont" class="big">DEVAM ET <small>(${sv.day}. gün · ${DIFF[sv.diff] ? DIFF[sv.diff].ad : ''})</small></button><br>` : ''}
  <div class="diffs">${Object.entries(DIFF).map(([k, d]) => `<button data-d="${k}" class="${UI.diff === k ? 'on' : ''}">${d.ad}</button>`).join('')}</div>
  <p class="ddesc" id="ddesc">${DIFF[UI.diff].desc}</p>
  <label class="chk"><input type="checkbox" id="tutChk" ${tutDone ? '' : 'checked'}> Öğretici ile başla</label><br>
  <button id="go" class="big">${sv ? 'YENİ OYUN' : 'ATEŞİ YAK'}</button>
  ${best ? `<p>En uzun hayatta kalma: <b>${best} gün</b></p>` : ''}
  <details><summary>Nasıl oynanır?</summary><div class="keys">${isTouch ? `<b>Sol taraf</b> hareket · <b>Saldır</b> mızrak · <b>Ok</b> yay · <b>Topla/Kullan</b> toplama, ateş, tedavi, evcilleştirme, binme` : `<b>WASD</b> hareket · <b>Shift</b> koş · <b>Fare/Boşluk</b> mızrak · <b>F / sağ tık</b> ok<br><b>E</b> (basılı) topla · ateşe odun · tedavi · evcilleştir · kurtar · bin/in<br><b>1-8</b> inşa · <b>C</b> zanaat · <b>M</b> harita · <b>H</b> halk paneli · <b>T</b> meşale · <b>P</b> duraklat`}<br>
  <b>Halk</b>: sağ panelde gruplar (Odun, Taş, Yiyecek, Şifacı, Muhafız, Takip, Boşta). <b>+/−</b> ile kişi aktar, <b>★</b> ile yönetici ata. Yöneticisi olan grup daha hızlı çalışır, <b>⚡ özel yetenek</b> ve <b>📍 bölge emri</b> kullanabilir. Kişiler sekmesinde çoklu seçip toplu aktarabilirsin.<br>
  <b>Bilinmezlik</b>: sadece halkının gördüğünü görürsün. Karanlık yerlere 🧭 kâşif gönder. Geceler çoğu zaman sessizdir... ama her zaman değil.<br>
  <b>Hedef</b>: haritada zaman yarığını bul, halkını 12 kişiye çıkar, Yarık Taşı yap ve son savaşı kazan.</div></details>
  <details><summary>Başarımlar (${ACHSET.size}/${Object.keys(ACH).length})</summary><div class="achs">${achList}</div></details>
  <p style="font-size:12px;color:#776">🎧 Kulaklıkla oyna.</p>`;
  $('screen').style.display = 'flex';
  for (const b of document.querySelectorAll('.diffs button')) b.onclick = () => { UI.diff = b.dataset.d; for (const x of document.querySelectorAll('.diffs button')) x.classList.toggle('on', x === b); $('ddesc').textContent = DIFF[UI.diff].desc; };
  $('go').onclick = () => { audioInit(); newGame(UI.diff, $('tutChk').checked); };
  if (sv) $('cont').onclick = () => { audioInit(); try { loadGame(sv.s); } catch (e) { console.error(e); store.del('sonAtesKayit'); startScreen(); } };
}
function onGameStart() {
  $('screen').style.display = 'none'; $('hud').style.display = 'block'; $('pause').style.display = 'none';
  G.started = true; G.paused = false; G.modal = false; $('craft').style.display = 'none';
  UI.sel.clear(); UI.open.clear(); UI.filter = 'all';
  if (innerWidth <= 700) { toggleSide(false); $('miniBox').style.display = 'none'; } else { toggleSide(true); $('miniBox').style.display = 'block'; }
  $('miniBox').classList.remove('big');
  buildTools(); renderSide(); updateHUD();
}
function showGameOver() {
  const dawn = G.diff === 'kolay' && store.get('sonAtesSafak');
  $('screenBox').innerHTML = `<h1 style="color:#c33;text-shadow:0 0 30px #600">KARANLIK</h1>
  <p class="story">Ateşin son közü de söndü. Ormanın sesleri, sanki hiçbir şey olmamış gibi devam etti.</p>
  <p><b>${G.day}</b> gün hayatta kaldınız · <b>${G.kills}</b> yaratık avlandı · <b>${G.deaths}</b> kişi öldü · <b>${G.lost}</b> kişi kayboldu</p>
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
  <p class="story">Yarık bir nefes gibi açıldı ve kapandı. Arkada, ormanın içinde, bir ateş hâlâ yanıyordu.</p>
  <p><b>${saved.length}</b> kişi yarıktan geçti: ${saved.map(p => p.name).join(', ')}.</p>
  ${left ? `<p class="story">${left} kişi geride, kampta kaldı. Onlar bu dünyanın ilk köyünü kuracak.</p>` : ''}
  <p><b>${G.day}</b> gün · <b>${G.kills}</b> av · <b>${G.deaths}</b> kayıp · ${DIFF[G.diff].ad}</p>
  <button id="menu" class="big">ANA MENÜ</button>`;
  $('screen').style.display = 'flex'; $('hud').style.display = 'none';
  $('menu').onclick = startScreen;
}

// ---- döngü
let lastT = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  if (G.started && L) {
    if (!G.paused && !G.over && !G.modal) update(dt);
    if (L) { render(); hudTick(dt); }
  }
  requestAnimationFrame(loop);
}
makeGround();
startScreen();
requestAnimationFrame(loop);
window.__G = G; window.__getL = () => L;
