# Personel iCal feed — T104a backend

Bu parça backend/API sunar; panelde bağlantı oluşturma, tek seferlik gösterim ve iptal arayüzü T104b olarak açıktır. Mevcut ortak panel takvimi/Staff.userId erişim modeli değiştirilmez.

Owner `POST /api/panel/staff/{id}/calendar` ile JSON `{}` göndererek ilk tokenı oluşturur veya eskisini döndürür. Yanıt yalnız bu anda `path` içerir. `DELETE` aynı endpointte tokenı iptal eder; askıdaki salonda iptal de kullanılabilir. Staff rolü yönetemez, yabancı tenant personeli404 alır. Token veya hash için listeleme/geri okuma endpointi yoktur. POST yalnız application/json kabul eder; mutation endpointlerinde CORS izni verilmez.

Token256bit rastgele base64url capability’dir. DB’de ayrı StaffCalendarFeed tablosunda yalnız SHA256 hash bulunur; generic tenant delegate/Staff include bu modele erişemez. Rotate/revoke tenant kilidiyle ve token içermeyen audit ile atomiktir. Staff silinince kayıt cascade silinir. Migration20261120090000_staff_calendar_feed yeni sürümden önce uygulanmalıdır; bu teslim yalnız yerel DB’ye uygulandı, deploy yapılmadı.

`GET /api/calendar/{token}` abonelik için text/calendar döndürür. Feed personelin kendi tenant/personel eşleşmesine bağlıdır; kilit altında token yeniden doğrulanır. Pasif personel veya askıdaki salon404 alır. Aktiflik/askı geçici erişim kapısıdır; kalıcı iptal için DELETE kullanılır. Bitmiş rotate/revoke sonrası eski token yeni sorgularda geçersizdir; halihazırda indirilmiş kopyalar geri alınamaz.

Feed son14 gün ve gelecek90 gündeki en fazla1000 randevuyu taşır. Kapasite aşılırsa sessiz eksiltmek yerine503 verir. UTC zamanlar/CRLF, stabil hash UID, DTSTAMP/LAST-MODIFIED, pending=TENTATIVE ve iptal=CANCELLED kullanılır. Müşteri adı/telefonu/notu, hizmet adı, fiyat, iptal URL/tokenı ve diğer personelin randevusu dışa aktarılmaz. Başlık tenant diline göre yalnız Randevu/Appointment’tır; tüm alanlar kontrollü ASCII olduğundan kullanıcı metni/ICS satır enjeksiyonu yoktur. Abonelik uygulamasının yenileme zamanını platform belirleyemez.

Feed/başarılı token yanıtları private,no-store ve no-referrer taşır. Yanlış/iptal token404, beklenmeyen hata503 döner; token/değer hata loguna yazılmaz. URL şifre gibi saklanmalıdır; üçüncü taraf takvim sağlayıcısına abonelik URL’sini vermek bu erişimi paylaşır. Caddy URI/Referer/Location log bastırması korunur; başka proxy/izleme sistemlerinde ayrıca gizleme gerekir. Feed için güvenilir IP/unknown bucket başına60/dakika process-local limit vardır; dağıtık DoS koruması iddiası yoktur.
