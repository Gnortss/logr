import { describe, it, expect } from "vitest";
import { computeCurrentStreak } from "~/lib/streak";

describe("computeCurrentStreak", () => {
  it("returns 0 when no entries", () => {
    expect(computeCurrentStreak([], "2026-05-27", () => true)).toBe(0);
  });

  it("counts consecutive successful days ending at todayDate", () => {
    const entries = [
      { date: "2026-05-25", value: 1 },
      { date: "2026-05-26", value: 1 },
      { date: "2026-05-27", value: 1 },
    ];
    expect(computeCurrentStreak(entries, "2026-05-27", (v) => v === 1)).toBe(3);
  });

  it("stops at the first failed or missing day", () => {
    const entries = [
      { date: "2026-05-25", value: 1 },
      { date: "2026-05-26", value: 0 },  // failed
      { date: "2026-05-27", value: 1 },
    ];
    expect(computeCurrentStreak(entries, "2026-05-27", (v) => v === 1)).toBe(1);
  });

  it("returns 0 if today is not successful", () => {
    const entries = [
      { date: "2026-05-26", value: 1 },
      { date: "2026-05-27", value: 0 },
    ];
    expect(computeCurrentStreak(entries, "2026-05-27", (v) => v === 1)).toBe(0);
  });

  it("works with custom predicate (numeric goal)", () => {
    const entries = [
      { date: "2026-05-26", value: 2.5 },
      { date: "2026-05-27", value: 1.8 },
    ];
    expect(computeCurrentStreak(entries, "2026-05-27", (v) => v >= 2)).toBe(0);
    expect(computeCurrentStreak(entries, "2026-05-26", (v) => v >= 2)).toBe(1);
  });
});
