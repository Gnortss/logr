import { useLoaderData } from "react-router";
import type { Route } from "./+types/_app.metrics.$id";
import { requireAuth } from "~/lib/auth.server";
import { getDb } from "~/lib/db.server";
import { metrics, metricEntries } from "~/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { addDays, today } from "~/lib/date";
import { computeBooleanStats, computeNumericStats, computeTrend, computeWeeklyBooleanStats } from "~/lib/stats.server";
import type { GoalDirection } from "~/lib/types";
import { Heatmap } from "~/components/heatmap";
import { StatsPanel } from "~/components/stats-panel";
import { EntriesTable } from "~/components/entries-table";

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const user = await requireAuth(request, context.cloudflare.env.JWT_SECRET);
  const db = getDb(context.cloudflare.env.DB);
  const metricId = parseInt(params.id);

  const metric = await db
    .select()
    .from(metrics)
    .where(and(eq(metrics.id, metricId), eq(metrics.userId, user.userId)))
    .get();

  if (!metric) throw new Response("Not Found", { status: 404 });

  const to = today();
  const from = addDays(to, -62); // ~9 weeks

  const entries = await db
    .select({ date: metricEntries.date, value: metricEntries.value })
    .from(metricEntries)
    .where(
      and(
        eq(metricEntries.metricId, metricId),
        gte(metricEntries.date, from),
        lte(metricEntries.date, to)
      )
    )
    .all();

  let stats;
  let trend;
  if (metric.type === "boolean") {
    if (metric.weeklyTarget != null) {
      stats = computeWeeklyBooleanStats(entries, metric.weeklyTarget, from, to);
    } else {
      stats = computeBooleanStats(entries, from, to);
    }
  } else {
    stats = computeNumericStats(entries, metric.goal, metric.goalDirection as GoalDirection | null);
    trend = computeTrend(entries);
  }

  return { metric, entries, stats, trend, from, to };
}

export async function action({ request, context, params }: Route.ActionArgs) {
  const user = await requireAuth(request, context.cloudflare.env.JWT_SECRET);
  const db = getDb(context.cloudflare.env.DB);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const now = new Date().toISOString();

  if (intent === "update-entry") {
    const metricId = parseInt(formData.get("metricId") as string);
    const date = formData.get("date") as string;
    const value = parseFloat(formData.get("value") as string);

    const metric = await db
      .select()
      .from(metrics)
      .where(and(eq(metrics.id, metricId), eq(metrics.userId, user.userId)))
      .get();
    if (!metric) throw new Response("Forbidden", { status: 403 });

    const existing = await db
      .select()
      .from(metricEntries)
      .where(and(eq(metricEntries.metricId, metricId), eq(metricEntries.date, date)))
      .get();

    if (existing) {
      await db.update(metricEntries).set({ value, updatedAt: now }).where(eq(metricEntries.id, existing.id));
    } else {
      await db.insert(metricEntries).values({ metricId, date, value, createdAt: now, updatedAt: now });
    }

    return { ok: true };
  }

  return { error: "Unknown intent." };
}

export default function MetricDetailView() {
  const { metric, entries, stats, trend, from, to } = useLoaderData<typeof loader>();
  const isBoolean = metric.type === "boolean";

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/" className="p-2 -ml-2 rounded-lg hover:bg-surface-container-high transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </a>
          <h2 className="text-xl font-bold font-heading text-text">Deep Insights</h2>
        </div>
        <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center">
          <span className="text-xs font-semibold text-text-muted uppercase">{metric.type.slice(0, 3)}</span>
        </div>
      </div>

      <div className="bg-bg-card rounded-xl p-4">
        <div className="text-lg font-heading font-semibold text-text mb-1">{metric.name}</div>
        {metric.unit && <span className="text-sm text-text-muted">{metric.unit}</span>}
        {metric.goal != null && metric.goalDirection != null && (
          <span className="text-sm text-text-muted ml-2">
            Goal: {metric.goalDirection === "at_least" ? "≥" : metric.goalDirection === "at_most" ? "≤" : "≈"} {metric.goal} {metric.unit ?? ""}
          </span>
        )}
        {metric.weeklyTarget != null && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary-fixed text-primary">
            {metric.weeklyTarget}× / week
          </span>
        )}
      </div>

      <div>
        {isBoolean && metric.weeklyTarget != null
          ? <StatsPanel type="weekly-boolean" stats={stats as any} />
          : isBoolean
          ? <StatsPanel type="boolean" stats={stats as any} />
          : <StatsPanel type="numeric" stats={stats as any} trend={trend as any} unit={metric.unit} hasGoal={metric.goal != null} />
        }
      </div>

      <div>
        <Heatmap entries={entries} from={from} to={to} type={metric.type} goal={metric.goal} goalDirection={metric.goalDirection as GoalDirection | null} weeklyTarget={metric.weeklyTarget} />
      </div>

      {entries.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold font-heading text-text-muted mb-3 uppercase tracking-wide">Entries</h3>
          <EntriesTable entries={entries} metricId={metric.id} type={metric.type} unit={metric.unit} />
        </div>
      )}
    </div>
  );
}
