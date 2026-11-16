/**
 * SMS kodlama tespiti ve segment sayısı.
 *  - gsm7   : GSM 03.38 temel + genişletme tablosu (genişletme karakteri ^ { } \ [ ] ~ | € 2 birim) → 160 / 153
 *  - gsm7_tr: GSM-7 + Türkçe tek-kaydırma harfleri (ç ğ ı İ ş Ş …) → sağlayıcıya göre 155 / 149 (ayarlanabilir)
 *  - ucs2   : diğer her şey (emoji, Kiril, …) → 70 / 67; UTF-16 kod birimi sayılır (emoji = 2)
 * Boş metin 0 segmenttir.
 */
export type SmsEncoding = "gsm7" | "gsm7_tr" | "ucs2";

export interface SegmentLimits { single: number; multi: number }
export type SegmentProfile = Record<SmsEncoding, SegmentLimits>;

export const DEFAULT_SEGMENT_PROFILE: SegmentProfile = {
  gsm7: { single: 160, multi: 153 },
  gsm7_tr: { single: 155, multi: 149 },
  ucs2: { single: 70, multi: 67 },
};

const GSM_BASIC = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà",
);
const GSM_EXT = new Set("^{}\\[~]|€\f");
/** GSM'de olmayan, Türkçe tek-kaydırma tablosundaki harfler. */
const TR_SHIFT = new Set("çÇğĞıİşŞ");

export interface SegmentInfo {
  encoding: SmsEncoding;
  /** Kodlamaya göre uzunluk (gsm7: genişletme 2 sayılır; ucs2: UTF-16 kod birimi). */
  length: number;
  segments: number;
  /** Bu kodlamada tek / çok parçalı limitler. */
  limits: SegmentLimits;
}

export function detectEncoding(text: string): SmsEncoding {
  let tr = false;
  for (const ch of text) {
    if (GSM_BASIC.has(ch) || GSM_EXT.has(ch)) continue;
    if (TR_SHIFT.has(ch)) { tr = true; continue; }
    return "ucs2";
  }
  return tr ? "gsm7_tr" : "gsm7";
}

export function smsSegments(text: string, profile: SegmentProfile = DEFAULT_SEGMENT_PROFILE): SegmentInfo {
  const encoding = detectEncoding(text);
  const limits = profile[encoding];
  let length = 0;
  if (encoding === "ucs2") length = text.length;
  else for (const ch of text) length += GSM_EXT.has(ch) ? 2 : 1;
  const segments = length === 0 ? 0 : length <= limits.single ? 1 : Math.ceil(length / limits.multi);
  return { encoding, length, segments, limits };
}
