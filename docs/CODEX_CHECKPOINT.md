# Codex çalışma kontrol noktası — 2026-11-18

Aktif proje KıbrısRandevu; repo cagan111/gun-dogumu, yalnız claude/kibris-randevu dalı. Eski Son Ateş talimatları bu site görevine uygulanmaz. Kullanıcı alt ajanlarla çalışmayı, testli küçük Türkçe commit/push ve PR1 üzerinden Claude'a teslimi, ardından zamanlanmış devamı yetkilendirdi.

## Gerçek teslimler
- 7bdbfdd T100R: sıcak salonbrand/focus-visible; Claude6987735407 onayı.
- 44221ea T122 ara medya yuvası/arka plan/onay animasyonu.
- f3e0c3a T110+119: production magic-link kapısı ve auth log gizliliği, Pino bağlam düzeltmesi. PR6988145153 teslim kaydı.
- T122 final cila/medya regresyonu ve T111 rezervasyon bütçesi bu kontrol noktasının commit'leriyle teslim edilir; gerçek remote SHA'yı her çalışmada git/connector üzerinden doğrula.

## Sonraki sıra
T114 → T115 → T116 → T117 → T118 → T104 → T105. docs/TASKS ve en yeni Claude PR mesajı öncelikli. T112 artık recovery.ts/send/jobs ile uygulanmıştır; T112-NOTES.md tarihli ilk taslak ve son uygulama notunu birlikte oku. T113 tenant kilidine ek tek unused OTP partialuniqueindex+legacyduplicatecleanup+paralleltest gerekir.

## Ortam ve doğrulama
Çalışma dizini /workspace/work/kibris-randevu. pnpm10 helper /tmp/kr-pnpm; yoksa packageManager ile yeniden kur. PostgreSQL16 docker kibris-dev-db, gerçek yerel DB; .env gitignore, asla yazdırma. SMS_PROVIDER mock ve ALLOW_REAL_SMS false kalmalı. Üretim sunucusu3000, JOBS_QUEUE=pgboss. Başka süreçleri rastgele sonlandırma. E2E: NODE_PATH=/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules, CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium. Signup IP limit5/h; aynı suite tekrarında yalnız bizim appserverı yeniden başlat.

Son T112/T123 paketi CI251/251 ve build geçti; booking/panel/flow/isolation dört e2e geçti. Gerçekworker açılışı ve dakika cron DB kaydı doğrulandı. Yeni10DBtesti kesinti/tek iade/leasefence/legacyfree/belirsizkanal yollarını kapsar. Medya harness7/7 gerçekChromium, sentetik1sn küçük test klibi yalnız/tmp, ürünvideosu değildir. docs/evidence/T122 önce/sonra390/1280. Gerçekvideo/lisans/üçkare halen eksik; Claude kodlaSVGposter alternatifini kabul etti, TODO_INSAN açık.

## Devam kuralları
Önce PR1 son yorumları/remote head/AGENTS ve gerekli proje belgelerini oku; kilit ve çalışma ağacını doğrula. Başka aktörün aktif dosyasına girme; kendi PRyorumuna cevap döngüsü kurma. Alt ajanlar bu sohbetin işçileridir, Claude veya ayrı GitHubCodexbotu değildir. Güvenlikte önce başarısız regresyon testi, sonra düzeltme; tam CI+build+ilgili e2e olmadan tamamlandı deme. docs TASKS/REVIEW/PROGRESS ve SHA ile PR teslimi. GerçekSMS/ücretliAPI/sırcommit/yapaymüşteriyorumu yok; merge/deploy yok. Bekleyen yeni görev yoksa onaylı sıradaki kilitsiz işi ilerlet; anlamsız ping üretme. Kota/ortam engelini kanıtıyla yaz. Her tetikte sınırlı somut çıktı, aktif çalışma varsa ikinci yürütme başlatma. Tüm kapsam bittiğinde sonözet ve zamanlanmış görevi kapat.

