const MAP: Record<string, string> = { ç: "c", ğ: "g", ı: "i", i: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };

/** "Girne Glow Kuaför" → "girne-glow-kuafor" (en çok 40 karakter). */
export function slugify(input: string): string {
  const s = input.toLocaleLowerCase("tr-TR").replace(/[çğıöşüâîû]/g, (c) => MAP[c] ?? c).normalize("NFD").replace(/[̀-ͯ]/g, "");
  return s.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/g, "");
}
