// =============================================================
//  SOFRA, AKŞAM MUHABBETİ, İÇKİ VE YARININ PLANI
//  - Lider yemek vaktinde sofraya oturabilir (oturmazsa yemeği stoktan yine alır).
//  - Akşam yemeğinden sonra, gece çökmeden: halk ateş başında halka olur, içer, konuşur.
//  - Lider muhabbete katılır: hikâye anlatır, yarın için plan kurar, dertleri dinler.
//  - Plan şafakta uygulanır (halkDawn'dan sonra), ertesi şafakta kalkar.
// =============================================================
const GATHER_END = 0.6;   // gece tam çökmeden (isNight ~0.55-0.6) dağılır
const PLANS = {
  erkenAv: { ad: 'Erken av', ic: '🏹', desc: 'Avcılar ve gönüllüler şafakta en yakın sürüye çıkar; avcılar %20 hızlı.' },
  odun:    { ad: 'Odun yığalım', ic: '🪓', desc: 'Toplayıcı, taşçı ve boştakilerden 3 kişi bir gün odun keser.' },
  tahkim:  { ad: 'Kampı tahkim edelim', ic: '🛡️', desc: '3 kişi bir gün inşaata yardım eder; mimarlar %25 hızlı.' },
  dinlen:  { ad: 'Dinlenme günü', ic: '😌', desc: 'Herkes yavaş çalışır (%60); moral artar, korku ve yorgunluk geçer.' }
};

// ---- yardımcılar
const sofraKim = () => G.people.filter(q => !q.leader && q.ate && G.meal && dist(q, G.meal.table) < 90).length;
function gatherOk(p) {
  if (p.leader || p.dead || p.grabbed || p.bed || p.bedRes || p.downed > 0 || p.desert > 0 || p.carrying || p.carriedBy) return false;
  if (p.post || p.injury || p.sick || p.hp < p.maxhp * 0.4 || p.fear >= 80) return false;
  if (G.hunt && (p.group === 'avci' || p.joinHunt) && dist(p, G.fire) > 900) return false;   // avdakiler uzakta
  return dist(p, G.fire) < 3000;
}
function gatherDanger() {
  if (G.raid || G.finale || G.fire.out) return true;
  for (const d of G.dinos) if (hostile(d) && !d.hidden && dist(d, G.fire) < 650) return true;
  return false;
}
function sayLine(p, t, life) { p.say = { t, life: life || 5.5 }; if (L && dist(p, L) < 600) G.msgDirty = true; }

