'use strict';
// =============================================================
//  SON ATEŞ — temel: yardımcılar, sabitler, veri tanımları
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
const angDiff = (a, b) => Math.abs(((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI);
const $ = id => document.getElementById(id);
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---- Türkçe ek uyumu
function lastV(w) { const m = w.toLocaleLowerCase('tr').match(/[aeıioöuü](?=[^aeıioöuü]*$)/); return m ? m[0] : 'e'; }
function harm(w) { const v = lastV(w); return 'aı'.includes(v) ? 'ı' : 'ei'.includes(v) ? 'i' : 'ou'.includes(v) ? 'u' : 'ü'; }
const endsV = w => /[aeıioöuü]$/i.test(w);
const gen = w => w + "'" + (endsV(w) ? 'n' : '') + harm(w) + 'n';
const acc = w => w + "'" + (endsV(w) ? 'y' : '') + harm(w);
const cop = w => w + "'s" + harm(w) + 'n';
const dat = w => w + "'" + (endsV(w) ? 'y' : '') + ('aıou'.includes(lastV(w)) ? 'a' : 'e');
const cap1 = s => s[0].toLocaleUpperCase('tr') + s.slice(1);
function compass(a) { const d = ['doğu', 'güneydoğu', 'güney', 'güneybatı', 'batı', 'kuzeybatı', 'kuzey', 'kuzeydoğu']; return d[Math.round((((a % TAU) + TAU) % TAU) / (TAU / 8)) % 8]; }

// ---- dünya sabitleri
const WORLD = 16000, CAMP = { x: 8000, y: 8000 }, CYCLE = 300;
const MAPN = 200, MAPC = WORLD / MAPN;

const NAMES = ['Arda','Ece','Toprak','Deniz','Kaya','Ilgın','Bora','Su','Tan','Yağmur','Doruk','Nehir','Çınar','Defne','Alp','Elif','Umut','Ay','Bulut','Duru','Ege','Lale','Oğuz','Selin','Yiğit','Mert','Zeynep','Kuzey','Asya','Poyraz','Rüzgar','Sema','Ozan','Ada','Kartal','Pınar','Barış','Cemre','Dilan','Eren','Feride','Gökay','Hazal','İlkay','Jale','Kerem','Leyla','Melis','Nazlı','Orhan','Pelin','Reşat','Sarp','Şule','Tuna','Ufuk','Vedat','Yasemin','Zafer','Aslı','Berk','Ceren','Dağhan','Esin','Fırat','Gizem','Harun','Irmak','Koray','Mira','Nil','Okan','Serra','Tolga','Volkan','Yaren','Ahu','Batu','Cansu','Demir','Ebru','Filiz','Gökhan','Hande','Işıl','Kaan','Lara','Meltem','Nur','Onur','Pars','Rana','Sevgi','Tamer','Ülkü','Yavuz','Zerrin','Atlas','Bengü','Cihan','Derin','Emre','Funda','Gül','Hakan','İpek','Kıvanç','Mavi','Nehir Su','Özge','Rüya','Selim','Tuğçe','Uğur','Yonca'];
const STORIES = [
  { t: 'Fırtınadan önce veterinerdi.', sk: { sifa: 2, kasaplik: 2 } }, { t: 'Hemşireydi; kan görmekten korkmaz.', sk: { sifa: 3 } },
  { t: 'Kasaptı. Eti nasıl ayıracağını bilir.', sk: { kasaplik: 3 } }, { t: 'Avcıydı; dağlarda yaban domuzu avlardı.', sk: { avcilik: 3 } },
  { t: 'İnşaat ustası. Elleri nasırlı.', sk: { insaat: 3 } }, { t: 'Marangozdu.', sk: { zanaat: 3 } }, { t: 'Bir çiftlikte büyüdü.', sk: { tarim: 3 } },
  { t: 'Emekli bir asker. Az konuşur.', sk: { savas: 3 } }, { t: 'Eski bir dağcı. Yükseklikten korkmaz.', sk: { kesif: 3 } },
  { t: 'Ormancıydı; ağaçları sesinden tanır.', sk: { toplama: 3 } }, { t: 'Mimarlık öğrencisiydi.', sk: { insaat: 2 } },
  { t: 'Demirci çırağıydı.', sk: { zanaat: 2 } }, { t: 'Eczanede çalışıyordu. Otları tanır.', sk: { sifa: 2 } },
  { t: 'Aşçıydı; "her şeyi pişiririm" der.', sk: { asci: 3 } }, { t: 'Bir lokantada bulaşıkçıydı; mutfağı bilir.', sk: { asci: 2 } }, { t: 'Annesinin yemeklerini özlüyor; tariflerini ezbere bilir.', sk: { asci: 1, tarim: 1 } }, { t: 'Bahçıvandı.', sk: { tarim: 2 } },
  { t: 'Okçuluk kulübündeydi.', sk: { avcilik: 2 } }, { t: 'Taksi şoförüydü. Yön duygusu çok iyi.', sk: { kesif: 2 } },
  { t: 'Gece bekçisiydi. Karanlığa alışkın.', sk: { savas: 2 } }, { t: 'Balıkçıydı; suyun sesini dinler.', sk: { avcilik: 1, toplama: 1 } },
  { t: 'Bir müzede dinozor iskeletlerini temizlerdi. Ne ironi.', sk: { kasaplik: 1, kesif: 1 } }, { t: 'Kuyumcuydu; kristallere bakışı başka.', sk: { zanaat: 2 } },
  { t: 'Kamyon şoförüydü; ağır yük taşımaya alışkın.', sk: { toplama: 2 } }, { t: 'Futbol takımının kalecisiydi.', sk: { savas: 1 } },
  { t: 'Bir lisede tarih öğretmeniydi.', sk: {} }, { t: 'Elinde hâlâ bir telefon var. Şarjı çoktan bitti.', sk: {} },
  { t: 'Kardeşini fırtınada kaybetti. Hâlâ arıyor.', sk: { kesif: 1 } }, { t: 'Kütüphaneciydi. Geceleri ateş başında hikâye anlatır.', sk: {} },
  { t: 'Yazılımcıydı. "Burada hiçbir şey derlenmiyor" diye şakalaşır.', sk: { zanaat: 1 } }, { t: 'Tiyatro oyuncusuydu. Herkesi güldürmeye çalışır.', sk: {} },
  { t: 'Bir düğüne gidiyordu. Hâlâ takım elbisesinin parçalarını taşıyor.', sk: {} }, { t: 'Hiç konuşmuyor. Adını halk koydu.', sk: { avcilik: 1 } },
  { t: 'Annesine "akşama dönerim" demişti.', sk: {} }, { t: 'Radyoda gece programı sunardı. Sesi herkesi sakinleştirir.', sk: { sifa: 1 } }
];

const TRAITS = {
  cesur:    { ad: 'Cesur',        ic: '🦁', desc: 'Korkuyu yarı yarıya hisseder.', ex: ['korkak'] },
  korkak:   { ad: 'Korkak',       ic: '🐇', desc: 'Çabuk paniğe kapılır.', ex: ['cesur'] },
  avci:     { ad: 'Keskin Göz',   ic: '🎯', desc: 'Avda ve savaşta %40 daha sert vurur.' },
  uykusuz:  { ad: 'Uykusuz',      ic: '🦉', desc: 'Gece nöbetinden yorulmaz.' },
  hasta:    { ad: 'Hastalıklı',   ic: '🤒', desc: 'Daha az can; hastalıklara açık.', ex: ['guclu'] },
  yasli:    { ad: 'Yaşlı Bilge',  ic: '📜', desc: 'Yavaştır ama iyi yönetir; iki kat hızlı öğrenir.', ex: ['cevik'] },
  cevik:    { ad: 'Çevik',        ic: '💨', desc: '%25 daha hızlı.', ex: ['yasli'] },
  guclu:    { ad: 'Güçlü',        ic: '💪', desc: 'Daha çok can, daha çok taşır.', ex: ['hasta'] },
  onder:    { ad: 'Önder Ruhlu',  ic: '⭐', desc: 'Yönetici olunca grubu çok daha verimli olur.' },
  caliskan: { ad: 'Çalışkan',     ic: '⚒️', desc: '%30 daha hızlı çalışır.' },
  sifali:   { ad: 'Şifalı Eller', ic: '🤲', desc: 'Yaraları iki kat hızlı sarar.' },
  zeki:     { ad: 'Zeki',         ic: '💡', desc: 'Becerilerde %50 daha hızlı ustalaşır.' }
};
const tr = (p, k) => !!(p.traits && p.traits.includes(k));

// ---- beceriler ve seviyeler
const SKILLS = {
  toplama:  { ad: 'Toplayıcılık', ic: '🪓' }, avcilik: { ad: 'Avcılık', ic: '🏹' }, kasaplik: { ad: 'Kasaplık', ic: '🔪' },
  tarim:    { ad: 'Tarım',        ic: '🌾' }, sifa:    { ad: 'Şifacılık', ic: '🌿' }, zanaat:  { ad: 'Zanaat', ic: '🔨' },
  insaat:   { ad: 'İnşaat',       ic: '📐' }, savas:   { ad: 'Savaş', ic: '⚔️' },    kesif:   { ad: 'Keşif', ic: '🧭' },
  asci:     { ad: 'Aşçılık',      ic: '🍲' }
};
const XPL = [0, 30, 80, 160, 280, 450, 680, 980, 1360, 1830];
const lvlOfXp = xp => { let l = 1; while (l < 10 && xp >= XPL[l]) l++; return l; };
const skillMul = l => 1 + 0.12 * (l - 1);

const GROUPS = {
  odun:    { ad: 'Oduncu',     ic: '🪓', col: '#8a5a32', sk: 'toplama',  desc: 'Ağaç keser. Balta ile %50 hızlı.' },
  tas:     { ad: 'Taşçı',      ic: '⛏️', col: '#7c7c7c', sk: 'toplama',  desc: 'Taş kırar; kazma ile dağlarda kristal çıkarır.' },
  yiyecek: { ad: 'Toplayıcı',  ic: '🫐', col: '#7a3a6a', sk: 'toplama',  desc: 'Meyve toplar.' },
  balik:   { ad: 'Balıkçı',    ic: '🎣', col: '#3a6a8a', sk: 'avcilik',  desc: 'En yakın göl ya da kıyıda balık tutar; balığı depoya getirir.' },
  avci:    { ad: 'Avcı',       ic: '🏹', col: '#6a4a1a', sk: 'avcilik',  desc: 'Av emri verilen hayvana mesafe koruyarak saldırır. Yiyecek azalınca kendiliğinden ava çıkar.' },
  kasap:   { ad: 'Et Ustası',  ic: '🔪', col: '#8a2a2a', sk: 'kasaplik', desc: 'Leşlerden getirilen çiğ eti temizler. Temiz et hastalık yapmaz. İş yoksa leşten et taşır.' },
  asci:    { ad: 'Aşçı',       ic: '🍲', col: '#b06a2a', sk: 'asci',     desc: 'Temiz et ve meyveden yemek pişirir, yemek vaktinde masaya koyar.' },
  ciftci:  { ad: 'Çiftçi',     ic: '🌾', col: '#9a8a2a', sk: 'tarim',    desc: 'Tarlaları eker, bakar, hasat eder.' },
  sifaci:  { ad: 'Şifacı',     ic: '🌿', col: '#3a7a5a', sk: 'sifa',     desc: 'Yaralıları kaldırır, şifahaneye taşır, ilaç ve sargı yapar, ot toplar.' },
  zanaat:  { ad: 'Zanaatkâr',  ic: '🔨', col: '#5a4a8a', sk: 'zanaat',   desc: 'Atölyede üretim emirlerini yapar: balta, kazma, ok, yay, zırh...' },
  mimar:   { ad: 'Mimar',      ic: '📐', col: '#4a6a8a', sk: 'insaat',   desc: 'Planlanan yapıları inşa eder. Usta mimar gelişmiş yapıları açar.' },
  kasif:   { ad: 'Kâşif',      ic: '🧭', col: '#8a7a3a', sk: 'kesif',    desc: 'Bilinmeyen yerleri keşfeder. Haritaya (M) dokunarak hedef ver.' },
  muhafiz: { ad: 'Muhafız',    ic: '🛡️', col: '#2c4f7a', sk: 'savas',    desc: 'Kampı korur, gece nöbet tutar, kulelere çıkar.' },
  takip:   { ad: 'Takip',      ic: '👣', col: '#5c6b2a', sk: 'savas',    desc: 'Seninle gelir, yanında savaşır.' },
  bos:     { ad: 'Boşta',      ic: '💤', col: '#555',    sk: null,       desc: 'Ateşi besler, inşaata yardım eder, dinlenir.' }
};
const GORDER = ['odun', 'tas', 'yiyecek', 'balik', 'avci', 'kasap', 'asci', 'ciftci', 'sifaci', 'zanaat', 'mimar', 'kasif', 'muhafiz', 'takip', 'bos'];
const ABIL = {
  odun:    { ad: 'Toplu Kesim',    desc: '30 sn: odun ×2', dur: 30, cd: 120 },
  tas:     { ad: 'Damar Bul',      desc: '30 sn: taş/kristal ×2', dur: 30, cd: 120 },
  yiyecek: { ad: 'Hasat Bereketi', desc: 'Kampa yakın çalılar dolar', dur: 0, cd: 150 },
  balik:   { ad: 'Bereketli Ağ',   desc: '30 sn: balık ×2', dur: 30, cd: 120 },
  avci:    { ad: 'Sürek Avı',      desc: '30 sn: avcılar hızlı ve öldürücü', dur: 30, cd: 110 },
  kasap:   { ad: 'Hızlı Kesim',    desc: '30 sn: et işleme ×2', dur: 30, cd: 100 },
  asci:    { ad: 'Şölen',          desc: 'Bir sonraki yemekte herkes +25 can, moral +10', dur: 0, cd: 240 },
  ciftci:  { ad: 'Bereket',        desc: 'Bütün ekili tarlalar bir anda serpilir', dur: 0, cd: 200 },
  sifaci:  { ad: 'Şifa Çemberi',   desc: 'Kamptaki herkes +40 can, kanamalar durur', dur: 0, cd: 120 },
  zanaat:  { ad: 'Ustalık',        desc: '40 sn: üretim ×2', dur: 40, cd: 120 },
  mimar:   { ad: 'İmece',          desc: '40 sn: inşaat ×2, boştakiler de yardım eder', dur: 40, cd: 120 },
  kasif:   { ad: 'Uzak Keşif',     desc: '40 sn: kâşifler hızlı, uzağı görür', dur: 40, cd: 120 },
  muhafiz: { ad: 'Savunma Düzeni', desc: '25 sn: muhafızlar korkusuz, +%60 hasar', dur: 25, cd: 100 },
  takip:   { ad: 'Hücum!',         desc: '15 sn: takipçiler öfkeyle saldırır', dur: 15, cd: 90 }
};

// ---- yaratıklar
// kind: pred (yırtıcı), herb (otobur), human
const DINO = {
  kucuk:      { ad: 'Sürüngeç',    r: 9,  hp: 16,  spd: 175, dmg: 4,  cd: 0.7, col: '#6b7d3a', eye: '#b6ff5a', drop: { meat: 4 },                     sense: 380, nsense: 560,  pred: true },
  geceavcisi: { ad: 'Gece Avcısı', r: 12, hp: 30,  spd: 205, dmg: 8,  cd: 0.8, col: '#3a3f4a', eye: '#7cff9a', drop: { meat: 5, bone: 1 },             sense: 300, nsense: 900,  pred: true, night: true },
  tukurgec:   { ad: 'Tükürgeç',    r: 13, hp: 28,  spd: 160, dmg: 7,  cd: 0.9, col: '#5a6a4a', eye: '#ff9a3a', drop: { meat: 6, bone: 1, poison: 2 },  sense: 420, nsense: 600,  pred: true },
  kesici:     { ad: 'Kesici',      r: 17, hp: 85,  spd: 265, dmg: 44, cd: 1.4, col: '#4a3a2e', eye: '#ff4040', drop: { meat: 12, bone: 3, hide: 3 },   sense: 650, nsense: 950,  pred: true },
  yirtici:    { ad: 'Yırtıcı',     r: 20, hp: 70,  spd: 215, dmg: 13, cd: 0.9, col: '#8a4b2a', eye: '#ffd23a', drop: { meat: 14, bone: 2, hide: 2 },   sense: 480, nsense: 850,  pred: true },
  yelken:     { ad: 'Yelkensırt',  r: 56, hp: 650, spd: 150, dmg: 42, cd: 1.5, col: '#5a4a3a', eye: '#ffb030', drop: { meat: 80, bone: 12, hide: 9 },  sense: 520, nsense: 700,  pred: true },
  dev:        { ad: 'Dev Kafa',    r: 62, hp: 750, spd: 125, dmg: 48, cd: 1.6, col: '#3e3b35', eye: '#ff3a1a', drop: { meat: 100, bone: 16, hide: 10 }, sense: 750, nsense: 1150, pred: true },
  ordek:      { ad: 'Ördekgaga',   r: 26, hp: 90,  spd: 95,  dmg: 0,  cd: 1.0, col: '#8a7a50', eye: '#ddd',    drop: { meat: 32, bone: 3, hide: 3 },   herb: true },
  gurleyen:   { ad: 'Kafakalkan',  r: 20, hp: 75,  spd: 110, dmg: 16, cd: 1.1, col: '#7a6a5a', eye: '#ddd',    drop: { meat: 20, bone: 3, hide: 1 },   herb: true },
  boynuzlu:   { ad: 'Boynuzlu',    r: 40, hp: 200, spd: 80,  dmg: 24, cd: 1.3, col: '#a08860', eye: '#ddd',    drop: { meat: 40, bone: 5, hide: 4 },   herb: true },
  zirhli:     { ad: 'Zırhlı',      r: 38, hp: 420, spd: 55,  dmg: 34, cd: 1.6, col: '#6a6248', eye: '#ddd',    drop: { meat: 55, bone: 6, hide: 9 },   herb: true },
  uzunboyun:  { ad: 'Uzunboyun',   r: 74, hp: 900, spd: 46,  dmg: 34, cd: 2.0, col: '#6f7f62', eye: '#ddd',    drop: { meat: 140, bone: 14, hide: 8 }, herb: true },
  kanatli:    { ad: 'Kanatlı',     r: 16, hp: 40,  spd: 170, dmg: 6,  cd: 1.0, col: '#8a6a5a', eye: '#9cf',    drop: { meat: 5, bone: 1, hide: 1 } },
  batakci:    { ad: 'Batakçı',     r: 30, hp: 170, spd: 230, dmg: 26, cd: 1.2, col: '#46553a', eye: '#cf6',    drop: { meat: 22, bone: 3, hide: 5 } },
  yamyam:     { ad: 'Yamyam',      r: 11, hp: 55,  spd: 140, dmg: 11, cd: 1.0, col: '#3a2a20', eye: '#e8d8b0', drop: { bone: 1, hide: 1 },             sense: 420, nsense: 620,  pred: true, human: true },
  taklitci:   { ad: 'Benzeyen',    r: 12, hp: 160, spd: 120, dmg: 55, cd: 1.2, col: '#d8d0c8', eye: '#ffffff', drop: { bone: 3 },                      sense: 600, nsense: 900,  pred: true }
};

// ---- yapılar (lvl: gereken en iyi İnşaat seviyesi; work: 1. seviye bir mimarın saniye cinsinden emeği)
const BUILD = {
  cadir:     { ad: 'Çadır',            ic: '⛺', cost: { wood: 6, hide: 2 },            r: 22, hp: 120, lvl: 1, work: 18, desc: 'Bir hane: tek kişi ya da bir çift ve çocukları', rooms: [] },
  kulube:    { ad: 'Kulübe',           ic: '🛖', cost: { wood: 30, stone: 10, hide: 4 }, r: 54, hp: 400, lvl: 2, work: 60, desc: '4 odalı büyük yapı; odaları sen seçersin', rooms: ['yatak', 'yatak', 'bos', 'bos'] },
  magara:    { ad: 'Mağara',           ic: '🪨', cost: {},                               r: 78, hp: 99999, lvl: 99, work: 1, desc: 'Halkın ilk yuvası', rooms: ['yatak', 'yatak', 'yatak', 'yatak', 'depo', 'mutfak', 'atolye'] },
  oktezgah:  { ad: 'Ok ve Yay Tezgâhı', ic: '🏹', cost: { wood: 10, stone: 4 },          r: 26, hp: 160, lvl: 2, work: 26, desc: 'Ok, yay ve zehirli ok burada üretilir' },
  tabakhane: { ad: 'Deri Tezgâhı',     ic: '🟫', cost: { wood: 10, hide: 4 },           r: 26, hp: 160, lvl: 2, work: 26, desc: 'Zırh, eyer, halat ve yelken bezi burada üretilir' },
  atolye:    { ad: 'Alet Tezgâhı',     ic: '🔨', cost: { wood: 12, stone: 6 },          r: 30, hp: 200, lvl: 1, work: 30, desc: 'Zanaatkârlar burada alet ve silah üretir' },
  kasaphane: { ad: 'Kasap Tezgâhı',    ic: '🔪', cost: { wood: 8, stone: 4 },           r: 24, hp: 150, lvl: 1, work: 20, desc: 'Et ustaları burada çalışır: %25 daha çok et' },
  tarla:     { ad: 'Tarla',            ic: '🌾', cost: { wood: 4 },                     r: 42, hp: 999, lvl: 1, work: 14, flat: true, desc: 'Çiftçiler eker; iki günde hasat' },
  cit:       { ad: 'Kazık Çit',        ic: '🪵', cost: { wood: 4 },                     r: 20, hp: 140, lvl: 1, work: 5,  desc: 'Yaratıkları durdurur, halk geçebilir' },
  mesale:    { ad: 'Meşale Direği',    ic: '🔦', cost: { wood: 4, stone: 2 },           r: 8,  hp: 70,  lvl: 1, work: 5,  desc: 'Güvenli ışık' },
  tuzak:     { ad: 'Kazık Tuzağı',     ic: '⚠️', cost: { wood: 4, stone: 3 },           r: 16, hp: 999, lvl: 1, work: 6,  flat: true, desc: '3 kez 45 hasar' },
  duvar:     { ad: 'Taş Duvar',        ic: '🧱', cost: { stone: 6 },                    r: 22, hp: 450, lvl: 2, work: 12, desc: 'Çok dayanıklı engel' },
  raf:       { ad: 'Kurutma Rafı',     ic: '🥩', cost: { wood: 6, hide: 2 },            r: 18, hp: 100, lvl: 2, work: 14, desc: 'Her şafak +4🍖, et bozulmaz' },
  sifahane:  { ad: 'Şifahane',         ic: '⛑️', cost: { wood: 14, stone: 6, herb: 4 }, r: 34, hp: 250, lvl: 2, work: 40, desc: '4 yatak: yaralılar ve hastalar günlerce burada iyileşir' },
  gemi:      { ad: 'Gemi', ic: '⛵', cost: { wood: 400, hide: 40, halat: 20, yelkenBezi: 4, gemiParca: 3 }, r: 120, hp: 3000, lvl: 6, work: 900, desc: 'Eve dönüş. Kıyıya kurulur; 200. günden sonra, 3 enkaz parçasıyla' },
  kule:      { ad: 'Gözetleme Kulesi', ic: '🗼', cost: { wood: 12, stone: 8 },          r: 24, hp: 300, lvl: 3, work: 45, desc: 'Geniş ışık ve görüş; muhafız çıkarsa ok atar' }
};
const BORDER = ['cadir', 'kulube', 'atolye', 'oktezgah', 'tabakhane', 'kasaphane', 'tarla', 'cit', 'mesale', 'tuzak', 'duvar', 'raf', 'sifahane', 'kule', 'gemi'];

// ---- üretilebilen eşyalar (by: hangi beceri üretir; lvl: gereken seviye; work: saniye)
const ITEMS = {
  balta:       { ad: 'Taş Balta',      ic: '🪓', by: 'zanaat', lvl: 1, cost: { wood: 3, stone: 2 },  work: 12, desc: 'Bir oduncu %50 hızlı keser' },
  kazma:       { ad: 'Kazma',          ic: '⛏️', by: 'zanaat', lvl: 1, cost: { wood: 3, stone: 3 },  work: 12, desc: 'Bir taşçı %50 hızlı; kristal için gerekli' },
  mizrak:      { ad: 'Taş Mızrak',     ic: '🗡️', by: 'zanaat', lvl: 1, cost: { wood: 3, stone: 2 },  work: 10, desc: 'Bir savaşçı/avcı daha sert vurur' },
  sepet:       { ad: 'Sepet',          ic: '🧺', by: 'zanaat', lvl: 1, cost: { wood: 2, herb: 1 },   work: 8,  desc: 'Bir işçi +4 fazla taşır' },
  ok:          { stn: 'okcu', ad: 'Ok (×10)',       ic: '➶',  by: 'zanaat', lvl: 1, cost: { wood: 2, bone: 1 },   work: 8,  qty: 10, desc: 'Yaylar için' },
  mesale:      { ad: 'El Meşalesi',    ic: '🔥', by: 'zanaat', lvl: 1, cost: { wood: 3 },            work: 6,  desc: 'Lider için taşınabilir ışık [T]' },
  yay:         { stn: 'okcu', ad: 'Yay',            ic: '🏹', by: 'zanaat', lvl: 2, cost: { wood: 5, hide: 1 },   work: 16, desc: 'Bir avcı/muhafız uzaktan ok atar' },
  zirh:        { stn: 'tabak', ad: 'Deri Zırh',      ic: '🦺', by: 'zanaat', lvl: 2, cost: { hide: 4, bone: 1 },   work: 16, desc: 'Giyen %30 daha az hasar alır' },
  zok:         { stn: 'okcu', ad: 'Zehirli Ok (×10)', ic: '☠️', by: 'zanaat', lvl: 3, cost: { wood: 2, bone: 1, poison: 2 }, work: 10, qty: 10, desc: 'Zehirler: saniyede ek hasar' },
  eyer:        { stn: 'tabak', ad: 'Eyer',           ic: '🐎', by: 'zanaat', lvl: 3, cost: { hide: 6, wood: 4 },   work: 20, desc: 'Evcil Boynuzlu’ya bin (yanında E)' },
  kemikMizrak: { ad: 'Kemik Mızrak',   ic: '🦴', by: 'zanaat', lvl: 4, cost: { bone: 4, wood: 2, crystal: 1 }, work: 22, desc: 'En güçlü yakın dövüş silahı' },
  yatak:       { ad: 'Yatak',          ic: '🛏️', by: 'zanaat', lvl: 1, cost: { hide: 2, wood: 2 }, work: 18, desc: 'Bir kişiye verilir. Yatağı olmayan yerde yatar, iyi dinlenemez' },
  halat:       { stn: 'tabak', ad: 'Halat',          ic: '🪢', by: 'zanaat', lvl: 3, cost: { hide: 3, herb: 2 }, work: 25, desc: 'Gemi için gerekli (20 adet)' },
  yelkenBezi:  { stn: 'tabak', ad: 'Yelken Bezi',    ic: '🏳️', by: 'zanaat', lvl: 5, cost: { hide: 12, herb: 4 }, work: 70, desc: 'Gemi için gerekli (4 adet)' },
  yarikTasi:   { ad: 'Yarık Taşı',     ic: '🌀', by: 'zanaat', lvl: 6, cost: { crystal: 25, stone: 40, wood: 40 }, work: 90, reqPop: 30, desc: 'Zaman yarığını açar. Halkın en az 30 kişi olmalı.' },
  bandaj:      { ad: 'Sargı',          ic: '🩹', by: 'sifa',   lvl: 1, cost: { hide: 1, herb: 1 },   work: 6,  qty: 2, desc: 'Kanamayı anında durdurur, can verir' },
  ilac:        { ad: 'İlaç',           ic: '💊', by: 'sifa',   lvl: 2, cost: { herb: 3 },            work: 10, desc: 'Enfeksiyon ve salgına iyi gelir' }
};
const IORDER = ['balta', 'kazma', 'mizrak', 'sepet', 'ok', 'mesale', 'yay', 'zirh', 'zok', 'eyer', 'kemikMizrak', 'yatak', 'halat', 'yelkenBezi', 'bandaj', 'ilac'];

const RES = { wood: '🪵', stone: '🪨', food: '🍲', meyve: '🫐', et: '🍖', cigEt: '🥩', bone: '🦴', hide: '🟫', herb: '🌿', poison: '🧪', crystal: '💎' };
const RESN = { wood: 'Odun', stone: 'Taş', food: 'Pişmiş yemek', meyve: 'Meyve ve tahıl', et: 'Temiz et', cigEt: 'Çiğ et (temizlenmemiş)', bone: 'Kemik', hide: 'Deri', herb: 'Şifalı ot', poison: 'Zehir', crystal: 'Kristal' };
// ---- odalar (mağara ve kulübe içinde seçilir)
const ROOMS = {
  yatak:  { ad: 'Yatakhane',    ic: '🛏️', desc: 'İki hane burada uyur' },
  depo:   { ad: 'Depo',         ic: '📦', desc: 'Yiyecek ve malzeme sınırını 150 artırır' },
  mutfak: { ad: 'Mutfak',       ic: '🍲', desc: 'Aşçılar burada pişirir; yemek vakti herkes buradaki masaya gelir' },
  sifa:   { ad: 'Şifa Odası',   ic: '⛑️', desc: '2 hasta yatağı' },
  kasap:  { ad: 'Et Temizleme', ic: '🔪', desc: 'Et ustaları burada eti temizler (+%25 et)' },
  atolye: { ad: 'Alet Tezgâhı', ic: '🔨', desc: 'Balta, kazma, mızrak, sepet, yatak burada yapılır' },
  okcu:   { ad: 'Ok ve Yay Tezgâhı', ic: '🏹', desc: 'Ok, yay ve zehirli ok burada yapılır' },
  tabak:  { ad: 'Deri Tezgâhı', ic: '🟫', desc: 'Zırh, eyer, halat ve yelken bezi burada yapılır' },
  bos:    { ad: 'Boş Oda',      ic: '⬜', desc: 'Henüz bir işe ayrılmadı' }
};
const RORDER = ['yatak', 'depo', 'mutfak', 'sifa', 'kasap', 'atolye', 'okcu', 'tabak', 'bos'];
const SLOTS = { sabah: 'Sabah', ogle: 'Öğle', ikindi: 'İkindi' };
const icOf = k => RES[k] || (ITEMS[k] && ITEMS[k].ic) || k;

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
  halk30:    { ad: 'Kabile',              desc: '30 kişilik bir halka ulaş' },
  cocuk:     { ad: 'Yeni Nesil',          desc: 'Kampta ilk çocuk doğsun' },
  yumurta:   { ad: 'Yuva Hırsızı',        desc: 'Bir yırtıcı yumurtasını kampa getir' },
  kule:      { ad: 'Gözcü',               desc: 'Gözetleme kulesi inşa et' },
  kasif:     { ad: 'Kâşif',               desc: 'Haritanın %40’ını keşfet' },
  gun15:     { ad: 'Dayanıklı',           desc: '15 gün hayatta kal' },
  kurtulus:  { ad: 'Eve Dönüş',           desc: 'Gemiyle eve dön' },
  kabus:     { ad: 'Kâbusu Yen',          desc: 'Kâbus zorluğunda 10 gün hayatta kal' },
  usta:      { ad: 'Usta',                desc: 'Bir karakter bir beceride 5. seviyeye ulaşsın' },
  avci10:    { ad: 'Büyük Av',            desc: 'Av emriyle 10 hayvan avla' },
  benzeyen:  { ad: 'Yüzünü Gördüm',       desc: 'Bir Benzeyen’i öldür' }
};

// ---- kalıcı depolama
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { } }
};

