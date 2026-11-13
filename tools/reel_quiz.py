"""Gamified quiz Reel: '3 soru, 3 saniye'. 1080x1920 @30fps, frames piped to ffmpeg."""
import math, subprocess, sys, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H, FPS = 1080, 1920, 30
FD = "/usr/share/fonts/truetype/google-fonts/"
NAVY, NAVY2 = (14, 24, 48), (30, 42, 82)
CREAM, GOLD, ORANGE = (255, 246, 229), (255, 200, 87), (255, 138, 61)
CORAL, TEAL, MUTED, CARD = (255, 107, 107), (94, 214, 190), (170, 182, 210), (36, 52, 98)
OUTDIR = "/home/claude/ig/reel1"

_fc = {}
def F(w, s):
    k = (w, s)
    if k not in _fc:
        _fc[k] = ImageFont.truetype(FD + f"Poppins-{w}.ttf", s)
    return _fc[k]

QUESTIONS = [
    dict(q="Bir sayının %20'si 30 ise, %50'si kaçtır?", opts=["60", "75", "90"], ans=1,
         why="%20'si 30 ise tamamı 150. 150'nin yarısı 75."),
    dict(q="Hangisi doğru yazılmış?", opts=["herkez", "herkes", "herkeş"], ans=1,
         why="Doğrusu: herkes. \"Herkez\" en sık yapılan yazım yanlışlarından."),
    dict(q="Bir koşuda 2. sıradakini geçtin. Kaçıncı oldun?", opts=["1.", "2.", "3."], ans=1,
         why="2.'yi geçen onun yerini alır: 2. olursun. Birinciyi geçmedin."),
]

T_HOOK, T_QIN, T_CD, T_REV, T_END = 2.5, 0.8, 3.0, 1.9, 3.6
T_Q = T_QIN + T_CD + T_REV
TOTAL = T_HOOK + 3 * T_Q + T_END


def make_bg():
    img = Image.new("RGB", (W, H), NAVY)
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)], fill=tuple(int(NAVY[i] + (NAVY2[i] - NAVY[i]) * t) for i in range(3)))
    glow = Image.new("RGB", (W, H), (0, 0, 0))
    g = ImageDraw.Draw(glow)
    cy = H + 260
    for r, col in [(820, (70, 32, 18)), (640, (120, 56, 26))]:
        g.ellipse([W / 2 - r, cy - r, W / 2 + r, cy + r], fill=col)
    glow = glow.filter(ImageFilter.GaussianBlur(110))
    arr = np.clip(np.asarray(img, dtype=np.int16) + np.asarray(glow, dtype=np.int16), 0, 255).astype(np.uint8)
    return Image.fromarray(arr)


BG = make_bg()


def wrap(d, text, font, maxw):
    lines, cur = [], ""
    for w in text.split(" "):
        t = (cur + " " + w).strip()
        if d.textlength(t, font=font) <= maxw:
            cur = t
        else:
            lines.append(cur); cur = w
    lines.append(cur)
    return lines


def center_text(d, y, text, font, fill, maxw=W - 160, lh=1.15):
    for line in wrap(d, text, font, maxw):
        d.text(((W - d.textlength(line, font=font)) / 2, y), line, font=font, fill=fill)
        y += int(font.size * lh)
    return y


def ease_out(t):
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 3


def logo(d):
    x, y, s = W / 2 - 150, 1560, 40
    d.pieslice([x, y, x + s, y + s], 180, 360, fill=GOLD)
    d.line([x - 6, y + s / 2, x + s + 6, y + s / 2], fill=GOLD, width=3)
    d.text((x + s + 14, y - 6), "gün doğumu", font=F("Bold", 38), fill=CREAM)


