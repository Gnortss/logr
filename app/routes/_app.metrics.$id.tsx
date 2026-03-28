import { useLoaderData } from "react-router";
import type { Route } from "./+types/_app.metrics.$id";
import { requireAuth } from "~/lib/auth.server";
import { getDb } from "~/lib/db.server";
import { metrics, metricEntries } from "~/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { addDays, today } from "~/lib/date";
import { computeBooleanStats, computeNumericStats, computeTrend } from "~/lib/stats.server";
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
    stats = computeBooleanStats(entries, from, to);
  } else {
    stats = computeNumericStats(entries, metric.goal);
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

  return (
    <div className="p-4 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-text">{metric.name}</h2>
        <div className="flex gap-2 mt-1">
          <span className="text-xs px-2 py-0.5 rounded-full bg-accent/15 text-accent font-medium">
            {metric.type}
          </span>
          {metric.unit && <span className="text-xs text-text-muted">{metric.unit}</span>}
          {metric.goal != null && (
            <span className="text-xs text-text-muted">Goal: {metric.goal} {metric.unit ?? ""}</span>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-text-muted mb-2">Activity</h3>
        <Heatmap entries={entries} from={from} to={to} type={metric.type} goal={metric.goal} />
      </div>

      <div>
        <h3 className="text-sm font-medium text-text-muted mb-2">Stats</h3>
        {metric.type === "boolean" ? (
          <StatsPanel type="boolean" stats={stats as any} />
        ) : (
          <StatsPanel type="numeric" stats={stats as any} trend={trend as any} unit={metric.unit} />
        )}
      </div>

      {entries.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-text-muted mb-2">Entries</h3>
          <EntriesTable entries={entries} metricId={metric.id} type={metric.type} unit={metric.unit} />
        </div>
      )}
    </div>
  );
}
