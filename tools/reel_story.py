"""Hikayeli Reels: Flow sahneleri + Turkce yazi + kapanis karti. Flow sesi korunur.
Kullanim: python3 reel_story.py [--stills]   (cikti: OUT/reel_alarm_ucuncu_kez.mp4)
Yeni hikaye icin SCENES ve CLOSING'i degistir."""
import os, subprocess, sys, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, "/home/claude/gun-dogumu/tools")
from reel_quiz import W, H, F, BG, CREAM, GOLD, NAVY

SRC = "/mnt/user-data/uploads/FBT/Downloads/"
OUT = "/home/claude/work/out"
NAME = "reel_alarm_ucuncu_kez"
FPS = 30
os.makedirs(OUT, exist_ok=True)

# her satir: (metin, font agirligi, boyut, renk, belirme zamani sn)
SCENES = [
    dict(file="Phone_alarm_glowing_in_bedroom_06449605.mp4", dur=6.6, lines=[
        ("06:30.", "Bold", 120, GOLD, 0.3),
        ("Alarm üçüncü kez çaldı.", "Bold", 64, CREAM, 1.2),
        ("Bugün de ertelesem mi?", "Medium", 60, CREAM, 3.4)]),
    dict(file="Sunrise_over_student_desk_3aa72fc5.mp4", dur=6.6, lines=[
        ("Sonra ışık masaya düştü.", "Bold", 64, CREAM, 0.4),
        ("Sadece 25 dakika, dedim.", "Bold", 64, GOLD, 2.8)]),
    dict(file="Timer_ringing_on_wooden_desk_55d3b1a5.mp4", dur=7.9, lines=[
        ("Bir tur.", "Bold", 72, CREAM, 0.4),
        ("Sonra bir tur daha.", "Bold", 72, CREAM, 1.9),
        ("Akşam altı tur bitmişti.", "Bold", 72, GOLD, 4.2)]),
]
CLOSE_DUR = 4.2
TOP = 300          # Reels ust arayuzunun altinda
MAXW = W - 180


def wrap(d, text, font):
    lines, cur = [], ""
    for w in text.split(" "):
        t = (cur + " " + w).strip()
        if d.textlength(t, font=font) <= MAXW:
            cur = t
        else:
            lines.append(cur); cur = w
    lines.append(cur)
    return lines


def layout(lines):
    """-> [(y, [satirlar], font, renk, t)], alt sinir"""
    d = ImageDraw.Draw(Image.new("RGB", (8, 8)))
    y, out = TOP, []
    for text, wgt, size, col, t in lines:
        f = F(wgt, size)
        ws = wrap(d, text, f)
        out.append((y, ws, f, col, t))
        y += int(size * 1.22) * len(ws) + 26
    return out, y - 26


def scene_layers(lines):
    """Panel (hep gorunur) + her satir icin seffaf katman."""
    lay, bottom = layout(lines)
    panel = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(panel).rounded_rectangle([50, TOP - 50, W - 50, bottom + 50], radius=48, fill=(8, 12, 26, 180))
    panel = panel.filter(ImageFilter.GaussianBlur(22))
    layers = []
    for y, ws, f, col, t in lay:
        im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ds, d = ImageDraw.Draw(sh), ImageDraw.Draw(im)
        yy = y
        for line in ws:
            x = (W - d.textlength(line, font=f)) / 2
            ds.text((x + 3, yy + 4), line, font=f, fill=(0, 0, 0, 200))
            d.text((x, yy), line, font=f, fill=col + (255,))
            yy += int(f.size * 1.22)
        im = Image.alpha_composite(sh.filter(ImageFilter.GaussianBlur(5)), im)
        layers.append((im, t))
    return panel, layers


