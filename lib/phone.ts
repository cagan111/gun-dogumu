import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/core";
import phoneMetadata from "libphonenumber-js/metadata.min.json";
import { z } from "zod";

export const DEFAULT_COUNTRY: CountryCode = "TR";

/** Telefonu E.164'e çevirir; geçersizse null. Ülke kodsuz numaralar varsayılan ülke (TR) sayılır. */
export function normalizePhone(input: string, defaultCountry: CountryCode = DEFAULT_COUNTRY): string | null {
  let raw = input.trim();
  if (!raw || raw.length > 32) return null;
  if (raw.startsWith("00")) raw = "+" + raw.slice(2); // 0090… → +90…
  if (!/^[+\d\s().-]+$/.test(raw)) return null; // harf vb. reddedilir
  const p = parsePhoneNumberFromString(raw, defaultCountry, phoneMetadata);
  if (!p || !p.isValid()) return null;
  return p.number;
}

export function isValidPhone(input: string, defaultCountry: CountryCode = DEFAULT_COUNTRY): boolean {
  return normalizePhone(input, defaultCountry) !== null;
}

/** KKTC cep numarası mı? (+90 533/542/548/539…) */
export function isKktcMobile(e164: string): boolean {
  return /^\+90(533|542|548|539)\d{7}$/.test(e164);
}

/** Zod şeması: girdiyi E.164'e dönüştürür. */
export const phoneSchema = z
  .string()
  .transform((v, ctx) => {
    const n = normalizePhone(v);
    if (!n) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "invalid_phone" });
    return n ?? "";
  });
