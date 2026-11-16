/**
 * Kayan pencereli hız sınırı. Arayüz (`RateLimiter`) sabit; bellek içi uygulama tek süreçte çalışır.
 * Çok örnekli kurulumda DB/Redis tabanlı bir uygulama `setRateLimiter()` ile takılabilir.
 */
export interface RateLimitResult {
  ok: boolean;
  /** Pencerede kalan hak (reddedildiyse 0). */
  remaining: number;
  /** Reddedildiyse tekrar denemek için beklenecek saniye. */
  retryAfterSec: number;
}

export interface RateLimiter {
  /** Anahtar için bir istek sayar; limit aşıldıysa ok=false döner (reddedilen istek sayılmaz). */
  hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
}

export class MemoryRateLimiter implements RateLimiter {
  private hits = new Map<string, number[]>();
  private lastSweep = 0;

  constructor(private now: () => number = Date.now) {}

  async hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const t = this.now();
    this.sweep(t, windowMs);
    const from = t - windowMs;
    const arr = (this.hits.get(key) ?? []).filter((x) => x > from);
    if (arr.length >= limit) {
      this.hits.set(key, arr);
      const oldest = arr[0] ?? t;
      return { ok: false, remaining: 0, retryAfterSec: Math.max(1, Math.ceil((oldest + windowMs - t) / 1000)) };
    }
    arr.push(t);
    this.hits.set(key, arr);
    return { ok: true, remaining: limit - arr.length, retryAfterSec: 0 };
  }

  /** Bellek sızıntısını önlemek için eski anahtarları ara sıra temizler. */
  private sweep(t: number, windowMs: number) {
    if (t - this.lastSweep < 60_000 && this.hits.size < 10_000) return;
    this.lastSweep = t;
    for (const [k, arr] of this.hits) {
      const last = arr[arr.length - 1];
      if (last === undefined || last <= t - Math.max(windowMs, 3_600_000)) this.hits.delete(k);
    }
  }

  clear() { this.hits.clear(); }
}

let current: RateLimiter = new MemoryRateLimiter();
export function getRateLimiter(): RateLimiter { return current; }
export function setRateLimiter(r: RateLimiter) { current = r; }
export const rateLimit = (key: string, limit: number, windowMs: number) => current.hit(key, limit, windowMs);

export const MINUTE = 60_000;
export const HOUR = 3_600_000;
