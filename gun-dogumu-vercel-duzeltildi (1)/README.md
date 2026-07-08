# Gün Doğumu — Vercel'e Yükleme Rehberi

Bu klasör, uygulamayı gerçek bir ürün olarak yayınlamak için hazır bir Vercel
projesi. Kullanıcılar hiçbir API anahtarı görmeyecek/girmeyecek — anahtarlar
sunucu tarafında (Vercel ortam değişkenleri) gizli kalıyor.

## 1. Vercel'e yükleme

**En kolay yol — Vercel CLI ile:**
```bash
npm install -g vercel
cd bu-klasor
vercel
```
Sorulara sırayla evet/varsayılan diyerek ilerle. İlk deploy tamamlanınca sana
bir `https://....vercel.app` linki verecek.

**Alternatif — GitHub üzerinden:**
1. Bu klasörü bir GitHub reposuna yükle (`git init`, `git add .`, `git commit`, `git push`)
2. [vercel.com](https://vercel.com) → "Add New Project" → reponu seç → Deploy

## 2. Gemini API anahtarlarını ekle

1. [aistudio.google.com/apikey](https://aistudio.google.com/apikey) adresinden
   **iki farklı Google hesabıyla** birer API anahtarı al (aynı hesaptan alınan
   iki anahtar aynı kota havuzunu paylaşır, fayda sağlamaz).
2. Vercel Dashboard → projen → **Settings → Environment Variables**:
   - `GEMINI_API_KEY_1` = ilk anahtar
   - `GEMINI_API_KEY_2` = ikinci anahtar (opsiyonel ama önerilir)

   (Admin şifresi artık bir ortam değişkeni DEĞİL — `api/admin.js`
   dosyasının en üstünde koda gömülü duruyor, aşağıdaki 4. adıma bak.)

3. Değişiklik sonrası **Deployments** sekmesinden en son deploy'u yeniden
   deploy et (env değişkenleri sadece yeni deploy'larda aktif olur).

## 3. İstatistikler için Upstash Redis ekle (opsiyonel ama önerilir)

Bu olmadan uygulama çalışır, sadece admin panelindeki sayılar hep 0 görünür.

1. Vercel Dashboard → projen → **Storage** sekmesi → **Browse Marketplace**
2. **Upstash** → **Redis** seç → ücretsiz plan ile bir veritabanı oluştur
3. Projene bağla — bu işlem `UPSTASH_REDIS_REST_URL` ve
   `UPSTASH_REDIS_REST_TOKEN` değişkenlerini otomatik olarak projene ekler
4. Yeniden deploy et

## 4. Admin paneline erişim

**Girişe ulaşmak için:** sitenin adresinin sonuna `#yonetici` ekle, örn.
`https://siten.vercel.app/#yonetici` — sayfa açılır açılmaz giriş ekranı
otomatik açılır. (Yedek yöntem: başlığa, yani "Gün Doğumu" yazısına, 2 saniye
içinde art arda 5 kez dokun/tıkla.)

**Şifre:** `api/admin.js` dosyasının en üstünde `ADMIN_PASSWORD` sabiti olarak
kodun içinde duruyor (şu an `159951cagan`). Değiştirmek istersen o satırı
düzenleyip yeniden deploy etmen yeterli — Vercel ortam değişkenleriyle hiç
uğraşman gerekmiyor.

Giriş yaptığında toplam istek sayısı, tür bazlı dağılım (çözülen soru, ikiz
soru, koçluk değerlendirmesi vb.), son 7 günlük grafik ve iki anahtarın ne
kadar kullanıldığını görürsün.

**Anahtarları panelden değiştirme:** Aynı ekranda "Gemini API Anahtarları"
bölümü var — yeni bir anahtar yapıştırıp "Anahtarları Kaydet" dediğinde,
Vercel'e hiç dokunmadan anahtarlar güncellenir (Upstash Redis'te saklanır).
Boş bıraktığın kutu değişmeden kalır. Bunun çalışması için **3. adımdaki
Upstash Redis kurulumunun yapılmış olması gerekiyor** — Redis yoksa panel
sadece Vercel'deki `GEMINI_API_KEY_1` / `GEMINI_API_KEY_2` değişkenlerini
kullanmaya devam eder, değiştiremezsin.

## 5. Kendi alan adını bağlama (opsiyonel)

Vercel Dashboard → projen → **Settings → Domains** → kendi domainini ekle,
Vercel'in verdiği DNS ayarlarını domain sağlayıcında yap.

---

## Önemli notlar

- **Google'ın kullanım şartlarına dikkat et.** İki ayrı ücretsiz Gemini
  anahtarını dönüşümlü kullanmak, tek kişinin kotasını aşmak amacıyla birden
  fazla hesap açmayı yasaklayan servis şartlarıyla çelişebilir. Ciddi bir
  ürün olarak büyütmeyi düşünüyorsan, Google AI Studio'da ücretli katmana
  (pay-as-you-go) geçmek daha güvenli ve sürdürülebilir bir yoldur.
- **KVKK / kişisel veri.** Kullanıcılar soru fotoğrafı yüklüyor; bu veriler
  şu an sadece kullanıcının kendi cihazında (localStorage) tutuluyor, senin
  sunucuna kalıcı olarak kaydedilmiyor — sadece o anlık Gemini'ye işlenmek
  üzere gönderiliyor. Yine de ticari bir ürün olarak sunacaksan bir gizlilik
  politikası hazırlaman ve bu konuda bir hukuk danışmanına sorman iyi olur.
  Ben avukat değilim, bu konuda kesin bir görüş veremem.
- Bu admin şifresi basit bir tek-şifre kontrolü — kurumsal seviyede güvenlik
  değil, ama küçük/orta ölçekli bir ürün için yeterli. Şifreyi başka hiçbir
  yerde kullanma ve kimseyle paylaşma.
