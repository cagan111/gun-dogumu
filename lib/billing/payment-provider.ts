import type { PaymentMethod } from "@prisma/client";
import { PaymentNotConfiguredError } from "../errors";

export interface ChargeRequest {
  tenantId: string;
  amountTry: number;
  months: number;
  plan?: string;
  note?: string | null;
  /** İşlemi başlatan (manuel ödemede süper-admin kullanıcı id'si). */
  actorId?: string | null;
}
export interface ChargeResult {
  method: PaymentMethod;
  status: "paid" | "pending";
  /** Sağlayıcıdaki işlem numarası (manuelde yok). */
  providerRef: string | null;
}

/** Ödeme sağlayıcısı arayüzü. MVP'de yalnız manuel; iyzico/PayTR ileride. */
export interface PaymentProvider {
  readonly id: PaymentMethod;
  charge(req: ChargeRequest): Promise<ChargeResult>;
}

/** Manuel: süper-admin parayı aldığını işaretler; anında "paid". */
export class ManualPaymentProvider implements PaymentProvider {
  readonly id = "manual" as const;
  async charge(): Promise<ChargeResult> {
    return { method: "manual", status: "paid", providerRef: null };
  }
}

export class IyzicoPaymentProvider implements PaymentProvider {
  readonly id = "iyzico" as const;
  async charge(): Promise<ChargeResult> { throw new PaymentNotConfiguredError("iyzico"); }
}

export class PaytrPaymentProvider implements PaymentProvider {
  readonly id = "paytr" as const;
  async charge(): Promise<ChargeResult> { throw new PaymentNotConfiguredError("paytr"); }
}

export function getPaymentProvider(method: PaymentMethod = "manual"): PaymentProvider {
  switch (method) {
    case "manual": return new ManualPaymentProvider();
    case "iyzico": return new IyzicoPaymentProvider();
    case "paytr": return new PaytrPaymentProvider();
  }
}