T113 tamam: partialunusedOTPindex+deterministiklegacycleanup transaction/write-lock altında; CI254/build/booking-flow-isolation geçti. T112/T12385d65cf Claude6988727859 onaylı. Sonraki T114kilitlireread abonelik/ödeme yarışıdır. Tekhafifaltajan GPT-6 Luna tercihi kullanıcı tarafından verildi; daha ağır alt model seçme.

## 18Kasım21:59UTC güncel öncelik
T114kilitlireread bu commit ile teslim; CI257/build/panel-flow-isolationPASS. Önceki ortam kaybolduğu için923b6a0 clone+migration+seed tazelendi. SonClaude6991313072/6991469004: T140→T141→T142→T115..118→T143..147→104105→124..129. Koyu/şampanya temayı koru. TekGPT-6Luna altajan. T140audit8kritik20yüksek yenidenölçüldü. Son kaynak ve PRyorumları tüm eski sıra/head notlarını geçersizkılar.
T140 bu commit ile Next15.5.29/Authbeta32/PostCSS8.5.23/sharp0.35.5/Zod4.6.6 teslimidir. Audit0tümseviyeler, CI257/build/dörte2ePASS. T141 sonraki: tests/unit/middleware-cookie.test.ts ayrıuncommittedredtesti gerçekAuth.js encryptedsecurecookie ile2FAIL/1PASS; middleware secureCookieeksik. Bu teste henüzfix yapılmadı; yeniortamda dosyayoksa tekraroluştur. Yeniöncelik T141→T142→T115..118→T143..147→104105→124..129.

T141 bu commit ile tamam: middlewareşema göresecureCookie; CI260/build/HTTPpanel-flow-isolation+yerelgerçekTLSChromiumPASS. T1401e4fb84 prod audit0tümseviyeler; T114402f06f tamam. ÖncekiuncommittedT141rednotu artıkgeçersiz. SıradakiT142→115..118→143..147→104105→124..129. https-session.cjs çalıştırmak için NextAUTH_URL/NEXTAUTH_URLhttpslocalhost3443 ile3000de başlatılır; testkendiTLSproxy3443ünü açıp kapatır. NormaltestiçinsonraappHTTPmodageridöndürülür.

## 19Kasım T142 teslimi — eskiT142bekleme notlarını geçersizkılar
T142 tamam: migration20261119000000_sms_safety, sms-policy.ts, send.ts ve ownerUI. Ülke90default/ownerizinlistesi, tenant200(owner1..2000), globaltelefon6segment/UTCgün; tümrandevularpaneldahil+OTP/kampanyadışını kapsar. Immutableattemptbudget, refundresetlemez. SMS-POLICY.md. CI267/build/dörte2ePASS; panelsettingspersist edildi. Migration yeniappbaşlamadan uygulanmalı; gerçekproductionDB/deployyapılmadı. Önceki iştaslağındaki panelbypass artıkgeçerli değil, sonkodpanelikorur. SıradakiT115→T116→T117→T118→T143..147→T104→T105→T124..129; kaynak/PRdan yeniden doğrula.

## 19Kasım T115+T150 teslimi
T115tamam: cancelByTokenokunanstartsAt+cancelHoursBefore+token/tenant/openstatusCAS; activechanged409+UIrefresh, closedalready_closed, missing404. T150ekUIloadracefix servicesAdddisabledloaderhazırolanadek; flowstaffAPIgateilekanıtlı. SonCI271/build/booking-controlledflow-isolationPASS. GerçekSMS/deployyok. T116-NOTES yalnızsaltokunurplan; uygulanmışsayma. SıradakiT116→117→118→143..147→104105→124..129. Sonhead/PRyorumlarıylagüncelle.

