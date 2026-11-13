"""Two gamified Reels: coach personality test + true/false quiz. Reuses the quiz Reel's drawing kit."""
import math, os, subprocess, sys, wave
import numpy as np
from PIL import ImageDraw

sys.path.insert(0, os.path.dirname(__file__))
from reel_quiz import (W, H, FPS, BG, F, pill, center_text, ease_out, logo, check, cross,
                       NAVY, NAVY2, CREAM, GOLD, ORANGE, CORAL, TEAL, CARD)

OUT = "/home/claude/ig/reel2"
os.makedirs(OUT, exist_ok=True)


def fade_col(c, a, base=NAVY2):
    return tuple(int(c[i] * a + base[i] * (1 - a)) for i in range(3))


# ------------------------------------------------------------------ audio
def write_audio(path, total, events):
    sr = 44100
    n = int(total * sr)
    out = np.zeros(n)

    def add(t, sig):
        i = int(t * sr); j = min(n, i + len(sig))
        if i < n:
            out[i:j] += sig[: j - i]

    def tone(f, dur, vol, decay):
        tt = np.arange(int(dur * sr)) / sr
        return vol * np.sin(2 * np.pi * f * tt) * np.exp(-decay * tt)

    def kick(vol):
        tt = np.arange(int(0.18 * sr)) / sr
        ph = 2 * np.pi * np.cumsum(110 * np.exp(-tt * 18) + 42) / sr
        return vol * np.sin(ph) * np.exp(-tt * 14)

    rng = np.random.default_rng(3)
    hat = 0.05 * rng.standard_normal(int(0.05 * sr)) * np.exp(-np.arange(int(0.05 * sr)) / sr * 90)
    k = 0.0
    while k < total - 0.3:
        add(k, kick(0.33)); add(k + 0.25, hat); k += 0.5
    for kind, t in events:
        if kind == "tick":
            add(t, tone(1320, 0.12, 0.3, 40))
        elif kind == "tick_last":
            add(t, tone(1760, 0.12, 0.32, 40))
        elif kind == "ding":
            add(t, tone(1046, 0.6, 0.3, 6)); add(t + 0.08, tone(1568, 0.6, 0.24, 6))
        elif kind == "pop":
            add(t, tone(880, 0.25, 0.18, 14))
        elif kind == "sting":
            add(t, tone(523, 0.4, 0.24, 8)); add(t + 0.45, tone(659, 0.4, 0.24, 8))
        elif kind == "fanfare":
            for i, f in enumerate([523, 659, 784, 1046]):
                add(t + 0.1 * i, tone(f, 0.5, 0.2, 7))
    fd = int(0.6 * sr)
    out[-fd:] *= np.linspace(1, 0, fd)
    out = out / max(1e-9, np.abs(out).max()) * 0.85
    pcm = (out * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes(np.stack([pcm, pcm], 1).tobytes())


def render(name, total, frame_at, events):
    wav = f"{OUT}/{name}.wav"
    write_audio(wav, total, events)
    tmp = f"{OUT}/{name}_v.mp4"
    p = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                          "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
                          "-pix_fmt", "yuv420p", tmp], stdin=subprocess.PIPE)
    for i in range(int(round(total * FPS))):
        p.stdin.write(frame_at(i / FPS).tobytes())
    p.stdin.close(); assert p.wait() == 0
    fin = f"{OUT}/{name}_tmp.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp, "-i", wav, "-map", "0:v", "-map", "1:a",
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", fin], check=True)
    os.replace(fin, f"{OUT}/{name}.mp4")
    os.remove(tmp)


def bar(d, y, frac, col=GOLD):
    d.rounded_rectangle([140, y, W - 140, y + 16], radius=8, fill=(50, 66, 112))
    x1 = 140 + (W - 280) * max(0.0, min(1.0, frac))
    if x1 > 150:
        d.rounded_rectangle([140, y, x1, y + 16], radius=8, fill=col)


# ================================================================ VIDEO A: coach test
SITS = [
    ("Deneme kötü geçti. Ne yaparsın?",
     "Telefonu açıp kafamı dağıtırım, yarın bakarım.", "Gece 2'ye kadar bütün yanlışları çözerim."),
    ("Haftalık plan yaptın. Sonra?",
     "Plan güzeldi ama uygulamadım.", "Uyguladım ama tükendim."),
    ("Ders çalışırken telefonun nerede?",
     "Elimde. Beş dakikada bir bakarım.", "Kapalı ama kafam hep sınavda."),
]
A_HOOK, A_SIT, A_RES, A_END = 2.6, 5.2, 6.0, 3.6
A_TOTAL = A_HOOK + 3 * A_SIT + A_RES + A_END


