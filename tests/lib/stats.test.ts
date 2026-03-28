import { describe, it, expect } from "vitest";
import { computeBooleanStats, computeNumericStats, computeTrend } from "~/lib/stats.server";

describe("computeBooleanStats", () => {
  it("computes streaks and completion rate", () => {
    const entries = [
      { date: "2026-03-28", value: 1 },
      { date: "2026-03-27", value: 1 },
      { date: "2026-03-26", value: 1 },
      { date: "2026-03-24", value: 1 },
      { date: "2026-03-23", value: 1 },
      { date: "2026-03-22", value: 1 },
      { date: "2026-03-20", value: 1 },
    ];
    const stats = computeBooleanStats(entries, "2026-03-19", "2026-03-28");
    expect(stats.currentStreak).toBe(3);
    expect(stats.longestStreak).toBe(3);
    expect(stats.totalDaysDone).toBe(7);
    expect(stats.completionRate).toBeCloseTo(70);
  });

  it("handles empty entries", () => {
    const stats = computeBooleanStats([], "2026-03-19", "2026-03-28");
    expect(stats.currentStreak).toBe(0);
    expect(stats.longestStreak).toBe(0);
    expect(stats.totalDaysDone).toBe(0);
    expect(stats.completionRate).toBe(0);
  });
});

describe("computeNumericStats", () => {
  it("computes average, min, max, total, days tracked, goal stats", () => {
    const entries = [
      { date: "2026-03-28", value: 3.5 },
      { date: "2026-03-27", value: 2.0 },
      { date: "2026-03-26", value: 4.0 },
      { date: "2026-03-25", value: 1.5 },
      { date: "2026-03-24", value: 3.0 },
    ];
    const stats = computeNumericStats(entries, 3.0);
    expect(stats.average).toBeCloseTo(2.8);
    expect(stats.min).toBe(1.5);
    expect(stats.max).toBe(4.0);
    expect(stats.total).toBeCloseTo(14.0);
    expect(stats.daysTracked).toBe(5);
    expect(stats.daysGoalMet).toBe(3);
    expect(stats.goalHitRate).toBeCloseTo(60);
  });
});

describe("computeTrend", () => {
  it("detects upward trend", () => {
    const entries = [
      { date: "2026-03-01", value: 1 },
      { date: "2026-03-15", value: 2 },
      { date: "2026-03-28", value: 3 },
    ];
    expect(computeTrend(entries)).toBe("up");
  });

  it("detects downward trend", () => {
    const entries = [
      { date: "2026-03-01", value: 5 },
      { date: "2026-03-15", value: 3 },
      { date: "2026-03-28", value: 1 },
    ];
    expect(computeTrend(entries)).toBe("down");
  });

  it("detects flat trend", () => {
    const entries = [
      { date: "2026-03-01", value: 3 },
      { date: "2026-03-15", value: 3.1 },
      { date: "2026-03-28", value: 2.9 },
    ];
    expect(computeTrend(entries)).toBe("flat");
  });

  it("returns flat for insufficient data", () => {
    expect(computeTrend([])).toBe("flat");
    expect(computeTrend([{ date: "2026-03-28", value: 5 }])).toBe("flat");
  });
});
