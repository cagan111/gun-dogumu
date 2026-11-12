# Son Ateş — ortak çalışma notları (her yapay zekâ / geliştirici önce bunu okusun)

Dinozor çağında, birinci şahıs 3B, hayatta kalma + koloni yönetimi oyunu. Arayüz dili Türkçe.

## Nerede ne var
- Oyun: `gun-dogumu-vercel-duzeltildi (1)/oyun/` — `index.html` + `js/*.js` (klasik script'ler, ortak global'ler, derleme yok).
- Tek dosyalık sürüm: kökteki `son-ates.html` (script'ler içine gömülü). `oyun/` değişince yeniden üretilmeli:
  index.html içindeki her `<script src="js/X.js">` etiketini dosyanın içeriğiyle değiştir (`</script` → `<\/script`).
- Çalışma dalı: `claude/nifty-johnson-d1o3sf`.

## Dosya sorumlulukları (yükleme sırası)
| Dosya | İçerik |
|---|---|
| `three.min.js` | three.js r149 (global `THREE`) — dokunma |
| `temel.js` | sabitler ve tüm veri tabloları: `DINO`, `BUILD`, `ITEMS`, `STAGES`, `GROUPS`, `ROOMS`, `WORLD=16000` |
| `ses.js` | sentezlenmiş sesler (`SFX`) |
| `dunya.js` | ada üretimi, biyomlar (0 orman,1 dağ,2 bataklık,3 sisli vadi,4 çayır,5 kumsal,6 deniz), `groundH(x,y)`, `isSea`, `terrainMul`, zaman/ışık |
| `halk.js` | insanlar: meslek davranışları, zimmet (`p.own`), yatak, taşıma (`depotOf`, `tripCap`), aşamalı üretim (`workOrder`), aşçı, balıkçı, yaralılar |
| `yaratik.js` | yaratık yapay zekâsı, doğurma, `hurt()`, gizlilik (`noiseOf`), kan izi |
| `oyun.js` | lider (`updLeader`), etkileşim, inşa, gece olayları, uyku, gemi sonu, kayıt (v4, anahtar `sonAtesKayit4`) |
| `cizim.js` | 2B kaplama (etiketler, işaretler, vinyet) ve mini harita; `render()` → `render3D()` |
| `ic.js` | iç mekân mantığı: `G.inside`, `inRooms`, `inFurn`, `inPeople`, `inMove` |
| `model3d.js` | insan ve dinozor modelleri/animasyonları: `M3.person/updPerson/dino/updDino` (API sabit) |
| `uc.js` | 3B çizici: arazi, deniz, bitki örtüsü, yapılar, iç mekânlar, ışık, gölge lekeleri, `inSolids`, `inWall` |
| `arayuz.js` | girdi (fare kilidi, dokunmatik), HUD, eylem menüsü (`toggleMenu`), kişi kartı, üretim menüsü, ana döngü (`TEMPO`) |
| `sohbet.js` | sofraya oturma (`sitAtTable`), akşam muhabbeti (`G.gather`, `gatherStep`, konuşma havuzu `chatPool`), içecek (`icki`, aşçı demler), lider diyaloğu (`#talkM`, `talkAct`), yarının planı (`PLANS`, `planDawnClear/Apply`, `planMul`) |
| `tarim.js` | ekinler (`CROPS`), tohumlar (`G.seeds`), tarla seçimi (`b.crop` seçilen, `b.cur` ekili), `cropGrow`, `cropHarvest`, `seedFind` |

Simülasyon 2B'dir (dünya x,y); çizim (x, yükseklik, y) olarak 3B'ye taşır. Kamera `G.yaw` / `G.pitch`.

## Ekip kuralları
1. Aynı anda aynı dosyayı iki taraf düzenlemesin. İşe başlamadan aşağıdaki "Şu an kim neyde" bölümüne yaz, bitince sil.
2. Küçük, tek konulu commit'ler; mesaj Türkçe. Başlamadan `git pull`, bitince hemen `git push`.
3. Başka dosyanın çağırdığı fonksiyon adını/imzasını değiştirme (önce `grep`).
4. Her değişiklikten sonra: `node --check js/*.js` ve sayfa açılışında konsol hatası olmadığını doğrula; sonra `son-ates.html`'i yeniden üret.
5. Grafikte PC kalitesi öncelikli (sahibi: "telefona ağır gelmesinde sorun yok"). `U3.quality` 'yuksek' (masaüstü: gölge haritası, yoğun bitki, post-process serbest) / 'dusuk' (dokunmatik: gölge haritası yok, ≤6 nokta ışık, instancing). Telefon yine oynanabilir kalmalı.
6. Var olan bir oyunun adı/karakteri/görseli kopyalanmaz; her şey özgün ve kodla üretilir.

## Test
Playwright ile başsız: `index.html`'i aç, `#go`'ya tıkla, `window.__G` (durum), `__getL()` (lider), `update(0.05)` (simülasyonu ilerlet).
WebGL için: `chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']})`.

## Çalışma düzeni
- Claude kodu uygular, test eder, gönderir ve yayınlar; Codex PR #1'de inceleme yapar ve `### DOSYA / #### BUL / #### YERİNE` parçaları yazar.
- 2 saatte bir otomatik tur (Claude). Kayıt anahtarı `sonAtesKayit4`, sürüm 4.

## Bitenler (özet)
Ada dünyası, 3B birinci şahıs, mağara içi, eylem menüsü, zimmet/yatak, aşamalı üretim ve yemek, mevsimler + bölgesel kar + donan göller, koku takibi (rüzgâr, iz yaşı, yağmurun iz yıkaması), yırtıcı yuvaları + av dengesi, Bozkır Atı, 15 hayvanın yeni modeli (Codex), ayrıntılı ağaçlar + rüzgârda yaprak, hedef göstergesi (gün/200, enkaz, halat, bez), ses (adım, nefes, ortam, rüzgâr, uzaktan büyük hayvan; N sessiz), ortak doğum kapısı `admitDino` (tüm doğumlar normal/olay bütçesinden geçer), donmuş gölde yürüme (`walkSurfaceH`, çözülünce kıyıya tahliye), Bozkır Atı doğumu gevşetildi (çayır yakınında 40 denemede 39), kar tonu düzeltmesi (Codex, `aSnow` maskesi), kayıtta iç mekân durumu, ağaç mesafe LOD'si (Codex), 60 günlük denge çalışması (Codex: yemek yeterli, ölümler saldırıdan), lider devrinde boş kalan mesleği (odun için taşçı/toplayıcıdan) birinin devralması, şafakta geçici işten (takip, rutin, yaralıdaki sipariş) kendi mesleğine dönüş (`halkDawn`), Türkçe ek düzeltmesi (â/î/û ünlüleri, lider için senin/seni/sana; "Alp'ın" zaten doğruydu). Gün 2 kat uzun (`DAYK=2`, `CYCLE=600`; ateş yakıtı, çalı/ot yenilenmesi, kar/buz, gece hücumu ve leş kokusu oranları `/DAYK` ile gün başına sabit; eski kayıtta saat `cyc` ile ölçeklenir). Lider yemekte "Sofraya otur" (E/menü); gelmezse stoktan yine doyar. Akşam yemeğinden sonra (faz ~0.49–0.6) muhabbet: halk ateş çevresinde halka olur, konuşma balonları, aşçının demlediği ot çayı/şerbet; kuşatma/erken gece olayında yok. "Muhabbete katıl": hikâye, kulak ver (gerçek duruma göre ipucu), plan (erken av / odun / tahkim / dinlenme; şafakta uygulanır, ertesi şafak kalkar, `rtBase` ile `halkDawn`'a uyumlu). Tarımda tarla başına ekin seçimi (çalı, tahıl, şifalı ot, lif otu→halat, balotu→çay), tohum bulma ve otomatik yeniden ekim. Not: dışarıda oturma pozu yok (uc.js dış mekân kişilere `p.pose` geçirmiyor; `p.pose='sit'` ve `b.crop/b.cur` Codex'in çizimi için hazır).

## Açık işler (sırayla)
1. **Kan/kanama/şifa (Codex):** kişi başı kan seviyesi, yaraya göre kanama; düşen yaralı kaldırılmaz, kanı bitmeden şifacıya taşınmalı (yerinde bandaj kanamayı yavaşlatır); şifacı ağır yaralıya öncelik verir, lider şifahaneye gelince yanına gelip kendi ürettiği ilaçla (`bandaj`, `ilac`) tedavi eder; şifahanede kalkmayan hasta hatası; lider birini taşırken yavaş/ağır (stamina); emirle taşıyan yaralıyı sırtta şifa yatağına hızla götürür; lider düşerse yakındakiler taşır. Yatak araması tek yardımcıda (`healBedFor`).
2. **Yırtıcı AI (Codex):** takılma (bıyık sensörleri, duvar takibi, takılınca sapma noktası/vazgeçme), sürü taktiği (yandan sarma, yalnız/yaralıyı seçme, düşeni sürükleme, ısrarlı takip). Yarım kalmış taslak: `wip/yaratik-ai-yarim.patch` (PACK_T tanımsız kalmıştı; olduğu gibi uygulanamaz, fikir kaynağı). Saldırılar nadir ama ölümcül.
3. **Başlangıç akışı:** giriş sahnesi; sahilde 0 malzemeyle başla; mağara çok yakında (ilk gün bulunur); "onarmak" = içine eşya yapmak (madde 4), ilk gün birkaç temel eşya yapılabilir; ilk basit aletler ateş başında üretilir.
4. **Oda sistemi kalkıyor:** mağara içinde her eşya ayrı yerleştirilir (şifa yatağı, şifa tezgâhı, mutfak masası, pişirme tezgâhı, yatak, raf, zanaat tezgâhı…); malzeme+süre+iş; eski kayıtlar dönüştürülür. Muhafız ve yerleşim ilk girişte seçilir.
5. **Gece/uyku:** muhafız mağara içinde kapıda; başlangıç yatakları kalkar; uyku yeri üç kademe: çıplak yer < yer yatağı (ucuz: ot/post) < gerçek yatak; kademeye göre homurdanma/mutsuzluk/dinlenme değişir (karakter özelliğine göre de: bazıları yere aldırmaz); içkiden sonra yavaş yavaş dağılıp yatar, bazıları uyumaz; muhafız gün gün nöbetleşir, uyuyakalabilir. Yamyam baskını ve taklitçi 15. güne kadar hiç olmadı → incele; mağaraya yalnız bu ikisi dalabilir.
6. **Codex görsel/içerik sırası:** karakterler (pozlar `p.pose`, taşıma, yaralı, kan lekesi) → etçiller daha korkunç → ağaç/taş çeşitliliği → dağda keşfedilecek, içinden yaratık çıkan mağaralar → öğünler daha uzun + sırayla işe dönüş + tarlalar 2–3× büyük.
7. **Moral ve ilişkiler (sahip istedi):** moralin iş etkisi şu an kaba (`moraleMul`: >70 ×1.15, <30 ×0.8) → kademeli ve görünür olsun (yüksek moral: hız, kalite, beceri kazanımı, hasat/üretim miktarı). Düşük moralde kişiler arası kavga (kişi kartında ilişki puanı, kavga olayı, yaralanma riski, araya girme). Eş olma şu an YALNIZ gelen çiftlerle oluyor (oyun.js ~432) → mevcut halk arasında yakınlık puanı (akşam muhabbeti, birlikte çalışma, kurtarma) ile flört → eş olma; eşler birlikte yatar, ayrılık/yas. Moral çok düşükse ayrılanlar (mevcut `desert` mantığı halk.js ~553–565 ve ~1210) daha görünür ve kademeli olsun.
8. Sonra: kış hazırlığı (kürk, kışlık odun uyarısı), depo/ambar + bozulma, ilişkiler, keşif, gemi finali, ayarlar menüsü, kayıt yuvaları, odun tekrar koşusu.
9. Gerçek cihaz performansı ölçülmedi.

## Şu an kim neyde
- Codex: model3d.js (karakterler). Sonra Codex sırası: madde 3–5 (başlangıç, mağara eşyaları, gece/uyku), madde 1 (kan/şifa), madde 2 (yırtıcı AI), madde 6–7. Claude yalnız inceler/uygular/test eder/yayınlar.
