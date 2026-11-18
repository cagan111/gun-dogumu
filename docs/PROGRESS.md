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
- T-007/T-008/T-081–T-084 + 40P01 kilitlenme kökü (sendMessage kilit sırası), staff yetki sıkılaştırması, mobil takvim cilası: Docker (compose app+worker+db+caddy+yedek, sandbox'ta ayağa kalktı), CI workflow, RUNBOOK, `flow.cjs`/`isolation.cjs` e2e yeşil; 225 test (Claude).

## 2026-11-18 — Codex (bu sohbet)
- T-100R 7bdbfdd remote teslim edildi; Claude PR6987735407 ile onayladı (Claude kendi CI227/227 sonucunu bildirdi). Bu sohbet CI227/227+build+booking/panel+odak kontrollerini çalıştırdı.
- T-122 ara sürüm44221ea remote; gerçek video seçilmedi. Bu sohbet CI229/229+build+booking/panel ve390/1280 poster/reduced-motion/taşma kontrolü yaptı. Ekran kanıtları docs/evidence/T122; gerçekvideo/üçkare eksik. Alt ajanlar hero tarayıcı regresyonu, T110+119 ve T111 üzerinde ayrık dosyalarda çalışıyor; henüz teslim sayılmaz.
- Son toplu CI241/241; hero gerçekChromium7/7. auth_security karşılıklı incelemesinde önemli hata bulunmadı. T111 günlük30segment/60s bekleme regresyonları gerçek PostgreSQL üzerinde18/18 (yeni5+mevcut13); tam üretim build/son e2e sonucu takip ediliyor.
- Son paket üretim build PASS; booking/panel/flow/isolation e2e PASS,390/1280 gerçek sayfa poster/azaltılmış hareket/taşma PASS. Gerçek SMS gönderilmedi. T112 inceleme notu hazır; uygulanmış kod değildir.

- 2026-11-18 T112/T123 root+tekLuna: ilk4/4regresyon kırmızı, sonCI251/251+build yeşil. Lease120sn/fencedrefund/workercron ve nötrTR+EN başlık hazır. Dört e2e sonkoşusu teslimden önce tamamlanır; gerçekSMS yok.
- T112/T123 son booking/panel/flow/isolation e2e tamamı PASS; gerçek mock ortam.
- T112/T12385d65cf Claude6988727859 ile onaylandı (Claude ayrıca CI251 bildirdi). T113partialindex+legacycleanup root/Luna teslimi: CI254/build+booking/flow/isolationPASS; gerçekSMS yok.

- 18Kasım21:52UTC: çalışma ortamı yenilenmiş, önceki/workspace/work dizini yoktu. Güncel923b6a0 yenidenclone edildi; pnpm+Postgres16+migration+seed yenidenkuruldu. T114 yerelteslim tamamlandı: CI257/build/panel-flow-isolationPASS; remoteöncesi rebase güncel. T140audit yeniden doğrulandı:8kritik20yüksek, sıradaki iş.
- T140: prod audit8kritik20yüksek22orta3düşük→0tümseviyeler; CI257/build ve booking/panel/flow/isolationPASS. Panel ilkkoşuda güngeçişiyle seedrandevuları eski günde kaldı; seed güncellenince geçti, ürünkodu/test gevşetilmedi. sharpnative libvips yükleme kontrolü geçti. T141HTTPSregresyonları ayrıhazır (henüz düzeltme yok).
