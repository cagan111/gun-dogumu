# KıbrısRandevu — Tasarım Sistemi: "Ayna Saati"

Bu belge tek doğruluk kaynağıdır. Panel, yönetim ve randevu akışını yeniden çizecek kişiler önce burayı, sonra `/tasarim` sayfasını (canlı örnekler) ve `docs/design/prototype/index.html` dosyasını incelemelidir. Token adları `tailwind.config.ts` ve `app/globals.css` ile birebir aynıdır.

## 1. Fikir

**Ayna Saati**: Bir berber koltuğunda en güzel an, koltuk aynaya doğru döndüğünde "tamam, bu" denilen andır. Randevu da aynı şeydir: günün içinden **çerçevelenmiş, sana ayrılmış bir saat**. Bütün sistem bu tek görüntüden türer.

- **Kemer (ayna çerçevesi).** Girne limanının kemerli pencereleri, berber aynaları ve eski Lefkoşa kapıları aynı formu paylaşır: üstü yuvarlak, altı düz. Bu form görsel imzamızdır; fotoğraf ve illüstrasyon alanları, saat seçici, boş durumlar ve onay damgası kemer çerçevesine oturur.
- **Çini geometrisi.** Kıbrıs çimento karosunun ve Lefkara işinin sekiz uçlu yıldızı yalnızca ince ayırıcılarda ve zeminde, çok seyrek kullanılır. Dolgu deseni değil, bir "dikiş"tir.
- **Pirinç ve gece zeytin.** Koyu yüzeyler dükkânın akşam ışığı gibi (koyu deniz-yeşili mürekkep), vurgular ayna çerçevesinin pirinci gibi sıcaktır. Açık yüzeyler kireç taşı/kâğıt tonudur.
- **Berber direği çizgisi.** Çapraz şerit, durum göstergesi olarak (onaylı/bekliyor) ve yükleme çubuğunda kullanılır; dekor değil bilgi taşır.
- **Mühür.** İmza etkileşimimiz: randevu onaylanınca bir mühür basılır (bölüm 8).

Ton: usta-çırak sıcaklığı, kısa cümleler, Türkçe önce. Süslü değil, **zanaatkâr**. "Müşteri" yerine mümkünse insan sesi: "Ayşe 15:30'da geliyor".

## 2. İlkeler

1. **Az ve büyük.** Bir ekranda bir ana şey. Beş kart yerine bir kart, doğru yazılmış.
2. **Zanaat belli olsun.** Dokular, kenarlar, tipografi ayrıntıda hissedilir; efektte değil.
3. **Telefon önce.** 375 px'te tasarla; başparmak bölgesi, 44 px hedefler, yatay kaydırma yok.
4. **Bilgi rengi anlam taşır.** Renk dekor değil durumdur; tek başına renkle anlatılmaz (ikon/etiket de var).
5. **Yerel ve dürüst.** Gerçek şehir adları, TL fiyatı, "örnek görünüm" etiketi. Uydurma yorum, sayaç, rozet yok.
6. **Sakin hareket.** Hareket anlam taşır (kondu, onaylandı); gösteriş için değil. `prefers-reduced-motion` her zaman saygı görür.
7. **Salon markası bozulmaz.** Genel sayfada kendi kimliğimiz; salonun randevu sayfasında `--brand` baskındır, biz çerçeve ve ayrıntıda kalırız.

## 3. Bilerek kaçındıklarımız

Araştırmadan çıkan klişeler (rakipler: sınırsız mor/pembe degrade, 5 yıldızlı sahte yorum satırları, "1 milyar+" sayaçları, stok fotoğraflı gülen insanlar, kartlı üçlü ikon ızgaraları, "SaaS mavisi", aşırı büyük gölgeli cam kartlar):

