/** Koşullu sınıf birleştirici (clsx yerine). */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
