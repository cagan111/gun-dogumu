// =============================================================
//  TARIM: ekin türleri, tohumlar, tarla başına seçim
//  - b.crop: oyuncunun seçtiği ekin (çiftçi hasattan sonra hep bunu eker); b.cur: şu an ekili olan
//  - Tohumlar G.seeds içinde; 'cali' çelikle çoğaltılır, tohum istemez (eski davranış)
//  - Görsel: uc.js b.crop / b.cur'a göre ekin çeşidi çizebilir (Codex)
// =============================================================
// sez: [ilkbahar, yaz, sonbahar, kış] büyüme çarpanı · minT: altında büyümez (°C) · out: hasat
const CROPS = {
  cali:    { ad: 'Meyve çalısı',  ic: '🫐', seed: false, grow: 1.0,  sez: [1.1, 1, 0.7, 0],    minT: 3,  out: { meyve: 14 }, desc: 'Çelikle dikilir, tohum istemez. Meyve verir.' },
  tahil:   { ad: 'Yabani tahıl',  ic: '🌾', seed: true,  grow: 0.85, sez: [1.2, 1, 0.8, 0.15], minT: 1,  out: { meyve: 19 }, desc: 'Ağır büyür ama bol tane verir; aşçı pişirir. Soğuğa dayanıklı.' },
  ot:      { ad: 'Şifalı ot',     ic: '🌿', seed: true,  grow: 1.15, sez: [1.2, 1, 0.6, 0],    minT: 4,  out: { herb: 6 },   desc: 'İlaç, sargı ve ot çayı için.' },
  lif:     { ad: 'Lif otu',       ic: '🪢', seed: true,  grow: 0.6,  sez: [1, 1.1, 0.7, 0],    minT: 5,  out: { halat: 2 },  desc: 'Uzun, sağlam lifler; çiftçi hasatta büküp halat yapar (gemi için).' },
  balotu:  { ad: 'Balotu',        ic: '🌼', seed: true,  grow: 1.0,  sez: [1.1, 1.1, 0.5, 0],  minT: 5,  out: { balotu: 5 }, desc: 'Tatlı kokulu çiçek; aşçı akşam için bal gibi çay demler.' }
};
const CORDER = ['cali', 'tahil', 'ot', 'lif', 'balotu'];
const SEED_BIOME = { 4: 'tahil', 0: 'ot', 3: 'lif', 5: 'lif', 2: 'balotu', 1: 'ot' };   // toplayıcının tohum bulduğu biyom
const cropOf = b => CROPS[b.cur] ? b.cur : CROPS[b.crop] ? b.crop : 'cali';
const hasSeed = k => !CROPS[k].seed || (G.seeds && (G.seeds[k] || 0) >= 1);

// büyüme hızı çarpanı (oyun.js tarla büyümesi): mevsim × ekin, kar ve don durdurur
function cropGrow(b) {
  const C = CROPS[cropOf(b)], w = seasonW();
  let m = 0; for (let i = 0; i < 4; i++) m += w[i] * C.sez[i];
  if (typeof snowAt === 'function' && snowAt(b.x, b.y) > 0.15) return 0;
  const T = tempAt(b.x, b.y); if (T < C.minT) return 0;
  return m * C.grow * clamp((T - C.minT) / 4, 0.3, 1);
}
// çiftçi: ekim (tohum düşer)
function cropPlant(b) {
  const k = CROPS[b.crop] ? b.crop : 'cali';
  if (!hasSeed(k)) return false;
  if (CROPS[k].seed) G.seeds[k]--;
  b.cur = k; b.planted = true; b.g = 0; b.noSeed = false; return true;
}
// çiftçi: hasat → torbaya ürün, depoya tohum
function cropHarvest(p, b) {
  const k = cropOf(b), C = CROPS[k], sm = skillMul(lvl(p, 'tarim'));
  let txt = [];
  for (const r in C.out) { const n = Math.max(1, Math.round(C.out[r] * sm)); p.bag[r] = (p.bag[r] || 0) + n; p.carry += n; txt.push(`+${n} ${icOf(r)}`); }
  if (C.seed) { const s = ri(1, 3); G.seeds[k] = (G.seeds[k] || 0) + s; txt.push(`+${s} tohum`); }
  b.planted = false; b.g = 0; b.cur = null;
  ftext(b.x, b.y - 20, `Hasat! ${C.ic} ${txt.join(' ')}`, '#ffe08a');
}
// toplayıcı: meyve toplarken arada tohum bulur
function seedFind(p, o) {
  if (Math.random() > 0.035) return;
  const k = SEED_BIOME[biomeFast(o.x, o.y)] || 'tahil';
  const n = ri(1, 2); G.seeds[k] = (G.seeds[k] || 0) + n;
  if (!G.seedSeen) G.seedSeen = {};
  if (!G.seedSeen[k]) { G.seedSeen[k] = 1; msg(`🌱 ${p.name} ${CROPS[k].ad} tohumu buldu! Bir tarlaya gidip ekini seçebilirsin.`, '#bfe8a0', 6); }
  else if (L && dist(p, L) < 500) ftext(p.x, p.y - 30, `+${n} ${CROPS[k].ic} tohum`, '#bfe8a0');
}

