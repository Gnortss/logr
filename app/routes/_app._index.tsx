import { useLoaderData } from "react-router";
import { useState } from "react";
import type { Route } from "./+types/_app._index";
import { requireAuth } from "~/lib/auth.server";
import { getDb } from "~/lib/db.server";
import { metrics, metricEntries } from "~/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { MetricForm } from "~/components/metric-form";
import { MetricRow } from "~/components/metric-row";
import { DateNav } from "~/components/date-nav";
import { today } from "~/lib/date";

export async function loader({ request, context }: Route.LoaderArgs) {
  const user = await requireAuth(request, context.cloudflare.env.JWT_SECRET);
  const db = getDb(context.cloudflare.env.DB);

  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? today();

  const userMetrics = await db
    .select()
    .from(metrics)
    .where(and(eq(metrics.userId, user.userId), eq(metrics.archived, 0)))
    .orderBy(asc(metrics.sortOrder));

  // Fetch entries for the date, then filter to user's metrics
  const dayEntries =
    userMetrics.length > 0
      ? await db
          .select()
          .from(metricEntries)
          .where(eq(metricEntries.date, date))
          .all()
          .then((rows) => {
            const metricIds = new Set(userMetrics.map((m) => m.id));
            return rows.filter((e) => metricIds.has(e.metricId));
          })
      : [];

  const entriesByMetricId = new Map(dayEntries.map((e) => [e.metricId, e]));

  return {
    date,
    metrics: userMetrics.map((m) => ({
      ...m,
      entry: entriesByMetricId.get(m.id) ?? null,
    })),
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const user = await requireAuth(request, context.cloudflare.env.JWT_SECRET);
  const db = getDb(context.cloudflare.env.DB);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const now = new Date().toISOString();

  if (intent === "add-metric") {
    const name = (formData.get("name") as string)?.trim();
    const type = formData.get("type") as string;
    const unit = (formData.get("unit") as string) || null;
    const goalStr = formData.get("goal") as string;
    const goal = goalStr ? parseFloat(goalStr) : null;

    if (!name || !type) return { error: "Name and type are required." };
    if (type !== "boolean" && goal === null) return { error: "Goal is required for this type." };

    const maxOrder = await db
      .select({ max: metrics.sortOrder })
      .from(metrics)
      .where(eq(metrics.userId, user.userId))
      .get();

    await db.insert(metrics).values({
      userId: user.userId,
      name, type, unit, goal,
      sortOrder: (maxOrder?.max ?? -1) + 1,
      createdAt: now,
    });

    return { ok: true };
  }

  if (intent === "edit-metric") {
    const metricId = parseInt(formData.get("metricId") as string);
    const name = (formData.get("name") as string)?.trim();
    const goalStr = formData.get("goal") as string;
    const goal = goalStr ? parseFloat(goalStr) : null;

    if (!name) return { error: "Name is required." };

    await db
      .update(metrics)
      .set({ name, goal })
      .where(and(eq(metrics.id, metricId), eq(metrics.userId, user.userId)));

    return { ok: true };
  }

  if (intent === "log-entry") {
    const metricId = parseInt(formData.get("metricId") as string);
    const value = parseFloat(formData.get("value") as string);
    const date = formData.get("date") as string;

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

  if (intent === "delete-entry") {
    const metricId = parseInt(formData.get("metricId") as string);
    const date = formData.get("date") as string;

    await db.delete(metricEntries)
      .where(and(eq(metricEntries.metricId, metricId), eq(metricEntries.date, date)));

    return { ok: true };
  }

  return { error: "Unknown intent." };
}

export default function TodayView() {
  const { date, metrics: metricsList } = useLoaderData<typeof loader>();
  const [showAddForm, setShowAddForm] = useState(false);

  return (
    <div className="pb-24">
      <DateNav date={date} />

      {metricsList.length === 0 ? (
        <div className="p-8 text-center text-text-muted">
          <p className="mb-2">No metrics yet.</p>
          <p className="text-sm">Tap "Add Metric" below to get started.</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {metricsList.map((m) => (
            <MetricRow key={m.id} metric={m} entry={m.entry} date={date} />
          ))}
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-bg">
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full py-3 bg-accent text-white font-medium rounded-xl hover:bg-accent-dark transition-colors min-h-[44px] max-w-lg mx-auto block">
          Add Metric
        </button>
      </div>

      <MetricForm open={showAddForm} onClose={() => setShowAddForm(false)} />
    </div>
  );
}
