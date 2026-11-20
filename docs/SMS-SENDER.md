# SMS başlığı onayı

Özel salon başlığı hem owner ayar servisinde hem gönderim servisinde denetlenir. Başlık 1–11 izinli ASCII karakter ve en az bir harf içermelidir. Biçim geçerliliği marka sahipliği değildir.

Operatör, sağlayıcı hesabında başlığın kullanım yetkisini/onayını doğruladıktan sonra app ve worker ortamına aynı `SMS_APPROVED_SENDERS_JSON` değerini yerleştirir. Örnek yalnız yapılandırma biçimidir; gerçek bir onay değildir:

```json
{"tenant-id":{"netgsm":["SALON"],"mock":["SALON"]}}
```

Tenant ID, gerçekten seçilen sağlayıcı adı (`mock`, `netgsm`, `iletimerkezi`, `generic_http`) ve başlık büyük/küçük harf dahil tam eşleşir. Başka tenant veya sağlayıcının onayı miras alınmaz. Mock'a düşülürse gerçek sağlayıcı onayı mock için geçerli değildir. Tenant HTTP alanları bu operatör kaydını değiştiremez. Boş, bozuk, 65536 karakteri aşan veya geçersiz içerikli kayıt özel başlıkları reddeder; tenant başına sağlayıcı listesi en çok20 başlıktır. Hiç onay varsayılan olarak verilmez.

`null` başlık yalnız operatörün sağlayıcı ortamında tanımladığı varsayılan başlığı kullanır; varsayılanın sağlayıcı onayını da operatör doğrular. Panelde boş alan bunu seçer. Gerçek sağlayıcı onayı için otomatik hesap/API sorgusu veya dış iletişim yapılmaz.

Eski DB başlıkları grandfather edilmez: onaysızsa gönderim, kredi/kota/MessageLog rezervasyonu ve sağlayıcı/fallback çağrısından önce `skipped/sms_sender_not_approved` döner. Onaysız başlıkla bekleyen kampanya iptal edilir; kullanılmamış hold serbest bırakılır, debit/refund oluşmaz. Başlamış gönderim geri çağrılmaz. Onay değişikliklerini app/worker tüm örneklerinde birlikte uygulayın; eski süreçleri kapatmadan iptal her örneğe ulaşmış sayılmaz. İptal edilen kampanya aynı UUID ile kör tekrar oynatılmaz. T112 belirsiz teslim kuralları korunur.

Bu teslim gerçek SMS veya sağlayıcı onay ölçümü yapmaz. Yerel testlerde yalnız mock sağlayıcı ve ayrı fixture tenantlar kullanılır.
