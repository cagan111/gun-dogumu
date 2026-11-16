import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export { getAuthSecret } from "./auth-secret";

export function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}

export function hmacHex(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("hex");
}
