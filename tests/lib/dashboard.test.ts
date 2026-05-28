import { describe, it, expect } from "vitest";
import { computeDaySuccess, computeWeeklyTargetEffective, classifyStatus, type Status, computeMetricView, type DashboardMetric, type DisplayKind, computeHero, type Hero, type DayState, buildDashboardData, type DashboardData, type DashboardEntry } from "~/lib/dashboard";
import { todayInTz } from "~/lib/tz";

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

  it("tracking metric: weeklyDone is 0 even when entries exist", () => {
    const m = {
      id: 5, name: "Notes", type: "count", unit: "notes", goal: null,
      goalDirection: null, weeklyTarget: null,
    } as any;
    const entries = [
      { date: "2026-05-25", value: 3 },
      { date: "2026-05-27", value: 5 },
    ];
    const view = computeMetricView(m, entries, weekDays, todayDate);
    expect(view.weeklyTargetEffective).toBe(0);
    expect(view.weeklyDone).toBe(0); // no target → meaningless to report
    expect(view.status).toBe("tracking");
  });
});

describe("computeHero", () => {
  const weekDays = [
    "2026-05-25", "2026-05-26", "2026-05-27",
    "2026-05-28", "2026-05-29", "2026-05-30", "2026-05-31",
  ];
  const todayDate = "2026-05-27"; // index 2

  function mkMetric(overrides: Partial<DashboardMetric>): DashboardMetric {
    return {
      id: 0, name: "m", type: "boolean", unit: null, goal: null,
      goalDirection: null, weeklyTarget: null,
      weeklyTargetEffective: 7, weeklyDone: 0,
      dayValues: [null, null, null, null, null, null, null],
      daySuccess: [false, false, false, false, false, false, false],
      status: "behind", displayKind: "streak", streak: 0, todayValue: null,
      ...overrides,
    };
  }

  it("sums done and target across counted metrics, ignores tracking", () => {
    const metrics: DashboardMetric[] = [
      mkMetric({ id: 1, weeklyTargetEffective: 4, weeklyDone: 3, status: "on_track", daySuccess: [true, true, true, false, false, false, false] }),
      mkMetric({ id: 2, weeklyTargetEffective: 7, weeklyDone: 3, status: "behind", daySuccess: [true, true, true, false, false, false, false] }),
      mkMetric({ id: 3, weeklyTargetEffective: 0, weeklyDone: 0, status: "tracking", daySuccess: [false, false, false, false, false, false, false] }),
    ];
    const hero = computeHero(metrics, weekDays, todayDate);
    expect(hero.done).toBe(6);
    expect(hero.total).toBe(11);
    expect(hero.totalGoals).toBe(2);
    expect(hero.onTrackCount).toBe(1);
  });

  it("dayStates: full if all metrics succeed; partial if some; empty if none; future for >todayIndex", () => {
    const metrics: DashboardMetric[] = [
      mkMetric({ id: 1, daySuccess: [true, true, false, false, false, false, false] }),
      mkMetric({ id: 2, daySuccess: [true, false, false, false, false, false, false] }),
    ];
    const hero = computeHero(metrics, weekDays, todayDate);
    expect(hero.dayStates).toEqual<DayState[]>([
      "full",    // Mon: both true
      "partial", // Tue: 1 of 2
      "empty",   // Wed: 0 of 2 (still today)
      "future", "future", "future", "future",
    ]);
  });

  it("handles empty metric list", () => {
    const hero = computeHero([], weekDays, todayDate);
    expect(hero.done).toBe(0);
    expect(hero.total).toBe(0);
    expect(hero.totalGoals).toBe(0);
    expect(hero.onTrackCount).toBe(0);
    expect(hero.dayStates).toEqual<DayState[]>(["empty", "empty", "empty", "future", "future", "future", "future"]);
  });
});

describe("buildDashboardData", () => {
  it("assembles all pieces given metrics + per-metric entries", () => {
    const todayDate = "2026-05-27"; // Wed of ISO week 22, 2026
    const metrics = [
      { id: 1, name: "Workout", type: "boolean" as const, unit: null, goal: null, goalDirection: null, weeklyTarget: 4 },
      { id: 2, name: "Read", type: "boolean" as const, unit: null, goal: null, goalDirection: null, weeklyTarget: null },
    ];
    const entriesByMetric = new Map<number, DashboardEntry[]>([
      [1, [
        { date: "2026-05-25", value: 1 },
        { date: "2026-05-26", value: 1 },
        { date: "2026-05-27", value: 1 },
      ]],
      [2, [
        { date: "2026-05-25", value: 1 },
        { date: "2026-05-26", value: 1 },
        { date: "2026-05-27", value: 1 },
      ]],
    ]);

    const data = buildDashboardData(metrics, entriesByMetric, todayDate);
    expect(data.date).toBe(todayDate);
    expect(data.weekDays).toHaveLength(7);
    expect(data.weekDays[0]).toBe("2026-05-25"); // Monday
    expect(data.todayIndex).toBe(2);
    expect(data.metrics).toHaveLength(2);
    expect(data.metrics[0].name).toBe("Workout");
    expect(data.metrics[0].status).toBe("on_track"); // 3/4 with daysElapsed=3, expected=2
    expect(data.metrics[1].displayKind).toBe("streak");
    expect(data.hero.done).toBe(3 + 3); // workout 3 + read 3
    expect(data.hero.total).toBe(4 + 7);
    expect(data.weekNumber).toBe(22);
  });
});

describe("buildDashboardData + tz integration", () => {
  it("a tz shift across midnight produces a different week", () => {
    // Same UTC instant: 2026-05-31 23:30 UTC (Sunday end-of-day).
    // UTC reads it as 2026-05-31 (still in ISO week 22).
    // Pacific/Auckland (+12 = NZST) sees 2026-06-01 11:30 (next day, ISO week 23).
    const instant = new Date("2026-05-31T23:30:00Z");
    const utcDate = todayInTz("UTC", instant);
    const aklDate = todayInTz("Pacific/Auckland", instant);
    expect(utcDate).toBe("2026-05-31");
    expect(aklDate).toBe("2026-06-01");

    const dUtc = buildDashboardData([], new Map(), utcDate);
    const dAkl = buildDashboardData([], new Map(), aklDate);
    expect(dUtc.weekDays[0]).toBe("2026-05-25"); // Mon of ISO 22
    expect(dAkl.weekDays[0]).toBe("2026-06-01"); // Mon of ISO 23
    expect(dUtc.weekNumber).toBe(22);
    expect(dAkl.weekNumber).toBe(23);
  });
});
