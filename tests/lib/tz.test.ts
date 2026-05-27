import { describe, it, expect } from "vitest";
import { todayInTz } from "~/lib/tz";

describe("todayInTz", () => {
  it("returns YYYY-MM-DD in UTC when no tz given", () => {
    const fixed = new Date("2026-05-26T12:00:00Z");
    const result = todayInTz(undefined, fixed);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result).toBe("2026-05-26");
  });

  it("returns YYYY-MM-DD in given IANA tz", () => {
    // We can't assert an exact date (depends on when tests run), but format must be valid
    const result = todayInTz("Europe/Ljubljana");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("falls back to UTC when tz is invalid", () => {
    const fixed = new Date("2026-05-26T12:00:00Z");
    const result = todayInTz("not/a/zone", fixed);
    expect(result).toBe("2026-05-26");
  });

  it("handles tz that shifts the date", () => {
    // Pin a known moment: 2026-05-26 23:30 UTC.
    // In Pacific/Auckland (UTC+12 in May = NZST UTC+12), that's 11:30 the NEXT day.
    const fixed = new Date("2026-05-26T23:30:00Z");
    const result = todayInTz("Pacific/Auckland", fixed);
    expect(result).toBe("2026-05-27");
  });

  it("falls back to UTC when tz is empty string", () => {
    const fixed = new Date("2026-05-26T12:00:00Z");
    const result = todayInTz("", fixed);
    expect(result).toBe("2026-05-26");
  });
});
