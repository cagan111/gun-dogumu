/** Açılışta zorunlu ortam değişkenleri. Üretimde eksikse net log + çıkış (hızlı hata). */
export interface EnvProblem { key: string; message: string }

export function envProblems(env: Record<string, string | undefined> = process.env): EnvProblem[] {
  const out: EnvProblem[] = [];
  const secret = env.NEXTAUTH_SECRET || env.AUTH_SECRET;
  if (!env.DATABASE_URL) out.push({ key: "DATABASE_URL", message: "tanımlı değil" });
  if (!secret) out.push({ key: "NEXTAUTH_SECRET", message: "tanımlı değil (üretir: openssl rand -base64 32)" });
  else if (secret.length < 16) out.push({ key: "NEXTAUTH_SECRET", message: "en az 16 karakter olmalı (önerilen: openssl rand -base64 32)" });
  if (env.ALLOW_REAL_SMS === "true" && (!env.SMS_PROVIDER || env.SMS_PROVIDER === "mock")) {
    out.push({ key: "SMS_PROVIDER", message: "ALLOW_REAL_SMS=true iken mock dışında bir sağlayıcı seçilmeli" });
  }
  return out;
}

/** Üretimde sorun varsa süreci durdurur; geliştirmede yalnız uyarı yazar. */
export function assertEnv(log: { error: (o: object, m: string) => void; warn: (o: object, m: string) => void }, env: Record<string, string | undefined> = process.env, exit: (code: number) => void = (c) => process.exit(c)): EnvProblem[] {
  const problems = envProblems(env);
  if (problems.length === 0) return problems;
  const prod = env.NODE_ENV === "production";
  for (const p of problems) (prod ? log.error : log.warn)({ key: p.key }, `ortam değişkeni hatası: ${p.key} ${p.message}`);
  if (prod) exit(1);
  return problems;
}
