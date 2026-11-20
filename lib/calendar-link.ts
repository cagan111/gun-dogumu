/** A capability response may only produce this app's exact feed URL. */
export function calendarLinkUrl(path: unknown, origin: string): string | null {
  if (typeof path !== "string" || path.length !== "/api/calendar/".length + 43 || !/^\/api\/calendar\/[A-Za-z0-9_-]{43}$/.test(path)) return null;
  try {
    const base = new URL(origin);
    if (!["http:", "https:"].includes(base.protocol)) return null;
    return new URL(path, base.origin).href;
  } catch { return null; }
}
