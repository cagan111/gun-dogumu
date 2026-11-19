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
