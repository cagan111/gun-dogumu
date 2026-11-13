# Son Ateş

Dinozorlar çağında geçen bir hayatta kalma / korku / halk yönetimi oyunu. Saf HTML5 Canvas + WebAudio, kurulum gerekmez:
`index.html` dosyasını tarayıcıda aç ya da Vercel'de `/oyun/` adresine git.

## Dosyalar
| Dosya | İçerik |
|---|---|
| `js/temel.js` | yardımcılar ve tüm veri: beceriler, gruplar, yaratıklar, yapılar, üretilebilir eşyalar, başarımlar |
| `js/ses.js` | sentezlenmiş sesler |
| `js/dunya.js` | biyomlar, tohumlu dünya üretimi, yamyam kampları, gün/gece, ışık, görüş, hava |
| `js/halk.js` | kişiler, beceri/seviye, kuşanım, çadırlar, şifahane ve salgın, bütün meslek davranışları |
| `js/yaratik.js` | yaratık yapay zekâsı, leşler, sürüler, Benzeyen, yamyamlar, doğurma |
| `js/oyun.js` | lider, etkileşim, inşaat planları, üretim emirleri, gün döngüsü, gece olayları, final, kayıt |
| `js/cizim.js` | grafikler: güneşe göre gölgeler, dokular, ışık, sis, efektler, harita |
| `js/arayuz.js` | girdi, halk paneli, karakter kartı, üretim menüsü, av emri, ekranlar |

## 3B birinci şahıs
Oyun liderin gözünden oynanır (three.js, `js/uc.js` çizici, `js/model3d.js` modeller). Simülasyon 2B kalır; arazi yüksekliği `groundH(x,y)` ile gelir.
- **Ada**: 16000 birimlik ada; orman, dağ sıraları, tepeler, çayırlar, bataklık, sisli vadi, kumsal ve deniz.
- **Mağara içi**: kapıda E ile içeri gir, dolaş; yatağa bak → uyu, üretim masasına bak → üretim, kişiye bak → emir ver (`js/ic.js`).
- **Uyku ve gözcü**: gece barınakta uyursun (U), zaman hızlanır. Kapıdaki meşaleli gözcü tehlikede uyandırır; gözcü zarar görmez.
- **Sessiz av**: X / Ctrl ile eğil. Av hayvanları sesi duyar; habersiz hayvana ilk vuruş 2 kat.
- **Sakin geceler**: yırtıcılar kamptan uzakta kendi bölgelerinde yaşar; keşif tehlikelidir, kamp çoğu gece sakindir.
- **Hedef**: en az 200 gün hayatta kal, kıyılardaki 3 gemi enkazını bul, halat ve yelken bezi ürettir, 6. seviye mimarla kıyıya ⛵ Gemi kur (15+ kişi), 100 yiyecekle yelken aç.
- Yeni insan katılımı ve doğum çok nadirdir.

## Oynanış
- **Halk ve meslekler (14 grup)**: Oduncu, Taşçı, Toplayıcı, Avcı, Et Ustası, Aşçı, Çiftçi, Şifacı, Zanaatkâr, Mimar, Kâşif, Muhafız, Takip, Boşta.
- **Beceriler ve seviye (1-10)**: herkes yaptığı işte ustalaşır; usta daha hızlı ve daha iyi çalışır, gelişmiş eşya ve yapıları açar.
  Karakter kartında (ⓘ) beceriler, özellikler, çadır, aile, kuşanım ve sağlık görünür; görev ve doğrudan üretim emri verilir.
- **Av (ana yiyecek)**: 🎯 Av Emri (G) ile bir hayvan seç. Avcılar okla mesafe korur, mızrakla arkadan/yandan girer, hayvan dönünce geri çekilir.
  Yiyecek azalınca kendiliğinden ava çıkarlar. Öldürülen hayvan leş bırakır.
