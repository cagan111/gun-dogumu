import { z } from "zod";
import { isValidSmsSender } from "../sms-sender";

const approvalsSchema = z.record(z.string().min(1), z.partialRecord(
  z.enum(["mock", "netgsm", "iletimerkezi", "generic_http"]),
  z.array(z.string().refine(isValidSmsSender)).max(20),
));

/** Operator-owned configuration, never writable by tenant HTTP routes. Null uses provider defaults. */
export function approvedSmsSender(tenantId: string, provider: string, sender: string | null, env: Record<string, string | undefined> = process.env): boolean {
  if (sender === null) return true;
  if (!isValidSmsSender(sender)) return false;
  const raw = env.SMS_APPROVED_SENDERS_JSON;
  if (!raw || raw.length > 65536) return false;
  try {
    const parsed = approvalsSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || !Object.hasOwn(parsed.data, tenantId)) return false;
    const tenant = parsed.data[tenantId];
    if (!tenant) return false;
    const list = Object.entries(tenant).find(([name]) => name === provider)?.[1];
    return Array.isArray(list) && list.includes(sender);
  } catch { return false; }
}
