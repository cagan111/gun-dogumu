# T140 — bağımlılık güvenliği, 18 Kasım 2026

Gerçek `pnpm audit --prod --json` baz çizgisi: 8 kritik,20 yüksek,22 orta,3 düşük. Güncelleme sonrası aynı komut: bütün önem seviyelerinde0. Bu sonuç tarama anındaki kayıtlı advisory'ler içindir; gelecekte açık çıkmayacağı garantisi değildir.

| Yol | Önce | Sonra |
| --- | --- | --- |
| next |15.1.6|15.5.29 (15.x) |
| next-auth |5.0.0-beta.25|5.0.0-beta.32 |
| @auth/core (next-auth üzerinden) | eski auth bağımlılığı |0.41.3 |
| postcss (doğrudan+geçişli) |8.5.1 ve eski Next geçişlisi |8.5.23, pnpm override |
| sharp (Next isteğe bağlı) | eski geçişli |0.35.5, pnpm override |
| zod |3.24.1|4.6.6 |

Next15.5.29 ve authbeta32 resmi npm sürüm metadata'sından doğrulandı. Audit patched-version aralıkları temel alındı; yalnız üst paket değiştirmek Next'in eskiPostCSS ve sharp yollarını açık bırakabildiği için override kilitlendi. Node22 sharp gereksinimini karşılar.

Zod4 geçişinde mevcut kısmi planfiyatı güncellemesinin TypeScript türü daha dar çıktı. `isPlanId` kontrolü runtime'da aynen korunup refine callback dönüşü açık boolean yapıldı; API eskisi gibi yalnız değiştirilen planların gönderilmesini kabul eder. Var olan DBtesti tek `pro` fiyatını güncelleyip null ile kaldırmayı doğrular.

Kontrol: tamCI257test+build; gerçek Chromium/HTTP e2e sonuçları PR teslim notunda. TekhafifLuna ajanı dependencygraph, advisorypatchedfloors ve ZodAPI çağrılarını salt-okunur inceledi; root uyguladı. Gerçek sağlayıcı/gerçekSMS/productiondeployment yapılmadı.