def coach_badge(d, cx, cy, r, col, letter, a=1.0):
    rr = r * a
    d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=col)
    f = F("Bold", max(1, int(r * 1.1 * a)))
    d.text((cx - d.textlength(letter, font=f) / 2, cy - f.size * 0.64), letter, font=f, fill=NAVY)


def a_hook(t):
    img = BG.copy(); d = ImageDraw.Draw(img)
    pill(d, W / 2, 440, "KOÇ TESTİ", GOLD, NAVY)
    a = ease_out(t / 0.4)
    center_text(d, 560 + int((1 - a) * 50), "Hangi koça", F("Bold", 110), CREAM)
    center_text(d, 690 + int((1 - a) * 50), "ihtiyacın var?", F("Bold", 110), CREAM)
    for i, (col, L, nm) in enumerate([(CORAL, "Ç", "Çançik"), (TEAL, "S", "Sophie")]):
        b = ease_out((t - 0.6 - 0.25 * i) / 0.4)
        if b <= 0:
            continue
        cx = W / 2 - 220 + 440 * i
        coach_badge(d, cx, 1010, 95, col, L, b)
        f = F("Bold", 54)
        d.text((cx - d.textlength(nm, font=f) / 2, 1130), nm, font=f, fill=fade_col(col, b))
    c = ease_out((t - 1.5) / 0.4)
    if c > 0:
        center_text(d, 1260, "Her soruda A mı B mi, aklında tut.", F("Medium", 46), fade_col(CREAM, c))
    logo(d)
    return img


def a_sit(i, t):
    q, oa, ob = SITS[i]
    img = BG.copy(); d = ImageDraw.Draw(img)
    pill(d, W / 2, 300, f"DURUM {i + 1}/3", GOLD, NAVY)
    a = ease_out(t / 0.35)
    center_text(d, 420 + int((1 - a) * 40), q, F("Bold", 76), CREAM, lh=1.16)
    for k, (lab, txt, col) in enumerate([("A", oa, CORAL), ("B", ob, TEAL)]):
        b = ease_out((t - 0.35 - 0.2 * k) / 0.35)
        if b <= 0:
            continue
        y = 720 + k * 300 + int((1 - b) * 60)
        d.rounded_rectangle([110, y, W - 110, y + 250], radius=44, fill=CARD)
        d.rounded_rectangle([110, y, 130, y + 250], radius=10, fill=col)
        d.text((170, y + 30), lab, font=F("Bold", 88), fill=col)
        yy = y + 52
        from reel_quiz import wrap
        for line in wrap(d, txt, F("Medium", 50), W - 420):
            d.text((290, yy), line, font=F("Medium", 50), fill=CREAM); yy += 64
    bar(d, 1380, t / A_SIT)
    return img


def a_result(t):
    img = BG.copy(); d = ImageDraw.Draw(img)
    a = ease_out(t / 0.35)
    center_text(d, 300 + int((1 - a) * 40), "Sonuç", F("Bold", 96), CREAM)
    rows = [(CORAL, "Ç", "Çoğu A ise", "Çançik'e ihtiyacın var.", "\"Bahane yok. 20 soru, şimdi.\""),
            (TEAL, "S", "Çoğu B ise", "Sophie'ye ihtiyacın var.", "\"Dinlenmek de çalışmanın parçası.\"")]
    for k, (col, L, head, res, quote) in enumerate(rows):
        b = ease_out((t - 0.5 - 0.9 * k) / 0.4)
        if b <= 0:
            continue
        y = 470 + k * 430 + int((1 - b) * 60)
        d.rounded_rectangle([90, y, W - 90, y + 380], radius=44, fill=CARD)
        coach_badge(d, 200, y + 120, 70, col, L)
        d.text((310, y + 50), head, font=F("Medium", 44), fill=fade_col(col, b))
        d.text((310, y + 110), res, font=F("Bold", 52), fill=CREAM)
        from reel_quiz import wrap
        yy = y + 230
        for line in wrap(d, quote, F("Medium", 44), W - 260):
            d.text((140, yy), line, font=F("Medium", 44), fill=(200, 210, 232)); yy += 56
    return img


