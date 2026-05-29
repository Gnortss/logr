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

  it("stops at the first failed or missing day before today", () => {
    const entries = [
      { date: "2026-05-25", value: 1 },
      { date: "2026-05-26", value: 0 }, // failed
      { date: "2026-05-27", value: 1 },
    ];
    expect(computeCurrentStreak(entries, "2026-05-27", (v) => v === 1)).toBe(1);
  });

  it("skips today and counts back from yesterday when today is failed", () => {
    const entries = [
      { date: "2026-05-26", value: 1 },
      { date: "2026-05-27", value: 0 },
    ];
    expect(computeCurrentStreak(entries, "2026-05-27", (v) => v === 1)).toBe(1);
  });

  it("skips today and counts back from yesterday when today is missing", () => {
    const entries = [
      { date: "2026-05-25", value: 1 },
      { date: "2026-05-26", value: 1 },
      // no entry for 2026-05-27
    ];
    expect(computeCurrentStreak(entries, "2026-05-27", (v) => v === 1)).toBe(2);
  });

  it("returns 0 when today is failed and yesterday is also failed", () => {
    const entries = [
      { date: "2026-05-26", value: 0 },
      { date: "2026-05-27", value: 0 },
    ];
    expect(computeCurrentStreak(entries, "2026-05-27", (v) => v === 1)).toBe(0);
  });

  it("returns 0 when today is missing and yesterday is missing", () => {
    expect(computeCurrentStreak([], "2026-05-27", (v) => v === 1)).toBe(0);
  });

  it("works with custom predicate (numeric goal)", () => {
    const entries = [
      { date: "2026-05-26", value: 2.5 },
      { date: "2026-05-27", value: 1.8 },
    ];
    // today (5-27) fails the >=2 predicate, so cursor starts at 5-26 which passes.
    expect(computeCurrentStreak(entries, "2026-05-27", (v) => v >= 2)).toBe(1);
    expect(computeCurrentStreak(entries, "2026-05-26", (v) => v >= 2)).toBe(1);
  });
});