// ---- konuşma havuzu: duruma göre aday satırlar (özgün, kısa)
function chatPool(p) {
  const S = G.season || seasonOf(G.day), out = [];
  const add = (...a) => out.push(...a);
  // genel
  add('Bugün de hayattayız. Bu az şey değil.', 'Ateşin sesi bile insanı sakinleştiriyor.', 'Yıldızlar burada daha yakın gibi.',
    'Bir gün bunları torunlarıma anlatacağım. Kimse inanmayacak.', 'Ellerim nasır bağladı ama içim rahat.', 'Şu dumanın kokusu… evdeki sobayı hatırlattı.',
    'Sessiz olun bir an… Hayır, rüzgârmış.', 'Herkes yerinde mi? Saydım, tamam.', 'Uyumadan önce bir tas sıcak bir şey iyi gelir.',
    'Gökyüzündeki o mavi parıltı… sence ne?', 'Geldiğimiz yere dönmenin bir yolu olmalı.', 'Bir şarkı biliyordum, sözlerini unuttum.',
    'Yarın ne olursa olsun, bu akşam güzel.', 'Odun sesi, tencere sesi, insan sesi… kamp böyle bir şey işte.');
  // özellik
  if (tr(p, 'cesur')) add('Gelsinler. Ateşin başında kimse yalnız değil.', 'Korkmak ayıp değil ama korkuya teslim olmayacağız.');
  if (tr(p, 'korkak')) add('Karanlıkta bir şey var, biliyorum… Ateşi büyük tutalım, olur mu?', 'Dün gece hiç uyuyamadım. Her çıtırtıda irkildim.');
  if (tr(p, 'yasli')) add('Benim yaşımda insan sabırlı olmayı öğreniyor. Siz de öğreneceksiniz.', 'Acele eden, karanlıkta kaybolur. Eskiler böyle derdi.');
  if (tr(p, 'caliskan')) add('Yarın erken kalkacağım. Yapılacak çok iş var.', 'Boş durunca içim sıkılıyor, elimi bir işe vermeliyim.');
  if (tr(p, 'zeki')) add('Hayvanların izlerini saydım; sürüler hep suya iniyor.', 'Bir düzenek düşündüm: çit ile tuzağı yan yana koysak…');
  if (tr(p, 'guclu')) add('Bana bir kütük daha verin, iki kat taşırım.', 'Yarın taşları ben kaldırırım, merak etmeyin.');
  if (tr(p, 'cevik')) add('Bugün bir Sürüngeç’ten kaçtım, ayaklarım hâlâ titriyor. Ama yakalayamadı!', 'Koşarken düşünmüyorum, sadece koşuyorum.');
  if (tr(p, 'sifali')) add('Yaraları temiz tutun. Temiz su ve şifalı ot, her şeyden önce.', 'Bugün kimse kanamadı. En sevdiğim gün böyle günler.');
  if (tr(p, 'uykusuz')) add('Nasılsa uyuyamıyorum. Gece ben de göz kulak olurum.');
  if (tr(p, 'onder')) add('Herkes bir işin ucundan tutarsa bu kamp ayakta kalır.');
  if (tr(p, 'avci')) add('Rüzgâr yönünü bilen avcı aç kalmaz.', 'Ördekgagalar sabah suya iner. Orada bekleriz.');
  // hikâye
  if (p.story) add(`Eskiden… ${p.story.charAt(0).toLocaleLowerCase('tr') + p.story.slice(1)} Şimdi bakın bana.`);
  // mevsim
  if (S.key === 'ilkbahar') add('Toprak ısınıyor. Tarlaya bir şeyler ekmenin vakti.', 'Çiçek kokusu geliyor ormandan.');
  if (S.key === 'yaz') add('Gündüz sıcaktan, gece hayvanlardan… Yaz da kolay değil.', 'Çalılar dolu. Kışa stok yapalım.');
  if (S.key === 'sonbahar') add('Yapraklar dökülüyor. Kış çabuk gelir, odun yığalım.', 'Sabahları nefesim buhar oluyor artık.');
  if (S.key === 'kis') add('Ayaklarımı ateşe uzatmadan uyuyamıyorum.', 'Kar her şeyi örttü. İzler de daha belli artık.', 'Göl donmuş. Balıkçılar ne yapacak?');
  // durum
  if (G.morale > 70) add('Uzun zamandır bu kadar gülmemiştim.', 'İyi gidiyoruz. Bunu hak ettik.');
  if (G.morale < 35) add('Böyle nereye kadar…', 'Moralimiz dibe vurdu. Bir şeyler değişmeli.');
  if ((G.stock.food || 0) + (G.stock.meyve || 0) < G.people.length * 2) add('Kiler azaldı. Yarın herkes yiyecek peşine düşmeli.', 'Karnım guruldadı, kimse duymasın.');
  if ((G.stock.wood || 0) < 12) add('Odun azaldı. Ateş sönerse…', 'Yarın odun kesmeye ben de giderim.');
  if (G.deaths > 0) add('Kaybettiklerimizi unutmayalım. Ateş onlar için de yanıyor.');
  if (G.stats && G.stats.hunts > 0) add('Son avı gördünüz mü? Et ustaları bütün gün uğraştı.');
  if (G.weather.type === 'yagmur' || G.weather.type === 'firtina') add('Yağmur çatıyı dövüyor. İyi ki barınağımız var.');
  if ((G.wrecks || []).some(w => !w.found)) add('Kıyıda bir gemi enkazı olduğunu söylüyorlar. Belki eve dönüşün anahtarı orada.');
  if (G.day > 20) add(`${G.day} gün oldu. Saymayı bıraktım sanıyordum.`);
  if ((G.stock.icki || 0) > 0) add('Şu çay bir harika olmuş. Aşçının elleri dert görmesin.', 'Bir yudum daha… sonra uyurum, söz.');
  if (p.child) return ['Bir hikâye daha anlatın!', 'Ben büyüyünce avcı olacağım!', 'Uykum gelmedi ki…', 'Ateşin içinde ejderha var gibi!'];
  return out;
}

