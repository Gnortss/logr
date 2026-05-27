import { isGoalMet, type GoalDirection, type MetricType } from "~/lib/types";
import { computeCurrentStreak } from "~/lib/streak";
import { getWeekDays } from "~/lib/date";

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

export type DisplayKind = "weekly_ratio" | "streak" | "today_value";

export interface DashboardMetric extends DashboardMetricInput {
  weeklyTargetEffective: number;
  weeklyDone: number;
  dayValues: (number | null)[];
  daySuccess: boolean[];
  status: Status;
  displayKind: DisplayKind;
  streak: number;
  todayValue: number | null;
}

export function computeMetricView(
  metric: DashboardMetricInput,
  entries: DashboardEntry[],
  weekDays: string[],
  todayDate: string
): DashboardMetric {
  const byDate = new Map(entries.map((e) => [e.date, e.value]));
  const dayValues = weekDays.map((d) => byDate.get(d) ?? null);
  const daySuccess = computeDaySuccess(metric, entries, weekDays);
  const weeklyTargetEffective = computeWeeklyTargetEffective(metric);

  const successCount = daySuccess.filter(Boolean).length;
  const weeklyDone =
    weeklyTargetEffective > 0
      ? Math.min(successCount, weeklyTargetEffective)
      : 0;

  const todayIndex = weekDays.indexOf(todayDate);
  const daysElapsed = todayIndex < 0 ? weekDays.length : todayIndex + 1;
  const status = classifyStatus(weeklyDone, weeklyTargetEffective, daysElapsed);

  let displayKind: DisplayKind;
  if (metric.weeklyTarget != null) {
    displayKind = "weekly_ratio";
  } else if (
    metric.type === "boolean" ||
    (metric.goal != null && metric.goalDirection != null)
  ) {
    displayKind = "streak";
  } else {
    displayKind = "today_value";
  }

  const isSuccessForStreak = (v: number): boolean => {
    if (metric.type === "boolean") return v === 1;
    if (metric.goal != null && metric.goalDirection != null) {
      return isGoalMet(v, metric.goal, metric.goalDirection);
    }
    return v > 0;
  };

  const streak =
    displayKind === "streak"
      ? computeCurrentStreak(entries, todayDate, isSuccessForStreak)
      : 0;

  const todayValue = byDate.get(todayDate) ?? null;

  return {
    ...metric,
    weeklyTargetEffective,
    weeklyDone,
    dayValues,
    daySuccess,
    status,
    displayKind,
    streak,
    todayValue,
  };
}

export type DayState = "full" | "partial" | "empty" | "future";

export interface Hero {
  done: number;
  total: number;
  onTrackCount: number;
  totalGoals: number;
  dayStates: DayState[];
}

export function computeHero(
  metrics: DashboardMetric[],
  weekDays: string[],
  todayDate: string
): Hero {
  const counted = metrics.filter((m) => m.weeklyTargetEffective > 0);
  const done = counted.reduce((s, m) => s + m.weeklyDone, 0);
  const total = counted.reduce((s, m) => s + m.weeklyTargetEffective, 0);
  const onTrackCount = counted.filter(
    (m) => m.status === "met" || m.status === "on_track"
  ).length;
  const totalGoals = counted.length;

  const todayIndex = weekDays.indexOf(todayDate);
  const todayIdx = todayIndex < 0 ? weekDays.length - 1 : todayIndex;

  const dayStates: DayState[] = weekDays.map((_, i) => {
    if (i > todayIdx) return "future";
    if (metrics.length === 0) return "empty";
    const successesOnDay = metrics.filter((m) => m.daySuccess[i]).length;
    if (successesOnDay === 0) return "empty";
    if (successesOnDay === metrics.length) return "full";
    return "partial";
  });

  return { done, total, onTrackCount, totalGoals, dayStates };
}

export interface DashboardData {
  date: string;
  weekDays: string[];
  todayIndex: number;
  weekNumber: number;
  hero: Hero;
  metrics: DashboardMetric[];
}

function isoWeekNumber(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  // ISO 8601: Thursday of the week determines the year.
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function buildDashboardData(
  metrics: DashboardMetricInput[],
  entriesByMetric: Map<number, DashboardEntry[]>,
  todayDate: string
): DashboardData {
  const weekDays = getWeekDays(todayDate);
  const todayIndex = weekDays.indexOf(todayDate);
  const computedMetrics = metrics.map((m) =>
    computeMetricView(m, entriesByMetric.get(m.id) ?? [], weekDays, todayDate)
  );
  const hero = computeHero(computedMetrics, weekDays, todayDate);
  return {
    date: todayDate,
    weekDays,
    todayIndex,
    weekNumber: isoWeekNumber(todayDate),
    hero,
    metrics: computedMetrics,
  };
}
