import { describe, it, expect } from "vitest";
import { computeDaySuccess } from "~/lib/dashboard";

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
