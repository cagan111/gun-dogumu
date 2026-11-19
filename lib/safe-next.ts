/** `?next=` only accepts local paths before browser URL normalization. */
export function safeNext(v: string | string[] | undefined | null): string | null {
  const s = Array.isArray(v) ? v[0] : v;
  if (!s || !s.startsWith("/") || s.startsWith("//")) return null;
  // Controls (notably TAB/LF/CR) can disappear and turn a local path into an authority.
  // eslint-disable-next-line no-control-regex
  if (/[\s\u0000-\u001f\u007f-\u009f\\]/u.test(s)) return null;
  try {
    const base = "https://redirect.invalid";
    return new URL(s, base).origin === base ? s : null;
  } catch {
    return null;
  }
}
