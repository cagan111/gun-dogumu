import { beforeEach, expect, it, vi } from "vitest";
const s = vi.hoisted(() => ({ suspended: true, revoke: vi.fn(async () => ({ revoked: true })), rotate: vi.fn() }));
vi.mock("@/lib/session", () => ({ requireTenantUser: vi.fn(async () => ({ user: { id: "owner", role: "owner" }, tenantId: "tenant", tenantStatus: s.suspended ? "suspended" : "active" })), requireSuperadmin: vi.fn() }));
vi.mock("@/lib/calendar-feed", () => ({ revokeCalendarFeed: s.revoke, rotateCalendarFeed: s.rotate }));
import { DELETE, POST } from "@/app/api/panel/staff/[id]/calendar/route";
beforeEach(() => { vi.clearAllMocks(); s.suspended = true; });
it("suspended owner can revoke through the actual panel route wrapper", async () => {
  const response = await DELETE(new Request("http://localhost/api/panel/staff/staff/calendar", { method: "DELETE" }), { params: Promise.resolve({ id: "staff" }) });
  expect(response.status).toBe(200); expect(s.revoke).toHaveBeenCalledTimes(1);
});
it("simple cross-site form content types cannot rotate a token", async () => {
  s.suspended = false;
  for (const type of ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data"]) {
    const response = await POST(new Request("http://localhost/api/panel/staff/staff/calendar", { method: "POST", headers: { "content-type": type }, body: "{}" }), { params: Promise.resolve({ id: "staff" }) });
    expect(response.status).toBe(415);
  }
  expect(s.rotate).not.toHaveBeenCalled();
});
