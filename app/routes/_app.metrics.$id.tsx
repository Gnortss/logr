import { useLoaderData } from "react-router";
import { useState } from "react";
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
  const [tab, setTab] = useState<"heatmap" | "stats">("heatmap");

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="px-4 pt-3.5 pb-3 border-b border-outline-variant">
        <div className="flex items-center gap-2.5 mb-2.5">
          <a href="/" className="p-1 -ml-1 rounded-lg hover:bg-surface-container-high transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </a>
        </div>
        <div className="font-bold text-xl text-text tracking-tight mb-1.5">{metric.name}</div>
        <div className="flex gap-1.5 items-center flex-wrap">
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-secondary-container text-secondary">{metric.type}</span>
          {metric.unit && <span className="text-xs text-outline font-mono">{metric.unit}</span>}
          {metric.goal != null && metric.goalDirection != null && (
            <span className="text-xs text-outline font-mono">
              · {metric.goalDirection === "at_least" ? "At least" : metric.goalDirection === "at_most" ? "At most" : "Approximately"} {metric.goal} {metric.unit ?? ""}
            </span>
          )}
          {metric.weeklyTarget != null && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary-fixed text-primary">
              {metric.weeklyTarget}× / week
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex px-4 pt-2 gap-1 border-b border-outline-variant">
        {(["heatmap", "stats"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-[13px] px-3.5 pb-2 pt-1.5 -mb-px ${
              tab === t
                ? "font-semibold text-primary border-b-2 border-primary"
                : "font-normal text-text-muted border-b-2 border-transparent"
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tab === "heatmap" ? (
          <Heatmap entries={entries} from={from} to={to} type={metric.type} goal={metric.goal} goalDirection={metric.goalDirection as GoalDirection | null} weeklyTarget={metric.weeklyTarget} />
        ) : (
          <>
            {isBoolean && metric.weeklyTarget != null
              ? <StatsPanel type="weekly-boolean" stats={stats as any} />
              : isBoolean
              ? <StatsPanel type="boolean" stats={stats as any} />
              : <StatsPanel type="numeric" stats={stats as any} trend={trend as any} unit={metric.unit} hasGoal={metric.goal != null} />
            }
          </>
        )}

        {entries.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold font-heading text-text-muted mb-3 uppercase tracking-wide">Entries</h3>
            <EntriesTable entries={entries} metricId={metric.id} type={metric.type} unit={metric.unit} />
          </div>
        )}
      </div>
    </div>
  );
}