const G = {};
let L = null;

// ---- uzaysal ızgara
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

// ---- mesajlar
function msg(t, col = '#eee', dur = 5) { if (!G.msgs) return; G.msgs.push({ t, col, life: dur }); if (G.msgs.length > 6) G.msgs.shift(); G.msgDirty = true; }
function ftext(x, y, t, col = '#fff') { if (G.texts) G.texts.push({ x, y, t, col, life: 1.3 }); }
const CAPPED = ['wood', 'stone', 'food', 'meyve', 'et', 'cigEt', 'bone', 'hide', 'herb', 'poison'];
function addStock(k, n, x, y) {
  if (!(n > 0)) return;
  if (CAPPED.includes(k) && typeof storeCap === 'function') { const room = Math.max(0, storeCap() - (G.stock[k] || 0)); if (n > room) { if (!G.flags.full) { G.flags.full = 1; msg(`📦 Depo dolu (${RESN[k]})! Mağara ya da kulübede bir odayı Depo yap.`, '#e9c', 5); } n = room; } if (n <= 0) return; }
  G.stock[k] = (G.stock[k] || 0) + n; if (x !== undefined) ftext(x, y - 16, `+${n} ${icOf(k)}`, '#ffe9b0'); }
function canAfford(c) { for (const k in c) if ((G.stock[k] || 0) < c[k]) return false; return true; }
function pay(c) { for (const k in c) G.stock[k] -= c[k]; }
function costTxt(c) { return Object.entries(c).map(([k, v]) => `${v}${icOf(k)}`).join(' '); }