def pill(d, cx, y, text, bg, fg, size=34):
    f = F("Bold", size)
    w = d.textlength(text, font=f)
    x = cx - (w + 48) / 2
    d.rounded_rectangle([x, y, x + w + 48, y + size + 32], radius=(size + 32) // 2, fill=bg)
    d.text((x + 24, y + 12), text, font=f, fill=fg)


def check(d, x, y, s, col):
    d.line([(x, y + s * 0.5), (x + s * 0.38, y + s * 0.85), (x + s, y + s * 0.1)], fill=col, width=int(s * 0.16), joint="curve")


def cross(d, x, y, s, col):
    w = int(s * 0.14)
    d.line([(x, y), (x + s, y + s)], fill=col, width=w)
    d.line([(x + s, y), (x, y + s)], fill=col, width=w)


def frame_hook(t):
    img = BG.copy(); d = ImageDraw.Draw(img)
    a = ease_out(t / 0.45)
    pill(d, W / 2, 470, "MEYDAN OKUMA", GOLD, NAVY)
    y = 600 + int((1 - a) * 60)
    f = F("Bold", int(150 * (0.85 + 0.15 * a)))
    center_text(d, y, "3 soru.", f, CREAM)
    b = ease_out((t - 0.5) / 0.45)
    if b > 0:
        center_text(d, 790 + int((1 - b) * 60), "3 saniye.", F("Bold", int(150 * (0.85 + 0.15 * b))), GOLD)
    c = ease_out((t - 1.1) / 0.4)
    if c > 0:
        center_text(d, 1030, "Kaçını bilirsin?", F("Bold", 76), tuple(int(v * c + NAVY[i] * (1 - c)) for i, v in enumerate(CREAM)))
    logo(d)
    return img


def frame_q(qi, t):
    q = QUESTIONS[qi]
    img = BG.copy(); d = ImageDraw.Draw(img)
    # header
    pill(d, W / 2, 300, f"SORU {qi + 1}/3", GOLD, NAVY)
    a = ease_out(t / 0.35)
    y = center_text(d, 420 + int((1 - a) * 40), q["q"], F("Bold", 70), CREAM, lh=1.18)
    revealed = t >= T_QIN + T_CD
    rt = t - (T_QIN + T_CD)
    oy = max(y + 60, 760)
    for i, opt in enumerate(q["opts"]):
        ai = ease_out((t - 0.12 * i - 0.15) / 0.35)
        if ai <= 0:
            continue
        x0, x1 = 120 + int((1 - ai) * 80), W - 120 + int((1 - ai) * 80)
        yy = oy + i * 175
        fill, txt, lab = CARD, CREAM, GOLD
        if revealed:
            if i == q["ans"]:
                pop = 1 + 0.04 * math.sin(min(rt, 0.3) / 0.3 * math.pi)
                fill, txt, lab = TEAL, NAVY, NAVY
                cx, cyy = (x0 + x1) / 2, yy + 70
                hw, hh = (x1 - x0) / 2 * pop, 70 * pop
                d.rounded_rectangle([cx - hw, cyy - hh, cx + hw, cyy + hh], radius=40, fill=fill)
            else:
                fill, txt, lab = (28, 38, 70), (95, 108, 140), (95, 108, 140)
                d.rounded_rectangle([x0, yy, x1, yy + 140], radius=40, fill=fill)
        else:
            d.rounded_rectangle([x0, yy, x1, yy + 140], radius=40, fill=fill)
        d.text((x0 + 50, yy + 34), "ABC"[i], font=F("Bold", 60), fill=lab)
        d.text((x0 + 150, yy + 34), opt, font=F("Bold", 60), fill=txt)
        if revealed:
            if i == q["ans"]:
                check(d, x1 - 120, yy + 40, 60, NAVY)
            else:
                cross(d, x1 - 110, yy + 45, 48, (120, 70, 80))
    by = oy + 3 * 175 + 40
    if not revealed and t >= T_QIN:
        ct = t - T_QIN
        n = 3 - int(ct)
        frac = ct - int(ct)
        # ring countdown
        cx, cy, r = W / 2, by + 115, 95
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(50, 66, 112), width=16)
        d.arc([cx - r, cy - r, cx + r, cy + r], -90, -90 + 360 * (1 - ct / T_CD), fill=CORAL if n == 1 else GOLD, width=16)
        s = 1.25 - 0.25 * ease_out(frac / 0.25)
        f = F("Bold", int(120 * s))
        txt = str(n)
        d.text((cx - d.textlength(txt, font=f) / 2, cy - f.size * 0.62), txt, font=f, fill=CORAL if n == 1 else CREAM)
    elif revealed:
        b = ease_out(rt / 0.3)
        col = tuple(int(v * b + NAVY2[i] * (1 - b)) for i, v in enumerate(CREAM))
        center_text(d, by + 30, q["why"], F("Medium", 50), col, maxw=W - 200, lh=1.3)
    return img


def frame_end(t):
    img = BG.copy(); d = ImageDraw.Draw(img)
    a = ease_out(t / 0.4)
    center_text(d, 430 + int((1 - a) * 50), "Kaç tane bildin?", F("Bold", 104), CREAM)
    b = ease_out((t - 0.35) / 0.4)
    if b > 0:
        xs = [W / 2 - 330, W / 2 - 110, W / 2 + 110, W / 2 + 330]
        for i, x in enumerate(xs):
            bi = ease_out((t - 0.35 - 0.1 * i) / 0.3)
            if bi <= 0:
                continue
            r = 85 * bi
            col = [CORAL, ORANGE, GOLD, TEAL][i]
            d.ellipse([x - r, 790 - r, x + r, 790 + r], fill=col)
            f = F("Bold", int(90 * bi) or 1)
            s = str(i)
            d.text((x - d.textlength(s, font=f) / 2, 790 - f.size * 0.62), s, font=f, fill=NAVY)
    c = ease_out((t - 0.9) / 0.4)
    if c > 0:
        center_text(d, 960, "Yoruma yaz.", F("Bold", 72), GOLD)
        center_text(d, 1090, "Arkadaşına gönder, bakalım o kaç bilecek.", F("Medium", 52), CREAM, maxw=W - 220, lh=1.25)
    logo(d)
    return img


