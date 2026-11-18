# Onaylı ek ürün kapsamı — 18 Kasım 2026

Kullanıcı “onları da yap” diyerek önerilen ürün eklerini yetkilendirdi. Bu belge teslim edilmiş özellik değildir. Güvenlik bulguları kapanmadan yeni akışlar yayına hazır sayılmaz; mevcut krem/koyu yeşil/serif, TR+EN ve SMS mock kuralları sürer.

## Hizmet ve personel (T124)
Mevcut ServiceStaff uygunluk ilişkisi yeniden yazılmaz. Önce gerçek UI/API desteği denetlenir. Personel için isteğe bağlı süre/fiyat farkı gerekiyorsa salon hizmet değeri varsayılan olur; müşteri seçimden önce geçerli süre ve toplam fiyatı görür. Rezervasyon fiyatı/süresi snapshot olmalı; sonradan ayar değişince eski randevu değişmemeli. Public müsaitlik, panel oluşturma/taşıma ve raporlar aynı kuralları kullanmalı. Yanlış tenant personeli, eşzamanlı aynı saat ve yaz saati geçişleri test edilir.

## Bekleme listesi (T125)
Salon+hizmet+isteğe bağlı personel+tarih/saat aralığı ve doğrulanmış iletişim. Ayrı açık bildirim rızası, iptal ve süre sonu. Boşluk açılması tek davet üretir; bildirim teslimi T112 güvenli altyapısını kullanır. Davet kesin rezervasyon değildir; müsaitlik ve fiyat onayda yeniden doğrulanır. Yarışta yalnız bir rezervasyon kazanır. Mesaj sayısı/kredi sınırı, mükerrer olay, izin iptali ve tenant izolasyonu test edilir. Varsayılan kapalı; gerçek SMS gönderilmez.

## Müşteri taşıma (T126)
Var olan panel taşıma ve rezervasyon motoru paylaşılır. Müşteri tokenı salon/randevuya bağlı, tahmin edilemez; loglarda görünmez. İptal/taşıma son saati ve hizmet/personel uygunluğu sunucuda denetlenir. Eski saat ile koşullu güncelleme, transaction+çakışma kısıtı; başarısız taşıma eski rezervasyonu korur. Eski hatırlatma işleri yeni saate mesaj atamaz; yeni işler idempotent. Eski bağlantının yeniden kullanımı ve paralel taşıma test edilir.

## Takvim ve yorum (T104/T105)
Mevcut görevler korunur. iCal personel tokenı döndürülebilir/iptal edilebilir; feed gerekli minimum müşteri bilgisiyle sınırlandırılır. Google yorum daveti varsayılan kapalı, yalnız tamamlanan randevu sonrası gecikmeli bir kez; iptal/izin/kredi/idempotency denetlenir. Yeni görev numarasıyla yinelenmez.

## Medya (T127)
İlk hedef berbere giriş/koltuk/örtü sahnesi, bulunamazsa izinli yakın sahne. Yalnız Pexels/Pixabay/Mixkit/Coverr lisansı doğrulanmış klip veya sahibin izinli özgün çekimi. Tanınır kişi/logo/tabela yok; 8–15sn sessiz H264,1280px≤2.5MB ve720px mobil, WebPposter. Config tek kaynak; reduced-motion/SaveData poster. Gerçek video yokken yapay kare/film varmış gibi sunulmaz. Salon fotoğrafında da varlık sahibinin izin kaydı tutulur.

## Ödeme araştırması (T128)
KKTC şirketi ve banka hesabının kabulü sağlayıcının resmi kaynağından doğrulanır. TRY ve gerekli diğer para birimleri, 3DS, ücretler, iade/iptal, webhook imzası, idempotency ve test ortamı değerlendirilir. Mevcut kodda sağlayıcı adı olması uygunluk kanıtı değildir. Hesap açma, sözleşme imzalama veya gerçek tahsilat bu araştırma tesliminin parçası değildir. Doğrulanmış seçenek çıkmadan ödeme entegrasyonu seçilmez.

## Pilot (T129)
Öneri: 2–3 izinli salon, iki haftalık gerçek kullanım. Başlangıçta haftalık randevu hacmi ve mevcut gelmeme sayısını sahipten al; sonrasında randevu tamamlama oranı, personelin harcadığı süre, yanlış/çift rezervasyon, hatırlatma teslimi ve devam etmek için ödemek istedikleri fiyatı ölç. Bunlar hedef ölçütlerdir, mevcut başarı iddiası değildir. Salon listesi, iletişim ve gerçek fotoğraf/yorum izinleri sahipten gelir; izinsiz dış mesaj veya sahte sonuç yok.