## 19 Kasım T116 — kalıcı kampanya ve kredi rezervasyonu
Bu sohbetin Codex asistanı uyguladı; tek GPT-6 Luna panel TR/EN arayüzü ve salt-okunur karşılıklı incelemeye katkı verdi. Claude ve GitHub Codex botu ayrı çalışanlardır.
Campaign/CampaignRecipient migration ile tenant+UUID işlem anahtarı, sabit metin/footer/segment profili ve rızalı alıcı snapshot kalıcıdır. API hazırlayıp kuyruğa alır; hedefli işçi ve dakikalık sınırlı kurtarma taraması yalnız kalanları işler. Kayıp POST yanıtı/sayfa yenileme aynı anahtarla sürer; farklı içerik aynı anahtarla reddedilir. Güncel rıza/telefon gönderim öncesi tekrar denetlenir.
Muhasebe: hold defter borcu değildir. Harcanabilir bakiye ham defter toplamı eksi kalan hold; normal debit öncesi hold aynı kilitli transaction içinde tüketilir. İptal yalnız harcanmayan hold'u bırakır; gönderilmiş/askıdaki mesajın tek iadesi T112'ye aittir. delivery_unknown otomatik replay edilmez; yalnız interrupted_before_dispatch kanıtlı girişim sınırlı tekrar için yeniden rezerve edilebilir. Askıya alınmış salon sahibi de kalan kampanyasını iptal edebilir; diğer yazma kapıları korunur.
İlk 7 DB regresyonu eski kaynakta başarısızdı; zorunlu anahtar testi ayrıca önce başarısızdı. Son CI283/283 ve üretim derlemesi geçti. Yeni gerçek Chromium kampanya e2e kayıp yanıt/reload/aynı anahtar, bakiye hold, owner/staff yetkisi, suspended iptal, kalıcı worker ve sabit hedef listesini doğruladı. Gerçek SMS veya dağıtım yapılmadı. Migration20261119070000_durable_campaigns yeni uygulamadan önce uygulanmalıdır; yalnız yerel test DB'sinde uygulandı.

T116 son doğrulama: booking/panel/controlled-flow/isolation da PASS. Tek GPT-6 Luna muhasebe/claim/iptal/unknown-replay yollarını salt okunur inceledi; önemli hata bulmadı. Düşük riskli not: aynı mounted ayarlar bileşeninde tenant değiştirme varsayılırsa eski sessionStorage aktif görünümü kalabilir; normal oturumda tenant değiştirme yok, sunucu kapsam/yetki denetimleri uygulanır. Sonraki T117 manuel ödeme idempotency.

## 19 Kasım — T117 manuel ödeme tekrar koruması
Payment üzerinde tenant+UUID benzersizliği, istek özeti (actor/tutar/ay/plan/not) ve ilk sonuç plan/tarih snapshot'ı kalıcıdır. Aynı tenant kilidi altında tekrar ilk sonucu döner; farklı içerik/actor aynı anahtarda409 alır. Yeni ödeme, abonelik uzatma ve audit atomiktir; replay aylık kredi verme çağrısını da tekrarlamaz. Eski Payment satırları nullable alanlarla korunur; küsuratlı kuruş reddedilir.
Süper-admin UI aynı niyetin UUID+payload'ını POST öncesi sessionStorage'a kaydeder, kayıp yanıt/reload sonrası aynı içerikle devam eder; alanlar kilitli, yeni niyet ayrı onay ister. TR+EN sözlükleri güncellendi. İlk4gerçekDBregresyonu eski kaynakta FAIL; son6DBregresyonu ve tamCI289/289PASS. Üretim build ve gerçek Chromium payment/booking/panel/controlled-flow ile HTTP isolation PASS. Payment e2e kayıp yanıt/reload sonrası aynı UUID ve tek Payment/audit/uzatma sonucunu kanıtlar; fixture hatası ve erken assertion beklemeleri düzeltilmiştir, ürün sonucu koşulları gevşetilmedi. Tek Luna backend/schema/migration incelemesinde önemli hata bulmadı. Migration20261119080000_manual_payment_idempotency yalnız yerel DB'ye uygulandı, üretim dağıtımı yapılmadı. Claude7001547607 önceki T114..116 teslimlerini onayladı; bu T117 incelemesi değildir. Tek GPT-6 Luna UI/sözlük sahibi ve karşılıklı inceleyici, root backend/migration/test sahibi.

