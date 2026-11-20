# Yorum daveti — T105a temel yapılandırma

T105 henüz tamamlanmadı. Bu parçada yalnız API ayarları ve ilk tamamlanma zamanı hazırdır. Otomatik yorum SMS’i, yeni worker/kuyruk işi veya panel kontrolü eklenmez. `reviewInviteEnabled=true` bu aşamada saklanan tercihtir; teslim/gönderim sonucu değildir.

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

T105b, yalnız uygun tamamlanma için kalıcı tek davet intent’i/kuyruk onarımı, max(completedAt, endsAt) sonrası gecikme/sessiz saat, güncel verified marketing consent, iptal/yeniden açılma, salon ayarı/askı, URL, kredi ve gönderim anı kontrollerini tamamlamalıdır. Eski tamamlanmaları otomatik tarayıp pazarlama gönderimine çevirmek bu temel ayarla yetkilendirilmez. T112 delivery_unknown için kör replay/ikinci iade yok; T142 ülke ve immutable telefon/tenant bütçeleri randevu bağlantılı davetlere de uygulanır. T116 kampanya hold/debit yolu burada yeniden kullanılmaz; çift debit/refund yapılmaz. Aynı randevu için ayar/URL/durum değişikliği yeni gönderim hakkı sayılmaz; exactly-once teslim iddiası kurulmaz.

T105c panel TR+EN açık opt-in/Google URL ve gönderim maliyeti açıklamasını ekler. İşleyici hazır olmadan kullanıcı arayüzünde teslim/gönderim vaadi sunulmaz.

Testler: şema pozitif alan ekleme eski kodda FAIL; gerçek DB owner/partial merge yarışları/defaultoff/ilk timestamp/MemoryQueue, stale auth→suspension regresyonu FAIL→fix; gerçek Auth.js+HTTP ayarlar/status akışı ve tüm booking/panel/flow/isolation paketi. MemoryQueue sürekli worker veya pg-boss davet tüketimi testi değildir. Gerçek Google hesabı veya SMS gönderimi yoktur.
