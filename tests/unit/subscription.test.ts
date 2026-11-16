import { describe, expect, it } from "vitest";
import { PAST_DUE_GRACE_DAYS } from "@/config/plans";
import { DAY_MS, nextStatus, noticesFor, type SubscriptionState } from "@/lib/billing/subscription";

const now = new Date("2026-12-01T12:00:00Z");
const d = (days: number) => new Date(now.getTime() + days * DAY_MS);
const st = (o: Partial<SubscriptionState>): SubscriptionState => ({ status: "trial", trialEndsAt: null, subscriptionEndsAt: null, pastDueSince: null, ...o });

describe("nextStatus", () => {
  it("trial: süre dolmadı → değişmez", () => {
    expect(nextStatus(st({ trialEndsAt: d(5) }), now)).toMatchObject({ status: "trial", changed: false });
  });
  it("trial: süre doldu, ödeme yok → past_due ve pastDueSince=now", () => {
    expect(nextStatus(st({ trialEndsAt: d(-1) }), now)).toEqual({ status: "past_due", pastDueSince: now, changed: true });
  });
  it("trial: tam sınırda (trialEndsAt == now) → past_due", () => {
    expect(nextStatus(st({ trialEndsAt: now }), now).status).toBe("past_due");
  });
  it("trial: ücretli abonelik varsa → active (deneme bitmiş olsa bile)", () => {
    expect(nextStatus(st({ trialEndsAt: d(-1), subscriptionEndsAt: d(20) }), now)).toEqual({ status: "active", pastDueSince: null, changed: true });
  });
  it("active: abonelik sürüyor → değişmez; null bitiş de değişmez", () => {
    expect(nextStatus(st({ status: "active", subscriptionEndsAt: d(3) }), now).changed).toBe(false);
    expect(nextStatus(st({ status: "active" }), now).changed).toBe(false);
  });
  it("active: abonelik bitti → past_due", () => {
    expect(nextStatus(st({ status: "active", subscriptionEndsAt: d(-0.01) }), now)).toEqual({ status: "past_due", pastDueSince: now, changed: true });
  });
  it("past_due: ödeme geldi → active, pastDueSince temizlenir", () => {
    expect(nextStatus(st({ status: "past_due", subscriptionEndsAt: d(30), pastDueSince: d(-2) }), now)).toEqual({ status: "active", pastDueSince: null, changed: true });
  });
  it("past_due: tolerans dolmadı → değişmez", () => {
    const r = nextStatus(st({ status: "past_due", subscriptionEndsAt: d(-9), pastDueSince: d(-(PAST_DUE_GRACE_DAYS - 0.5)) }), now);
    expect(r.changed).toBe(false);
    expect(r.status).toBe("past_due");
  });
  it("past_due: tolerans tam dolunca → suspended (pastDueSince korunur)", () => {
    const since = d(-PAST_DUE_GRACE_DAYS);
    expect(nextStatus(st({ status: "past_due", pastDueSince: since }), now)).toEqual({ status: "suspended", pastDueSince: since, changed: true });
  });
  it("past_due: pastDueSince eksikse onarılır (now)", () => {
    expect(nextStatus(st({ status: "past_due" }), now)).toEqual({ status: "past_due", pastDueSince: now, changed: true });
  });
  it("suspended yapışkan: ödeme tarihi gelecekte olsa bile tick açmaz", () => {
    expect(nextStatus(st({ status: "suspended", subscriptionEndsAt: d(30) }), now).changed).toBe(false);
  });
});

describe("noticesFor", () => {
  it("deneme bitmesine ≤3 gün → trial_ending; 5 gün → yok", () => {
    const a = st({ trialEndsAt: d(2) });
    expect(noticesFor("t", a, nextStatus(a, now), now).map((n) => n.kind)).toEqual(["trial_ending"]);
    const b = st({ trialEndsAt: d(5) });
    expect(noticesFor("t", b, nextStatus(b, now), now)).toEqual([]);
  });
  it("deneme bitti → trial_ended; abonelik bitti → past_due; tolerans bitti → suspended", () => {
    const a = st({ trialEndsAt: d(-1) });
    expect(noticesFor("t", a, nextStatus(a, now), now).map((n) => n.kind)).toEqual(["trial_ended"]);
    const b = st({ status: "active", subscriptionEndsAt: d(-1) });
    expect(noticesFor("t", b, nextStatus(b, now), now).map((n) => n.kind)).toEqual(["past_due"]);
    const c = st({ status: "past_due", pastDueSince: d(-8) });
    expect(noticesFor("t", c, nextStatus(c, now), now).map((n) => n.kind)).toEqual(["suspended"]);
  });
  it("ödeyen deneme salonuna uyarı yok", () => {
    const a = st({ trialEndsAt: d(1), subscriptionEndsAt: d(30) });
    expect(noticesFor("t", a, nextStatus(a, now), now)).toEqual([]);
  });
});
