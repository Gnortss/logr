interface Entry {
  date: string;
  value: number;
}

function parseDateUTC(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addDaysUTC(dateStr: string, days: number): string {
  const date = parseDateUTC(dateStr);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetweenUTC(from: string, to: string): number {
  const a = parseDateUTC(from);
  const b = parseDateUTC(to);
  return Math.round((b.getTime() - a.getTime()) / (86400 * 1000));
}

export interface BooleanStats {
  currentStreak: number;
  longestStreak: number;
  totalDaysDone: number;
  completionRate: number;
}

export function computeBooleanStats(entries: Entry[], from: string, to: string): BooleanStats {
  const totalDays = daysBetweenUTC(from, to) + 1;
  const doneSet = new Set(entries.filter((e) => e.value === 1).map((e) => e.date));
  const totalDaysDone = doneSet.size;

  let longestStreak = 0;
  let streak = 0;

  for (let i = 0; i < totalDays; i++) {
    const day = addDaysUTC(from, i);
    if (doneSet.has(day)) {
      streak++;
      if (streak > longestStreak) longestStreak = streak;
    } else {
      streak = 0;
    }
  }

  let currentStreak = 0;
  for (let i = 0; i < totalDays; i++) {
    const day = addDaysUTC(to, -i);
    if (doneSet.has(day)) {
      currentStreak++;
    } else {
      break;
    }
  }

  return {
    currentStreak,
    longestStreak,
    totalDaysDone,
    completionRate: totalDays > 0 ? (totalDaysDone / totalDays) * 100 : 0,
  };
}

export interface NumericStats {
  average: number;
  min: number;
  max: number;
  total: number;
  daysTracked: number;
  daysGoalMet: number;
  goalHitRate: number;
}

export function computeNumericStats(entries: Entry[], goal: number | null): NumericStats {
  if (entries.length === 0) {
    return { average: 0, min: 0, max: 0, total: 0, daysTracked: 0, daysGoalMet: 0, goalHitRate: 0 };
  }

  const values = entries.map((e) => e.value);
  const total = values.reduce((sum, v) => sum + v, 0);
  const daysGoalMet = goal != null ? values.filter((v) => v >= goal).length : 0;

  return {
    average: total / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    total,
    daysTracked: entries.length,
    daysGoalMet,
    goalHitRate: goal != null ? (daysGoalMet / entries.length) * 100 : 0,
  };
}

export type Trend = "up" | "down" | "flat";

export function computeTrend(entries: Entry[]): Trend {
  if (entries.length < 2) return "flat";

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const n = sorted.length;
  const xMean = (n - 1) / 2;
  const yMean = sorted.reduce((s, e) => s + e.value, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (sorted[i].value - yMean);
    denominator += (i - xMean) ** 2;
  }

  if (denominator === 0) return "flat";
  const slope = numerator / denominator;

  const relativeSlope = yMean !== 0 ? slope / Math.abs(yMean) : slope;
  if (relativeSlope > 0.05) return "up";
  if (relativeSlope < -0.05) return "down";
  return "flat";
}
