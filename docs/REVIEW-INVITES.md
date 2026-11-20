# Yorum daveti — T105a/b1 altyapı

T105 henüz tamamlanmadı. API ayarları, ilk tamamlanma zamanı ve uygun ilk geçişle atomik intent hazırdır. Otomatik yorum SMS’i, yeni worker/kuyruk işi veya panel kontrolü henüz yoktur. `reviewInviteEnabled=true` bu aşamada saklanan tercihtir; teslim/gönderim sonucu değildir.

## Ayarlar

Yeni ve mevcut salonlarda `reviewInviteEnabled=false`, `reviewInviteUrl=null` varsayılandır. Owner mevcut `/api/panel/settings` PATCH servisiyle tercihi kaydedebilir; staff yazamaz. Etkinleştirme için geçerli URL gerekir. URL’yi temizlemek, aynı istekte özellik kapatılmadıkça reddedilir. Kısmi güncellemeler tenant kilidi altında mevcut değerle birleştirilir; etkinlik/URL çifti ve audit aynı transaction’da yazılır. Askı durumu kilit altında yeniden kontrol edilir; auth sırasında aktif görülen ama sonra askıya alınan salon yazamaz. DB CHECK yalnız enabled→nonnull URL bütünlüğünü de korur; uygulama URL doğrulamasının yerini tutmaz.

Yalnız şu doğrudan Google yorum biçimleri kabul edilir:

- `https://search.google.com/local/writereview?placeid=ChIJ_fixture-1`
- `https://g.page/r/C_fixture-1/review`

Örnekler biçimi gösterir, gerçek işletme/onay değildir. Dış boşluklar şemada kırpılır. HTTPS, tam host/path, tek placeid parametresi veya g.page review yolu gerekir; kullanıcı/parola, alternatif port, fragment, redirect wrapper, yabancı host ve ek/çift sorgu parametresi reddedilir. Sunucu URL’yi çağırmaz veya yönlendirmesini izlemez. Google işletme sahipliği/hesap onayı bu doğrulamayla kanıtlanmaz.

## Tamamlanma zamanı

Appointment.completedAt ilk gerçek `completed` durum geçişinde sunucu zamanı ile, mevcut status compare-and-set güncellemesi içinde kaydedilir. Tekrar aynı durum veya confirmed→completed tekrarları ilk zamanı değiştirmez. İptal/yeniden açma zamanı silmez. Eski completed/null kayıtlara tahmini tarih doldurulmaz; migration bir toplu mesaj veya kuyruk backfill’i yapmaz. `completedAt` yalnız geçiş bilgisidir; tek başına mesaj izni veya gönderim intent’i değildir.

Migration `20261120100000_review_invite_settings` yalnız yerel test DB’sine uygulandı; yeni uygulamadan önce uygulanması gerekir. Üretim deploy yapılmadı.

## Açık T105b/c

T105b2, varolan intent için worker/kuyruk onarımı, max(completedAt, endsAt) sonrası gecikme/sessiz saat, güncel verified marketing consent, iptal/yeniden açılma, salon ayarı/askı, URL, kredi ve gönderim anı kontrollerini tamamlamalıdır. Eski tamamlanmaları otomatik tarayıp pazarlama gönderimine çevirmek bu temel ayarla yetkilendirilmez. T112 delivery_unknown için kör replay/ikinci iade yok; T142 ülke ve immutable telefon/tenant bütçeleri randevu bağlantılı davetlere de uygulanır. T116 kampanya hold/debit yolu burada yeniden kullanılmaz; çift debit/refund yapılmaz. Aynı randevu için ayar/URL/durum değişikliği yeni gönderim hakkı sayılmaz; exactly-once teslim iddiası kurulmaz.

T105c panel TR+EN açık opt-in/Google URL ve gönderim maliyeti açıklamasını ekler. İşleyici hazır olmadan kullanıcı arayüzünde teslim/gönderim vaadi sunulmaz.