def closing_layers():
    bg = BG.copy()
    d = ImageDraw.Draw(bg)
    # dogan gunes
    cx, cy, r = W / 2, 1010, 150
    glow = Image.new("RGB", (W, H), (0, 0, 0))
    ImageDraw.Draw(glow).ellipse([cx - 330, cy - 330, cx + 330, cy + 330], fill=(110, 60, 20))
    glow = glow.filter(ImageFilter.GaussianBlur(120))
    bg = Image.fromarray(np.clip(np.asarray(bg, np.int16) + np.asarray(glow, np.int16), 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(bg)
    d.pieslice([cx - r, cy - r, cx + r, cy + r], 180, 360, fill=GOLD)
    d.line([cx - r - 70, cy, cx + r + 70, cy], fill=GOLD, width=6)

    def text_layer(items):
        im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        dd = ImageDraw.Draw(im)
        for y, text, f, col in items:
            for line in wrap(dd, text, f):
                dd.text(((W - dd.textlength(line, font=f)) / 2, y), line, font=f, fill=col + (255,))
                y += int(f.size * 1.2)
        return im

    l1 = text_layer([(470, "Her gün güneş doğar.", F("Bold", 78), CREAM)])
    l2 = text_layer([(1100, "Sen de bir turla başla.", F("Bold", 78), GOLD)])
    l3 = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d3 = ImageDraw.Draw(l3)
    f = F("Bold", 54); s = 56; txt = "gün doğumu"
    tw = d3.textlength(txt, font=f); x = (W - (s + 18 + tw)) / 2; y = 1330
    d3.pieslice([x, y, x + s, y + s], 180, 360, fill=GOLD + (255,))
    d3.line([x - 8, y + s / 2, x + s + 8, y + s / 2], fill=GOLD + (255,), width=4)
    d3.text((x + s + 18, y - 12), txt, font=f, fill=CREAM + (255,))
    f2 = F("Medium", 40); t2 = "Google Play: Gün Doğumu"
    w2 = d3.textlength(t2, font=f2)
    d3.rounded_rectangle([(W - w2) / 2 - 36, 1440, (W + w2) / 2 + 36, 1440 + 84], radius=42, fill=(36, 52, 98, 255))
    d3.text(((W - w2) / 2, 1440 + 14), t2, font=f2, fill=CREAM + (255,))
    return bg, [(l1, 0.3), (l2, 1.3), (l3, 2.1)]


ENC = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-r", str(FPS), "-an"]


def run(cmd):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error"] + cmd, check=True)


def overlay_graph(base, n_layers, times, dur, first=1, fade_in=True):
    """base etiketi uzerine katmanlari sirayla, her biri kendi zamaninda belirerek bindirir."""
    parts, cur = [], base
    for i in range(n_layers):
        t = times[i]
        lab = f"l{i}"
        parts.append(f"[{first + i}:v]format=rgba,loop=-1:1,trim=duration={dur},fade=t=in:st={t}:d=0.35:alpha=1[{lab}]")
        parts.append(f"[{cur}][{lab}]overlay=0:0:shortest=1[o{i}]")
        cur = f"o{i}"
    return parts, cur


def render_scene(i, sc, stills=False):
    panel, layers = scene_layers(sc["lines"])
    pp = f"{OUT}/s{i}_panel.png"; panel.save(pp)
    ins = ["-t", str(sc["dur"]), "-i", SRC + sc["file"], "-i", pp]
    for k, (im, _) in enumerate(layers):
        p = f"{OUT}/s{i}_l{k}.png"; im.save(p); ins += ["-i", p]
    g = [f"[0:v]fps={FPS},scale={W}:{H}:flags=lanczos,setsar=1,trim=duration={sc['dur']}[v0]",
         f"[1:v]format=rgba,loop=-1:1,trim=duration={sc['dur']}[pn]", "[v0][pn]overlay=0:0:shortest=1[vb]"]
    parts, cur = overlay_graph("vb", len(layers), [t for _, t in layers], sc["dur"], first=2)
    g += parts
    if i == 0:
        g.append(f"[{cur}]fade=t=in:st=0:d=0.3[vo]"); cur = "vo"
    if stills:
        t = max(t for _, t in layers) + 0.8
        run(ins + ["-filter_complex", ";".join(g), "-map", f"[{cur}]", "-ss", str(t), "-frames:v", "1", f"{OUT}/still_s{i}.jpg"])
        return
    tmp = f"{OUT}/s{i}.part.mp4"
    run(ins + ["-filter_complex", ";".join(g), "-map", f"[{cur}]"] + ENC + ["-t", str(sc["dur"]), tmp])
    os.replace(tmp, f"{OUT}/s{i}.mp4")


def render_closing(stills=False):
    bg, layers = closing_layers()
    bp = f"{OUT}/c_bg.png"; bg.save(bp)
    ins = ["-framerate", str(FPS), "-i", bp]
    for k, (im, _) in enumerate(layers):
        p = f"{OUT}/c_l{k}.png"; im.save(p); ins += ["-i", p]
    g = [f"[0:v]format=yuv420p,loop=-1:1,trim=duration={CLOSE_DUR},fade=t=in:st=0:d=0.4[vb]"]
    parts, cur = overlay_graph("vb", len(layers), [t for _, t in layers], CLOSE_DUR)
    g += parts
    if stills:
        run(ins + ["-filter_complex", ";".join(g), "-map", f"[{cur}]", "-ss", "3.2", "-frames:v", "1", f"{OUT}/still_c.jpg"])
        return
    tmp = f"{OUT}/c.part.mp4"
    run(ins + ["-filter_complex", ";".join(g), "-map", f"[{cur}]"] + ENC + ["-t", str(CLOSE_DUR), tmp])
    os.replace(tmp, f"{OUT}/c.mp4")


def chime(path, dur):
    """Kapanis icin kodla uretilmis yumusak akor (telifsiz)."""
    sr = 48000; n = int(dur * sr); out = np.zeros(n)
    for k, (f, t0) in enumerate([(392.0, 0.25), (523.25, 0.45), (659.25, 0.65), (783.99, 1.3)]):
        tt = np.arange(n - int(t0 * sr)) / sr
        sig = 0.22 * (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(4 * np.pi * f * tt)) * np.exp(-1.6 * tt) * np.minimum(1, tt / 0.02)
        out[int(t0 * sr):] += sig
    fd = int(0.8 * sr); out[-fd:] *= np.linspace(1, 0, fd)
    pcm = (out / np.abs(out).max() * 0.5 * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes(np.stack([pcm, pcm], 1).tobytes())


def main():
    stills = "--stills" in sys.argv
    for i, sc in enumerate(SCENES):
        render_scene(i, sc, stills)
    render_closing(stills)
    if stills:
        return
    with open(f"{OUT}/list.txt", "w") as fh:
        for i in range(len(SCENES)):
            fh.write(f"file 's{i}.mp4'\n")
        fh.write("file 'c.mp4'\n")
    run(["-f", "concat", "-safe", "0", "-i", f"{OUT}/list.txt", "-c", "copy", f"{OUT}/video.mp4"])
    # ses: Flow sesleri (kesimlerde kisa gecis) + kapanis akoru
    chime(f"{OUT}/chime.wav", CLOSE_DUR)
    ins, g, labs = [], [], []
    for i, sc in enumerate(SCENES):
        ins += ["-t", str(sc["dur"]), "-i", SRC + sc["file"]]
        d = sc["dur"]
        g.append(f"[{i}:a]aresample=48000,apad,atrim=duration={d},afade=t=in:st=0:d=0.08,afade=t=out:st={d - 0.25}:d=0.25[a{i}]")
        labs.append(f"[a{i}]")
    ins += ["-i", f"{OUT}/chime.wav"]
    n = len(SCENES)
    g.append("".join(labs) + f"[{n}:a]concat=n={n + 1}:v=0:a=1,loudnorm=I=-16:TP=-1.5:LRA=11[a]")
    run(ins + ["-filter_complex", ";".join(g), "-map", "[a]", "-ar", "48000", f"{OUT}/audio.wav"])
    tmp = f"{OUT}/{NAME}.part.mp4"
    run(["-i", f"{OUT}/video.mp4", "-i", f"{OUT}/audio.wav", "-map", "0:v", "-map", "1:a", "-c:v", "copy",
         "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", tmp])
    os.replace(tmp, f"{OUT}/{NAME}.mp4")
    print(f"{OUT}/{NAME}.mp4")


if __name__ == "__main__":
    main()
