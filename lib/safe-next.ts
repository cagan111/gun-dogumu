/** `?next=` yalnız site içi yola izin verir (açık yönlendirme yok). */
export function safeNext(v: string | string[] | undefined | null): string | null {
  const s = Array.isArray(v) ? v[0] : v;
  if (!s || !s.startsWith("/") || s.startsWith("//") || s.includes("\\")) return null;
  return s;
}
