# T116 hazırlık notu — henüz uygulanmadı

19 Kasım, tek GPT-6 Luna salt-okunur incelemesi/root kaydı. Kampanya özelliği T116 teslimi değildir.

- Tenant kapsamında Campaign + CampaignRecipient; request/idempotency anahtarı ve sabit rıza-filtreli hedef listesi kalıcı olmalı. Yeniden deneme hedef listeyi yeniden üretmemeli.
- Aynı tenant kilitli transaction'da içerik/footer/segment profilini sabitle, toplam rezervasyonu denetle/düş ve alıcıları oluştur. Sonraki gönderimler rezervasyonu tüketmeli, ikinci kez debit yapılmamalı.
- Alıcı başına sabit anahtar, sonuç/deneme durumu; kayıp HTTP yanıtında MessageLog ile uzlaştır. `duplicate` veya0segment sonucu gönderildi kabul edilmemeli.
- Harcanmayan rezervasyon bir kez serbest bırakılmalı; T112 iadeleri ile çifte iade yapılmamalı. Muhasebe tasarımı uygulanmadan önce açıkça seçilip test edilmeli.
- `delivery_unknown` / dispatch sonrası çöküş otomatik tekrar gönderilmez. Güvenli, gönderim başlamamış durum ancak eski girişim kapatılıp muhasebesi uzlaştırıldıktan sonra yeni attempt anahtarıyla denenebilir.
- T142 randevu/OTP koruması kampanyayı ayrı bırakır; kampanyanın bütçe ve rıza politikası ayrıca belgelenmeli. Bu not yeni model/API/migration/işçi veya test sonucu değildir.
