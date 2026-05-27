import { isGoalMet, type GoalDirection, type MetricType } from "~/lib/types";

export interface DashboardEntry {
  date: string;
  value: number;
}

export interface DashboardMetricInput {
  id: number;
  name: string;
  type: MetricType;
  unit: string | null;
  goal: number | null;
  goalDirection: GoalDirection | null;
  weeklyTarget: number | null;
}

export function computeDaySuccess(
  metric: DashboardMetricInput,
  entries: DashboardEntry[],
  weekDays: string[]
): boolean[] {
  const byDate = new Map(entries.map((e) => [e.date, e.value]));
  return weekDays.map((d) => {
    const v = byDate.get(d);
    if (v == null) return false;
    if (metric.type === "boolean") return v === 1;
    if (metric.goal != null && metric.goalDirection != null) {
      return isGoalMet(v, metric.goal, metric.goalDirection);
    }
    return v > 0;
  });
}

export type Status = "met" | "on_track" | "behind" | "tracking";

export function computeWeeklyTargetEffective(m: DashboardMetricInput): number {
  if (m.weeklyTarget != null) return m.weeklyTarget;
  if (m.type === "boolean") return 7;
  if (m.goal != null && m.goalDirection != null) return 7;
  return 0;
}

export function classifyStatus(
  done: number,
  target: number,
  daysElapsed: number
): Status {
  if (target === 0) return "tracking";
  if (done >= target) return "met";
  const expected = Math.ceil((target * daysElapsed) / 7);
  return done >= expected ? "on_track" : "behind";
}
