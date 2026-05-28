import { eq, and, asc, gte, lte, inArray } from "drizzle-orm";
import { metrics, metricEntries } from "~/db/schema";
import type { Database } from "~/lib/db.server";
import {
  buildDashboardData,
  type DashboardData,
  type DashboardEntry,
  type DashboardMetricInput,
} from "~/lib/dashboard";
import { getWeekDays } from "~/lib/date";

const MAX_METRICS = 5;

export async function getDashboardData(
  db: Database,
  userId: number,
  todayDate: string
): Promise<DashboardData> {
  const userMetricsRows = await db
    .select({
      id: metrics.id,
      name: metrics.name,
      type: metrics.type,
      unit: metrics.unit,
      goal: metrics.goal,
      goalDirection: metrics.goalDirection,
      weeklyTarget: metrics.weeklyTarget,
    })
    .from(metrics)
    .where(and(eq(metrics.userId, userId), eq(metrics.archived, 0)))
    .orderBy(asc(metrics.sortOrder))
    .limit(MAX_METRICS)
    .all();

  const userMetrics: DashboardMetricInput[] = userMetricsRows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type as DashboardMetricInput["type"],
    unit: r.unit,
    goal: r.goal,
    goalDirection: r.goalDirection as DashboardMetricInput["goalDirection"],
    weeklyTarget: r.weeklyTarget,
  }));

  const weekDays = getWeekDays(todayDate);
  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];

  const ids = userMetrics.map((m) => m.id);
  const entriesByMetric = new Map<number, DashboardEntry[]>();
  if (ids.length > 0) {
    const rows = await db
      .select({
        metricId: metricEntries.metricId,
        date: metricEntries.date,
        value: metricEntries.value,
      })
      .from(metricEntries)
      .where(
        and(
          inArray(metricEntries.metricId, ids),
          gte(metricEntries.date, weekStart),
          lte(metricEntries.date, weekEnd)
        )
      )
      .all();
    for (const r of rows) {
      const list = entriesByMetric.get(r.metricId) ?? [];
      list.push({ date: r.date, value: r.value });
      entriesByMetric.set(r.metricId, list);
    }
  }

  return buildDashboardData(userMetrics, entriesByMetric, todayDate);
}