def a_end(t):
    img = BG.copy(); d = ImageDraw.Draw(img)
    a = ease_out(t / 0.4)
    center_text(d, 470 + int((1 - a) * 50), "Sen hangisisin?", F("Bold", 100), CREAM)
    for i, (col, L) in enumerate([(CORAL, "Ç"), (TEAL, "S")]):
        b = ease_out((t - 0.3 - 0.15 * i) / 0.35)
        if b > 0:
            coach_badge(d, W / 2 - 150 + 300 * i, 760, 100, col, L, b)
    c = ease_out((t - 0.8) / 0.4)
    if c > 0:
        center_text(d, 940, "Yoruma yaz: Ç mi, S mi?", F("Bold", 66), GOLD)
        center_text(d, 1060, "Hangisine ihtiyacı olan bir arkadaşını etiketle.", F("Medium", 50), CREAM, maxw=W - 220, lh=1.25)
    logo(d)
    return img


def a_frame(t):
    if t < A_HOOK:
        return a_hook(t)
    t -= A_HOOK
    if t < 3 * A_SIT:
        i = int(t // A_SIT); return a_sit(i, t - i * A_SIT)
    t -= 3 * A_SIT
    if t < A_RES:
        return a_result(t)
    return a_end(t - A_RES)


def a_events():
    ev = [("sting", 0.0)]
    for i in range(3):
        ev.append(("pop", A_HOOK + i * A_SIT))
    rs = A_HOOK + 3 * A_SIT
    ev += [("ding", rs + 0.5), ("ding", rs + 1.4), ("fanfare", rs + A_RES + 0.3)]
    return ev


# ================================================================ VIDEO B: true / false
TF = [
    ("0 bir çift sayıdır.", True, "Doğru. 0, 2'ye kalansız bölünür; bu yüzden çifttir."),
    ("1 bir asal sayıdır.", False, "Yanlış. Asal sayının tam 2 böleni olur; 1'in tek böleni var."),
    ("Ses suda, havada olduğundan daha hızlı yayılır.", True, "Doğru. Ses havada saniyede ~340 m, suda ~1500 m gider."),
    ("Türkiye'nin ilk anayasası 1924 Anayasası'dır.", False, "Yanlış. İlk anayasa 1921 Teşkilât-ı Esasiye Kanunu'dur."),
]
B_HOOK, B_IN, B_CD, B_REV, B_END = 2.5, 0.7, 3.0, 2.1, 3.6
B_Q = B_IN + B_CD + B_REV
B_TOTAL = B_HOOK + 4 * B_Q + B_END


def b_hook(t):
    img = BG.copy(); d = ImageDraw.Draw(img)
    pill(d, W / 2, 470, "4 SORU · 3 SANİYE", GOLD, NAVY)
    a = ease_out(t / 0.4)
    center_text(d, 600 + int((1 - a) * 50), "Doğru mu,", F("Bold", 130), TEAL)
    b = ease_out((t - 0.45) / 0.4)
    if b > 0:
        center_text(d, 760 + int((1 - b) * 50), "yanlış mı?", F("Bold", 130), CORAL)
    c = ease_out((t - 1.1) / 0.4)
    if c > 0:
        center_text(d, 1000, "Son soru tuzaklı. Dikkat!", F("Medium", 50), fade_col(CREAM, c), maxw=W - 200)
    logo(d)
    return img


def b_q(i, t):
    s, ans, why = TF[i]
    img = BG.copy(); d = ImageDraw.Draw(img)
    pill(d, W / 2, 300, f"SORU {i + 1}/4", GOLD, NAVY)
    a = ease_out(t / 0.35)
    y = 420 + int((1 - a) * 40)
    d.rounded_rectangle([90, y, W - 90, y + 380], radius=44, fill=CARD)
    from reel_quiz import wrap
    lines = wrap(d, s, F("Bold", 70), W - 260)
    ly = y + (380 - len(lines) * 84) / 2
    for line in lines:
        d.text(((W - d.textlength(line, font=F("Bold", 70))) / 2, ly), line, font=F("Bold", 70), fill=CREAM); ly += 84
    revealed = t >= B_IN + B_CD
    rt = t - (B_IN + B_CD)
    for k, (lab, val, col) in enumerate([("DOĞRU", True, TEAL), ("YANLIŞ", False, CORAL)]):
        x0 = 90 + k * 470
        x1 = x0 + 430
        yy = 870
        if revealed:
            if val == ans:
                pop = 1 + 0.05 * math.sin(min(rt, 0.3) / 0.3 * math.pi)
                cx, cy = (x0 + x1) / 2, yy + 85
                d.rounded_rectangle([cx - 215 * pop, cy - 85 * pop, cx + 215 * pop, cy + 85 * pop], radius=44, fill=col)
                f = F("Bold", 60)
                d.text((cx - d.textlength(lab, font=f) / 2 - 30, cy - 40), lab, font=f, fill=NAVY)
                check(d, cx + d.textlength(lab, font=f) / 2 - 10, cy - 28, 50, NAVY)
            else:
                d.rounded_rectangle([x0, yy, x1, yy + 170], radius=44, fill=(28, 38, 70))
                f = F("Bold", 60)
                d.text(((x0 + x1) / 2 - d.textlength(lab, font=f) / 2, yy + 45), lab, font=f, fill=(95, 108, 140))
        else:
            d.rounded_rectangle([x0, yy, x1, yy + 170], radius=44, outline=col, width=6, fill=CARD)
            f = F("Bold", 60)
            d.text(((x0 + x1) / 2 - d.textlength(lab, font=f) / 2, yy + 45), lab, font=f, fill=col)
    if not revealed and t >= B_IN:
        ct = t - B_IN
        n = 3 - int(ct); frac = ct - int(ct)
        cx, cy, r = W / 2, 1210, 95
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(50, 66, 112), width=16)
        d.arc([cx - r, cy - r, cx + r, cy + r], -90, -90 + 360 * (1 - ct / B_CD), fill=CORAL if n == 1 else GOLD, width=16)
        f = F("Bold", int(120 * (1.25 - 0.25 * ease_out(frac / 0.25))))
        d.text((cx - d.textlength(str(n), font=f) / 2, cy - f.size * 0.62), str(n), font=f, fill=CORAL if n == 1 else CREAM)
    elif revealed:
        b = ease_out(rt / 0.3)
        center_text(d, 1110, why, F("Medium", 50), fade_col(CREAM, b), maxw=W - 200, lh=1.3)
    return img


