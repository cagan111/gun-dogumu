# Üçüncü taraf varlık lisansları

## Ana sayfa hero videosu — durum: SEÇİLMEDİ (kod hazır, `config/hero.ts` → `heroVideo = null`)
Sahibin istediği çekim: müşteri gözünden (POV) berbere girme / koltuğa oturma / berberin pelerini boğaza geçirmesi; sıcak, sinematik; marka logosu ve okunur tabela yok.
Arama 2026-11-17'de yapıldı. Pexels ve Pixabay otomatik istemcilere bot doğrulaması (Cloudflare) gösterdi (403); doğrulama aşılmadı. Yalnız Mixkit erişilebildi (Mixkit Free License: ücretsiz ticari kullanım). Aşağıdakiler **aday**; hiçbiri POV değil, bu yüzden hero'da kullanılmadı:

| Aday | Sayfa | Dosya | Not |
|---|---|---|---|
| aday 1 | https://mixkit.co/free-stock-video/barber-putting-on-cape-for-haircut-43240/ | https://assets.mixkit.co/videos/43240/43240-720.mp4 (720×1280, 11.3 sn, 3.8 MB) | Konu en yakını (pelerin takma), dikey, karanlık; sol üstte klima üzerinde silik marka yazısı; döngü değil |
| aday 2 | https://mixkit.co/free-stock-video/client-comes-to-a-barbershop-40605/ | https://assets.mixkit.co/videos/40605/40605-720.mp4 (1280×720, 15 sn, 5.3 MB) | Neon/parti havası, arka planda okunur yazılar; tonu uymuyor |
| aday 3 | https://mixkit.co/free-stock-video/barber-showing-the-haircut-to-his-client-43233/ | (sayfadan -720.mp4) | Aynada sonucu gösterme; incelenmedi |
| aday 4 | https://mixkit.co/free-stock-video/close-up-of-a-man-getting-a-haircut-43243/ | (sayfadan -720.mp4) | Yakın plan; incelenmedi |

Seçildiğinde buraya yazılacak: klip URL'si, yazar, lisans, indirme tarihi. Kullanım: dosyaları `public/hero/` altına koyup `config/hero.ts` içindeki `heroVideo` sabitini doldurun (1280 px MP4 ≤ 2.5 MB, isteğe bağlı 720 px mobil sürüm, poster JPG).

## Yazı tipleri
- Fraunces — SIL Open Font License 1.1 (Google Fonts, next/font ile servis edilir).
- Instrument Sans — SIL Open Font License 1.1 (Google Fonts, next/font ile servis edilir).

## Görseller
- Hero sahne A (berber illüstrasyonu), kıbrıs haritası, ikonlar: bu depo için kodla özgün çizildi; üçüncü taraf telif yok.
