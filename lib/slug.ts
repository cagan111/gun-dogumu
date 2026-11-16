import { z } from "zod";

export const RESERVED_SLUGS = [
  "admin", "panel", "api", "giris", "kayit", "r", "randevularim", "fiyatlar", "gizlilik", "kosullar",
] as const;

export const SLUG_REGEX = /^[a-z0-9-]{3,40}$/;

export type SlugProblem = "format" | "reserved";

/** null = geçerli. (Veritabanı müsaitliği ayrıca kontrol edilir.) */
export function slugProblem(slug: string): SlugProblem | null {
  if (!SLUG_REGEX.test(slug)) return "format";
  if (slug.startsWith("-") || slug.endsWith("-")) return "format";
  if ((RESERVED_SLUGS as readonly string[]).includes(slug)) return "reserved";
  return null;
}

export const slugSchema = z
  .string()
  .trim()
  .superRefine((v, ctx) => {
    const p = slugProblem(v);
    if (p) ctx.addIssue({ code: z.ZodIssueCode.custom, message: p === "reserved" ? "slug_reserved" : "slug_format" });
  });
