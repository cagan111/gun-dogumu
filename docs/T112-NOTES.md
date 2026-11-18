# T-112 — kesinti sonrası mesaj uzlaştırması için inceleme

18 Kasım 2026, Codex alt ajanı tarafından mevcut `send.ts` ve `jobs/*` üzerinde statik inceleme. **Bu belge uygulama veya test teslimi değildir.** T-112 açıktır.

## Doğrulanan açıklar

- `sendMessage` herhangi bir aynı anahtarlı kaydı `duplicate` sayıyor. `queued` kayıt yeniden ele alınmıyor; kredi askıda kalıyor.
- `handleSendReminder` kendi erken `MessageLog` kontrolünde aynı hatayı yineliyor. Merkezi gönderim düzeltilse bile bu erken dönüş kaldırılmazsa hatırlatma yeniden denemesi çalışmaz.
- `finish` sahiplik denetlemeden durumu değiştiriyor. Mevcut hata yolu durum geçişini kazanıp kazanmadığına bakmadan iade ediyor. Uzlaştırıcı ve gecikmiş işçi birlikte çalışınca çift iade veya son durumun ezilmesi engellenmeli.
- Ücretsiz WhatsApp/e-posta yolları ve `sendTenantEmail` da `queued` kayıt bırakabilir.
- OTP kaydının mesaj içeriği maskelidir; buradan geçerli OTP tekrar üretilemez. Kurtarma uğruna düz kod saklanmamalı.

## Önerilen küçük uygulama

`MessageLog` için `leaseOwner`, `leaseUntil`, `dispatchStartedAt` alanları ve `(status, leaseUntil)` indeksi ekle. Eski `queued` kayıtları süresi dolmuş ve gönderim durumu belirsiz kabul et; eski satırdaki boş gönderim işareti gönderilmediğinin kanıtı değildir.

1. Önce tenant satırını kilitle; kredi rezervasyonu, mesaj kaydı ve rastgele sahiplik belirteci aynı transaction içinde oluşsun. Aynı anahtarlı terminal kayıt yinelenen sonuç döndürsün; canlı sahiplik yeniden gönderilmesin.
2. Sağlayıcı çağrısından hemen önce `queued + leaseOwner` koşuluyla `dispatchStartedAt` yaz. Sahipliği kaybeden süreç ağa çıkmasın. Ağ çağrıları süreyle sınırlandırılsın; normal zaman aşımı sahiplik süresinden kısa olsun.
3. Başarı ve hata sonuçları sahiplik belirtecini koşullu güncellemede eşleştirsin. Hata/iade transaction'ında tenant kilidi altında önce durum geçişini kazan; yalnız kazanan bir kez iade yazsın. Gecikmiş işçi terminal kaydı ezemesin.
4. Başlangıçta ve pg-boss üzerinden dakikalık, sınırlı partili uzlaştırma çalışsın. Eşzamanlı uzlaştırıcılar aynı koşullu geçişle korunmalı. Ücretsiz kanalların da askıda kalması giderilsin.
5. Hatırlatma, taşıma ve iptal işlerinin mevcut güncel randevu kontrolleri korunsun. Yeniden deneme bu kontrolleri atlayarak eski bir hatırlatmayı göndermesin.

## Çöküş belirsizliği kararı önerisi

Yeni kayıt için, gönderim işareti yazılmadan gerçekleşen kesinti gönderimin başlamadığını kanıtlar: rezervasyon bir kez iade edilip kayıt kapatılabilir; yeniden deneme gerekiyorsa özgün iş güncel kuralları tekrar okuyarak sahiplenmelidir. OTP için maskeli içerikten tekrar gönderim yapılmaz; kullanıcı yeni kod ister.

İşaret yazıldıktan sonraki kesinti veya eski `queued` kayıt **belirsizdir**: sağlayıcı kabul etmiş olabilir. Mevcut sağlayıcılar ortak bir idempotency/teslim sorgusu sözleşmesi sunmuyor. Bu durumda otomatik tekrar gönderme; kaydı `failed`, nedeni `delivery_unknown` olarak kapatıp rezervasyonu yalnız bir kez iade et. Sağlayıcı kabul etmişse maliyeti uygulama üstlenir. Kullanıcı kredisi askıda kalmaz ve kör tekrar gönderim engellenir; **tam bir kez teslim garantisi verilmez**. Sağlayıcıya özgü doğrulanmış idempotency veya teslim sorgusu ileride ayrı eklenebilir.

## Önce yazılacak regresyonlar

- Rezervasyon sonrası/işaret öncesi kesinti: gönderim yok; süre bitince bir iade; iki uzlaştırıcı da çalışsa çift iade yok.
- Sağlayıcı kabulü sonrası/başarı kaydı öncesi kesinti: tek sağlayıcı çağrısı; belirsiz terminal durum + bir iade; yeniden deneme ikinci mesaj üretmez.
- Canlı sahipliğe başka işçi dokunamaz; süresi dolmuş sahipliğin geç yanıtı yeni terminal durumu ezemez.
- Hatırlatma işindeki erken yinelenme kontrolü kurtarmayı atlamaz; taşınmış/iptal edilmiş randevu tekrar gönderilmez.
- Maskeli OTP ve ücretsiz kanal kayıtları güvenli kapanır; tenantlar arası anahtar çakışması başka salona ait kaydı sahiplenmez.

Kapsam: sonraki görev için tasarım notu. Şema, gönderim kodu ve işçi bu incelemede değiştirilmedi; yeni test çalıştırılmadı.

## Son uygulama — 18 Kasım 2026
İlk statik taslak yukarıdadır; artık recovery.ts/send.ts ve worker integrasyonu ile T112 uygulandı. Otomatikyenidengönderim yerine tek iade+terminalfailed politikası seçildi. Yeni10gerçekDBtesti ve tamCI251/build/dört e2e geçti; sağlayıcıgerçekteslim testiyok. Root ve tekLuna incelemesi docs/REVIEW içinde.