// ---- akşam toplanması: başlat / sürdür / dağıt (update'ten her kare)
function updGather(dt) {
  for (const p of G.people) if (p.say) { p.say.life -= dt; if (p.say.life <= 0) p.say = null; }
  const ph = phase(), f = G.flags;
  planTick(dt, ph);
  if (!G.gather) {
    if (f.gath || !f.m2 || G.meal || ph < 0.46 || ph > GATHER_END - 0.04) return;
    f.gath = 1;
    let end = GATHER_END;
    for (const e of G.nightPlan || []) if (!e.done && e.at < GATHER_END + 0.03) end = Math.min(end, e.at - 0.04);
    if (gatherDanger() || end - ph < 0.03) return;   // kuşatma / erken gece olayı: muhabbet yok
    G.gather = { end, sayT: 2, ringT: 0, ring: [], told: 0, heard: 0, plan: 0, lead: false, drunk: 0 };
    msg('🔥 Akşam muhabbeti: halk ateşin başında toplanıyor, sıcak bir şeyler içilecek. Yanlarına gidip katılabilirsin.', '#ffd9a0', 6);
    return;
  }
  const g = G.gather;
  if (ph > g.end || ph < 0.3 || gatherDanger()) { endGather(gatherDanger() ? '⚠️ Muhabbet yarıda kaldı — tehlike!' : '🌙 Muhabbet dağıldı. Herkes yatağına çekiliyor.'); return; }
  g.ringT -= dt;
  if (g.ringT <= 0) { g.ringT = 1; g.ring = G.people.filter(gatherOk).map(q => q.id); }
  g.sayT -= dt;
  if (g.sayT <= 0) {
    g.sayT = rand(2.6, 4.5);
    const sat = G.people.filter(q => q.gSeat && !q.say);
    if (sat.length) { const q = pick(sat), pool = chatPool(q); if (pool.length) sayLine(q, pool[Math.floor(Math.random() * pool.length)]); }
  }
}
function endGather(why) {
  if (!G.gather) return;
  G.gather = null;
  for (const p of G.people) { p.gSeat = false; if (p.pose === 'sit') p.pose = null; }
  if (why) msg(why, '#cbb', 4);
}
// kişi: halkadaki yerine otur, iç, konuş
function gatherStep(p, dt) {
  const g = G.gather, i = g.ring.indexOf(p.id), n = Math.max(1, g.ring.length);
  const a = (i < 0 ? p.seat : i / n * TAU + 0.3), r = (p.child ? 62 : 82) + (n > 14 ? (i % 2) * 24 : 0);
  const sx = G.fire.x + Math.cos(a) * r, sy = G.fire.y + Math.sin(a) * r * 0.9;
  p.tgt = null; p.work = 0;
  if (p.carry > 0 && dist(p, depotOf(p)) < 900) { if (dist(p, depotOf(p)) < 80) deposit(p); else { steer(p, depotOf(p).x, depotOf(p).y, pSpeed(p), dt, false); p.anim += dt * 9; return; } }
  if (Math.hypot(p.x - sx, p.y - sy) > 12) { p.gSeat = false; p.pose = null; steer(p, sx, sy, pSpeed(p) * 1.05, dt, false); p.anim += dt * 9; p.stageAd = 'Muhabbete geliyor'; return; }
  p.moving = false; p.ang = angTo(p, G.fire); p.gSeat = true; p.pose = 'sit'; p.stageAd = p.drank === G.day ? '🍵 Muhabbet ediyor' : 'Muhabbet ediyor';
  p.fear = Math.max(0, p.fear - 3 * dt);
  if (p.drank !== G.day && (G.stock.icki || 0) >= 1 && Math.random() < dt * 0.25) {
    G.stock.icki -= 1; p.drank = G.day; g.drunk++;
    p.fear = Math.max(0, p.fear - 15); moraleAdd(0.4); p.hp = Math.min(p.maxhp, p.hp + 3);
    if (L && dist(p, L) < 400) ftext(p.x, p.y - 30, '🍵', '#e8d4b0');
  }
}

