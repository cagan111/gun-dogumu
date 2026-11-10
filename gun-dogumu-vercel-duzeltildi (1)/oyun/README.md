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
- **Halk ve meslekler (13 grup)**: Oduncu, Taşçı, Toplayıcı, Avcı, Et Ustası, Çiftçi, Şifacı, Zanaatkâr, Mimar, Kâşif, Muhafız, Takip, Boşta.
- **Beceriler ve seviye (1-10)**: herkes yaptığı işte ustalaşır; usta daha hızlı ve daha iyi çalışır, gelişmiş eşya ve yapıları açar.
  Karakter kartında (ⓘ) beceriler, özellikler, çadır, aile, kuşanım ve sağlık görünür; görev ve doğrudan üretim emri verilir.
- **Av (ana yiyecek)**: 🎯 Av Emri (G) ile bir hayvan seç. Avcılar okla mesafe korur, mızrakla arkadan/yandan girer, hayvan dönünce geri çekilir.
  Yiyecek azalınca kendiliğinden ava çıkarlar. Öldürülen hayvan leş bırakır.
- **Et ustası ve salgın**: leşi Et Ustası temizler (Kasap Tezgâhı +%25). Lider çiğ et keserse salgın riski oluşur. Salgın yayılır, nadiren öldürür.
- **Tarım**: tarlalar ekilir, bakılır, iki günde hasat edilir.
- **Çadırlar**: her tek kişi ya da çift bir çadırda yaşar; çiftler aynı çadıra taşınır, çocuklar ebeveynle kalır. Boş çadır yoksa yeni insan gelmez.
- **Şifahane**: 4 yatak. Yaralılar başkaları tarafından taşınır, günlerce tedavi görür.
- **Üretim**: Zanaatkârlar atölyede balta, kazma, mızrak, sepet, ok, yay, zırh, zehirli ok, eyer, kemik mızrak ve Yarık Taşı yapar;
  şifacılar sargı ve ilaç yapar. Aletler otomatik kuşanılır (balta oduncuya, yay avcıya...). Ok harcanır.
- **İnşaat**: yapılar planlanır, mimarlar (ve boştakiler) inşa eder. Gelişmiş yapılar usta mimar ister.
- **Yaratıklar**: küçükler (Sürüngeç, Tükürgeç, Gece Avcısı), tehlikeliler (Yırtıcı, Batakçı), devler (Dev Kafa, Yelkensırt),
  otlayanlar (Ördekgaga sürüleri, Kafakalkan, Zırhlı, Boynuzlu, Uzunboyun), Kanatlı. Geceler gündüzden belirgin şekilde tehlikelidir.
- **Benzeyen**: halktan birinin kılığına girip kampa yaklaşan şey. Aynı isim iki kez görünür. Yaklaşınca yüzünü gösterir.
- **Bilinmezlik**: dünyayı yalnızca halkının gördüğü kadar görürsün; Kâşifler bilinmeyene gider. Gece olaylarının zamanı bilinmez.
- **Hedef**: yarığı bul, halkını 30 kişiye çıkar, 6. seviye bir zanaatkâra Yarık Taşı yaptır, son savaşı kazan.

## Kontroller
WASD hareket · Shift koş · Fare/Boşluk mızrak · F/sağ tık ok · E (basılı) topla/kullan/tedavi/inşaata yardım · E (bas) bin/in, yaralı taşı ·
G av emri · C üretim · M harita · H halk paneli · 1-9 inşa planı · T meşale · P duraklat. Telefonda sanal kol ve düğmeler.