Testler: şema pozitif alan ekleme eski kodda FAIL; gerçek DB owner/partial merge yarışları/defaultoff/ilk timestamp/MemoryQueue, stale auth→suspension regresyonu FAIL→fix; gerçek Auth.js+HTTP ayarlar/status akışı ve tüm booking/panel/flow/isolation paketi. MemoryQueue sürekli worker veya pg-boss davet tüketimi testi değildir. Gerçek Google hesabı veya SMS gönderimi yoktur.

## T105b1 kalıcı intent

Yalnız ilk completed geçişinde (önceki completedAt null), tenant kilidi ve status UPDATE’in satır kilidi altında intent oluşturulur. UPDATE sonrası randevu yeniden okunur; eşzamanlı taşıma önce tamamlandıysa gerçek güncel endsAt kullanılır. Tenant ayarı açık, URL geçerli, salon askıda değil, müşteri rızası true ve marketingConsentAt dolu, telefon kanonik olmalıdır. İzin zamanı tek başına kimlik kanıtı değildir; mevcut T144 opt-in yazma sınırı yalnız doğrulanmış müşteri servisine aittir. Legacy true/null ve geçersiz URL hiçbir intent oluşturmaz.

ReviewInvitation, tenant/appointment/customer ID ile kanonik alıcıyı, Google URL’sini ve completedAt değerini dondurur. dueAt=max(completedAt,endsAt)+2saat, expiresAt=dueAt+24saat’tir. Expiry şu anda metadata’dır; b1 periyodik sonlandırıcı veya gönderim başlatmaz. Appointment unique + boş-update upsert eski kaydı canlandırmaz. Ayar/rıza sonradan açıldığında geçmiş tamamlanmaya kayıt eklenmez; tekrar completed/reopen-recomplete yeni hak sayılmaz.

Randevu completed dışına geçince, müşteri rızasını geri çekince veya yorum ayarı kapatılınca/URL değişince pending intent aynı tenant kilidi altında kalıcı skipped olur. Kaydın ilk alıcı/URL/tarih snapshot’ı korunur; opt-in/config geri dönüşü canlandırmaz. Capture DB hatası completion ve ilk zamanını da geri alır. Intent kredi hold’u veya debit değildir; b1 MessageLog, SMS defteri veya kuyruk işi oluşturmaz.

Yeni model scoped tenant allowlist’indedir; public/generic intent HTTP endpointi eklenmez. İlişki ID’leri scoped appointment/customer okumalarından türetilir; mevcut scalar-FK/service-validation sınırı ve RLS olmama durumu değişmez. Tablo `20261120110000_review_invitation_intents` migration’ıyla yalnız yerel DB’ye uygulandı. Yeni sürümden önce migration gerekir; karışık eski/yeni API/worker örnekleriyle gönderim politikası cutover’u yapılmış sayılmaz.

b1 yalnız pending kayıtları kapatır, processing/finished durumuna geçmez. b2 claim sırasında debit+MessageLog bağlantısını atomik kurmalı; provider sınırından önce startDispatch altında güncel intent/consent/status/settings/URL/phone/tenant kontrolü ve unstarted iptal+tek refund’u tamamlamalıdır. Processing kaydın pending-only skip ile durduğu varsayılmaz. Başlamış gönderim geri çağrılamaz; delivery_unknown kör tekrar edilmez. Sender onayı/T142 ülke ve immutable attempt bütçeleri korunur; T116 kampanya hold’u kullanılmaz.

Doğrulama: datastore hazır ama eski capture koduyla ilk intent null ve scoped PG INSERT fault testi resolved kaldığı için2FAIL/1PASS→capture fix. Fault trigger yalnız kendi UUID fixture tenant’ında hata üretir ve finally kaldırılır; gerçek DB servisi kesilmez. FinalCI407/build/Caddy15e2e; gerçek HTTP tamamlanma + trusted fixture consent servisi ile1intent, reopen/recomplete sonrası aynı skipped ID ve0message/0ledger doğrular. Bu test yeni OTP doğrulaması, pg-boss review consumer yaşam döngüsü veya fiziksel SMS testi değildir.