// ---- lider: sofraya otur
function sitAtTable() {
  if (!G.meal || L.ate) return;
  const t = G.meal.table, a = -Math.PI / 2 + rand(-0.6, 0.6);
  L.x = t.x + Math.cos(a) * 40; L.y = t.y + Math.sin(a) * 20; G.yaw = angTo(L, t); G.pitch = -0.25;
  G.seated = { kind: 'meal', t: 3.2 };
  msg(`🍲 Sofraya oturdun. ${G.meal.name} başladı.`, '#ffd9a0', 3);
}
function seatedTick(dt) {
  const s = G.seated; if (!s) return false;
  s.t -= dt; L.moving = false; L.sprinting = false; G.actProg = clamp(1 - s.t / 3.2, 0, 1);
  const moved = keys.KeyW || keys.KeyS || keys.KeyA || keys.KeyD || keys.ArrowUp || keys.ArrowDown || touch.jx || touch.jy;
  if (s.t > 0 && !(moved && s.t < 2.4) && G.meal) { if (Math.random() < dt * 2) SFX.pickup && SFX.pickup(); return true; }
  G.seated = null; G.actProg = 0;
  if (!L.ate) {
    eatMeal(L);
    const n = sofraKim();
    L.hp = Math.min(L.maxhp, L.hp + 10); L.stam = 100; moraleAdd(n >= 2 ? 3 : 1);
    const nice = ['Halk seninle aynı tastan yedi; yüzler gülüyor.', 'Biri şakalaştı, sofrada kahkaha koptu.', 'Aşçı göz ucuyla tabağına bakıyor: "Beğendin mi?"', 'Çocuklar yanına sokuldu, ekmeğini paylaştın.', 'Sofrada kimse yalnız değil. Bu his iyi geldi.'];
    msg(L.lastMeal ? `😋 Karnın doydu (+can, +dayanıklılık). ${n >= 2 ? pick(nice) + ' (+moral)' : ''}` : '😞 Masada sana yiyecek kalmadı…', L.lastMeal ? '#ffe6a0' : '#f99', 5);
    if (L.lastMeal) ftext(L.x, L.y - 30, '😋', '#ffe6a0');
  }
  return false;
}

