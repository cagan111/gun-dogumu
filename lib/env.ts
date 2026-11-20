/** Açılışta zorunlu ortam değişkenleri. Üretimde eksikse net log + çıkış (hızlı hata). */
export interface EnvProblem { key: string; message: string }

export function envProblems(env: Record<string, string | undefined> = process.env): EnvProblem[] {
  const out: EnvProblem[] = [];
  const secret = env.NEXTAUTH_SECRET || env.AUTH_SECRET;
  if (!env.DATABASE_URL) out.push({ key: "DATABASE_URL", message: "tanımlı değil" });
  if (!secret) out.push({ key: "NEXTAUTH_SECRET", message: "tanımlı değil (üretir: openssl rand -base64 32)" });
  else if (secret.length < 16) out.push({ key: "NEXTAUTH_SECRET", message: "en az 16 karakter olmalı (önerilen: openssl rand -base64 32)" });
  if (env.TRUST_PROXY && !["true", "false"].includes(env.TRUST_PROXY)) out.push({ key: "TRUST_PROXY", message: "true veya false olmalı" });
  if (env.TRUST_PROXY === "true" && (!env.PROXY_SHARED_SECRET || env.PROXY_SHARED_SECRET.length < 32)) out.push({ key: "PROXY_SHARED_SECRET", message: "proxy güveni açıkken en az 32 karakter gerekli" });
  if (env.TRUST_PROXY === "true" && env.PROXY_SHARED_SECRET === secret) out.push({ key: "PROXY_SHARED_SECRET", message: "oturum sırrından farklı olmalı" });
  return out;
}

/** Üretimde sorun varsa süreci durdurur; geliştirmede yalnız uyarı yazar. */
export function assertEnv(log: { error: (o: object, m: string) => void; warn: (o: object, m: string) => void }, env: Record<string, string | undefined> = process.env, exit: (code: number) => void = (c) => process.exit(c)): EnvProblem[] {
  const problems = envProblems(env);
  if (problems.length === 0) return problems;
  const prod = env.NODE_ENV === "production";
  for (const p of problems) {
    if (prod) log.error({ key: p.key }, `ortam değişkeni hatası: ${p.key} ${p.message}`);
    else log.warn({ key: p.key }, `ortam değişkeni hatası: ${p.key} ${p.message}`);
  }
  if (prod) exit(1);
  return problems;
}
