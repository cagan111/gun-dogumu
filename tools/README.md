# Üretim araçları

- make_posts.py: 9 açılış gönderisinin 1080x1350 kareleri (Pillow, Poppins fontu).
- reel_quiz.py: "3 soru 3 saniye" Reels'i; diğer videolar bunun çizim yardımcılarını (BG, F, pill, center_text, logo) kullanır. Kare kare çizim + ffmpeg, ses kodla üretilir.
- reel_two.py: Koç testi ve doğru/yanlış Reels'leri; write_audio/render yardımcıları yeniden kullanılabilir.

Yollar /home/claude/ig/... olarak yazılı; yeni ortamda OUT/OUTDIR değişkenlerini güncelle.
Görsel dil: lacivert #0E1830 zemin, altta turuncu-sarı doğan güneş, krem #FFF6E5 başlık, altın #FFC857 vurgu, Poppins.
- reel_story.py: hikayeli Reels; Flow sahneleri (720x1280) 1080x1920e buyutulur, ustune Turkce yazi katmanlari ve kapanis karti eklenir, Flow sesi korunur. SCENES/CLOSING/SRC/OUT degistirilerek yeni hikaye yapilir. Poppins agirliklari: Bold, Medium, Regular, Light.