- **Mağara ve iç görünüm (I)**: halk ilk başta mağarada yaşar. I tuşu ya da 🏠 İçeri düğmesi mağaranın/kulübenin içini açar.
  Odalara dokunarak türünü seç: Yatakhane (2 hane), Depo (+150 kapasite), Mutfak, Şifa Odası (2 yatak), Et Odası, Atölye.
  İçerideki birine dokununca karakter kartı açılır; oklarla diğer yapılara geçilir.
- **Kulübe**: büyük yapı, 4 oda (başta 2 yatakhane + 2 boş, sen belirlersin).
- **Yiyecek zinciri**: avcılar ve taşıyıcılar leşten çiğ eti Et Ustası'na taşır → usta temizler → Aşçı pişirir, masaya koyar.
  Meyveleri de aşçı yemeğe çevirir. Günde iki yemek vakti vardır (sabah ve öğleden sonra); halk masada toplanır.
  Temizlenmemiş çiğ et yenirse salgın riski doğar; salgın nadiren öldürür. Depo dolunca fazlası kaybolur.
- **Günlük rutin ve yedek iş**: kartta sabah/öğle/ikindi için ayrı görev verilebilir. İşi olmayan usta ya da aşçı seçilen yedek işi yapar.
- **Çitler ve kuşatma**: çadır ve kulübelerin etrafına çit/duvar yapılmazsa nadiren yırtıcılar gece yapılara saldırıp zarar verir.
- **Tarım**: tarlalar ekilir, bakılır, iki günde hasat edilir.
- **Çadırlar**: mağara dolunca her tek kişi ya da çift bir çadırda yaşar; çiftler aynı çadıra taşınır, çocuklar ebeveynle kalır. Boş çadır yoksa yeni insan gelmez.
- **Şifahane**: 4 yatak. Yaralılar başkaları tarafından taşınır, günlerce tedavi görür.
- **Üretim**: Zanaatkârlar atölyede balta, kazma, mızrak, sepet, ok, yay, zırh, zehirli ok, eyer, kemik mızrak ve Yarık Taşı yapar;
  şifacılar sargı ve ilaç yapar. Aletler otomatik kuşanılır (balta oduncuya, yay avcıya...). Ok harcanır.
- **İnşaat**: yapılar planlanır, mimarlar (ve boştakiler) inşa eder. Gelişmiş yapılar usta mimar ister.
- **Yaratıklar**: küçükler (Sürüngeç, Tükürgeç, Gece Avcısı), tehlikeliler (Yırtıcı, Batakçı), devler (Dev Kafa, Yelkensırt),
  otlayanlar (Ördekgaga sürüleri, Kafakalkan, Zırhlı, Boynuzlu, Uzunboyun), Kanatlı. Çok büyükler nadiren görünür. Geceler gündüzden belirgin şekilde tehlikelidir.
- **Kesici**: sessiz, ani ve öldürücü bir raptor. Yalnız kalanı avlar; 2-3 kişi bir aradaysa geri çekilir ve onlara karşı savunmasızdır.
- **Kaçırılma işareti**: kaçırılan birinin izi yalnızca kısa bir süre ve yakındayken görünür.
- **Benzeyen**: halktan birinin kılığına girip kampa yaklaşan şey. Aynı isim iki kez görünür. Yaklaşınca yüzünü gösterir.
- **Bilinmezlik**: dünyayı yalnızca halkının gördüğü kadar görürsün; Kâşifler bilinmeyene gider. Gece olaylarının zamanı bilinmez.

## Kontroller
Fare bakış (ekrana tıkla; Esc/Tab bırakır) · WASD hareket · Shift koş · X/Ctrl eğil · Sol tık/Boşluk mızrak · F/sağ tık ok · E etkileşim / içeri gir / emir ver ·
U uyu · I oda düzeni · G av emri (hayvana bak ve tıkla) · C üretim · M harita · H halk paneli · 1-9 inşa planı · T meşale · P duraklat.
Telefonda: sol yarı yürüme, sağ yarıyı sürükle bakış, düğmeler sağda.
