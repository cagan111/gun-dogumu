# Codex çalışma kontrol noktası — 2026-11-18

Aktif proje KıbrısRandevu; repo cagan111/gun-dogumu, yalnız claude/kibris-randevu dalı. Eski Son Ateş talimatları bu site görevine uygulanmaz. Kullanıcı alt ajanlarla çalışmayı, testli küçük Türkçe commit/push ve PR1 üzerinden Claude'a teslimi, ardından zamanlanmış devamı yetkilendirdi.

## Gerçek teslimler
- 7bdbfdd T100R: sıcak salonbrand/focus-visible; Claude6987735407 onayı.
- 44221ea T122 ara medya yuvası/arka plan/onay animasyonu.
- f3e0c3a T110+119: production magic-link kapısı ve auth log gizliliği, Pino bağlam düzeltmesi. PR6988145153 teslim kaydı.
- T122 final cila/medya regresyonu ve T111 rezervasyon bütçesi bu kontrol noktasının commit'leriyle teslim edilir; gerçek remote SHA'yı her çalışmada git/connector üzerinden doğrula.

## Sonraki sıra
T112 → T113 → T114 → T115 → T116 → T117 → T118 → T104 → T105. docs/TASKS ve en yeni Claude PR mesajı öncelikli. T112-NOTES.md yalnız taslak inceleme, uygulanmış sayılmaz. T113 tenant kilidine ek tek unused OTP partialuniqueindex+legacyduplicatecleanup+paralleltest gerekir.

## Ortam ve doğrulama
Çalışma dizini /workspace/work/kibris-randevu. pnpm10 helper /tmp/kr-pnpm; yoksa packageManager ile yeniden kur. PostgreSQL16 docker kibris-dev-db, gerçek yerel DB; .env gitignore, asla yazdırma. SMS_PROVIDER mock ve ALLOW_REAL_SMS false kalmalı. Üretim sunucusu3000, JOBS_QUEUE=pgboss. Başka süreçleri rastgele sonlandırma. E2E: NODE_PATH=/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules, CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium. Signup IP limit5/h; aynı suite tekrarında yalnız bizim appserverı yeniden başlat.

Son paket CI241/241 ve build geçti; booking/panel/flow/isolation ve390/1280 sonkontroller çalıştırılır. Medya harness7/7 gerçekChromium, sentetik1sn küçük test klibi yalnız/tmp, ürünvideosu değildir. docs/evidence/T122 önce/sonra390/1280. Gerçekvideo/lisans/üçkare halen eksik; Claude kodlaSVGposter alternatifini kabul etti, TODO_INSAN açık.

## Devam kuralları
Önce PR1 son yorumları/remote head/AGENTS ve gerekli proje belgelerini oku; kilit ve çalışma ağacını doğrula. Başka aktörün aktif dosyasına girme; kendi PRyorumuna cevap döngüsü kurma. Alt ajanlar bu sohbetin işçileridir, Claude veya ayrı GitHubCodexbotu değildir. Güvenlikte önce başarısız regresyon testi, sonra düzeltme; tam CI+build+ilgili e2e olmadan tamamlandı deme. docs TASKS/REVIEW/PROGRESS ve SHA ile PR teslimi. GerçekSMS/ücretliAPI/sırcommit/yapaymüşteriyorumu yok; merge/deploy yok. Bekleyen yeni görev yoksa onaylı sıradaki kilitsiz işi ilerlet; anlamsız ping üretme. Kota/ortam engelini kanıtıyla yaz. Her tetikte sınırlı somut çıktı, aktif çalışma varsa ikinci yürütme başlatma. Tüm kapsam bittiğinde sonözet ve zamanlanmış görevi kapat.
