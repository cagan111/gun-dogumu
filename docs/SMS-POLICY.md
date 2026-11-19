# T142 — SMS kötüye kullanım sınırları

19 Kasım 2026. Randevu almak, telefon sahipliğini kanıtlamaz. Bu koruma gönderim maliyetini ve hacmini sınırlar; telefon sahibinin kimliğini doğruladığı veya kötüye kullanımı tamamen ortadan kaldırdığı iddia edilmez.

## Kapsam ve ayarlar

- Tüm randevuya bağlı SMS'ler (çevrimiçi, panel ve yürüyerek gelen dahil), OTP ve kampanya dışındaki bildirimler merkezi `sendMessage` kapısından geçer. Panelden oluşturmak korumayı atlatmaz.
- Yalnız randevuya bağlı olmayan kampanya hizmeti bu sınırdan ayrı tutulur; mevcut rol/paket/rıza doğrulaması devam eder. Kampanya rezervasyonu ve yeniden deneme güvenliği T116'dır; henüz tamamlandı sayılmaz.
- Varsayılan izinli ülke arama kodu `90`. Salon sahibi ayarlardan en fazla30 farklı kod seçer (`90, 44` gibi); boş liste bu SMS'leri kapatır. Kodlar telefon metadata'sından alınır, ham önek karşılaştırması kullanılmaz.
- Yabancı numarayla randevu almak engellenmez. Ülke izni yoksa SMS atlanır; alternatif WhatsApp/e-posta da bu engeli dolanmak için denenmez.
- Salon başına varsayılan200segment/UTCgün; sahibi1–2000 arasında ayarlar. Telefon başına platform genelinde6segment/UTCgün, salon değiştirerek aşılmaz. Bir mesaj birden çok segment tüketebilir. Bunlar TRY tutarı değil segment tavanlarıdır.

## Atomiklik

Gönderimden önce normalize edilmiş telefon için transaction advisory lock alınır; sonra mevcut Tenant FORUPDATE kilidi alınır. Ters yönde telefon kilidi alan yol yoktur. Kota, ülke politikası, MessageLog rezervasyonu ve kredi düşümü aynı transaction'dadır. Politika engeli sağlayıcıdan ve kredi düşümünden önce döner; `InsufficientCreditsError` ile karıştırılıp fallback'e girmez.

Global telefon toplamı için yalnız bu güvenilir sistem yordamında açık rawSQL kullanılır. Tenantlara başka salonun kaydı/toplamı döndürülmez; salon toplamı tenant-kapsamlı sorgudur. İndeks recipient/createdAt üstündedir.

`MessageLog.smsSafetySegments` harcanmış girişim bütçesidir: başarısız/iadeli/belirsiz teslimde sıfırlanmaz. Kredi iadesi T112 defter kurallarıyla yapılır; kota iade edilmez. Böylece timeout/refund ile pompalama sınırı yeniden doldurulamaz. UTC yeni gün yeni bütçedir. Migration geçiş gününün eski SMS kayıtlarını muhafazakâr biçimde sayar (en az1segment); eski günler değiştirilmez.

## Doğrulama

İlk4regresyon düzeltmeden önce başarısızdı. Panel kaynaklı atlama için ek test de önce başarısız oldu. Yedi yeni gerçekPostgreSQL testi; ülke/fallback/kredi, iki salon arasında segment ağırlıklı yarış, farklı telefonlarda salon kotası, dispatch anında politika değişimi+OTP, refund+gün değişimi, yabancı gerçekbookPublic kabulü+SMSengeli ve panel yolu kapsamını doğrular.

T112 testlerinin alıcıları testler arası global kota etkileşimi yapmayacak şekilde ayrıldı; kesinti/tek iade assertleri korunur. Panel e2e yeni ülke listesi ve günlük sınırın UI→API→DB→reload kalıcılığını doğrular. Tam CI267test; build ve son e2e sonuçları PRtesliminde kayıtlıdır. Gerçek SMS veya deployment yapılmadı.
