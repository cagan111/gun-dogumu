import { describe, expect, it } from "vitest";
import { scopeArgs } from "@/lib/tenant";

describe("scopeArgs (tenant izolasyonu)", () => {
  it("tenant modelinde okuma sorgusuna tenantId ekler", () => {
    expect(scopeArgs("Appointment", "findUnique", { where: { id: "a1" } }, "t1").where).toEqual({ id: "a1", tenantId: "t1" });
    expect(scopeArgs("Customer", "findMany", undefined, "t1").where).toEqual({ tenantId: "t1" });
  });
  it("istemcinin verdiği tenantId'yi ezer", () => {
    expect(scopeArgs("Staff", "findFirst", { where: { tenantId: "t2" } }, "t1").where).toEqual({ tenantId: "t1" });
  });
  it("create/createMany/upsert verisine tenantId koyar", () => {
    expect(scopeArgs("Service", "create", { data: { nameTr: "Saç" } }, "t1").data).toEqual({ nameTr: "Saç", tenantId: "t1" });
    expect(scopeArgs("Service", "createMany", { data: [{ a: 1 }, { a: 2 }] }, "t1").data).toEqual([{ a: 1, tenantId: "t1" }, { a: 2, tenantId: "t1" }]);
    const u = scopeArgs("Customer", "upsert", { where: { id: "c" }, create: { name: "x" } }, "t1");
    expect(u.where).toEqual({ id: "c", tenantId: "t1" });
    expect(u.create).toEqual({ name: "x", tenantId: "t1" });
  });
  it("update/delete sorgularını kapsar", () => {
    expect(scopeArgs("Appointment", "update", { where: { id: "a" }, data: {} }, "t1").where).toEqual({ id: "a", tenantId: "t1" });
    expect(scopeArgs("Appointment", "deleteMany", {}, "t1").where).toEqual({ tenantId: "t1" });
  });
  it("tenant dışı modele dokunmaz, boş tenantId'yi reddeder", () => {
    expect(scopeArgs("Tenant", "findMany", { where: { slug: "x" } }, "t1").where).toEqual({ slug: "x" });
    expect(() => scopeArgs("Staff", "findMany", {}, "")).toThrow();
  });
});
