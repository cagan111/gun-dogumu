// Edge uyumlu (node:crypto yok): middleware da kullanır.
const DEV_SECRET = "dev-only-insecure-secret-change-me";

/** Oturum/imza sırrı. Üretimde zorunlu; geliştirmede (boşsa) sabit bir yedek kullanılır. */
export function getAuthSecret(env: Record<string, string | undefined> = process.env): string {
  const s = env.NEXTAUTH_SECRET || env.AUTH_SECRET;
  if (s) return s;
  // `next build` sırasında modüller değerlendirilir; sır çalışma zamanında zorunlu
  if (env.NODE_ENV === "production" && env.NEXT_PHASE !== "phase-production-build") throw new Error("NEXTAUTH_SECRET tanımlı olmalı");
  return DEV_SECRET;
}
