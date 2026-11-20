/** Only Google's direct review entry points; never fetch or follow a pasted URL. */
export function isGoogleReviewUrl(value: string): boolean {
  if (value.length > 500 || /[\s\\#]/.test(value)) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) return false;
    if (url.hostname === "g.page") return /^\/r\/[A-Za-z0-9_-]{1,200}\/review$/.test(url.pathname) && !url.search;
    if (url.hostname !== "search.google.com" || url.pathname !== "/local/writereview") return false;
    const keys = [...url.searchParams.keys()];
    return keys.length === 1 && keys[0] === "placeid" && /^[A-Za-z0-9_-]{1,255}$/.test(url.searchParams.get("placeid") ?? "");
  } catch { return false; }
}