// ---- lider: muhabbete katıl (diyalog)
function joinChat() {
  if (!G.gather) return;
  const a = angTo(G.fire, L), r = 104;
  L.x = G.fire.x + Math.cos(a) * r; L.y = G.fire.y + Math.sin(a) * r * 0.9; G.yaw = angTo(L, G.fire); G.pitch = -0.12;
  if (!G.gather.lead) { G.gather.lead = true; moraleAdd(2); const sat = G.people.filter(q => q.gSeat); if (sat.length) sayLine(pick(sat), pick(['Gel, otur şöyle! Sana da yer var.', 'Lider de geldi, şimdi oldu!', 'Hoş geldin. Bir tas çay?', 'Tam da senden bahsediyorduk.'])); }
  openTalk('ana');
}
let TALK = { v: 'ana', txt: '' };
function openTalk(v, txt) {
  if (typeof unlockPtr === 'function') unlockPtr();
  TALK = { v: v || 'ana', txt: txt || '' };
  $('talkM').style.display = 'flex'; G.modal = true; renderTalk();
}
function closeTalk() { $('talkM').style.display = 'none'; G.modal = !!UI.char || $('craft').style.display === 'flex' || !!UI.inB; }
function renderTalk() {
  const g = G.gather;
  if (!g) { closeTalk(); return; }
  const sat = G.people.filter(q => q.gSeat), B = (c, v, t, sub, off) => `<button data-t="${c}" data-v="${v || ''}" class="${off ? 'no' : ''}">${t}${sub ? `<br><small>${sub}</small>` : ''}</button>`;
  let h = `<div class="ch"><b style="font-size:16px">🔥 Ateş başı muhabbeti</b><span class="res">${sat.length} kişi halkada · 🍵 ${G.stock.icki || 0}</span><button data-t="close">✕</button></div><div class="cl" style="padding:10px 14px">`;
  if (TALK.txt) h += `<p class="story2">${TALK.txt}</p>`;
  if (TALK.v === 'plan') {
    h += `<div class="cat">Yarın için plan</div><div class="gsel tsel">` + Object.keys(PLANS).map(k => B('plan', k, `${PLANS[k].ic} ${PLANS[k].ad}${G.planNext === k ? ' ✓' : ''}`, PLANS[k].desc)).join('') + `</div>`;
    h += `<div class="gsel tsel">${B('back', '', '↩️ Geri')}${G.planNext ? B('plan', '', '✖ Planı boz') : ''}</div>`;
  } else {
    h += `<div class="gsel tsel">`
      + B('story', '', '📖 Hikâye anlat', g.told ? 'bu akşam anlattın' : 'moral +, korku −', !!g.told)
      + B('plan', '?', '🗓️ Yarın için plan kur', G.planNext ? `seçili: ${PLANS[G.planNext].ic} ${PLANS[G.planNext].ad}` : 'şafakta uygulanır, bir gün sürer')
      + B('ear', '', '👂 Birine kulak ver', g.heard >= 3 ? 'herkes derdini anlattı' : 'dert, söylenti, ipucu', g.heard >= 3)
      + B('drink', '', '🍵 Bir şey iç', (G.stock.icki || 0) > 0 ? (L.drank === G.day ? 'bu akşam içtin' : 'can +, dayanıklılık +') : 'içecek yok — aşçı ot çayı demler', (G.stock.icki || 0) < 1 || L.drank === G.day)
      + B('close', '', '🌙 Kalk')
      + `</div>`;
    if (G.planToday) h += `<p class="hint">Bugünün planı: ${PLANS[G.planToday].ic} ${PLANS[G.planToday].ad}</p>`;
  }
  $('talkBox').innerHTML = h + '</div>';
}
function talkAct(c, v) {
  const g = G.gather; if (!g) return closeTalk();
  const sat = G.people.filter(q => q.gSeat && !q.child);
  if (c === 'close') return closeTalk();
  if (c === 'back') { TALK.v = 'ana'; TALK.txt = ''; }
  if (c === 'story' && !g.told) {
    g.told = 1; moraleAdd(4);
    for (const q of G.people) if (q.gSeat) q.fear = Math.max(0, q.fear - 12);
    const tales = ['Fırtınadan önceki hayatını anlattın: kalabalık sokakları, sabah kahvesini, bir otobüs durağını. Herkes sessizce dinledi.',
      'İlk gece mağaraya nasıl sığındığınızı anlattın. Gülümseyenler oldu, gözü dolanlar da.',
      'Bir Dev Kafa’yı ateşle nasıl kovaladığını abartarak anlattın. Çocuklar çığlık çığlığa güldü.',
      'Ada’nın öbür ucunda gördüğün mavi ışığı anlattın. "Belki eve giden yol oradadır" dedin.',
      'Yıldızlara bakıp kendi takımyıldızlarınızı uydurdunuz: Yorgun Avcı, Kayıp Terlik, Büyük Kazan.'];
    let t = pick(tales) + ' (+moral, korku azaldı)';
    if (sat.length && Math.random() < 0.3) {
      const q = pick(sat), k = pick(['cesur', 'zeki', 'caliskan', 'onder'].filter(k => !tr(q, k) && !(TRAITS[k].ex || []).some(x => tr(q, x))) || []);
      if (k && q.traits.length < 4) { q.traits.push(k); t += ` <b>${q.name}</b> hikâyeden etkilendi: artık ${TRAITS[k].ic} ${TRAITS[k].ad}.`; }
    }
    TALK.txt = t; SFX.bell && SFX.bell();
  }
  if (c === 'plan') {
    if (v === '?') { TALK.v = 'plan'; TALK.txt = 'Yarın ne yapalım? Halk seni dinliyor.'; }
    else if (!v) { G.planNext = null; TALK.txt = 'Plan bozuldu; yarın herkes kendi işine bakacak.'; }
    else { G.planNext = v; g.plan = 1; TALK.v = 'ana'; TALK.txt = `${PLANS[v].ic} <b>${PLANS[v].ad}</b> — kararlaştırıldı. ${planNod(v)}`; msg(`🗓️ Yarının planı: ${PLANS[v].ad}`, '#ffd27a', 4); }
  }
  if (c === 'ear' && g.heard < 3) { g.heard++; TALK.txt = rumor(); }
  if (c === 'drink' && (G.stock.icki || 0) >= 1 && L.drank !== G.day) {
    G.stock.icki--; L.drank = G.day; L.hp = Math.min(L.maxhp, L.hp + 8); L.stam = 100; moraleAdd(1);
    TALK.txt = pick(['Sıcak ot çayı boğazını yaktı ama içini ısıttı.', 'Tatlı, ekşimsi bir şerbet. Biri "aşçının sırrı" diye göz kırptı.', 'Tası elden ele dolaştırdınız. Herkes bir yudum aldı.']);
  }
  renderTalk(); G.uiDirty = true;
}
function planNod(k) {
  const sat = G.people.filter(q => q.gSeat && !q.child), q = sat.length ? pick(sat) : null, w = q ? `${q.name}: ` : '';
  return w + ({ erkenAv: '"Mızrakları bileyelim, şafakta yoldayız."', odun: '"Baltalar hazır. Yarın ormanı inleteceğiz."', tahkim: '"Çitler, duvarlar… Yarın kamp kale olacak."', dinlen: '"Hele şükür! Biraz nefes alalım."' }[k]);
}

