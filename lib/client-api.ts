import type { Key, Params } from "./i18n/shared";

/** API hata yanıtı ({ error: { code, message, … } }) → istemci hatası. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public extra: { field?: string; feature?: string; limit?: number; fieldErrors?: Record<string, string[]> } = {},
  ) {
    super(message);
  }
}

type Init = { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown; signal?: AbortSignal };

/** JSON fetch; 2xx dışında ApiError fırlatır. */
export async function api<T = unknown>(url: string, init: Init = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method ?? "GET",
      headers: init.body !== undefined ? { "content-type": "application/json" } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: init.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError(0, "network", "network");
  }
  const text = await res.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* boş / JSON değil */ }
  if (!res.ok) {
    const e = (json as { error?: { code?: string; message?: string; field?: string; feature?: string; limit?: number; fieldErrors?: Record<string, string[]> } } | null)?.error;
    throw new ApiError(res.status, e?.code ?? `http_${res.status}`, e?.message ?? res.statusText, { field: e?.field, feature: e?.feature, limit: e?.limit, fieldErrors: e?.fieldErrors });
  }
  return json as T;
}

type T = (key: Key, params?: Params) => string;

const CODE_KEYS: Record<string, Key> = {
  plan_limit: "err.plan_limit",
  plan_feature: "err.plan_feature",
  slot_taken: "err.slot_taken",
  slot_unavailable: "err.slot_unavailable",
  forbidden: "err.forbidden",
  suspended: "err.suspended",
  quiet_hours: "err.quiet_hours",
  insufficient_credits: "err.insufficient_credits",
  conflict: "err.conflict",
  invalid_phone: "err.invalid_phone",
  validation: "err.validation",
  not_found: "err.not_found",
  already_closed: "err.already_closed",
  unauthorized: "err.unauthorized",
  rate_limited: "common.rateLimited",
  network: "err.network",
};

/** Hata → kullanıcıya gösterilecek yerelleştirilmiş metin (sunucu mesajı sızdırılmaz). */
export function errorMessage(e: unknown, t: T): string {
  if (e instanceof ApiError) {
    const k = CODE_KEYS[e.code];
    if (k) return t(k, { limit: e.extra.limit ?? "" });
  }
  return t("common.genericError");
}

export const isCode = (e: unknown, code: string): e is ApiError => e instanceof ApiError && e.code === code;
