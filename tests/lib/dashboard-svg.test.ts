import { describe, it, expect } from "vitest";
import { renderDashboardSvg } from "~/lib/dashboard-svg";
import type { DashboardData } from "~/lib/dashboard";

const fixture: DashboardData = {
  date: "2026-05-27",
  weekDays: ["2026-05-25", "2026-05-26", "2026-05-27", "2026-05-28", "2026-05-29", "2026-05-30", "2026-05-31"],
  todayIndex: 2,
  weekNumber: 22,
  hero: {
    done: 12, total: 26, onTrackCount: 3, totalGoals: 5,
    dayStates: ["full", "partial", "partial", "future", "future", "future", "future"],
  },
  metrics: [
    {
      id: 1, name: "Workout", type: "boolean", unit: null, goal: null, goalDirection: null,
      weeklyTarget: 4, weeklyTargetEffective: 4, weeklyDone: 3,
      dayValues: [1, 1, 1, null, null, null, null],
      daySuccess: [true, true, true, false, false, false, false],
      status: "on_track", displayKind: "weekly_ratio", streak: 0, todayValue: 1,
    },
    {
      id: 2, name: "Read", type: "boolean", unit: null, goal: null, goalDirection: null,
      weeklyTarget: null, weeklyTargetEffective: 7, weeklyDone: 3,
      dayValues: [1, 1, 1, null, null, null, null],
      daySuccess: [true, true, true, false, false, false, false],
      status: "on_track", displayKind: "streak", streak: 28, todayValue: 1,
    },
  ],
};

describe("renderDashboardSvg", () => {
  it("produces an SVG with width 400 and height 300", () => {
    const svg = renderDashboardSvg(fixture, { mode: "color" });
    expect(svg).toMatch(/^<svg[^>]*width="400"/);
    expect(svg).toMatch(/height="300"/);
    expect(svg).toContain('viewBox="0 0 400 300"');
  });

  it("color mode contains expected text strings", () => {
    const svg = renderDashboardSvg(fixture, { mode: "color" });
    expect(svg).toContain("Workout");
    expect(svg).toContain("Read");
    expect(svg).toContain("12");      // hero done
    expect(svg).toContain("/26");     // hero total
    expect(svg).toContain("28");      // streak
    expect(svg).toContain("Wk 22");
  });

  it("bw mode contains hatch pattern definition", () => {
    const svg = renderDashboardSvg(fixture, { mode: "bw" });
    expect(svg).toContain('id="hatch-50"');
    expect(svg).toContain("<pattern");
  });

  it("matches the color snapshot", () => {
    const svg = renderDashboardSvg(fixture, { mode: "color" });
    expect(svg).toMatchSnapshot();
  });

  it("matches the bw snapshot", () => {
    const svg = renderDashboardSvg(fixture, { mode: "bw" });
    expect(svg).toMatchSnapshot();
  });
});