// ---- tarla seçici (sohbet.js'deki pencereyi kullanır)
let CROPB = null;
function openCrop(b) {
  CROPB = b; if (typeof unlockPtr === 'function') unlockPtr();
  TALK = { v: 'crop', txt: '' }; $('talkM').style.display = 'flex'; G.modal = true; renderCrop();
}
function renderCrop() {
  const b = CROPB; if (!b || b.dead) { closeTalk(); return; }
  const cur = cropOf(b), sel = CROPS[b.crop] ? b.crop : 'cali';
  let h = `<div class="ch"><b style="font-size:16px">🌾 Tarla — ne ekilsin?</b><span class="res">${b.planted ? `Ekili: ${CROPS[cur].ic} ${CROPS[cur].ad} · %${Math.round(b.g * 100)}${cropGrow(b) <= 0 ? ' · büyümüyor (soğuk/kar)' : ''}` : b.noSeed ? 'Tohum yok — boş bekliyor' : 'Boş, ekim bekliyor'}</span><button data-t="close">✕</button></div><div class="cl" style="padding:10px 14px">`;
  h += `<p class="hint">Seçtiğin ekin bu tarlaya hep yeniden ekilir. Ekili ekin değişmez; yeni seçim bir sonraki ekimde başlar.</p><div class="gsel tsel">`;
  for (const k of CORDER) {
    const C = CROPS[k], n = C.seed ? (G.seeds[k] || 0) : '∞', ok = hasSeed(k);
    h += `<button data-t="crop" data-v="${k}" class="${sel === k ? 'on' : ''} ${ok ? '' : 'no'}">${C.ic} ${C.ad}${sel === k ? ' ✓' : ''}<br><small>${C.desc} · tohum: ${n}</small></button>`;
  }
  h += `</div></div>`;
  $('talkBox').innerHTML = h;
}
function cropAct(v) {
  const b = CROPB; if (!b || !CROPS[v]) return;
  b.crop = v;
  if (b.planted && b.cur !== v && b.g < 0.05 && CROPS[b.cur] && CROPS[b.cur].seed !== undefined) {   // yeni ekilmişse (filiz yok) hemen değiştir, tohumu iade et
    if (CROPS[b.cur].seed) G.seeds[b.cur] = (G.seeds[b.cur] || 0) + 1;
    b.planted = false; b.cur = null;
  }
  msg(`🌾 Bu tarlaya artık ${CROPS[v].ic} ${CROPS[v].ad} ekilecek.${hasSeed(v) ? '' : ' Ama hiç tohum yok! Toplayıcılar bulana kadar tarla boş bekler.'}`, hasSeed(v) ? '#bfe8a0' : '#e9c', 4);
  renderCrop(); G.uiDirty = true;
}
