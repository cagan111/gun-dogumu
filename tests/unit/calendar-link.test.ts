import { expect, it } from "vitest";
import { calendarLinkUrl } from "@/lib/calendar-link";
const path = `/api/calendar/${"a".repeat(43)}`;
it("constructs only an exact same-origin feed URL", () => {
  expect(calendarLinkUrl(path, "https://salon.example")).toBe(`https://salon.example${path}`);
  expect(calendarLinkUrl(path, "http://localhost:3400")).toBe(`http://localhost:3400${path}`);
});
it.each([`https://evil.example${path}`, `//evil.example${path}`, `${path}?token=extra`, `${path}#fragment`, `${path}\n`, "/api/calendar/short", null, { path }])("rejects malformed/foreign capability response %j", input => {
  expect(calendarLinkUrl(input, "https://salon.example")).toBeNull();
});
it("rejects non-web origins", () => { expect(calendarLinkUrl(path, "javascript:alert(1)")).toBeNull(); });