// ---- kulak ver: gerçek oyun durumundan dert / söylenti / ipucu
function rumor() {
  const sat = G.people.filter(q => q.gSeat && !q.child), q = sat.length ? pick(sat) : null, who = q ? q.name : 'Biri';
  const yon = o => compass(angTo(G.fire, o)), uz = o => { const d = dist(G.fire, o); return d < 1500 ? 'yakında' : d < 3500 ? 'biraz uzakta' : 'çok uzakta'; };
  const c = [];
  const fd = (G.stock.food || 0) + (G.stock.meyve || 0) + (G.stock.et || 0);
  if (fd < G.people.length * 3) c.push(`"Kilerde ${Math.floor(fd)} öğünlük yiyecek kaldı. ${G.people.length} kişiyiz. Hesap ortada…"`);
  if ((G.stock.wood || 0) < 15) c.push(`"Odun yığını ${G.stock.wood || 0} kütüğe indi. Gece ateş beslenmezse hepimiz yanarız — ya da donarız."`);
  if ((G.stock.herb || 0) < 2) { const h = G.herbs.filter(b => b.amt > 0).sort((a, b) => dist(a, G.fire) - dist(b, G.fire))[0]; if (h) c.push(`"Şifalı ot bitti sayılır. ${yon(h)} tarafında, ${uz(h)}, otların bittiği bir yer gördüm."`); }
  const w = (G.wrecks || []).filter(x => !x.found); if (w.length) { const x = pick(w); c.push(`"Balık tutarken ${yon(x)} kıyısında, ${uz(x)}, karaya vurmuş tahtalar gördüm. Bir gemi enkazı olabilir."`); }
  for (const d of G.dens || []) if (d.type && DINO[d.type]) c.push(`"${yon(d)} tarafında, ${uz(d)}, ${DINO[d.type].ad} yuvası var. Oraya yalnız gitmeyin."`);
  const herd = G.dinos.filter(d => !d.tamed && DINO[d.type].herb && dist(d, G.fire) < 4000).sort((a, b) => dist(a, G.fire) - dist(b, G.fire))[0];
  if (herd) c.push(`"${yon(herd)} yönünde, ${uz(herd)}, ${DINO[herd.type].ad} otluyordu. Erken çıkarsak yakalarız."`);
  for (const cc of G.ccamps || []) if (cc.alive) c.push(`"${yon(cc)} tarafında boyalı adamların kampı var. Geceleri davul sesleri geliyor…"`);
  if (G.rift && !G.rift.found && G.riftHint) c.push(`"Gece ${yon(G.rift)} ufkunda o mavi ışık yine yandı. Bir gün oraya gitmeliyiz."`);
  if (homelessCount && homelessCount() > 0) c.push(`"${homelessCount()} kişi hâlâ açıkta yatıyor. Bir çadır daha kursak…"`);
  if (G.people.some(p => p.sick)) c.push(`"${G.people.find(p => p.sick).name} iyi değil. Ateşi yüksek; şifacıya göstermeliyiz."`);
  if (!c.length) c.push('"Her şey yolunda gibi. Ama ben yine de gözümü açık tutuyorum."');
  const r = pick(c);
  return `👂 <b>${who}</b> alçak sesle anlatıyor: "${r.charAt(1).toLocaleUpperCase('tr')}${r.slice(2)}`;
}

