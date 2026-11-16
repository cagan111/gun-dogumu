# İlerleme günlüğü

## 2026-11-16
- Repo (dal) açıldı, belgeler ve görev panosu yazıldı.
- M1 iskeleti başladı (Claude).
- T-010/T-011/T-012/T-014: saat dilimi yardımcıları, müsaitlik motoru, rezervasyon (transaction + exclusion yakalama, iptal kuralı) ve telefon doğrulama tamam (Claude).
- T-080/T-030/T-031/T-065/T-013/T-015/T-016: hız sınırı, HTTP hata eşlemesi, Auth.js v5 + middleware, kayıt/slug-check, ilk süper-admin, public API, iptal ve OTP "Randevularım" API'leri tamam; tenant izolasyonu DB testiyle kanıtlandı (Claude).
- T-033/T-035/T-037/T-039/T-041/T-060/T-062/T-063/T-064: panel API (randevu, hizmet/personel/saat/izin, müşteri, ayarlar, SMS defteri, rapor), süper-admin API (ödeme, kredi, plan fiyatı, gelir, audit), abonelik durum makinesi ve ödeme sağlayıcı arayüzü tamam; 53 yeni test (Claude).

## 2026-11-17
- M4 bildirimler tamam: mesaj sağlayıcıları (+ALLOW_REAL_SMS kapısı), segment hesabı, şablonlar, kredi düşümü/iade/aylık kredi, pg-boss işleri (`pnpm worker`), WhatsApp/e-posta yedekleme, kampanya, OTP/sihirli bağlantı bağlantıları, askıda panel yazma engeli ve panel AuditLog; 77 yeni test (Claude).
- T-006/T-017–T-020/T-032/T-070–T-072: seed, i18n (tr/en), 4 adımlı mobil randevu akışı + `/r/[token]` + Randevularım, giriş/kayıt sihirbazı, ana sayfa ve hukuk taslakları tamam; `node tests/e2e/booking.cjs` 375×812 başsız kontrolü yeşil (panel/admin yalnız yer tutucu).
- T-034/T-036/T-038/T-040/T-042/T-061: salon paneli (takvim gün/hafta + sürükle-bırak, hizmet/personel/saat/izin, müşteri, ayarlar+SMS+kampanya, rapor) ve süper-admin (salonlar, ödeme, kredi, SMS talepleri, fiyatlar, denetim) arayüzleri tamam; `node tests/e2e/panel.cjs` başsız kontrolü yeşil (Claude).
