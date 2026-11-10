# Son Ateş

Dinozorlar çağında geçen bir hayatta kalma / korku / halk yönetimi oyunu. Saf HTML5 Canvas + WebAudio, kurulum gerekmez:
`index.html` dosyasını tarayıcıda aç ya da Vercel'de `/oyun/` adresine git.

## Dosyalar
| Dosya | İçerik |
|---|---|
| `js/temel.js` | yardımcılar, tüm veri tanımları (yaratıklar, yapılar, zanaat, özellikler, gruplar, başarımlar), ses |
| `js/dunya.js` | biyomlar, tohumlu dünya üretimi, gün/gece, ışık, hava |
| `js/halk.js` | kişiler, özellikler, gruplar ve yöneticiler, moral, yaralanma/tedavi, çiftler ve çocuklar |
| `js/yaratik.js` | yaratık yapay zekâsı, evcilleştirme, binme, yumurtalar, oklar, doğurma |
| `js/oyun.js` | lider, etkileşim, inşa/zanaat, gün döngüsü, korku olayları, final, kayıt, başarımlar, öğretici |
| `js/cizim.js` | çizim, sis/yağmur/şimşek, mini harita |
| `js/arayuz.js` | girdi, HUD, halk paneli, zanaat menüsü, ekranlar, ana döngü |

## Oynanış
- **Ateş** her şeydir. Gece yırtıcılar ışığa giremez, kenarında bekler. Yağmurda ateş hızlı söner.
- **Halk ve gruplar**: Odun, Taş, Yiyecek, Şifacı, Muhafız, Takip, Boşta. Gruplar sekmesinde `+/−` ile hızlı aktarım,
  Kişiler sekmesinde çoklu seçim ve toplu aktarım, filtreler, kişi kartları (özellikler + geçmiş).
- **Yöneticiler (★)**: grubu hızlandırır (Önder Ruhlu / Yaşlı Bilge daha iyi), grup yeteneği (⚡) ve bölge emri (📍) verir:
  Toplu Kesim, Damar Bul, Hasat Bereketi, Şifa Çemberi, Savunma Düzeni, Hücum!
- **Özellikler**: Cesur, Korkak, İyi Avcı, Uykusuz, Hastalıklı, Yaşlı Bilge, Çevik, Güçlü, Önder Ruhlu, Çalışkan, Şifalı Eller.
- **Moral**: açlık, ölüm, kaçışlar düşürür; zafer, doğum, evcilleştirme yükseltir. Çok düşerse biri yiyecek çalıp kaçar.
- **Çiftler ve çocuklar**: yakınlaşan iki kişinin bebeği olabilir; çocuk 3 günde büyür.
- **Yaralanma**: kanama, kırık bacak, enfeksiyon (ilaç gerekir). Ağır yaralı kişi 25 sn yerde kalır — yanına gidip kaldır.
- **Gece nöbeti**: muhafızlar ertesi gün yorgun olur (Uykusuz hariç). Kulelere muhafız çıkar ve ok atar.
- **Zanaat ağacı**: Taş/Kemik Mızrak, Ok-Yay, Zehirli Ok, El Meşalesi, Eyer, Deri Zırh, Halk Zırhı, Taş Duvar, Kule,
  Et Kurutma, Şifahane, İlaç, Yarık Taşı.
- **Yaratıklar**: Sürüngeç, Yırtıcı, Dev Kafa, Boynuzlu (bayılt + evcilleştir, eyerle bin), Uzunboyun (besle, yük taşır),
  Kanatlı (dağlarda konar; sessizce yaklaşıp besle, yaklaşan yırtıcıları haber verir), Batakçı (bataklık havuzlarında pusu kurar).
  Yırtıcı yuvasından yumurta çal → anneler peşine düşer → ateşe götür → yavru seninle büyür.
- **Biyomlar**: Orman, Dağlar (kristal), Bataklık (zehirli bitki, çamur yavaşlatır), Sisli Vadi (gündüz bile tehlikeli, yuvalar).
- **Korku olayları**: Dev ayak izleri (o gece Dev Kafa gelir), kuşların susması (av gecesi), fırtına ve şimşek, sis,
  ormandan uyuyan birinin sesiyle seni çağıran şey, şafakta boş bulunan yatak.
- **Hedef**: Zaman yarığını bul, halkını 12 kişiye çıkar, Yarık Taşı yap, yarığı aç ve 100 saniye dayan.
- **Bilinmezlik / keşif sisi**: dünyayı yalnızca halkının, ışıklarının, kulelerinin ve evcil yaratıklarının gördüğü kadar görürsün.
  Görülmemiş yerler simsiyah; bir kez görülüp şu an kimsenin bakmadığı yerler soluk ve içlerindeki yaratıklar görünmez.
  **Kâşif** grubu bilinmeyene gider; büyük haritaya (M) dokunarak hedef ver. Sisli Vadi'de görüş yarıya iner.
- **Ani gece olayları**: çoğu gece sessiz geçer. Bazı gecelerde, saati bilinmeyen anda: pusu, karanlıktan atılıp kaçan
  tek yırtıcı, Dev Kafa (uzaktan ya da birden dibinde), yamyam baskını, yırtıcı sürüsü, taklit eden ses, boş yatak.
  İşaretler (ayak izleri, susan kuşlar, boyalı el izleri) yalnızca bazen önceden görünür. Gündüz de kamptan uzaktakiler nadiren pusuya düşer.
- **Yamyamlar**: haritada gizli kamplar. Yakınına gidenlere saldırırlar; bazı geceler sessizce yaklaşıp baskın yapar ve
  insanları sürükleyip götürürler. Esirleri ertesi akşama kadar kurtarmazsan yenir. Totemi yıkarsan kamp dağılır.
- **Yaratık boyutları**: çoğu küçük (Sürüngeç, Tükürgeç — zehir tükürür), orta tehlikeliler (Yırtıcı, Batakçı), devasa olanlar
  (Dev Kafa, Uzunboyun — ağaçları devirerek geçer).
- **Animasyon**: insanlar yürürken bacak/kol sallar, çalışırken balta/kazma kullanır, saldırırken mızrak saplar; yaratıklar nefes alır, başları sallanır.
- **Kayıt** (otomatik), **zorluk** (Kolay: son şafaktan devam · Normal · Kâbus: tek can), **öğretici**, **mini harita** ve
  keşif sisi, **13 başarım**.

## Kontroller
WASD hareket · Shift koş · Fare/Boşluk mızrak · F/sağ tık ok · E (basılı) topla/kullan/tedavi/evcilleştir · E bin/in ·
1-8 inşa · C zanaat · M harita · H halk paneli · T meşale · P duraklat. Telefonda sanal kol ve düğmeler.
