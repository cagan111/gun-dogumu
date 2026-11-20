/** Iterate instead of recursing: JSON strings/keys must not pass PostgreSQL a NUL. */
export function hasNul(value: unknown): boolean {
  const pending: unknown[] = [value], seen = new WeakSet<object>();
  while (pending.length) {
    const current = pending.pop();
    if (typeof current === "string") { if (current.includes("\0")) return true; continue; }
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);
    for (const [key, child] of Object.entries(current)) {
      if (key.includes("\0")) return true;
      pending.push(child);
    }
  }
  return false;
}
export function invalidUrlText(pathname: string, query: Iterable<[string, string]>): boolean {
  try { if (decodeURIComponent(pathname).includes("\0")) return true; }
  catch { return true; }
  for (const [key, value] of query) if (key.includes("\0") || value.includes("\0")) return true;
  return false;
}
/** Prisma contains uses LIKE: quote pattern metacharacters, not SQL syntax. */
export function literalLike(term: string): string { return term.replace(/[\\%_]/g, "\\$&"); }