// ---- plan: şafakta uygula, ertesi şafakta kaldır
function planDawnClear() {
  for (const p of G.people) if (p.planHunt) { p.joinHunt = !!p.planHuntPrev; p.planHunt = false; p.planHuntPrev = false; }
  G.planToday = G.planNext || null; G.planNext = null;
}
function planDawnApply() {
  const k = G.planToday; if (!k || !PLANS[k]) { G.planToday = null; return; }
  const adults = G.people.filter(p => !p.leader && !p.child && !p.bed && !p.sick && !p.injury);
  const move = (from, to, n) => { let c = 0; for (const g of from) for (const p of adults) { if (c >= n) break; if (p.group !== g || G.managers[g] === p.id || p.routine) continue; p.rtBase = p.rtBase || p.group; setGroup(p, to, true); c++; } return c; };
  if (k === 'odun') { const c = move(['bos', 'yiyecek', 'tas'], 'odun', 3); msg(`🪓 Plan: odun günü. ${c} kişi oduncularla ormana gidiyor.`, '#ffd27a', 6); }
  if (k === 'tahkim') { const c = move(['bos', 'tas', 'yiyecek', 'odun'], 'mimar', 3); msg(`🛡️ Plan: kampı tahkim ediyoruz. ${c} kişi mimarlara yardım ediyor${G.builds.some(b => !b.built) ? '' : ' — Eylemler menüsünden çit/duvar planlarsan hemen başlarlar'}.`, '#ffd27a', 6); }
  if (k === 'dinlen') { moraleAdd(8); for (const p of G.people) { p.fear = Math.max(0, p.fear - 25); p.tired = false; } msg('😌 Plan: dinlenme günü. Herkes ağır ağır çalışıyor; yüzler gülüyor.', '#ffd27a', 6); }
  if (k === 'erkenAv') {
    let c = 0; for (const p of adults) { if (c >= 2 || p.group === 'avci' || p.joinHunt || !['bos', 'yiyecek', 'takip', 'odun'].includes(p.group) || p.hp < p.maxhp * 0.6) continue; p.planHunt = true; p.planHuntPrev = !!p.joinHunt; p.joinHunt = true; c++; }
    msg(`🏹 Plan: erken av. Avcılar${c ? ` ve ${c} gönüllü` : ''} şafakta yola çıkıyor.`, '#ffd27a', 6);
    G.planHuntT = 0; planPickHunt();
  }
  G.uiDirty = true;
}
function planPickHunt() {
  if (G.hunt && G.hunt.t && !G.hunt.t.dead) return true;
  let best = null, bd = 4200;
  for (const d of G.dinos) { if (d.tamed || d.dead || d.hidden || !DINO[d.type].herb || d.type === 'uzunboyun' || d.type === 'zirhli') continue; const dd = dist(d, G.fire); if (dd < bd) { bd = dd; best = d; } }
  if (!best) return false;
  G.hunt = { t: best }; msg(`🎯 Erken av: hedef ${DINO[best.type].ad} (${compass(angTo(G.fire, best))}).`, '#ffd27a', 4);
  return true;
}
function planTick(dt, ph) {
  if (G.planToday === 'erkenAv' && ph < 0.35 && !(G.hunt && G.hunt.t && !G.hunt.t.dead)) { G.planHuntT = (G.planHuntT || 0) - dt; if (G.planHuntT <= 0) { G.planHuntT = 4; planPickHunt(); } }
}
// halk.js workRate çarpanı
function planMul(p) {
  const k = G.planToday; if (!k || p.leader) return 1;
  if (k === 'dinlen') return 0.6;
  if (k === 'tahkim' && p.group === 'mimar') return 1.25;
  if (k === 'erkenAv' && p.group === 'avci') return 1.2;
  return 1;
}

