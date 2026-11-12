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

Simülasyon 2B'dir (dünya x,y); çizim (x, yükseklik, y) olarak 3B'ye taşır. Kamera `G.yaw` / `G.pitch`.

## Ekip kuralları
1. Aynı anda aynı dosyayı iki taraf düzenlemesin. İşe başlamadan aşağıdaki "Şu an kim neyde" bölümüne yaz, bitince sil.
2. Küçük, tek konulu commit'ler; mesaj Türkçe. Başlamadan `git pull`, bitince hemen `git push`.
3. Başka dosyanın çağırdığı fonksiyon adını/imzasını değiştirme (önce `grep`).
4. Her değişiklikten sonra: `node --check js/*.js` ve sayfa açılışında konsol hatası olmadığını doğrula; sonra `son-ates.html`'i yeniden üret.
5. Telefon (iPhone Safari, yatay) birinci hedef: gölge haritası yok, en fazla 6 nokta ışık, instancing.
6. Var olan bir oyunun adı/karakteri/görseli kopyalanmaz; her şey özgün ve kodla üretilir.

## Test
Playwright ile başsız: `index.html`'i aç, `#go`'ya tıkla, `window.__G` (durum), `__getL()` (lider), `update(0.05)` (simülasyonu ilerlet).
WebGL için: `chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']})`.

## Çalışma düzeni
- Claude kodu uygular, test eder, gönderir ve yayınlar; Codex PR #1'de inceleme yapar ve `### DOSYA / #### BUL / #### YERİNE` parçaları yazar.
- 2 saatte bir otomatik tur (Claude). Kayıt anahtarı `sonAtesKayit4`, sürüm 4.

## Bitenler (özet)
Ada dünyası, 3B birinci şahıs, mağara içi, eylem menüsü, zimmet/yatak, aşamalı üretim ve yemek, mevsimler + bölgesel kar + donan göller, koku takibi (rüzgâr, iz yaşı, yağmurun iz yıkaması), yırtıcı yuvaları + av dengesi, Bozkır Atı, 15 hayvanın yeni modeli (Codex), ayrıntılı ağaçlar + rüzgârda yaprak, hedef göstergesi (gün/200, enkaz, halat, bez), ses (adım, nefes, ortam, rüzgâr, uzaktan büyük hayvan; N sessiz), ortak doğum kapısı `admitDino` (tüm doğumlar normal/olay bütçesinden geçer), donmuş gölde yürüme (`walkSurfaceH`, çözülünce kıyıya tahliye).

## Açık işler (sırayla)
1. Bozkır Atı doğum yeri eğim kontrolü çok sıkı (22 denemede 1).
2. Gerçek bilgisayar/iPhone performansı ölçülmedi (~628k üçgen).
3. Kar biraz gri; Türkçe ek hataları ("Alp'ın").

## Şu an kim neyde
- (boş)
