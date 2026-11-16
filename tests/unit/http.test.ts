import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AlreadyClosedError, CancelWindowError, InvalidPhoneError, NotFoundError, SlotTakenError, SlotUnavailableError } from "@/lib/booking";
import { InsufficientCreditsError, PaymentNotConfiguredError, PlanFeatureError, PlanLimitError, RateLimitedError, SuspendedError } from "@/lib/errors";
import { clientIp, errorResponse, parseWith } from "@/lib/http";

describe("errorResponse", () => {
  const status = (e: unknown) => errorResponse(e).status;
  it("BookingError kodları HTTP durumuna eşlenir", () => {
    expect(status(new NotFoundError("Randevu"))).toBe(404);
    expect(status(new SlotTakenError())).toBe(409);
    expect(status(new SlotUnavailableError())).toBe(422);
    expect(status(new CancelWindowError(2))).toBe(403);
    expect(status(new InvalidPhoneError())).toBe(400);
    expect(status(new AlreadyClosedError())).toBe(409);
    expect(status(new SuspendedError())).toBe(423);
    expect(status(new PlanLimitError(1))).toBe(402);
    expect(status(new PlanFeatureError("reports"))).toBe(402);
    expect(status(new InsufficientCreditsError(0, 1))).toBe(402);
    expect(status(new PaymentNotConfiguredError("iyzico"))).toBe(501);
  });
  it("429 Retry-After taşır; bilinmeyen hata 500 ve ayrıntı sızdırmaz", async () => {
    const r = errorResponse(new RateLimitedError(42));
    expect(r.status).toBe(429);
    expect(r.headers.get("Retry-After")).toBe("42");
    const x = errorResponse(new Error("gizli sql"));
    expect(x.status).toBe(500);
    expect(JSON.stringify(await x.json())).not.toContain("gizli");
  });
});

describe("parseWith", () => {
  const schema = z.object({ a: z.string().min(2), b: z.number() });
  it("geçerli girdi", () => {
    const r = parseWith(schema, { a: "xx", b: 1 });
    expect(r.ok).toBe(true);
  });
  it("hatada 400 + alan hataları", async () => {
    const r = parseWith(schema, { a: "x" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(400);
      const j = await r.response.json();
      expect(j.error.code).toBe("validation");
      expect(Object.keys(j.error.fieldErrors)).toEqual(expect.arrayContaining(["a", "b"]));
    }
  });
});

describe("clientIp", () => {
  it("x-forwarded-for ilk değeri", () => {
    expect(clientIp(new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } }))).toBe("1.2.3.4");
    expect(clientIp(new Request("http://x"))).toBe("unknown");
  });
});
