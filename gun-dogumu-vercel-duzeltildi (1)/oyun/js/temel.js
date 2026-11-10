'use strict';
// =============================================================
//  SON ATEŞ — temel: yardımcılar, sabitler, veri tanımları, ses
// =============================================================
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rand(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
function angLerp(a, b, t) { const d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI; return a + d * t; }
const $ = id => document.getElementById(id);
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---- Türkçe ek uyumu
function lastV(w) { const m = w.toLocaleLowerCase('tr').match(/[aeıioöuü](?=[^aeıioöuü]*$)/); return m ? m[0] : 'e'; }
function harm(w) { const v = lastV(w); return 'aı'.includes(v) ? 'ı' : 'ei'.includes(v) ? 'i' : 'ou'.includes(v) ? 'u' : 'ü'; }
const endsV = w => /[aeıioöuü]$/i.test(w);
const gen = w => w + "'" + (endsV(w) ? 'n' : '') + harm(w) + 'n';   // Ali'nin
const acc = w => w + "'" + (endsV(w) ? 'y' : '') + harm(w);         // Ali'yi
const cop = w => w + "'s" + harm(w) + 'n';                            // Ali'sin
const dat = w => w + "'" + (endsV(w) ? 'y' : '') + ('aıou'.includes(lastV(w)) ? 'a' : 'e'); // Ali'ye
function compass(a) { const d = ['doğu', 'güneydoğu', 'güney', 'güneybatı', 'batı', 'kuzeybatı', 'kuzey', 'kuzeydoğu']; return d[Math.round((((a % TAU) + TAU) % TAU) / (TAU / 8)) % 8]; }

// ---- dünya sabitleri
const WORLD = 6000, CAMP = { x: 3000, y: 3000 }, CYCLE = 300;
const MAPN = 100, MAPC = WORLD / MAPN; // keşif / biyom ızgarası

const NAMES = ['Arda','Ece','Toprak','Deniz','Kaya','Ilgın','Bora','Su','Tan','Yağmur','Doruk','Nehir','Çınar','Defne','Alp','Elif','Umut','Ay','Bulut','Duru','Ege','Lale','Oğuz','Selin','Yiğit','Mert','Zeynep','Kuzey','Asya','Poyraz','Rüzgar','Sema','Ozan','Ada','Kartal','Pınar','Barış','Cemre','Dilan','Eren','Feride','Gökay','Hazal','İlkay','Jale','Kerem','Leyla','Melis','Nazlı','Orhan','Pelin','Reşat','Sarp','Şule','Tuna','Ufuk','Vedat','Yasemin','Zafer','Aslı','Berk','Ceren','Dağhan','Esin','Fırat','Gizem','Harun','Irmak','Koray','Mira','Nil','Okan','Serra','Tolga','Volkan','Yaren'];
const STORIES = ['Fırtınadan önce veterinerdi.','Bir lisede tarih öğretmeniydi.','Elinde hâlâ bir telefon var. Şarjı çoktan bitti.','Eski bir dağcı. Yükseklikten korkmaz.','Bir fırında çalışıyordu. Ekmek kokusunu özlüyor.','Hemşireydi; kan görmekten korkmaz.','Bir çiftlikte büyüdü, hayvanları tanır.','Öğrenciydi; sınav haftası başlamak üzereydi.','Bir futbol takımının kalecisiydi.','İnşaat ustası. Elleri nasırlı.','Kardeşini fırtınada kaybetti. Hâlâ arıyor.','Gece bekçisiydi. Karanlığa alışkın.','Balıkçıydı; suyun sesini dinler.','Bir müzede dinozor iskeletlerini temizlerdi. Ne ironi.','Aşçıydı; "her şeyi pişiririm" der.','Taksi şoförüydü. Yön duygusu çok iyi.','Emekli bir asker. Az konuşur.','Kütüphaneciydi. Geceleri ateş başında hikâye anlatır.','Yazılımcıydı. "Burada hiçbir şey derlenmiyor" diye şakalaşır.','Tiyatro oyuncusuydu. Herkesi güldürmeye çalışır.','Doğa fotoğrafçısıydı. Bu yaratıkları çekemediğine yanıyor.','Ormancıydı; ağaçları sesinden tanır.','Bir düğüne gidiyordu. Hâlâ takım elbisesinin parçalarını taşıyor.','Marangozdu.','Çocuklara yüzme öğretirdi.','Hiç konuşmuyor. Adını halk koydu.','Kuyumcuydu; kristallere bakışı başka.','Eczanede çalışıyordu. Otları tanır.','Kamyon şoförüydü; ağır yük taşımaya alışkın.','Kayıp bir çocuğu bulup kampa getirdi. Kendisi de kayıptı.','Bir radyoda gece programı sunardı. Sesi herkesi sakinleştirir.','Annesine "akşama dönerim" demişti.'];

const TRAITS = {
  cesur:    { ad: 'Cesur',        ic: '🦁', desc: 'Korkuyu yarı yarıya hisseder.', ex: ['korkak'] },
  korkak:   { ad: 'Korkak',       ic: '🐇', desc: 'Çabuk paniğe kapılır.', ex: ['cesur'] },
  avci:     { ad: 'İyi Avcı',     ic: '🏹', desc: '%50 daha sert vurur; yay varsa ok atar.' },
  uykusuz:  { ad: 'Uykusuz',      ic: '🦉', desc: 'Gece nöbetinden yorulmaz.' },
  hasta:    { ad: 'Hastalıklı',   ic: '🤒', desc: 'Daha az can; sık enfeksiyon kapar.', ex: ['guclu'] },
  yasli:    { ad: 'Yaşlı Bilge',  ic: '📜', desc: 'Yavaştır ama iyi yöneticidir.', ex: ['cevik'] },
  cevik:    { ad: 'Çevik',        ic: '💨', desc: '%25 daha hızlı.', ex: ['yasli'] },
  guclu:    { ad: 'Güçlü',        ic: '💪', desc: 'Daha çok can, daha çok taşır.', ex: ['hasta'] },
  onder:    { ad: 'Önder Ruhlu',  ic: '⭐', desc: 'Yönetici olunca grubu çok daha verimli olur.' },
  caliskan: { ad: 'Çalışkan',     ic: '⚒️', desc: '%30 daha hızlı çalışır.' },
  sifali:   { ad: 'Şifalı Eller', ic: '🤲', desc: 'Yaraları iki kat hızlı sarar.' }
};
const tr = (p, k) => !!(p.traits && p.traits.includes(k));

const GROUPS = {
  odun:    { ad: 'Odun',    ic: '🪵', col: '#8a5a32', desc: 'Ağaç keser, odunu ateşe taşır.' },
  tas:     { ad: 'Taş',     ic: '🪨', col: '#7c7c7c', desc: 'Taş kırar; dağlara gönderilirse kristal çıkarır.' },
  yiyecek: { ad: 'Yiyecek', ic: '🫐', col: '#7a3a6a', desc: 'Meyve toplar.' },
  sifaci:  { ad: 'Şifacı',  ic: '🌿', col: '#3a7a5a', desc: 'Yaralıları tedavi eder, ot ve zehir toplar, ilaç yapar.' },
  muhafiz: { ad: 'Muhafız', ic: '🛡️', col: '#2c4f7a', desc: 'Kampı korur, gece nöbet tutar, kulelere çıkar.' },
  kasif:   { ad: 'Kâşif',   ic: '🧭', col: '#8a7a3a', desc: 'Bilinmeyen yerleri keşfeder. Büyük haritaya (M) dokunarak hedef ver.' },
  takip:   { ad: 'Takip',   ic: '👣', col: '#5c6b2a', desc: 'Seninle gelir, yanında savaşır.' },
  bos:     { ad: 'Boşta',   ic: '💤', col: '#555',    desc: 'Ateş başında dinlenir, ateşi besler.' }
};
const GORDER = ['odun', 'tas', 'yiyecek', 'sifaci', 'kasif', 'muhafiz', 'takip', 'bos'];
const ABIL = {
  odun:    { ad: 'Toplu Kesim',     desc: '30 sn boyunca odun ×2',                     dur: 30, cd: 120 },
  tas:     { ad: 'Damar Bul',       desc: '30 sn boyunca taş/kristal ×2',              dur: 30, cd: 120 },
  yiyecek: { ad: 'Hasat Bereketi',  desc: 'Kampa yakın bütün çalılar meyveyle dolar',  dur: 0,  cd: 150 },
  sifaci:  { ad: 'Şifa Çemberi',    desc: 'Kamptaki herkes +40 can, kanamalar durur',  dur: 0,  cd: 120 },
  muhafiz: { ad: 'Savunma Düzeni',  desc: '25 sn: muhafızlar korkusuz, +%60 hasar',    dur: 25, cd: 100 },
  kasif:   { ad: 'Uzak Keşif',      desc: '40 sn: kâşifler daha hızlı, daha uzağı görür', dur: 40, cd: 120 },
  takip:   { ad: 'Hücum!',          desc: '15 sn: takipçiler hızlanır, öfkeyle saldırır', dur: 15, cd: 90 }
};

const DINO = {
  kucuk:     { ad: 'Sürüngeç',  r: 9,  hp: 16,  spd: 175, dmg: 4,  cd: 0.7, col: '#6b7d3a', eye: '#b6ff5a', drop: { food: 2 },                       sense: 380, nsense: 560,  pred: true },
  tukurgec:  { ad: 'Tükürgeç',  r: 13, hp: 32,  spd: 160, dmg: 7,  cd: 0.9, col: '#5a6a4a', eye: '#ff9a3a', drop: { food: 4, bone: 1, poison: 2 },  sense: 420, nsense: 600,  pred: true },
  yirtici:   { ad: 'Yırtıcı',   r: 20, hp: 70,  spd: 215, dmg: 13, cd: 0.9, col: '#8a4b2a', eye: '#ffd23a', drop: { food: 9, bone: 2, hide: 1 },    sense: 480, nsense: 850,  pred: true },
  dev:       { ad: 'Dev Kafa',  r: 62, hp: 750, spd: 125, dmg: 48, cd: 1.6, col: '#3e3b35', eye: '#ff3a1a', drop: { food: 80, bone: 16, hide: 10 }, sense: 750, nsense: 1150, pred: true },
  boynuzlu:  { ad: 'Boynuzlu',  r: 40, hp: 200, spd: 80,  dmg: 24, cd: 1.3, col: '#a08860', eye: '#ddd',    drop: { food: 30, bone: 5, hide: 4 } },
  uzunboyun: { ad: 'Uzunboyun', r: 74, hp: 900, spd: 46,  dmg: 34, cd: 2.0, col: '#6f7f62', eye: '#ddd',    drop: { food: 110, bone: 14, hide: 8 } },
  kanatli:   { ad: 'Kanatlı',   r: 16, hp: 40,  spd: 170, dmg: 6,  cd: 1.0, col: '#8a6a5a', eye: '#9cf',    drop: { food: 4, bone: 1, hide: 1 } },
  batakci:   { ad: 'Batakçı',   r: 30, hp: 170, spd: 230, dmg: 26, cd: 1.2, col: '#46553a', eye: '#cf6',    drop: { food: 18, bone: 3, hide: 5 } },
  yamyam:    { ad: 'Yamyam',    r: 11, hp: 55,  spd: 140, dmg: 11, cd: 1.0, col: '#3a2a20', eye: '#e8d8b0', drop: { bone: 1, hide: 1 },             sense: 420, nsense: 620,  pred: true, human: true }
};

const BUILD = {
  kulube:   { ad: 'Kulübe',          ic: '🛖', cost: { wood: 15, stone: 4 },  r: 30, hp: 240, desc: '+3 nüfus, 3 kişi güvenle uyur' },
  cit:      { ad: 'Kazık Çit',       ic: '🪵', cost: { wood: 4 },             r: 20, hp: 140, desc: 'Yaratıkları durdurur, halk geçebilir' },
  duvar:    { ad: 'Taş Duvar',       ic: '🧱', cost: { stone: 6 },            r: 22, hp: 450, tech: 'tasDuvar', desc: 'Çok dayanıklı engel' },
  mesale:   { ad: 'Meşale Direği',   ic: '🔦', cost: { wood: 4, stone: 2 },   r: 8,  hp: 70,  desc: 'Güvenli ışık' },
  tuzak:    { ad: 'Kazık Tuzağı',    ic: '⚠️', cost: { wood: 4, stone: 3 },   r: 16, hp: 999, desc: '3 kez 45 hasar' },
  kule:     { ad: 'Gözetleme Kulesi',ic: '🗼', cost: { wood: 12, stone: 8 },  r: 24, hp: 300, tech: 'kule', desc: 'Geniş ışık; muhafız çıkarsa ok atar' },
  raf:      { ad: 'Kurutma Rafı',    ic: '🥩', cost: { wood: 6, hide: 2 },    r: 18, hp: 100, tech: 'kurutma', desc: 'Her şafak +3🍖, avlardan daha çok et' },
  sifahane: { ad: 'Şifahane',        ic: '⛺', cost: { wood: 10, stone: 4 },  r: 32, hp: 250, tech: 'sifahane', desc: 'Yakınındakiler 3 kat hızlı iyileşir' }
};
const BORDER = ['kulube', 'cit', 'duvar', 'mesale', 'tuzak', 'kule', 'raf', 'sifahane'];

const TECH = {
  tasMizrak:   { ad: 'Taş Mızrak',       kat: 'Silah',    cost: { wood: 5, stone: 10 },           req: [],            desc: 'Lider ve halk daha sert vurur.' },
  kemikMizrak: { ad: 'Kemik Mızrak',     kat: 'Silah',    cost: { bone: 10, crystal: 3, wood: 5 }, req: ['tasMizrak'], desc: 'En güçlü yakın dövüş silahı.' },
  yay:         { ad: 'Ok ve Yay',        kat: 'Silah',    cost: { wood: 10, bone: 6, hide: 3 },   req: ['tasMizrak'], desc: 'F / sağ tık / Ok düğmesi ile ok at. İyi Avcı muhafızlar da ok atar.' },
  zehirliOk:   { ad: 'Zehirli Ok',       kat: 'Silah',    cost: { poison: 8, bone: 4 },           req: ['yay'],       desc: 'Oklar zehirler: saniyede ek hasar.' },
  elMesalesi:  { ad: 'El Meşalesi',      kat: 'Araç',     cost: { wood: 6 },                       req: [],            desc: 'Etrafında güvenli ışık. [T] ile yak/söndür, odun tüketir.' },
  eyer:        { ad: 'Eyer',             kat: 'Araç',     cost: { hide: 6, wood: 4 },              req: [], reqTame: 'boynuzlu', desc: 'Evcil Boynuzlu’ya bin (yanında E). Hızlı gider, çarparak saldırır.' },
  deriZirh:    { ad: 'Deri Zırh',        kat: 'Zırh',     cost: { hide: 8, bone: 4 },              req: [],            desc: 'Lider %30 daha az hasar alır.' },
  halkZirhi:   { ad: 'Halk Zırhı',       kat: 'Zırh',     cost: { hide: 20, bone: 6 },             req: ['deriZirh'],  desc: 'Bütün halk %25 daha az hasar alır.' },
  tasDuvar:    { ad: 'Taş Duvar',        kat: 'Yapı',     cost: { stone: 12 },                     req: [],            desc: 'Taş duvar inşa edilebilir.' },
  kule:        { ad: 'Gözetleme Kulesi', kat: 'Yapı',     cost: { wood: 15, stone: 10 },           req: ['tasDuvar'],  desc: 'Kule inşa edilebilir: geniş ışık, ok atan nöbetçi.' },
  kurutma:     { ad: 'Et Kurutma',       kat: 'Yapı',     cost: { wood: 12, hide: 4 },             req: [],            desc: 'Kurutma rafı inşa edilebilir.' },
  sifahane:    { ad: 'Şifahane',         kat: 'Yapı',     cost: { wood: 15, stone: 6, herb: 6 },   req: [],            desc: 'Şifahane inşa edilebilir.' },
  ilac:        { ad: 'İlaç (1 adet)',    kat: 'Tüketim',  cost: { herb: 3 },                       req: [], repeat: true, desc: 'Enfeksiyonu iyileştirir. Şifacılar kendileri de yapar.' },
  yarikTasi:   { ad: 'Yarık Taşı',       kat: 'Kurtuluş', cost: { crystal: 25, stone: 40, wood: 40 }, req: ['kule'], reqPop: 12, desc: 'Zaman yarığını açar. Halkın en az 12 kişi olmalı. Yarığa götür, E ile etkinleştir ve dayan.' }
};
const TORDER = ['tasMizrak', 'yay', 'zehirliOk', 'kemikMizrak', 'elMesalesi', 'eyer', 'deriZirh', 'halkZirhi', 'tasDuvar', 'kule', 'kurutma', 'sifahane', 'ilac', 'yarikTasi'];

const RES = { wood: '🪵', stone: '🪨', food: '🍖', bone: '🦴', hide: '🟫', herb: '🌿', poison: '☠️', crystal: '💎', med: '💊' };
const RESN = { wood: 'Odun', stone: 'Taş', food: 'Yiyecek', bone: 'Kemik', hide: 'Deri', herb: 'Şifalı ot', poison: 'Zehir', crystal: 'Kristal', med: 'İlaç' };

const DIFF = {
  kolay:  { ad: 'Kolay',  dmg: 0.6,  spawn: 0.7, burn: 0.8, eat: 0.75, desc: 'Hikâye modu. Ölürsen son şafaktan devam edersin.' },
  normal: { ad: 'Normal', dmg: 1,    spawn: 1,   burn: 1,   eat: 1,    desc: 'Dengeli. Oyun otomatik kaydedilir.' },
  kabus:  { ad: 'Kâbus',  dmg: 1.35, spawn: 1.3, burn: 1.2, eat: 1.15, desc: 'Tek can. Kayıt yok. Karanlık affetmez.' }
};

const ACH = {
  dev:       { ad: 'Dev Avcısı',          desc: 'Bir Dev Kafa öldür' },
  kayipsiz:  { ad: 'Kimse Geride Kalmaz', desc: 'Kimseyi kaybetmeden 10 gün geçir' },
  ates:      { ad: 'Sönmeyen Ateş',       desc: 'Ateş hiç sönmeden 5 gece geçir' },
  evcil3:    { ad: 'Yaratık Dostu',       desc: '3 yaratık evcilleştir' },
  binici:    { ad: 'Binici',              desc: 'Bir Boynuzlu’ya bin' },
  halk20:    { ad: 'Kabile',              desc: '20 kişilik bir halka ulaş' },
  cocuk:     { ad: 'Yeni Nesil',          desc: 'Kampta ilk çocuk doğsun' },
  yumurta:   { ad: 'Yuva Hırsızı',        desc: 'Bir yırtıcı yumurtasını kampa getir' },
  kule:      { ad: 'Gözcü',               desc: 'Gözetleme kulesi inşa et' },
  kasif:     { ad: 'Kâşif',               desc: 'Haritanın %40’ını keşfet' },
  gun15:     { ad: 'Dayanıklı',           desc: '15 gün hayatta kal' },
  kurtulus:  { ad: 'Eve Dönüş',           desc: 'Zaman yarığından geç' },
  kabus:     { ad: 'Kâbusu Yen',          desc: 'Kâbus zorluğunda 10 gün hayatta kal' }
};

// ---- kalıcı depolama (güvenli)
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { } }
};

