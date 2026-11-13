"""Gün Doğumu Instagram launch posts: 1080x1350 JPEG slides."""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1080, 1350
OUT = "/home/claude/ig/out"
FD = "/usr/share/fonts/truetype/google-fonts/"

NAVY = (14, 24, 48)
NAVY2 = (28, 40, 78)
CREAM = (255, 246, 229)
GOLD = (255, 200, 87)
ORANGE = (255, 138, 61)
CORAL = (255, 107, 107)
MUTED = (170, 182, 210)
TEAL = (94, 214, 190)


def F(weight, size):
    return ImageFont.truetype(FD + f"Poppins-{weight}.ttf", size)


def gradient_bg(top=NAVY, bottom=NAVY2):
    img = Image.new("RGB", (W, H), top)
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        c = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        d.line([(0, y), (W, y)], fill=c)
    return img


def sunrise(img, strength=1.0, cy=None):
    """Glowing half-sun rising from the bottom edge."""
    cy = H + 120 if cy is None else cy
    glow = Image.new("RGB", (W, H), (0, 0, 0))
    g = ImageDraw.Draw(glow)
    for r, col in [(760, (90, 40, 20)), (600, (150, 70, 30)), (470, (210, 100, 40))]:
        g.ellipse([W / 2 - r, cy - r, W / 2 + r, cy + r], fill=tuple(int(c * strength) for c in col))
    glow = glow.filter(ImageFilter.GaussianBlur(90))
    img = Image.fromarray(__import__("numpy").clip(
        __import__("numpy").asarray(img, dtype="int16") + __import__("numpy").asarray(glow, dtype="int16"), 0, 255
    ).astype("uint8"))
    d = ImageDraw.Draw(img)
    r = 330
    d.ellipse([W / 2 - r, cy - r, W / 2 + r, cy + r], fill=ORANGE)
    r2 = 250
    d.ellipse([W / 2 - r2, cy - r2, W / 2 + r2, cy + r2], fill=GOLD)
    return img


def wrap(d, text, font, maxw):
    lines = []
    for para in text.split("\n"):
        words, cur = para.split(" "), ""
        for w in words:
            t = (cur + " " + w).strip()
            if d.textlength(t, font=font) <= maxw:
                cur = t
            else:
                if cur:
                    lines.append(cur)
                cur = w
        lines.append(cur)
    return lines


def text_block(d, xy, text, font, fill, maxw, spacing=1.18, align="left"):
    x, y = xy
    lh = int(font.size * spacing)
    for line in wrap(d, text, font, maxw):
        if align == "center":
            lx = (W - d.textlength(line, font=font)) / 2
        else:
            lx = x
        d.text((lx, y), line, font=font, fill=fill)
        y += lh
    return y


def logo(d, x, y, size=34, color=CREAM):
    r = size // 2
    d.pieslice([x, y, x + size, y + size], 180, 360, fill=GOLD)
    d.line([x - 6, y + r, x + size + 6, y + r], fill=GOLD, width=3)
    d.text((x + size + 14, y - size * 0.18), "gün doğumu", font=F("Bold", int(size * 0.9)), fill=color)


def footer(d, idx=None, total=None, cta=None):
    logo(d, 70, 1252)
    if idx and total and not cta:
        s = f"{idx}/{total}"
        d.text((W - 70 - d.textlength(s, font=F("Medium", 30)), 1250), s, font=F("Medium", 30), fill=MUTED)
    if cta:
        d.text((W - 70 - d.textlength(cta, font=F("Medium", 28)), 1252), cta, font=F("Medium", 28), fill=GOLD)


