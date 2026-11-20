# Personel iCal feed — T104

Salon sahibi Personel sayfasındaki Takvim bağlantısı düğmesiyle personel bazlı abonelik bağlantısını oluşturur/yeniler veya iptal eder. Arayüz TR+EN destekler. Mevcut ortak panel takvimi/Staff.userId erişim modeli değiştirilmez.

Owner `POST /api/panel/staff/{id}/calendar` ile JSON `{}` göndererek ilk tokenı oluşturur veya eskisini döndürür. Yanıt yalnız bu anda `path` içerir. `DELETE` aynı endpointte tokenı iptal eder; askıdaki salonda iptal de kullanılabilir. Staff rolü yönetemez, yabancı tenant personeli404 alır. Token veya hash için listeleme/geri okuma endpointi yoktur. POST yalnız application/json kabul eder; mutation endpointlerinde CORS izni verilmez.

Token256bit rastgele base64url capability’dir. DB’de ayrı StaffCalendarFeed tablosunda yalnız SHA256 hash bulunur; generic tenant delegate/Staff include bu modele erişemez. Rotate/revoke tenant kilidiyle ve token içermeyen audit ile atomiktir. Staff silinince kayıt cascade silinir. Migration20261120090000_staff_calendar_feed yeni sürümden önce uygulanmalıdır; bu teslim yalnız yerel DB’ye uygulandı, deploy yapılmadı.

`GET /api/calendar/{token}` abonelik için text/calendar döndürür. Feed personelin kendi tenant/personel eşleşmesine bağlıdır; kilit altında token yeniden doğrulanır. Pasif personel veya askıdaki salon404 alır. Aktiflik/askı geçici erişim kapısıdır; kalıcı iptal için DELETE kullanılır. Bitmiş rotate/revoke sonrası eski token yeni sorgularda geçersizdir; halihazırda indirilmiş kopyalar geri alınamaz.

Feed son14 gün ve gelecek90 gündeki en fazla1000 randevuyu taşır. Kapasite aşılırsa sessiz eksiltmek yerine503 verir. UTC zamanlar/CRLF, stabil hash UID, DTSTAMP/LAST-MODIFIED, pending=TENTATIVE ve iptal=CANCELLED kullanılır. Müşteri adı/telefonu/notu, hizmet adı, fiyat, iptal URL/tokenı ve diğer personelin randevusu dışa aktarılmaz. Başlık tenant diline göre yalnız Randevu/Appointment’tır; tüm alanlar kontrollü ASCII olduğundan kullanıcı metni/ICS satır enjeksiyonu yoktur. Abonelik uygulamasının yenileme zamanını platform belirleyemez.

Feed/başarılı token yanıtları private,no-store ve no-referrer taşır. Yanlış/iptal token404, beklenmeyen hata503 döner; token/değer hata loguna yazılmaz. URL şifre gibi saklanmalıdır; üçüncü taraf takvim sağlayıcısına abonelik URL’sini vermek bu erişimi paylaşır. Caddy URI/Referer/Location log bastırması korunur; başka proxy/izleme sistemlerinde ayrıca gizleme gerekir. Feed için güvenilir IP/unknown bucket başına60/dakika process-local limit vardır; dağıtık DoS koruması iddiası yoktur.

## Panel kullanımı ve sınırlar

Oluştur/yenile, önceki bağlantıyı geçersiz kılacağını onaylatır. Tam abonelik URL’si yalnız başarılı yanıtın açık penceresinde, salt okunur alanda gösterilir; sayfa/pencere kapatıldığında geri okunamaz. Uygulama URL/tokenı localStorage, sessionStorage veya adres çubuğuna yazmaz. Kopyalama yalnız açık kullanıcı eylemidir; Clipboard API başarısızsa alanı seçerek elle kopyalama kullanılabilir. Gizli URL screenshot/test çıktısına basılmaz. API yanıt yolu tam feed biçimi ve aynı origin kontrolünden geçer; yabancı URL, query, fragment veya kontrol karakteri gösterilmez.

İptal ve yenileme ayrı onay adımlarıdır. HTTP işlemi sürerken X/Escape/arka plan üzerinden pencere kapanmaz; yanıt kaybolmasın diye bekleme metni gösterilir. Sayfa yenileme, başka sayfaya gitme veya ağ kesintisi yine tamamlanmış bir döndürme yanıtını kaybettirebilir; istemci abort’u sunucu işlemini geri almaz. Sonuç doğrulanamazsa arayüz bunu bildirir; yeniden oluşturma eski URL’yi geçersiz kılar veya erişim iptal edilebilir. Bu amaçla gizli tokenı kalıcı tarayıcı depolamasına yazmayız. Unmount/abort ve clipboard nesil kontrolleri geç yanıtların yeni pencere durumunu değiştirmesini önler.

Pasif personel/askıdaki salon için oluşturma kapalı, iptal açıktır. Staff rolünde kontroller yoktur; backend owner kapısı ayrıca korunur. Gerçek tarayıcı testleri ayrı UUID fixture tenant kullanır, TR+EN/mobil, API ve yaşam döngüsünü sınar. Kopyalama API’si testte bellek içi mock ile denetlenir; fiziksel işletim sistemi panosu veya dış Google/Apple hesap aboneliği doğrulandı iddiası yoktur.
