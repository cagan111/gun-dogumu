# İnsanın yapması gerekenler

- [ ] GitHub'da `kibris-randevu` reposu aç; `claude/kibris-randevu` dalı oraya taşınacak.
- [ ] VPS (Ubuntu, 2 GB RAM yeterli) ve alan adı al; `APP_DOMAIN` DNS A kaydı sunucuya.
- [ ] SMS sağlayıcı hesabı aç (Netgsm / İleti Merkezi veya KKTC Turkcell/Telsim kurumsal toplu SMS); SMS başlığı onayı; KKTC numaralarına teslimatı test et.
- [ ] WhatsApp Business (Meta) doğrulaması ve mesaj şablonu onayları.
- [ ] Şirket/vergi kaydı (KKTC), fatura düzeni.
- [ ] Gizlilik politikası, kullanım koşulları, aydınlatma metni: KKTC 89/2007 sayılı yasaya göre avukata kontrol ettir.
- [ ] iyzico/PayTR üye işyeri başvurusu (ileride).
- [ ] E-posta sağlayıcı (SMTP/Resend) hesabı: üretimde gerçek sağlayıcı yokken sihirli giriş kapalıdır. Auth URL/token loglanmaz; yalnız ilk superadmin şifre kurulum bağlantısı istisnadır (T-110).
- [ ] Gerçek `Dockerfile`'ı internet erişimli bir makinede bir kez `docker compose build` ile doğrula (sandbox'ta apt/Debian deposu engelliydi; yerelde yalnız `node:22-bookworm` tabanlı eşdeğeri derlendi). Sonra VPS'te `docs/RUNBOOK.md` adımlarını ve geri yükleme provasını uygula.
- [ ] GitHub Actions workflow'u (`.github/workflows/ci.yml`) repo GitHub'a taşınınca ilk çalıştırmada yeşil mi bak.

- [ ] Gerçek salon sahiplerinden izinli kısa yorumlar/alıntılar topla (ana sayfada kullanılacak; o zamana kadar alıntı yok).

- T-122 medya: izinli stok siteleri bu ortamda403 döndü. Gerçek berber POV (giriş/koltuk/örtü) veya en yakın uygun klip seçilip lisansı/üreticisi doğrulanmalı; `config/hero.ts` desktop/mobile yolları ve `docs/LICENSES.md` güncellenmeli. Geçici poster kodla üretilmiş SVG degrade/dokudur; fotoğraf değildir. Sonradan sahibin kendi çekimiyle değiştirilebilir. Gerçek video ve üç karesi henüz yok.
