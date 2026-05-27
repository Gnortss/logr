import { describe, it, expect } from "vitest";
import { renderDashboardPng } from "~/lib/dashboard-png.server";
import type { DashboardData } from "~/lib/dashboard";

const fixture: DashboardData = {
  date: "2026-05-27",
  weekDays: ["2026-05-25","2026-05-26","2026-05-27","2026-05-28","2026-05-29","2026-05-30","2026-05-31"],
  todayIndex: 2,
  weekNumber: 22,
  hero: { done: 12, total: 26, onTrackCount: 3, totalGoals: 5,
    dayStates: ["full","partial","partial","future","future","future","future"] },
  metrics: [],
};

describe("renderDashboardPng", () => {
  // Skipped: vitest/Node cannot fetch the wasm ?url asset at runtime because there is
  // no dev server running during tests. The wasm stub plugin returns "" for ?url imports,
  // so fetch("http://localhost/...") would fail. The implementation is verified manually
  // via the dev server (`curl localhost:517X/dashboard.png`).
  it.skip("returns a buffer starting with PNG magic bytes", async () => {
    const buf = await renderDashboardPng(fixture);
    expect(buf.length).toBeGreaterThan(100);
    // PNG magic: 89 50 4E 47 0D 0A 1A 0A
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50);
    expect(buf[2]).toBe(0x4e);
    expect(buf[3]).toBe(0x47);
  }, 15_000);
});
