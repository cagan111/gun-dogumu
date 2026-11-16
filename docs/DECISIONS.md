# Kararlar (tarih – karar – gerekçe)

- 2026-11-16 – Kod `cagan111/gun-dogumu` reposunda geçmişsiz `claude/kibris-randevu` dalında – Ayrı repo yok, oturum yeni repo açamıyor; dal sonradan kendi reposuna aynen taşınabilir (TODO_INSAN).
- 2026-11-16 – Çalışma klasörü `/srv/kibris-randevu` değil, oturumun repo klasörü – Bulut kapsayıcısı geçici; kalıcılık git push ile sağlanır.
- 2026-11-16 – Varsayılan saat dilimi `Asia/Famagusta` (salon bazında alan, sabit kodlama yok) – Kuzey Kıbrıs'ın IANA bölgesi; `Europe/Nicosia` güney Kıbrıs'tır ve yaz/kış saatine geçer. Bugün `Europe/Istanbul` ile aynı saati verir.
- 2026-11-16 – Kişisel veri metinleri KKTC 89/2007 sayılı Kişisel Verilerin Korunması Yasası'na göre – Türkiye KVKK'sı KKTC'de geçerli değil.
- 2026-11-16 – SMS segment hesabı sağlayıcıya göre ayarlanabilir (GSM-7 160/153, Türkçe tek-kaydırma 155/149, UCS-2 70/67) – Netgsm gibi sağlayıcılar Türkçe karakteri 155'te taşır; düz "70" fazla kredi düşer.
- 2026-11-16 – Saat dilimi dönüşümleri bağımlılıksız `Intl` yardımcılarıyla (`lib/time.ts`) – Ek kütüphane riskini azaltır, test edilebilir.
- 2026-11-16 – Çift rezervasyon: Postgres `btree_gist` exclusion constraint (personel + zaman aralığı, aktif durumlar) + uygulama içi kontrol – Veritabanı seviyesinde garanti.
- 2026-11-16 – Codex aynı makinede değil; iş bölümü bu repo/PR üzerinden – Ortak sunucu yok.
- 2026-11-16 – Tempo: tek seferde "durmadan" değil, oturum başına dilimler – Sahibin haftalık kullanım limiti.