// ---- oyun durumu (tek nesne) ve lider
const G = {};
let L = null;

// ---- uzaysal ızgara (engeller)
const CELL = 200; let grid = new Map();
function cellsOf(o, fn) {
  const x0 = Math.floor((o.x - o.r) / CELL), x1 = Math.floor((o.x + o.r) / CELL), y0 = Math.floor((o.y - o.r) / CELL), y1 = Math.floor((o.y + o.r) / CELL);
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) fn(x * 10007 + y);
}
function gAdd(o) { cellsOf(o, k => { let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(o); }); }
function gDel(o) { cellsOf(o, k => { const a = grid.get(k); if (a) { const i = a.indexOf(o); if (i >= 0) a.splice(i, 1); } }); }
function gQuery(x, y, r) {
  const res = [];
  const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL), y0 = Math.floor((y - r) / CELL), y1 = Math.floor((y + r) / CELL);
  for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) { const a = grid.get(cx * 10007 + cy); if (a) for (const o of a) if (!res.includes(o)) res.push(o); }
  return res;
}

// ---- mesajlar ve yüzen yazılar
function msg(t, col = '#eee', dur = 5) { if (!G.msgs) return; G.msgs.push({ t, col, life: dur }); if (G.msgs.length > 6) G.msgs.shift(); G.msgDirty = true; }
function ftext(x, y, t, col = '#fff') { G.texts.push({ x, y, t, col, life: 1.3 }); }
function addStock(k, n, x, y) { if (n <= 0) return; G.stock[k] += n; if (x !== undefined) ftext(x, y - 16, `+${n} ${RES[k]}`, '#ffe9b0'); }
function canAfford(c) { for (const k in c) if ((G.stock[k] || 0) < c[k]) return false; return true; }
function pay(c) { for (const k in c) G.stock[k] -= c[k]; }
function costTxt(c) { return Object.entries(c).map(([k, v]) => `${v}${RES[k]}`).join(' '); }

