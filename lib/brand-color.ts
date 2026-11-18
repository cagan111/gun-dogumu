/** "#rrggbb" → "R G B" (Tailwind alfa destekli CSS değişkeni) ve okunur ön plan rengi. */
const HEX = /^#[0-9a-fA-F]{6}$/;
export const DEFAULT_BRAND = "#465635";

export function brandVars(hex: string | null | undefined): Record<string, string> {
  const h = hex && HEX.test(hex) ? hex : DEFAULT_BRAND;
  const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
  const lin = (c: number) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  // beyaz yazı kontrastı 4.5'tan düşükse koyu yazı kullan
  const white = 1.05 / (lum + 0.05) >= 4.5;
  return { "--brand": `${r} ${g} ${b}`, "--brand-fg": white ? "255 255 255" : "15 23 42" };
}
