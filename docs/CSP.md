# CSP işletim sınırı

HTML sayfalarının CSP başlığı Next middleware'den gelir; Caddy bunu iletir. Nonce128bit crypto random ve her istekte yenidir, istemci başlığından alınmaz. Next betikleri request CSP'sinden nonce çıkarır; JSON-LD aynı güvenilir x-nonce'u alır. Root dynamic render zorunludur; HTML'yi public cache'e alma veya CSP başlığını silme. Next static asset cache'i bu kısıt değildir.

Üretim script politikası nonce+strict-dynamic'tir; unsafe-inline/eval yoktur. Trusted scriptlerin dinamik yüklediği betiklere güven aktarımı CSP3 davranışıdır, CSP güvenilir kod içindeki bütün gadget/XSS sınıflarının çözümü değildir. React inline stilleri ve mevcut HTTPS salon görselleri korunur. API ve Nextstatic/image/favicon CSP middleware matcher'ına girmez; bu API yetkilendirmesini değiştirmez. Geliştirme modunda eval/WebSocket izinleri vardır, production testleri bunların prod'da olmadığını denetler.

Doğrulama: pnpm run ci + pnpm build, ardından tests/e2e/proxy.cjs. csp.cjs gerçek Chromium ile nonce/HTMLparser enjeksiyonu/Next client navigation/JSON-LD/404 kontrol eder; test yalnız yerel zararsız marker kullanır. Yeni inlinebetik veya dış script/bağlantı eklemeden politika ve tarayıcı regresyonu birlikte değerlendirilmelidir.
