# Proxy güven sınırı — T146A

Varsayılan `TRUST_PROXY=false`: kullanıcı XFF/X-Real-IP göndererek IP kotasını bölemez. Next Request güvenilir socket peer sunmadığı için doğrudan istekler `unknown` ortak kotasını kullanır. Bu doğrudan mod çok kullanıcılı üretim kurulumu değildir.

Üretimde yalnız Caddy portları yayımlanır. Ayrı, rastgele, en az32karakter `PROXY_SHARED_SECRET` app ve Caddy'de aynı olmalıdır; NEXTAUTH_SECRET ile aynı olamaz. Anahtar `.env` içinde özel kalır, commit/log edilmez. Compose app için TRUST_PROXY=true ayarlar; worker için güven ve proxy anahtarı kapalıdır. Anahtar rotasyonu iki bileşende birlikte yapılır.

Caddy gerçek bağlantı peer'ını `X-Real-IP` olarak yazar ve özel proxy başlığını overwrite eder. Uygulama sadece doğru özel token ve tek geçerli IP'yi kabul eder; XFF zincirini yorumlamaz. Bu token bir kullanıcı kimliği değildir. Key eksik/yanlışsa IP `unknown` olur; portu doğrudan yayımlamamak yine gereklidir. Caddy'den önce CDN/LB eklemek bu sözleşmede otomatik desteklenmez: şu haliyle Caddy onun peer adresini görür, zincir için ayrı güven tasarımı gerekir.

Caddy accesslog filtresi Cookie, Authorization ve proxy token başlığını siler. URL path/query token maskelemesi, HSTS/CSP ve gövde sınırı henüz bu teslimin parçası değildir; T146D açıktır. OTP ve JWT alt maddeleri de T146B/C'de açıktır.

Yerel gerçek proxy testi: derlenmiş uygulama, pnpm helper, Chromium ve resmi Caddy executable gerekir. `CADDY_EXECUTABLE_PATH` ile binary yolu seçilir; `tests/e2e/proxy.cjs` kendine ait loopback3400/3401 süreçleri kurar, rastgele test anahtarı üretir, beş e2e çalıştırır ve yalnız kendi süreçlerini kapatır. `login-dos.cjs` bu harness içinde çalışır. Header ve erişim logu kontrolleri gerçek Caddy'de yapılmıştır; TLS/production dağıtımı yapılmamıştır.


## HTTPS ve gövde sınırı (T146D2a)
Caddy TLS bağlantılarında bir yıllık HSTS başlığı gönderir; HTTP veya sahte X-Forwarded-Proto bunu açmaz. includeSubDomains/preload yoktur. APP_DOMAIN/DNS ve güvenilir sertifika kurulumu mevcut RUNBOOK'a göre operatörün işidir; bu değişiklik üretim yayını yapmaz. Site handler'ı istek gövdesini1048576baytla sınırlar; tam sınır geçer, fazlası Content-Length/chunked fark etmeden413 alır. Yeni büyük upload uçları eklenirse açıkça ayrı değerlendirilmelidir. Doğrudan Next portu bu Caddy sınırını uygulamaz; üretimde appportu yayımlanmamalıdır. CSP, HTML isteklerinde Next middleware tarafından üretilen istek başına nonce ile uygulanır (T146D2b); ayrıntı için CSP.md. HTML nonce üretimini atlayan cache veya response CSP başlığını kaldıran proxy kuralı eklenmemelidir. YerelTLS testi selfsignedfixture ile response/protokolü doğrular; gerçek alan adı CA zinciri doğrulaması değildir.
