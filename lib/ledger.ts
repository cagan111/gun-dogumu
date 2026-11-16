/**
 * SMS defteri — bakiye için TEK kanonik yer.
 * Bakiye = defterdeki delta toplamı (balanceAfter her satırda aynı değeri anlık görüntü olarak saklar).
 * Eşzamanlı düşümler tenant satırı `SELECT … FOR UPDATE` ile sıraya girer; bakiye yarışla eksiye düşemez.
 */
import type { LedgerReason } from "@prisma/client";
import { withTenant, type TenantDb } from "./db";
import { InsufficientCreditsError, ValidationError } from "./errors";

export type LedgerTx = Parameters<Parameters<TenantDb["$transaction"]>[0]>[0];

export const DEBIT_REASONS = ["reminder", "confirmation", "campaign", "notification"] as const satisfies readonly LedgerReason[];
export type DebitReason = (typeof DEBIT_REASONS)[number];

/** Saf: düşüm sonrası bakiyeyi hesaplar; eksiye düşecekse (allowNegative yoksa) null. */
export function applyDebit(balance: number, amount: number, allowNegative = false): number | null {
  const next = balance - amount;
  return next < 0 && !allowNegative ? null : next;
}

function assertAmount(n: number): void {
  if (!Number.isInteger(n) || n <= 0) throw new ValidationError("Miktar pozitif tam sayı olmalı", "amount");
}

async function lockTenant(tx: LedgerTx, tenantId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "Tenant" WHERE id = ${tenantId} FOR UPDATE`;
}

/** Güncel bakiye (delta toplamı). */
export async function getBalance(db: TenantDb | LedgerTx): Promise<number> {
  const r = await db.smsLedger.aggregate({ _sum: { delta: true } });
  return r._sum.delta ?? 0;
}

async function entry(tx: LedgerTx, tenantId: string, delta: number, reason: LedgerReason, opts: { messageId?: string | null; note?: string | null; allowNegative?: boolean }) {
  await lockTenant(tx, tenantId);
  const balance = await getBalance(tx);
  const after = balance + delta;
  if (delta < 0 && applyDebit(balance, -delta, opts.allowNegative) === null) throw new InsufficientCreditsError(balance, -delta);
  const row = await tx.smsLedger.create({
    data: { delta, reason, balanceAfter: after, messageId: opts.messageId ?? null, note: opts.note ?? null } as never,
  });
  return { id: row.id, balance: after };
}

/** Transaction içinden kredi (paket alımı, aylık plan, düzeltme). */
export function creditTx(tx: LedgerTx, tenantId: string, amount: number, reason: Exclude<LedgerReason, DebitReason> = "package_purchase", note?: string | null) {
  assertAmount(amount);
  return entry(tx, tenantId, amount, reason, { note });
}

export async function credit(tenantId: string, amount: number, reason: Exclude<LedgerReason, DebitReason> = "package_purchase", note?: string | null) {
  assertAmount(amount);
  return withTenant(tenantId).$transaction((tx) => entry(tx, tenantId, amount, reason, { note }));
}

/** Düşüm. Bakiye yetmezse (allowNegative yoksa) InsufficientCreditsError. */
export async function debit(tenantId: string, amount: number, opts: { reason: DebitReason; messageId?: string | null; note?: string | null; allowNegative?: boolean }) {
  assertAmount(amount);
  return withTenant(tenantId).$transaction((tx) => entry(tx, tenantId, -amount, opts.reason, opts));
}

/** Transaction içinden düşüm (mesaj kaydıyla atomik olsun diye). */
export function debitTx(tx: LedgerTx, tenantId: string, amount: number, opts: { reason: DebitReason; messageId?: string | null; note?: string | null; allowNegative?: boolean }) {
  assertAmount(amount);
  return entry(tx, tenantId, -amount, opts.reason, opts);
}

/** Transaction içinden iade. */
export function refundTx(tx: LedgerTx, tenantId: string, amount: number, opts: { messageId?: string | null; note?: string | null } = {}) {
  assertAmount(amount);
  return entry(tx, tenantId, amount, "refund", opts);
}

/** İade (başarısız gönderim vb.): pozitif delta, reason=refund. */
export async function refund(tenantId: string, amount: number, opts: { messageId?: string | null; note?: string | null } = {}) {
  assertAmount(amount);
  return withTenant(tenantId).$transaction((tx) => entry(tx, tenantId, amount, "refund", opts));
}
