import { describe, it, expect } from "vitest";
import { startOfYear } from "~/lib/date";

describe("startOfYear", () => {
  it("returns Jan 1 of the year in the given date string", () => {
    expect(startOfYear("2026-05-29")).toBe("2026-01-01");
  });

  it("returns the same string when input is already Jan 1", () => {
    expect(startOfYear("2026-01-01")).toBe("2026-01-01");
  });

  it("handles different years", () => {
    expect(startOfYear("2025-12-31")).toBe("2025-01-01");
    expect(startOfYear("2030-07-04")).toBe("2030-01-01");
  });
});
