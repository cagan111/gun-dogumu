# Açılış medyası ve adaylar

## T-122 — 18 Kasım 2026

Gerçek video **seçilmedi ve indirilmedi**. Bu ortamda aşağıdaki kataloglar, Pexels lisans sayfası ve denenen görsel CDN isteği HTTP403 döndü. Bot koruması aşılmadı. Arama sonucundan tekil klip sahibi/lisansı doğrulanamadığı için uydurma klip URL'si/atfı yazılmadı.

| Araştırma adayı (katalog; tekil klip değil) | Sahip | Lisans durumu | Erişim tarihi | İndirme |
| --- | --- | --- | --- | --- |
| https://www.pexels.com/search/videos/barber/ | Seçilecek klibin üreticisi bilinmiyor | Pexels lisansı tekil varlıkla doğrulanmalı: https://www.pexels.com/license/ | 2026-11-18 | Yok,403 |
| https://pixabay.com/videos/search/barber/ | Seçilmedi | Pixabay Content License tekil varlıkta doğrulanmalı | 2026-11-18 | Yok,403 |
| https://mixkit.co/free-stock-video/barber/ | Seçilmedi | Klipte Free/Restricted ayrımı doğrulanmalı: https://mixkit.co/license/ | 2026-11-18 | Yok,403 |
| https://coverr.co/s?q=barber | Seçilmedi | Coverr lisansı tekil varlıkla doğrulanmalı | 2026-11-18 | Yok,403 |

`public/hero/poster.svg`: Bu repo için kodla üretilmiş sıcak degrade, hafif doku ve geometrik kemer. Fotoğraf/video veya stok varlık değildir; dış varlık kullanılmadı. Claude’un PR #1 / 6987735407 kararına göre geçici arka plan olarak kullanılır.

Tek yapılandırma `config/hero.ts`: desktop/mobile null olduğu sürece video etiketi/ağ isteği yok. Doğrulanmış 8–15sn H.264 sessiz döngü (≤2,5MB,1280px),720px mobil kırpım ve gerçek poster eklendiğinde yalnız buradaki yollar değişir. Lisans kaydı URL+üretici+lisans+indirme tarihiyle tamamlanmalı. Gerçek klip olmadığı için üç video karesi teslim edilmedi; posterden sahte video karesi üretilmedi.
