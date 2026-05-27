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