def frame_at(t):
    if t < T_HOOK:
        return frame_hook(t)
    t2 = t - T_HOOK
    qi = int(t2 // T_Q)
    if qi < 3:
        return frame_q(qi, t2 - qi * T_Q)
    return frame_end(t2 - 3 * T_Q)


def render_audio(path):
    sr = 44100
    n = int(TOTAL * sr)
    out = np.zeros(n, dtype=np.float64)

    def add(start, sig):
        i = int(start * sr)
        j = min(n, i + len(sig))
        out[i:j] += sig[: j - i]

    def tone(f, dur, vol, decay=30.0):
        tt = np.arange(int(dur * sr)) / sr
        return vol * np.sin(2 * np.pi * f * tt) * np.exp(-decay * tt)

    def kick(vol=0.55):
        tt = np.arange(int(0.18 * sr)) / sr
        freq = 110 * np.exp(-tt * 18) + 42
        ph = 2 * np.pi * np.cumsum(freq) / sr
        return vol * np.sin(ph) * np.exp(-tt * 14)

    def hat(vol=0.06):
        tt = np.arange(int(0.05 * sr)) / sr
        return vol * np.random.default_rng(1).standard_normal(len(tt)) * np.exp(-tt * 90)

    # light beat 120 bpm across the whole video
    beat = 0.5
    k = 0.0
    while k < TOTAL - 0.3:
        add(k, kick(0.35))
        add(k + beat / 2, hat())
        k += beat
    # hook stingers
    add(0.0, tone(523, 0.4, 0.25, 8)); add(0.5, tone(659, 0.4, 0.25, 8))
    for qi in range(3):
        base = T_HOOK + qi * T_Q
        add(base, tone(880, 0.25, 0.18, 14))
        for s in range(3):
            add(base + T_QIN + s, tone(1320 if s < 2 else 1760, 0.12, 0.32, 40))
        rv = base + T_QIN + T_CD
        add(rv, tone(1046, 0.6, 0.32, 6)); add(rv + 0.08, tone(1568, 0.6, 0.26, 6))
    eb = T_HOOK + 3 * T_Q
    for i, f in enumerate([523, 659, 784, 1046]):
        add(eb + 0.35 + 0.1 * i, tone(f, 0.5, 0.22, 7))
    fade = int(0.6 * sr)
    out[-fade:] *= np.linspace(1, 0, fade)
    out = out / max(1e-9, np.abs(out).max()) * 0.85
    pcm = (out * 32767).astype(np.int16)
    st = np.stack([pcm, pcm], axis=1)
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes(st.tobytes())


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "full"
    if mode == "stills":
        for name, t in [("hook", 2.0), ("q1_cd", T_HOOK + T_QIN + 0.1), ("q1_rev", T_HOOK + T_QIN + T_CD + 1.0),
                        ("q3_rev", T_HOOK + 2 * T_Q + T_QIN + T_CD + 1.0), ("q2_cd1", T_HOOK + T_Q + T_QIN + 2.3), ("end", TOTAL - 0.3)]:
            frame_at(t).save(f"{OUTDIR}/still_{name}.jpg", quality=90)
        print("stills ok")
    else:
        render_audio(f"{OUTDIR}/audio.wav")
        nfr = int(round(TOTAL * FPS))
        tmp = f"{OUTDIR}/video_tmp.mp4"
        p = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                              "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "veryfast",
                              "-crf", "18", "-pix_fmt", "yuv420p", tmp], stdin=subprocess.PIPE)
        for i in range(nfr):
            p.stdin.write(frame_at(i / FPS).tobytes())
        p.stdin.close()
        assert p.wait() == 0
        final_tmp = f"{OUTDIR}/reel_tmp.mp4"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp, "-i", f"{OUTDIR}/audio.wav", "-map", "0:v",
                        "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest",
                        "-movflags", "+faststart", final_tmp], check=True)
        import os
        os.replace(final_tmp, f"{OUTDIR}/reel_3soru.mp4")
        print("done", TOTAL)
