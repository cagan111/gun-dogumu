import { describe, expect, it } from "vitest";
import { DEFAULT_SEGMENT_PROFILE, detectEncoding, smsSegments, type SegmentProfile } from "@/lib/messaging/segments";

const rep = (c: string, n: number) => c.repeat(n);

describe("kodlama tespiti", () => {
  it("düz ASCII ve GSM harfleri gsm7", () => {
    expect(detectEncoding("Merhaba dunya 123 !?")).toBe("gsm7");
    expect(detectEncoding("é è ù ì ò Ç ü ö ä ñ Ä Ö Ü £ $ ¥ @ _")).toBe("gsm7");
    expect(detectEncoding("")).toBe("gsm7");
  });
  it("genişletme tablosu karakterleri gsm7 kalır", () => {
    expect(detectEncoding("a^b{c}d\\e[f]g~h|i€")).toBe("gsm7");
  });
  it("Türkçe harfler gsm7_tr", () => {
    for (const ch of ["ç", "ğ", "ı", "İ", "ş", "Ş", "Ğ"]) expect(detectEncoding(`a${ch}b`)).toBe("gsm7_tr");
    expect(detectEncoding("Çok güzel öğle şekeri")).toBe("gsm7_tr");
  });
  it("emoji, Kiril, Yunanca-dışı ve tipografik tırnak ucs2", () => {
    expect(detectEncoding("Selam 😀")).toBe("ucs2");
    expect(detectEncoding("Привет")).toBe("ucs2");
    expect(detectEncoding("“tırnak”")).toBe("ucs2");
    expect(detectEncoding("şş ✓")).toBe("ucs2"); // Türkçe + desteklenmeyen karakter → ucs2
  });
});

describe("segment sayısı: GSM-7", () => {
  it("160 tek, 161 iki segment", () => {
    expect(smsSegments(rep("a", 160))).toMatchObject({ encoding: "gsm7", length: 160, segments: 1 });
    expect(smsSegments(rep("a", 161)).segments).toBe(2);
  });
  it("çok parçalıda 153: 306 → 2, 307 → 3", () => {
    expect(smsSegments(rep("a", 306)).segments).toBe(2);
    expect(smsSegments(rep("a", 307)).segments).toBe(3);
    expect(smsSegments(rep("a", 459)).segments).toBe(3);
    expect(smsSegments(rep("a", 460)).segments).toBe(4);
  });
  it("genişletme karakteri 2 sayılır", () => {
    expect(smsSegments("€")).toMatchObject({ length: 2, segments: 1 });
    expect(smsSegments(rep("a", 159) + "€")).toMatchObject({ length: 161, segments: 2 });
    expect(smsSegments(rep("a", 158) + "€").segments).toBe(1);
    expect(smsSegments(rep("[", 80)).segments).toBe(1); // 160 birim
    expect(smsSegments(rep("[", 81)).segments).toBe(2);
  });
  it("boş metin 0 segment, tek karakter 1", () => {
    expect(smsSegments("").segments).toBe(0);
    expect(smsSegments("a").segments).toBe(1);
  });
  it("satır sonu ve boşluk gsm7 tek birim", () => {
    expect(smsSegments("a\nb\r c")).toMatchObject({ encoding: "gsm7", length: 6 });
  });
});

describe("segment sayısı: Türkçe tek-kaydırma (155/149)", () => {
  it("155 tek, 156 iki", () => {
    expect(smsSegments("ş" + rep("a", 154))).toMatchObject({ encoding: "gsm7_tr", length: 155, segments: 1 });
    expect(smsSegments("ş" + rep("a", 155)).segments).toBe(2);
  });
  it("çok parçalıda 149: 298 → 2, 299 → 3", () => {
    expect(smsSegments("ş" + rep("a", 297)).segments).toBe(2);
    expect(smsSegments("ş" + rep("a", 298)).segments).toBe(3);
  });
  it("genişletme karakteri Türkçe modda da 2 sayılır", () => {
    expect(smsSegments("ş€" + rep("a", 152))).toMatchObject({ length: 155, segments: 1 });
    expect(smsSegments("ş€" + rep("a", 153)).segments).toBe(2);
  });
  it("sağlayıcıya göre ayarlanabilir profil (160/153 gibi)", () => {
    const p: SegmentProfile = { ...DEFAULT_SEGMENT_PROFILE, gsm7_tr: { single: 160, multi: 153 } };
    expect(smsSegments("ş" + rep("a", 159), p).segments).toBe(1);
    expect(smsSegments("ş" + rep("a", 159)).segments).toBe(2); // varsayılan 155
  });
});

describe("segment sayısı: UCS-2 (70/67)", () => {
  it("70 tek, 71 iki; 134 → 2, 135 → 3", () => {
    expect(smsSegments(rep("я", 70))).toMatchObject({ encoding: "ucs2", length: 70, segments: 1 });
    expect(smsSegments(rep("я", 71)).segments).toBe(2);
    expect(smsSegments(rep("я", 134)).segments).toBe(2);
    expect(smsSegments(rep("я", 135)).segments).toBe(3);
  });
  it("emoji 2 kod birimi sayılır", () => {
    expect(smsSegments(rep("😀", 35)).segments).toBe(1); // 70 birim
    expect(smsSegments(rep("😀", 36)).segments).toBe(2);
  });
  it("tek ucs2 karakter tüm mesajı ucs2'ye çevirir", () => {
    expect(smsSegments(rep("a", 100) + "😀").segments).toBe(2);
  });
});
