import { expect, it } from "vitest";
import { renderCalendar } from "@/lib/calendar-feed";
it("UTC times, stable UID, CRLF and minimal event text exclude customer data", () => {
  const date = new Date("2026-11-20T08:30:00Z");
  const feed = renderCalendar([{ id: "fixture", startsAt: date, endsAt: new Date(+date + 1800000), updatedAt: date, status: "confirmed" }], "tr");
  expect(feed).toContain("DTSTART:20261120T083000Z\r\n");
  expect(feed).toMatch(/UID:[a-f0-9]{32}@kibrisrandevu\r\n/);
  expect(feed).toContain("SUMMARY:Randevu\r\n");
  expect(feed.replaceAll("\r\n", "")).not.toMatch(/[\r\n]/);
  expect(feed).not.toMatch(/DESCRIPTION|ATTENDEE|URL|LOCATION/);
});
it("cancellations retain UID; pending is tentative; English label", () => {
  const date = new Date("2026-11-20T08:30:00Z");
  const event = { id: "fixture", startsAt: date, endsAt: date, updatedAt: date, status: "cancelled_by_salon" };
  expect(renderCalendar([event], "en")).toContain("STATUS:CANCELLED\r\n");
  expect(renderCalendar([{ ...event, status: "pending" }], "en")).toContain("STATUS:TENTATIVE\r\n");
  expect(renderCalendar([event], "en")).toContain("SUMMARY:Appointment\r\n");
});