// ---- diyalog girdisi (fare + dokunmatik)
$('talkM').addEventListener('pointerdown', e => {
  if (e.target.id === 'talkM') { closeTalk(); return; }
  const b = e.target.closest('[data-t]'); if (!b) return; e.preventDefault(); e.stopPropagation();
  talkAct(b.dataset.t, b.dataset.v);
});

// ---- aşçı: ikindi vakti akşam için ot çayı / meyve şerbeti demler
function brewWanted() {
  const S = G.stock, ph = phase(), n = G.people.length;
  if ((S.icki || 0) >= Math.ceil(n * 0.7) || ph < 0.24 || ph > 0.44) return false;
  if (!((S.herb || 0) >= 3 || (S.meyve || 0) >= 4)) return false;
  return (S.food || 0) >= n * 0.8 || (S.meyve || 0) >= 10;
}
function brewStep(p, dt, k) {
  const sp = k ? stnPos(k) : { x: G.fire.x + 30, y: G.fire.y + 26 };
  if (!(k ? atStation(p, k, dt) : (dist(p, sp) < 30 || (steer(p, sp.x, sp.y, pSpeed(p), dt, false), false)))) { p.anim += dt * 9; stageSay(p, 'Çay için ocağa gidiyor'); return; }
  p.moving = false; p.work = 1; p.brewT = (p.brewT || 0) + dt * workRate(p) * (k ? 1 : 0.8);
  const f = p.brewT / 6; stageSay(p, f < 0.35 ? 'Su kaynatılıyor' : f < 0.75 ? 'Otlar demleniyor' : 'Tasa dolduruluyor');
  if (p.brewT >= 6) {
    p.brewT = 0; const S = G.stock;
    if ((S.herb || 0) >= 3) { S.herb -= 1; const m = (S.meyve || 0) >= 1 ? 1 : 0; S.meyve -= m; addStock('icki', 4 + m, p.x, p.y); }   // ot çayı (meyveyle tatlandırılır)
    else if ((S.meyve || 0) >= 4) { S.meyve -= 3; addStock('icki', 3, p.x, p.y); }   // meyve şerbeti
    addXP(p, 'asci', 2); G.uiDirty = true;
  }
}