def pill(d, x, y, text, bg=GOLD, fg=NAVY, size=30):
    f = F("Bold", size)
    w = d.textlength(text, font=f)
    d.rounded_rectangle([x, y, x + w + 44, y + size + 30], radius=(size + 30) // 2, fill=bg)
    d.text((x + 22, y + 11), text, font=f, fill=fg)
    return x + w + 44


def save(img, name):
    path = os.path.join(OUT, name)
    img.convert("RGB").save(path, "JPEG", quality=92, optimize=True)
    return path


# ---------- generic slide types ----------

def cover(title, kicker=None, sub=None, idx=None, total=None, name=""):
    img = sunrise(gradient_bg(), 1.0)
    d = ImageDraw.Draw(img)
    y = 190
    if kicker:
        pill(d, 80, y, kicker)
        y += 120
    y = text_block(d, (80, y), title, F("Bold", 84), CREAM, W - 160, 1.12)
    if sub:
        text_block(d, (80, y + 30), sub, F("Regular", 40), MUTED, W - 160, 1.3)
    footer(d, idx, total, cta="kaydır >" if idx == 1 else None)
    return save(img, name)


def numbered(num, title, body, idx, total, name, accent=GOLD):
    img = gradient_bg()
    d = ImageDraw.Draw(img)
    d.text((80, 120), str(num), font=F("Bold", 260), fill=accent)
    y = text_block(d, (80, 470), title, F("Bold", 66), CREAM, W - 160, 1.15)
    text_block(d, (80, y + 40), body, F("Regular", 42), MUTED, W - 160, 1.38)
    footer(d, idx, total)
    return save(img, name)


def closing(title, sub, idx, total, name, button="Ücretsiz · link bioda"):
    img = sunrise(gradient_bg(), 1.1, cy=H + 40)
    d = ImageDraw.Draw(img)
    y = text_block(d, (80, 230), title, F("Bold", 76), CREAM, W - 160, 1.12)
    y = text_block(d, (80, y + 30), sub, F("Regular", 42), MUTED, W - 160, 1.35)
    pill(d, 80, y + 60, button, size=38)
    footer(d, idx, total)
    return save(img, name)


# ---------- posts ----------
posts = {}

# 1 — intro carousel
p = []
p.append(cover("Ders çalışıyorsun ama nereye gittiğini bilmiyor musun?", "LGS · TYT · AYT", None, 1, 4, "p1_1.jpg"))
img = gradient_bg(); d = ImageDraw.Draw(img)
y = text_block(d, (80, 170), "Gün Doğumu", F("Bold", 96), GOLD, W - 160)
y = text_block(d, (80, y + 10), "LGS ve YKS'ye hazırlananlar için ücretsiz çalışma takip uygulaması.", F("Medium", 52), CREAM, W - 160, 1.25)
rows = ["Bugün ne çalışacağım?", "Ne kadar çalıştım?", "Hangi yanlışımı tekrar etmeliyim?"]
y += 70
for r in rows:
    d.rounded_rectangle([80, y, W - 80, y + 120], radius=28, fill=(36, 52, 98))
    d.ellipse([115, y + 40, 155, y + 80], fill=GOLD)
    d.text((185, y + 30), r, font=F("Medium", 44), fill=CREAM)
    y += 150
text_block(d, (80, y + 30), "Hepsi tek ekranda.", F("Bold", 50), GOLD, W - 160)
footer(d, 2, 4); p.append(save(img, "p1_2.jpg"))

img = gradient_bg(); d = ImageDraw.Draw(img)
text_block(d, (80, 150), "Neler var?", F("Bold", 80), CREAM, W - 160)
feats = [
    (GOLD, "Yanlış Kutusu", "Yanlışlarını biriktirir, 1-3-7-16-35. günlerde tekrar önüne getirir."),
    (CORAL, "Yapay zekâ koç", "Gün sonunda çalışmanı değerlendirir, eksiğini açıkça söyler."),
    (TEAL, "Grup Pomodoro", "Arkadaşlarınla aynı anda 25 dakikalık turlar."),
]
y = 330
for col, t, b in feats:
    d.rounded_rectangle([80, y, W - 80, y + 250], radius=32, fill=(36, 52, 98))
    d.rounded_rectangle([80, y, 100, y + 250], radius=10, fill=col)
    d.text((135, y + 35), t, font=F("Bold", 50), fill=col)
    text_block(d, (135, y + 110), b, F("Regular", 38), CREAM, W - 260, 1.3)
    y += 285
footer(d, 3, 4); p.append(save(img, "p1_3.jpg"))
p.append(closing("Ücretsiz.\nGoogle Play'de.", "Profildeki linkten indir, bugünkü ilk görevini yaz.", 4, 4, "p1_4.jpg"))
posts[1] = p

# 2 — after a practice exam
p = [cover("Deneme sonrası yapılması gereken 4 şey", "DENEME GÜNÜ", "Çözüp kapatmak, emeğin yarısını çöpe atmak.", 1, 6, "p2_1.jpg")]
steps = [
    ("Yanlışları aynı gün incele", "Çözümü okumak yetmez. Neden yanlış yaptığını tek cümleyle yaz: bilgi eksiği mi, dikkat mi, süre mi?"),
    ("Boşları konu konu ayır", "Boş bıraktığın her soruyu konusuna göre listele. En çok tekrar eden konu, bu haftanın önceliği."),
    ("Aynı tipten 5 soru daha çöz", "Yanlış yaptığın soru tipini bulup hemen 5 benzerini çöz. Hata kalıbı ancak böyle kırılır."),
    ("Bir hafta sonra tekrar bak", "Aynı soruları bir hafta sonra yeniden çöz. Hâlâ yapamıyorsan konu henüz oturmamış demektir."),
]
for i, (t, b) in enumerate(steps, 1):
    p.append(numbered(i, t, b, i + 1, 6, f"p2_{i+1}.jpg"))
p.append(closing("Bunu her deneme sonrası yap.", "Yanlış Kutusu 1, 3, 7, 16 ve 35. günlerde hatırlatır, sen unutsan da.", 6, 6, "p2_6.jpg", "Kaydet · deneme günü lazım"))
posts[2] = p

# 3 — Yanlış Kutusu single
img = gradient_bg(); d = ImageDraw.Draw(img)
pill(d, 80, 140, "YANLIŞ KUTUSU")
y = text_block(d, (80, 260), "Yanlış yaptığın soru kaybolmasın.", F("Bold", 80), CREAM, W - 160, 1.12)
y += 80
days = [1, 3, 7, 16, 35]
x0, x1 = 140, W - 140
d.line([x0, y + 60, x1, y + 60], fill=(70, 90, 140), width=8)
for i, dd in enumerate(days):
    x = x0 + (x1 - x0) * i / (len(days) - 1)
    rr = 46
    d.ellipse([x - rr, y + 60 - rr, x + rr, y + 60 + rr], fill=GOLD if i == len(days) - 1 else ORANGE)
    s = str(dd)
    f = F("Bold", 40)
    d.text((x - d.textlength(s, font=f) / 2, y + 33), s, font=f, fill=NAVY)
    lab = "gün"
    d.text((x - d.textlength(lab, font=F("Medium", 30)) / 2, y + 125), lab, font=F("Medium", 30), fill=MUTED)
text_block(d, (80, y + 250), "Yanlışını kutuya at. Uygulama o soruyu 1, 3, 7, 16 ve 35. günlerde yeniden önüne getirir.", F("Regular", 44), CREAM, W - 160, 1.35)
footer(d, cta="Ücretsiz · link bioda")
posts[3] = [save(img, "p3_1.jpg")]

# 4 — 25 minute rule
p = [cover("25 dakika kuralı", "ODAK", "Masada 3 saat oturmak, 3 saat çalışmak değil.", 1, 4, "p4_1.jpg")]
p.append(numbered(25, "dakika tek iş", "Bir ders, bir konu, bir hedef. Sayaç bitene kadar başka hiçbir şeye bakma.", 2, 4, "p4_2.jpg"))
p.append(numbered(5, "dakika mola", "Kalk, su iç, pencereden bak. Telefona değil. Dört turdan sonra 20-30 dakikalık uzun mola.", 3, 4, "p4_3.jpg", accent=TEAL))
p.append(closing("Telefonu başka odaya koy.", "Bugün kaç tur yaparsın? Yoruma yaz. Arkadaşınla aynı anda çalışmak istersen grup Pomodoro uygulamada.", 4, 4, "p4_4.jpg"))
posts[4] = p

# 5 — November TYT plan
p = [cover("Kasım'da başlayan için TYT planı", "TYT'YE 218 GÜN", "Geç kalmadın. Plansız devam edersen kalırsın.", 1, 6, "p5_1.jpg")]
plan = [
    ("Hafta içi: matematik", "Okuldan sonra ilk blok matematik. 3 tur Pomodoro: konu, örnek, 20 soru."),
    ("Hafta içi: paragraf", "Her gün 20 paragraf sorusu, süre tutarak. Türkçe netinin büyük kısmı buradan gelir."),
    ("Hafta içi: fen veya sosyal", "Günde bir konu tekrarı. Pazartesi fizik, salı tarih gibi dönüşümlü ilerle."),
    ("Cumartesi: deneme", "Gerçek sınav saatinde, süre tutarak bir TYT denemesi. Aynı gün yanlış analizi."),
]
for i, (t, b) in enumerate(plan, 1):
    p.append(numbered(i, t, b, i + 1, 6, f"p5_{i+1}.jpg"))
p.append(closing("Pazar: yanlış günü.", "Haftanın bütün yanlışlarını yeniden çöz, eksik konuyu bir sonraki haftanın ilk işi yap.", 6, 6, "p5_6.jpg", "Kaydet · her hafta lazım"))
posts[5] = p

# 6 — two coaches
img = gradient_bg(); d = ImageDraw.Draw(img)
text_block(d, (80, 120), "Bugün hiç çalışmadın.", F("Bold", 76), CREAM, W - 160)
text_block(d, (80, 225), "İki koç, iki tepki.", F("Medium", 44), MUTED, W - 160)
boxes = [
    (CORAL, "Çançik", "Bahane yok. 20 soru, şimdi. Yarın değil.", 350),
    (TEAL, "Sophie", "Olur böyle günler. 10 soruyla başlayalım mı? Sonra devam edersin.", 735),
]
for col, nm, msg, y in boxes:
    d.rounded_rectangle([80, y, W - 80, y + 360], radius=36, fill=(36, 52, 98))
    d.ellipse([115, y + 40, 195, y + 120], fill=col)
    d.text((140 if nm == "Sophie" else 142, y + 52), nm[0], font=F("Bold", 44), fill=NAVY)
    d.text((220, y + 50), nm, font=F("Bold", 50), fill=col)
    text_block(d, (115, y + 150), msg, F("Medium", 42), CREAM, W - 230, 1.28)
text_block(d, (80, 1140), "Sen hangisini seçerdin? Yoruma yaz.", F("Bold", 44), GOLD, W - 160)
footer(d)
posts[6] = [save(img, "p6_1.jpg")]

# 7 — paragraph mistakes
p = [cover("Paragrafta süre kaybettiren 3 hata", "TÜRKÇE", None, 1, 5, "p7_1.jpg")]
mist = [
    ("Önce paragrafı okumak", "Önce soru kökünü oku. Ne aradığını bilerek okursan paragrafı bir kez okuman yeter."),
    ("Her şıkkı iki kez okumak", "Paragrafla açıkça çelişen şıkkı hemen ele. Kalan iki şık arasında karar ver."),
    ("Takıldığın soruda inat etmek", "90 saniyede çıkmıyorsa işaretle ve geç. Turun sonunda dönersin."),
]
for i, (t, b) in enumerate(mist, 1):
    p.append(numbered(i, t, b, i + 1, 5, f"p7_{i+1}.jpg", accent=CORAL))
p.append(closing("Günde 20 paragraf, süre tutarak.", "Bir ay sonra hızındaki farkı kendin görürsün.", 5, 5, "p7_5.jpg", "Kaydet · arkadaşına gönder"))
posts[7] = p

# 8 — quote single
img = sunrise(gradient_bg(), 1.2, cy=H - 60); d = ImageDraw.Draw(img)
y = text_block(d, (80, 330), "Motivasyon bekleme.", F("Bold", 104), CREAM, W - 160, 1.08)
text_block(d, (80, y + 10), "Sistem kur.", F("Bold", 104), GOLD, W - 160, 1.08)
text_block(d, (80, y + 220), "Motivasyon gelir gider. Her gün aynı saatte masaya oturmak kalır.", F("Regular", 42), CREAM, W - 160, 1.35)
footer(d)
posts[8] = [save(img, "p8_1.jpg")]

# 9 — parents
p = [cover("Veliler için: çocuğunuza sormamanız gereken soru", "VELİ KÖŞESİ", None, 1, 4, "p9_1.jpg")]
img = gradient_bg(); d = ImageDraw.Draw(img)
d.rounded_rectangle([80, 200, W - 80, 560], radius=36, fill=(60, 36, 52))
d.text((120, 230), "Bunu değil", font=F("Bold", 40), fill=CORAL)
text_block(d, (120, 320), "“Kaç net yaptın?”", F("Bold", 76), CREAM, W - 240)
d.rounded_rectangle([80, 620, W - 80, 1080], radius=36, fill=(30, 64, 70))
d.text((120, 650), "Bunu sorun", font=F("Bold", 40), fill=TEAL)
text_block(d, (120, 740), "“Bugün ne öğrendin?”", F("Bold", 76), CREAM, W - 240)
footer(d, 2, 4); p.append(save(img, "p9_2.jpg"))
p.append(numbered("?", "Neden?", "Net sorusu sonucu sorar, öğrenme sorusu süreci. Süreçle ilgilenen veli, çocuğun yanlışlarını saklamasına gerek bırakmaz.", 3, 4, "p9_3.jpg", accent=TEAL))
p.append(closing("Takibi siz de görmek isterseniz", "Gün Doğumu'nda veli takibi var. Çocuğunuzun çalışmasını baskı kurmadan izleyin.", 4, 4, "p9_4.jpg"))
posts[9] = p

if __name__ == "__main__":
    for k, v in posts.items():
        print(k, [os.path.basename(x) for x in v])
