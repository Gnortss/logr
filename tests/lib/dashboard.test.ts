import { describe, it, expect } from "vitest";
import { computeDaySuccess, computeWeeklyTargetEffective, classifyStatus, type Status, computeMetricView, type DashboardMetric, type DisplayKind } from "~/lib/dashboard";

describe("computeDaySuccess", () => {
  const weekDays = [
    "2026-05-25", "2026-05-26", "2026-05-27",
    "2026-05-28", "2026-05-29", "2026-05-30", "2026-05-31",
  ];

  it("boolean: only value=1 counts as success", () => {
    const m = { type: "boolean", goal: null, goalDirection: null } as any;
    const entries = [
      { date: "2026-05-25", value: 1 },
      { date: "2026-05-26", value: 0 },
      { date: "2026-05-27", value: 1 },
    ];
    expect(computeDaySuccess(m, entries, weekDays)).toEqual([
      true, false, true, false, false, false, false,
    ]);
  });

  it("numeric with goal: only goal-met days count", () => {
    const m = { type: "volume", goal: 2, goalDirection: "at_least", unit: "liters" } as any;
    const entries = [
      { date: "2026-05-25", value: 2.0 },
      { date: "2026-05-26", value: 1.5 },
      { date: "2026-05-27", value: 2.5 },
    ];
    expect(computeDaySuccess(m, entries, weekDays)).toEqual([
      true, false, true, false, false, false, false,
    ]);
  });

  it("numeric no goal: any value>0 counts", () => {
    const m = { type: "count", goal: null, goalDirection: null } as any;
    const entries = [
      { date: "2026-05-25", value: 1 },
      { date: "2026-05-26", value: 0 },
    ];
    expect(computeDaySuccess(m, entries, weekDays)).toEqual([
      true, false, false, false, false, false, false,
    ]);
  });
});

describe("computeWeeklyTargetEffective", () => {
  it("returns weeklyTarget when set", () => {
    const m = { type: "boolean", weeklyTarget: 4, goal: null, goalDirection: null } as any;
    expect(computeWeeklyTargetEffective(m)).toBe(4);
  });

  it("returns 7 for boolean with no weeklyTarget", () => {
    const m = { type: "boolean", weeklyTarget: null, goal: null, goalDirection: null } as any;
    expect(computeWeeklyTargetEffective(m)).toBe(7);
  });

  it("returns 7 for numeric-with-goal, no weeklyTarget", () => {
    const m = { type: "volume", weeklyTarget: null, goal: 2, goalDirection: "at_least" } as any;
    expect(computeWeeklyTargetEffective(m)).toBe(7);
  });

  it("returns 0 for numeric-no-goal, no weeklyTarget", () => {
    const m = { type: "count", weeklyTarget: null, goal: null, goalDirection: null } as any;
    expect(computeWeeklyTargetEffective(m)).toBe(0);
  });
});

describe("classifyStatus", () => {
  it("returns 'tracking' when target is 0", () => {
    expect(classifyStatus(0, 0, 3)).toBe<Status>("tracking");
  });

  it("returns 'met' when done >= target", () => {
    expect(classifyStatus(4, 4, 5)).toBe<Status>("met");
    expect(classifyStatus(5, 4, 5)).toBe<Status>("met");
  });

  it("returns 'on_track' when done >= expected for daysElapsed", () => {
    // target=4, daysElapsed=3 (Mon-Wed) → expected = ceil(4*3/7) = 2
    expect(classifyStatus(2, 4, 3)).toBe<Status>("on_track");
    expect(classifyStatus(3, 4, 3)).toBe<Status>("on_track");
  });

  it("returns 'behind' when done < expected", () => {
    // target=5, daysElapsed=3 → expected = ceil(5*3/7) = 3
    expect(classifyStatus(2, 5, 3)).toBe<Status>("behind");
  });
});

describe("computeMetricView", () => {
  const weekDays = [
    "2026-05-25", "2026-05-26", "2026-05-27",
    "2026-05-28", "2026-05-29", "2026-05-30", "2026-05-31",
  ];
  const todayDate = "2026-05-27"; // Wed → todayIndex=2 → daysElapsed=3

  it("weekly-target boolean: met case", () => {
    const m = {
      id: 1, name: "Workout", type: "boolean", unit: null, goal: null,
      goalDirection: null, weeklyTarget: 4,
    } as any;
    const entries = [
      { date: "2026-05-25", value: 1 },
      { date: "2026-05-26", value: 1 },
      { date: "2026-05-27", value: 1 },
      { date: "2026-05-24", value: 1 }, // outside the current week
    ];
    const view = computeMetricView(m, entries, weekDays, todayDate);
    expect(view.weeklyTargetEffective).toBe(4);
    expect(view.weeklyDone).toBe(3);
    expect(view.status).toBe("on_track");
    expect(view.displayKind).toBe<DisplayKind>("weekly_ratio");
  });

  it("daily boolean (no weeklyTarget): shows streak", () => {
    const m = {
      id: 2, name: "Read", type: "boolean", unit: null, goal: null,
      goalDirection: null, weeklyTarget: null,
    } as any;
    const entries = [
      { date: "2026-05-25", value: 1 },
      { date: "2026-05-26", value: 1 },
      { date: "2026-05-27", value: 1 },
    ];
    const view = computeMetricView(m, entries, weekDays, todayDate);
    expect(view.displayKind).toBe<DisplayKind>("streak");
    expect(view.streak).toBe(3);
  });

  it("numeric no goal: today_value", () => {
    const m = {
      id: 3, name: "Notes", type: "count", unit: "notes", goal: null,
      goalDirection: null, weeklyTarget: null,
    } as any;
    const entries = [{ date: "2026-05-27", value: 5 }];
    const view = computeMetricView(m, entries, weekDays, todayDate);
    expect(view.displayKind).toBe<DisplayKind>("today_value");
    expect(view.todayValue).toBe(5);
    expect(view.status).toBe("tracking");
  });

  it("caps weeklyDone at target", () => {
    const m = {
      id: 4, name: "Walk", type: "boolean", unit: null, goal: null,
      goalDirection: null, weeklyTarget: 3,
    } as any;
    const entries = weekDays.map((d) => ({ date: d, value: 1 })); // 7 done
    const view = computeMetricView(m, entries, weekDays, todayDate);
    expect(view.weeklyDone).toBe(3); // capped at target
    expect(view.status).toBe("met");
  });
});