// =============================================================
//  SES — tamamen sentezlenmiş (WebAudio)
// =============================================================
const A = { ctx: null };
function audioInit() {
  if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    A.ctx = ac;
    A.master = ac.createGain(); A.master.gain.value = 0.7; A.master.connect(ac.destination);
    const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    A.noise = buf;
    const bb = ac.createBuffer(1, len, ac.sampleRate), bd = bb.getChannelData(0); let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = last * 3.5; }
    const w = ac.createBufferSource(); w.buffer = bb; w.loop = true;
    const wf = ac.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 500;
    A.wind = ac.createGain(); A.wind.gain.value = 0.05;
    w.connect(wf); wf.connect(A.wind); A.wind.connect(A.master); w.start();
    const rn = ac.createBufferSource(); rn.buffer = buf; rn.loop = true;
    const rf = ac.createBiquadFilter(); rf.type = 'highpass'; rf.frequency.value = 1400;
    A.rain = ac.createGain(); A.rain.gain.value = 0;
    rn.connect(rf); rf.connect(A.rain); A.rain.connect(A.master); rn.start();
    const dr = ac.createOscillator(); dr.type = 'sine'; dr.frequency.value = 43;
    const dr2 = ac.createOscillator(); dr2.type = 'sine'; dr2.frequency.value = 44.3;
    A.drone = ac.createGain(); A.drone.gain.value = 0;
    dr.connect(A.drone); dr2.connect(A.drone); A.drone.connect(A.master); dr.start(); dr2.start();
    const ds = ac.createWaveShaper(); const c = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = i / 128 - 1; c[i] = Math.tanh(x * 4); }
    ds.curve = c; A.dist = ds; ds.connect(A.master);
  } catch (e) { A.ctx = null; }
}
function sOut(pan) {
  if (pan !== undefined && A.ctx.createStereoPanner) { const p = A.ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); p.connect(A.master); return p; }
  return A.master;
}
function tone(type, f0, f1, dur, vol, opt = {}) {
  if (!A.ctx || !(vol >= 0.003)) return;
  const ac = A.ctx, t = ac.currentTime + (opt.delay || 0);
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + (opt.att || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  if (opt.vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = opt.vib; lg.gain.value = f0 * 0.06; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur); }
  o.connect(g); g.connect(opt.dist ? A.dist : sOut(opt.pan)); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, vol, ftype, f0, f1, opt = {}) {
  if (!A.ctx || !(vol >= 0.003)) return;
  const ac = A.ctx, t = ac.currentTime + (opt.delay || 0);
  const s = ac.createBufferSource(); s.buffer = A.noise; s.playbackRate.value = opt.rate || 1;
  const f = ac.createBiquadFilter(); f.type = ftype; f.Q.value = opt.q || 1;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + (opt.att || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(opt.dist ? A.dist : sOut(opt.pan)); s.start(t, Math.random()); s.stop(t + dur + 0.05);
}
const SFX = {
  roar(v, pan) { noise(2.4, v * 0.9, 'lowpass', 900, 90, { att: 0.25, q: 4, pan }); tone('sawtooth', 95, 38, 2.3, v * 0.45, { att: 0.3, dist: true, vib: 7 }); tone('square', 190, 70, 1.8, v * 0.12, { att: 0.2, vib: 11, pan }); },
  screech(v, pan) { tone('sawtooth', 1100, 1700, 0.18, v * 0.25, { pan }); tone('sawtooth', 1600, 600, 0.45, v * 0.25, { delay: 0.16, vib: 30, pan }); noise(0.5, v * 0.25, 'bandpass', 3000, 1500, { q: 3, pan }); },
  chirp(v, pan) { tone('square', 1800, 2600, 0.08, v * 0.12, { pan }); tone('square', 2200, 1500, 0.1, v * 0.12, { delay: 0.1, pan }); },
  thump(v) { tone('sine', 70, 28, 0.45, v, { att: 0.005 }); noise(0.25, v * 0.5, 'lowpass', 200, 40); },
  hit(v) { noise(0.12, v * 0.6, 'highpass', 1200, 600); tone('triangle', 220, 90, 0.1, v * 0.4); },
  swing() { noise(0.16, 0.12, 'bandpass', 600, 2400, { q: 2 }); },
  arrow() { noise(0.18, 0.15, 'bandpass', 3500, 900, { q: 3 }); },
  chop() { noise(0.07, 0.25, 'bandpass', 900, 500, { q: 4 }); tone('triangle', 300, 150, 0.06, 0.12); },
  rock() { noise(0.06, 0.25, 'highpass', 3000, 2000); tone('square', 900, 700, 0.04, 0.05); },
  pickup() { tone('sine', 600, 900, 0.08, 0.08); },
  scream(v, pan) { tone('sawtooth', 820, 300, 1.4, v * 0.3, { vib: 9, att: 0.05, pan }); tone('triangle', 1240, 450, 1.3, v * 0.15, { vib: 13, pan }); },
  heart(v) { tone('sine', 62, 38, 0.18, v); tone('sine', 58, 34, 0.18, v * 0.8, { delay: 0.22 }); },
  rustle(v, pan) { for (let i = 0; i < 5; i++) noise(0.09, v * rand(0.3, 1), 'bandpass', rand(1500, 4000), 1200, { delay: i * rand(0.06, 0.14), q: 1.5, pan }); },
  crackle(v) { noise(0.03, v, 'highpass', 2500, 2000); },
  bird() { const f = rand(2000, 3200); tone('sine', f, f * 1.3, 0.09, 0.025); tone('sine', f * 1.2, f * 0.9, 0.12, 0.025, { delay: 0.12 }); },
  build() { noise(0.1, 0.25, 'lowpass', 600, 200); tone('triangle', 200, 120, 0.15, 0.15, { delay: 0.12 }); },
  bell() { tone('sine', 520, 520, 1.2, 0.08); tone('sine', 780, 780, 1.0, 0.05); },
  sting() { tone('sawtooth', 110, 104, 2.5, 0.12, { att: 0.02, dist: true }); tone('sine', 1300, 1250, 2.0, 0.04, { vib: 6 }); },
  thunder(v) { noise(3.2, v, 'lowpass', 500, 50, { att: 0.03, q: 1 }); noise(1.2, v * 0.6, 'lowpass', 1500, 200, { delay: 0.05 }); },
  splash(v, pan) { noise(0.5, v * 0.5, 'bandpass', 900, 250, { q: 1.5, pan }); },
  flap(v, pan) { noise(0.12, v * 0.4, 'lowpass', 500, 150, { pan }); noise(0.12, v * 0.4, 'lowpass', 500, 150, { delay: 0.2, pan }); },
  mimic(v, pan) { tone('triangle', 320, 290, 0.5, v * 0.3, { vib: 5, att: 0.1, pan }); tone('triangle', 380, 300, 0.9, v * 0.3, { vib: 6, att: 0.1, delay: 0.6, pan }); },
  baby() { tone('square', 1400, 2000, 0.1, 0.06); tone('square', 1700, 1300, 0.12, 0.05, { delay: 0.12 }); },
  win() { [392, 494, 587, 784].forEach((f, i) => tone('sine', f, f, 2.5, 0.08, { delay: i * 0.25, att: 0.05 })); },
  jump() { noise(0.35, 0.9, 'highpass', 1800, 900, { att: 0.003 }); [220, 233, 311, 466, 622].forEach(f => tone('sawtooth', f, f * 0.97, 1.3, 0.11, { att: 0.004, dist: true })); tone('sine', 80, 30, 0.6, 0.8, { att: 0.003 }); },
  drum(v, pan) { for (let i = 0; i < 6; i++) { tone('sine', 95, 55, 0.3, v * (i % 3 === 0 ? 1 : 0.6), { delay: i * 0.38 + (i % 2) * 0.05, att: 0.005, pan }); noise(0.08, v * 0.3, 'lowpass', 400, 100, { delay: i * 0.38, pan }); } },
  warcry(v, pan) { [310, 360, 420, 480, 390].forEach((f, i) => tone('triangle', f, f * 1.25, 0.9, v * 0.16, { delay: i * 0.07, vib: 9 + i, att: 0.05, pan })); noise(0.8, v * 0.2, 'bandpass', 1200, 900, { q: 2, pan }); },
  spit(v, pan) { noise(0.15, v * 0.5, 'bandpass', 2500, 800, { q: 3, pan }); tone('square', 600, 300, 0.12, v * 0.1, { pan }); },
  crash(v, pan) { noise(0.9, v, 'lowpass', 1200, 80, { att: 0.01, pan }); tone('triangle', 120, 40, 0.6, v * 0.4, { pan }); },
  ach() { tone('sine', 880, 880, 0.4, 0.06); tone('sine', 1320, 1320, 0.6, 0.05, { delay: 0.12 }); }
};
const panOf = (x) => L ? clamp((x - L.x) / 700, -1, 1) : 0;
const volOf = (o, max) => L ? clamp(1 - dist(o, L) / max, 0, 1) : 0.3;