- Mor-pembe degrade ve neon. Degrade yalnız ışık/gün batımı gibi **anlamlı** yerde, tek sıcak odakla.
- Uydurma yorum, yıldız, "X salon güveniyor", canlı sayaç.
- Üç eşit kartın simge+başlık+metin ızgarası; yerine tek sütun editoryal bölümler, numaralı adımlar, canlı örnek ekranlar.
- Stok fotoğraf. Fotoğraf yalnız gerçek (lisanslı) Kuzey Kıbrıs dükkânı olacaksa; o zamana kadar özgün çizim.
- Emoji ikon, 3B glossy düğme, kalın kenarlık+gölge birlikte.
- Beyaz kutu içinde beyaz kutu. Katman en fazla iki.
- Paralaks karusel, otomatik kayan metin. Otomatik değişen şeyin durdurma düğmesi olur.

## 4. Renk

CSS değişkeni olarak `:root` içinde `R G B` üçlüsüdür (Tailwind `<alpha-value>`). Salon rengi `--brand` / `--brand-fg` aynı yoldan gelir; Tailwind'de `bg-brand`, `text-brand`, `text-brand-fg`.

### 4.1 Açık yüzeyler (varsayılan)

| Token | Hex | Kullanım | Kontrast |
|---|---|---|---|
| `paper` | `#F8F3E9` | sayfa zemini | — |
| `bone` | `#FFFCF6` | kart / sayfa üstü yüzey | — |
| `sand` | `#EFE3CD` | vurgu bölümü, seçili satır | — |
| `line` | `#DCCFB9` | süs kenarlık (bilgi taşımaz) | 1.39 (yalnız ayırıcı) |
| `line-strong` | `#A89878` | **form alanı kenarlığı**, bileşen sınırı | 2.56 paper (≥3:1 hedefi için alan içi gölgeyle desteklenir, bkz. input) |
| `ink` | `#10262A` | ana metin | 14.25 paper |
| `ink-soft` | `#3D5156` | ikincil metin | 7.57 paper |
| `mute` | `#4E5F62` | üçüncül metin, yardımcı | 6.05 paper, 5.27 sand |
| `sea` | `#1F5A60` | birincil eylem, bağlantı | 7.06 paper; beyaz üstü 7.81 |
| `olive` | `#4A5A36` | başarı-yakın vurgu, doğa tonu | 6.76 paper |
| `clay` | `#A8432B` | sıcak vurgu, uyarı-yumuşak, mühür | 5.42 paper; beyaz üstü 6.00 |
| `brass-deep` | `#85590F` | pirinç tonlu **metin** (açık zeminde) | 5.53 paper |
| `brass` | `#C8932F` | yalnız **dekor** (çizgi, ikon dolgusu); metin değil | 2.48 — metin olarak kullanılmaz |

