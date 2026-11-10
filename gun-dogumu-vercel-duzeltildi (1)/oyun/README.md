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
- **Hedef**: yarığı bul, halkını 30 kişiye çıkar, 6. seviye bir zanaatkâra Yarık Taşı yaptır, son savaşı kazan.

## Kontroller
WASD hareket · Shift koş · Fare/Boşluk mızrak · F/sağ tık ok · E (basılı) topla/kullan/tedavi/inşaata yardım · E (bas) bin/in, yaralı taşı ·
I iç görünüm · G av emri · C üretim · M harita · H halk paneli · 1-9 inşa planı · T meşale · P duraklat. Telefonda sanal kol ve düğmeler.