## 19 Kasım — T118 tenant istemcisinde açık ret
Model/işlem izin listesi: bilinmeyen model/işlem, iç içe ilişki mutasyonu, update/upsert ile tenant değiştirme reddedilir. Tenant kökü id ile, AuditLog tenantId ile kapsanır; kullanıcı yazmaları ve desteklenmeyen global model/ilişki okumaları reddedilir. Ham/unsafe SQL, istemci genişletme, özel iç alanlar ve delegate.$parent erişimi root ve callback transaction içinde kapalıdır; batch transaction desteklenmez.
Mevcut ham SQL kullanımını dar sabit-sorgulu yardımcılar taşır: tenant satır/advisory kilidi bound tenant'ı kontrol eder; aylık advisory anahtarının eski biçimi korunur. T142 global telefon güvenlik toplamı/kilidi bilerek platform kapsamlıdır; sorgu metni kabul etmez. Yetkili global prisma auth/admin/sistem işleri için kalır. Bu değişiklik PostgreSQL RLS veya genel JavaScript sandbox değildir; scalar FK bağlarını servisler mevcut tenant kontrolleriyle doğrular. Tenant-composite FK dönüşümü bu yamanın kapsamına eklenmedi.
İlk8 saf regresyon eski kaynakta FAIL. Delegate parent bypass ek testi önce FAIL, sonra kapatıldı; bir DB fixture eksik city alanı düzeltildi. Son CI303/303PASS; Son üretim build ve booking/panel/controlled-flow/isolation/campaign/payment e2e PASS. Gerçek SMS/dağıtım yok. Claude7002037541 T117'yi onayladı; T118'i onaylamış sayılmaz. Root kod/test sahibi; tekGPT-6Luna salt-okunur inceleme yaptı.

Son Luna incelemesi: User varsayılan okuması ve Staff.user include passwordHash taşıyabileceğinden User scoped istemciden tamamen kaldırıldı; auth/admin global prisma kullanır. User/nested-user erişimi reddedilir. Subscription sistem satır kilidi de sabit lockTenantRow helperına taşındı.

T118 son karşılıklı inceleme: Luna User hash okuma yolunu buldu, root User erişimini tamamen kapattı; Luna tekrar incelemesinde bu yolun kapandığını ve mevcut çağrılarda önemli regresyon görmediğini bildirdi. SonCI303/build ve altı e2e PASS. TENANT-BOUNDARY.md sözleşmesi eklendi; sonrakiT143→144..147→104105→124..129.

## 19 Kasım — T143 giriş yönlendirmesi
safeNext tek slash ile başlayan site içi yolu kabul eder; boşluk/kontrol karakterleri (TAB/LF/CR, C0/C1/DEL) ve ters slash reddedilir, tarayıcı URL ayrıştırmasıyla aynı-origin ayrıca doğrulanır. landingFor istemci sınırında tekrar doğrular; geçersiz hedefte oturum rolüne göre yerel admin/panel hedefi kullanılır. Literal boşluklu yol/query reddedilir, yüzde kodlu boşluk ve geçerli query/hash korunur. Yeni UI metni/tasarım yok.
Önce18regresyonda7FAIL/11PASS; düzeltme sonrası tamCI321/321PASS. Üretim build ve safe-next/booking/panel/controlled-flow/isolation e2e PASS. Gerçek Chromium TAB/LF/CR ile girişin yerelde kaldığını ve geçerli yerel path/query hedefinin korunduğunu doğruladı; dış origin istekleri testte engellendi. TekGPT-6Luna salt-okunur incelemede somut bypass bulmadı; root kod/test sahibi. Claude7005831507 T118 onayını bildirdi; bu T143 onayı değildir. GerçekSMS/dağıtım yok.

T143 tamam; sonraki T144 anonim rezervasyonda müşteri kimliği/rıza ve opt-out → T145..147 → T104105 → T124..129.