def b_end(t):
    img = BG.copy(); d = ImageDraw.Draw(img)
    a = ease_out(t / 0.4)
    center_text(d, 430 + int((1 - a) * 50), "Kaç tane bildin?", F("Bold", 104), CREAM)
    cols = [CORAL, ORANGE, GOLD, (180, 220, 120), TEAL]
    for i in range(5):
        bi = ease_out((t - 0.3 - 0.08 * i) / 0.3)
        if bi <= 0:
            continue
        x = W / 2 - 360 + 180 * i
        r = 72 * bi
        d.ellipse([x - r, 760 - r, x + r, 760 + r], fill=cols[i])
        f = F("Bold", max(1, int(80 * bi)))
        d.text((x - d.textlength(str(i), font=f) / 2, 760 - f.size * 0.62), str(i), font=f, fill=NAVY)
    c = ease_out((t - 0.9) / 0.4)
    if c > 0:
        center_text(d, 920, "Puanını yoruma yaz.", F("Bold", 70), GOLD)
        center_text(d, 1040, "4/4 yapacağını düşündüğün arkadaşına gönder.", F("Medium", 50), CREAM, maxw=W - 220, lh=1.25)
    logo(d)
    return img


def b_frame(t):
    if t < B_HOOK:
        return b_hook(t)
    t -= B_HOOK
    if t < 4 * B_Q:
        i = int(t // B_Q); return b_q(i, t - i * B_Q)
    return b_end(t - 4 * B_Q)


def b_events():
    ev = [("sting", 0.0)]
    for i in range(4):
        base = B_HOOK + i * B_Q
        ev.append(("pop", base))
        for s in range(3):
            ev.append(("tick" if s < 2 else "tick_last", base + B_IN + s))
        ev.append(("ding", base + B_IN + B_CD))
    ev.append(("fanfare", B_HOOK + 4 * B_Q + 0.3))
    return ev


if __name__ == "__main__":
    mode = sys.argv[1]
    if mode == "stills":
        for nm, fn, t in [("a_hook", a_frame, 2.3), ("a_sit", a_frame, A_HOOK + 2.5), ("a_res", a_frame, A_HOOK + 3 * A_SIT + 3.0),
                          ("a_end", a_frame, A_TOTAL - 0.3), ("b_hook", b_frame, 2.2), ("b_cd", b_frame, B_HOOK + B_IN + 1.2),
                          ("b_rev", b_frame, B_HOOK + 3 * B_Q + B_IN + B_CD + 1.2), ("b_end", b_frame, B_TOTAL - 0.3)]:
            fn(t).save(f"{OUT}/s_{nm}.jpg", quality=88)
        print("ok", A_TOTAL, B_TOTAL)
    else:
        render("reel_kocun_hangisi", A_TOTAL, a_frame, a_events())
        render("reel_dogru_yanlis", B_TOTAL, b_frame, b_events())
        print("done", A_TOTAL, B_TOTAL)