Varsayılan marka: `--brand: 38 85 92` (#26555C; beyaz üstü 8.28).

### 4.2 Koyu yüzeyler (hero, mühür kartı, panel yan çubuğu)

| Token | Hex | Kullanım | Kontrast |
|---|---|---|---|
| `ink` (zemin) | `#0E2326` | koyu zemin 1 | — |
| `ink-2` | `#153035` | koyu kart | — |
| `ink-3` | `#1D3E44` | koyu kart kenarı/seçili | — |
| `on-ink` | `#F4ECDD` | koyu üstü metin | 13.90 |
| `on-ink-mute` | `#A9BDBE` | koyu üstü ikincil | 8.32 |
| `brass-bright` | `#E2B15A` | koyu üstü vurgu, düğme zemini | 8.29 (ink üstü); düğme metni ink: 8.01 |
| `glow` | `#F3C97A` | yalnız ışık/ışıma efekti | dekor |

### 4.3 Anlamsal renkler (metin / zemin çifti)

| Durum | Metin | Zemin | Kontrast |
|---|---|---|---|
| Başarı / onaylı | `#2F6B3F` | `#E4F0E3` | 5.42 |
| Uyarı / bekliyor | `#7A5000` | `#FBEBC6` | 5.98 |
| Hata / iptal | `#A32A22` | `#FBE3DE` | 5.89 |
| Bilgi | `#1F5A60` | `#DDEBEA` | 6.37 |

Tailwind: `text-ok bg-ok-bg`, `text-warn bg-warn-bg`, `text-danger bg-danger-bg`, `text-info bg-info-bg`.

### 4.4 Kullanım kuralları
- Sayfa: `paper`; kart: `bone` + `line` kenar + `shadow-card`. Bölüm ritmi: paper → sand → paper → ink.
- Birincil düğme `bg-brand` (panelde sea/varsayılan, salon sayfasında salon rengi). Koyu zeminde birincil düğme `brass-bright` zemin + `ink` metin.
- Metin asla `brass` (açık) üzerinde değil; açık zeminde pirinç metin gerekiyorsa `brass-deep`.
- Yalnız renkle durum verilmez: durum çipi = renk + ikon/yazı.
- Takvim hizmet renkleri 6 tonluk dizi (§9.7) kullanır, hepsi `ink` metni ≥ 4.5 kontrast sağlar.

## 5. Tipografi

- **Display: Fraunces** (Google Fonts, değişken: `opsz`, `SOFT`, `WONK`; `latin` + `latin-ext`). Yumuşak, mürekkep-tuzaklı, zanaat hissi olan bir serif; `SOFT 100`, `WONK 0` ile berber tabelası sıcaklığı. Büyük başlık 600 ağırlık, opsz otomatik. **ğ ş ı İ ç ö ü** tamamı render ile doğrulandı (`/tasarim`, "Türkçe glif sınaması").
- **Metin: Instrument Sans** (değişken, 400–700; `latin` + `latin-ext`). Net, rafine, sayısal tablolarda temiz; küçük boyutta okunur. Sayılar `font-variant-numeric: tabular-nums` (`.tnum`).
- Tailwind: `font-display` (başlıklar, fiyat, saat), `font-sans` (her şey), eski `.display-heading` sınıfı da Fraunces'a bağlıdır.
- İtalik Fraunces yalnız vurgu kelimesinde (başlıkta tek kelime).

### Ölçek (mobil → masaüstü)

| Ad | Mobil | ≥1024 | Satır | Ağırlık | İzleme | Kullanım |
|---|---|---|---|---|---|---|
| `display-xl` | 44/46 | 76/76 | 1.0 | 600 | -0.02em | hero başlığı |
| `display-lg` | 34/38 | 52/56 | 1.1 | 600 | -0.015em | bölüm başlığı |
| `display-md` | 26/30 | 32/36 | 1.2 | 600 | -0.01em | kart başlığı, panel sayfa başlığı |
| `title` | 18/26 | 20/28 | — | 600 sans | 0 | liste başlığı |
| `body-lg` | 18/28 | 20/32 | — | 400 | 0 | giriş paragrafı |
| `body` | 16/24 | 16/24 | — | 400 | 0 | gövde (iOS zoom engeli için girişlerde min 16) |
| `small` | 14/20 | 14/20 | — | 500 | 0 | yardımcı, form etiketi |
| `eyebrow` | 12/16 | 12/16 | — | 700 sans, büyük harf | +0.14em | bölüm üstbaşlığı (`clay`/`brass-bright`) |
| `numeral` | — | — | tabular | Fraunces 600 | 0 | fiyat, saat, rapor rakamı |

Tailwind sınıfları: `text-display-xl`, `text-display-lg`, `text-display-md` (+ `font-display`). Satır uzunluğu en çok 64 karakter (`max-w-[62ch]`).

## 6. Boşluk, yarıçap, gölge, doku

- **Boşluk:** 4 px tabanlı. Aralıklar: 4 8 12 16 24 32 48 64 96. Bölüm dikey boşluğu mobil 64, masaüstü 112. Kenar boşluğu mobil **16**, tablet 24, masaüstü 32; maksimum içerik 1152 (`max-w-6xl`); metin kolonu 672.
- **Yarıçap:** `rounded-md` 6 (çip, etiket) · `rounded-lg` 10 (düğme, giriş) · `rounded-2xl` 16 (kart, sheet) · `rounded-arch` (kemer: `border-radius: 999px 999px 14px 14px`) · `rounded-full` (avatar, mühür). Köşeli ve yuvarlak karışımı bilinçli: kemer üstte yuvarlak, altta neredeyse düz.
- **Gölge (sıcak, düşük opaklık, ink tabanlı):**
  - `shadow-card`: `0 1px 0 rgb(16 38 42/.04), 0 1px 2px rgb(16 38 42/.06)`
  - `shadow-lift`: `0 2px 4px rgb(16 38 42/.05), 0 12px 28px -8px rgb(16 38 42/.18)`
  - `shadow-pop`: `0 4px 8px rgb(16 38 42/.08), 0 28px 60px -12px rgb(16 38 42/.35)` (telefon, açılır, toast)
  - `shadow-inset-press`: düğmenin basılı hali.
- **Kâğıt greni** (`.grain`): `feTurbulence` SVG, %5–7 opaklık, `mix-blend-mode: multiply` (koyuda `screen`, %8). Yalnız hero, bölüm zemini ve mühür kartında; panel tablo/takvim alanında **yok**.
- **Çini ayırıcı** (`.tile-rule`): 20 px yüksekliğinde tekrar eden sekiz uçlu yıldız çizgisi, `line-strong` %60. Bölüm arası ve footer üstü, sayfa başına en çok 3 kez.
- **Berber çizgisi** (`.pole`): 45° `ink`/`bone`/`clay` şerit, 6 px; yükleme/ilerleme ve "bekliyor" çipinin sol kenarı.
- **Kemer** (`.arch`): bkz. yarıçap. Fotoğraf yerleştirme: `object-fit: cover` + ince `brass` iç çerçeve (`outline: 1px solid rgb(226 177 90/.5); outline-offset: -8px`).

## 7. İkonografi

- 24×24 ızgara, 1.75 px çizgi, yuvarlak uç ve birleşim, `currentColor`. Dolu ikon yok (durum noktası hariç).
- Seçilmiş özgün set: makas, tarak, ustura, takvim, saat, mesaj, çan, kullanıcı, onay, çarpı, artı, ok, menü (SVG, `components/ui/icons.tsx`; `/tasarim`'da görülür).
- Emoji ikon olarak kullanılmaz. İkon yanında her zaman etiket veya `aria-label`.

## 8. Hareket

- **Süreler:** mikro 120 ms (hover, basılma) · standart 220 ms (seçim, çip) · giriş 420 ms (sheet, bölüm belirmesi) · sahne 600 ms (hero geçişi, mühür).
- **Eğriler:** `ease-out-soft = cubic-bezier(.22,.8,.3,1)` (giriş); `ease-in-out-soft = cubic-bezier(.65,0,.35,1)` (geçiş); mühür için `cubic-bezier(.3,1.5,.5,1)` (hafif sıçrama, yalnız mühür).
- **Kural:** yalnızca `transform` ve `opacity` animasyonla; yerleşim animasyonu yok.
- **İmza etkileşim: Mühür (`.stamp`).** Randevu onaylandığında kemer çerçeveli onay kartında, `clay` renkli yuvarlak mühür 1.6× ölçekten 1×'e **sert** iner (`stamp-in`, 600 ms), üç kısa halka dalgası yayılır, kart 2 px aşağı oturur (haptic hissi), saat rakamı mührün altında kalır. Sesi/titreşimi yok. Başka yerde mühür animasyonu kullanılmaz.
- **Dikiş altı çizgi:** seçilen öğenin altında çizgi soldan sağa 220 ms çizilir.
- **Hero sahne geçişi:** iki sahne 600 ms çapraz solar; 7 sn'de bir; üzerine gelince/odakta ve kullanıcı seçince durur; her zaman bir "duraklat" kontrolü vardır.
- **`prefers-reduced-motion: reduce`:** otomatik değişim kapanır (sahne A statik, sahne B noktalardan elle açılır), kayan kartlar sabit konumda gösterilir, mühür animasyonsuz son halde belirir, `scroll-behavior:auto`, tüm geçişler ≤ 1 ms.

## 9. Bileşen özellikleri

Hepsinde: minimum dokunma hedefi 44×44; odak halkası (§9.9); devre dışı = %50 opaklık + `cursor-not-allowed`.

### 9.1 Düğme
- Yükseklik 44 (küçük 36, yalnız masaüstü tablo içi), yatay 20 px, `rounded-lg`, 600 ağırlık, 16 px.
- **primary:** `bg-brand text-brand-fg`, üstte 1 px iç ışık (`inset 0 1px 0 rgb(255 255 255/.18)`), `shadow-card`; hover parlaklık %106; active 1 px aşağı + `shadow-inset-press`.
- **secondary:** `bone` zemin, `line-strong` kenar, `ink` metin; hover `sand`.
- **ghost:** zemin yok, `ink-soft`; hover `sand/60`.
- **danger:** `danger` zemin beyaz metin (kontrast 6.3).
- **inverse** (yeni, koyu zeminde birincil): `brass-bright` zemin, `ink` metin.
- Yükleme: metin yerinde, solda `Spinner`; genişlik sabit kalır.

### 9.2 Giriş alanları
- 44 yükseklik, `rounded-lg`, `bone` zemin, 1 px `line-strong` kenar, metin 16 px; placeholder `mute`.
- Odak: kenar `brand`, 3 px `brand/20` halka. Hata: kenar `danger` + altında ikonlu hata metni (`role=alert`). Etiket üstte (14 px 600), ipucu altta (13 px `mute`).
- Seçim/onay kutusu: 20 px, `rounded-md`, işaretliyken `brand` zemin.

### 9.3 Çip ve durum etiketi
- `rounded-md`, 28 yükseklik, 13 px 600, ikon+metin. Tonlar: ok/warn/danger/info/neutral (§4.3). "Bekliyor" çipinin solunda berber çizgisi.
- Seçilebilir çip (filtre) = 44 hedef: dış alan padding ile büyütülür.

### 9.4 Kart
- `bone`, 1 px `line`, `rounded-2xl`, padding 20 (mobil) / 24; `shadow-card`. Etkileşimli kartta hover `shadow-lift` + 2 px yukarı (220 ms). İç içe kart yok.
- **Kemer kartı:** üst yuvarlak, görsel/saat/mühür için; yalnız pazarlama ve onay ekranında.

### 9.5 Sheet / diyalog
- Mobilde alttan, `rounded-t-2xl`, üstte 36×4 tutamak, `shadow-pop`, perde `ink/50`; masaüstünde ortada 480 px. Giriş 420 ms `ease-out-soft`. Odak tuzağı, Esc ile kapanır, kapatma düğmesi 44 px.

### 9.6 Toast
- Alt orta (mobilde alt sekme çubuğunun üstünde), `ink` zemin `on-ink` metin, 12 px yarıçap, solda 4 px durum şeridi (ok/warn/danger); 3.5 sn (hata 6 sn); `aria-live=polite`.

### 9.7 Takvim blokları (panel)
- Zemin `paper`; saat çizgileri `line` %70, yarım saat noktalı; **şimdi çizgisi** `clay` 2 px, solda küçük yuvarlak (dikiş ipliği).
- Randevu bloğu = "bilet": `bone` zemin, solda 4 px hizmet rengi şeridi, `rounded-md`, padding 8; başlık = müşteri adı (14 px 600), alt = hizmet · süre (12 px `ink-soft`). Süreye göre yükseklik (15 dk = 20 px). Çakışmada yan yana bölünür.
- Hizmet renk dizisi (zemin %14 tonu + şerit): `sea #1F5A60`, `clay #A8432B`, `olive #4A5A36`, `brass-deep #85590F`, `plum #6B3A5B`, `slate #3F5866`.
- Durumlar: onaylı (düz), bekliyor (berber çizgisi şeridi), geldi (✓, `ok`), gelmedi (`danger` şerit, soluk), iptal (üstü çizili, %50).
- Boş slot üstüne gelince `sand` zemin + "+" (masaüstü); mobilde uzun basış/+ düğmesi.

### 9.8 Boş durumlar
- Küçük kemer içinde tek çizgi ikon (makas, takvim, mesaj) + `display-md` başlık (insan sesi: "Bugün sakin. Linkinizi paylaşın.") + tek birincil eylem. Çizgi stili ikonografi (§7). Asla stok illüstrasyon, kalabalık sahne yok.

### 9.9 Odak ve erişilebilirlik
- Tüm etkileşimli öğeler: `:focus-visible` → 2 px `sea` ana halka + 2 px `bone` dış halka (iç içe); koyu zeminde `brass-bright` halka. Fare tıklamasında halka görünmez.
- Metin kontrastı ≥ 4.5, büyük metin ≥ 3; arayüz bileşeni sınırı ≥ 3 (giriş alanı: `line-strong` + gölge).
- Dokunma hedefi ≥ 44. Dil `lang` etiketli; `aria-label` TR/EN i18n'den.

## 10. Yerleşim kuralları

### Pazarlama (`/`)
- Bölüm ritmi: koyu hero → kâğıt (sorun) → kum (3 adım) → kâğıt (özellikler) → koyu veya kum (yerel) → kâğıt (fiyat) → kâğıt (SSS) → koyu (son CTA) → footer. Arada en çok 3 çini ayırıcı.
- Hero 100svh'ye kadar; başlık sol hizalı (masaüstü iki sütun: metin + sahne), mobilde metin üstte, sahne altta (kemer maskeli).
- Başlık = tek cümle, bir kelime italik/pirinç. Alt metin ≤ 2 satır. Birincil + ikincil CTA, altında tek satır güven notu (kart yok).
- Gösterim içeriği "örnek görünüm" etiketiyle işaretlenir.

### Randevu akışı (`/{salon}`, `/r/*`)
- Tek sütun, maks. 480 px (masaüstünde ortada bir "bilet" kolonu); üstte salon adı (display-md) ve ilerleme: 3 nokta + berber çizgili ilerleme çubuğu.
- Hizmet kartı: büyük dokunma alanı, ad solda, **süre · fiyat** sağda Fraunces numeral. Seçim: `brand` iç çerçeve + dikiş altı çizgi (mevcut `.booking-option` korunur).
- Saat seçici: 4'lü ızgara, saat Fraunces tabular; seçilince kemer çerçeveli özet kartı belirir.
- Onay: kemer kartı + **Mühür** (imza etkileşim) + "randevunuz sizin" + takvime ekle/iptal bağlantısı.
- Salon rengi: düğme, seçili çerçeve, ilerleme; yüzeyler yine `paper/bone`. Salon rengi düşük kontrastlıysa mevcut kontrast koruması geçerli (metin için `brand-fg`).
- TR/EN anahtarı 1. adımdan itibaren başlıkta görünür.

### Panel (`/panel`)
- Mobil: alt sekme çubuğu (5 öğe, 56 px, aktif öğe `brand` + üst dikiş çizgisi); masaüstü: 240 px sol çubuk, **koyu `ink` zemin**, `on-ink` metin, aktif öğe `ink-3` + solda pirinç şerit.
- İçerik zemini `paper`; sayfa başlığı `display-md`; tablolar `bone` kart içinde, satır 56 px, ayırıcı `line`; sayı sütunları `tnum`. Dokulu zemin yok.
- Bugün ekranı: üstte tek cümlelik özet ("Bugün 9 randevu, ilki 10:00"), altında takvim; rapor rakamları Fraunces numeral.
- Sheet'ler ayrıntı için; modal yığını yok.

### Yönetim (`/admin`)
- Panelin aynısı ama daha yoğun: satır 44, 14 px, sol çubuk `ink-2`. Üst şeritte `clay` ince çizgi "süper yönetici" ayırt edici. Dokular ve kemer yok; bilgi yoğunluğu öncelik.

## 11. Dosya haritası
- `tailwind.config.ts` — token'lar; `app/globals.css` — CSS değişkenleri, `.grain`, `.tile-rule`, `.pole`, `.arch`, `.stamp`, odak halkası.
- `app/layout.tsx` — Fraunces + Instrument Sans (`--font-display`, `--font-body`).
- `components/ui/*` — `Button`, `Field`, `Sheet`, `Toast` (geriye dönük uyumlu) + `kit.tsx` (`Chip`, `Card`, `EmptyState`, `Stamp`, `Eyebrow`) + `icons.tsx`.
- `components/marketing/*` — ana sayfa. `/tasarim` — canlı sistem. `docs/design/prototype/index.html` — tek dosya prototip.
- Fotoğraf: `HeroStage`'in `photoSrc` prop'u salon sahnesini lisanslı bir fotoğrafla değiştirir.
