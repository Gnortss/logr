import { useLoaderData, useFetcher } from "react-router";
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
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

  if (intent === "reorder") {
    const ids = JSON.parse(formData.get("ids") as string) as number[];
    for (let i = 0; i < ids.length; i++) {
      await db
        .update(metrics)
        .set({ sortOrder: i })
        .where(and(eq(metrics.id, ids[i]), eq(metrics.userId, user.userId)));
    }
    return { ok: true };
  }

  if (intent === "add-metric") {
    const name = (formData.get("name") as string)?.trim();
    const type = formData.get("type") as string;
    const unit = (formData.get("unit") as string) || null;
    const goalStr = formData.get("goal") as string;
    const goal = goalStr ? parseFloat(goalStr) : null;
    const goalDirection = (formData.get("goalDirection") as string) || null;

    if (!name || !type) return { error: "Name and type are required." };
    if (type !== "boolean" && goal != null && !goalDirection) {
      return { error: "Goal direction is required when a goal is set." };
    }

    const maxOrder = await db
      .select({ max: metrics.sortOrder })
      .from(metrics)
      .where(eq(metrics.userId, user.userId))
      .get();

    await db.insert(metrics).values({
      userId: user.userId,
      name, type, unit, goal,
      goalDirection: goal != null ? goalDirection : null,
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
    const goalDirection = (formData.get("goalDirection") as string) || null;

    if (!name) return { error: "Name is required." };

    await db
      .update(metrics)
      .set({ name, goal, goalDirection: goal != null ? goalDirection : null })
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

function SortableMetricRow({ metric, entry, date }: { metric: any; entry: any; date: string }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: metric.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center">
      <button
        {...attributes}
        {...listeners}
        className="px-2 py-3 text-outline-variant cursor-grab active:cursor-grabbing min-w-[32px] min-h-[44px] flex items-center"
        aria-label="Drag to reorder"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
          <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
          <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
        </svg>
      </button>
      <div className="flex-1">
        <MetricRow metric={metric} entry={entry} date={date} />
      </div>
    </div>
  );
}

export default function TodayView() {
  const { date, metrics: metricsList } = useLoaderData<typeof loader>();
  const [showAddForm, setShowAddForm] = useState(false);
  const [orderedMetrics, setOrderedMetrics] = useState(metricsList);
  const fetcher = useFetcher();

  // Sync with loader data when it changes
  const [prevMetrics, setPrevMetrics] = useState(metricsList);
  if (metricsList !== prevMetrics) {
    setOrderedMetrics(metricsList);
    setPrevMetrics(metricsList);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedMetrics.findIndex((m) => m.id === active.id);
    const newIndex = orderedMetrics.findIndex((m) => m.id === over.id);
    const newOrder = [...orderedMetrics];
    const [moved] = newOrder.splice(oldIndex, 1);
    newOrder.splice(newIndex, 0, moved);
    setOrderedMetrics(newOrder);

    fetcher.submit(
      { intent: "reorder", ids: JSON.stringify(newOrder.map((m) => m.id)) },
      { method: "post" }
    );
  }

  return (
    <div className="pb-24">
      <DateNav date={date} />

      {orderedMetrics.length === 0 ? (
        <div className="p-8 text-center text-text-muted">
          <p className="font-heading font-semibold mb-2">No metrics yet.</p>
          <p className="text-sm">Tap "Add Metric" below to get started.</p>
        </div>
      ) : (
        <div className="px-4 pt-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading font-semibold text-lg text-text">Core Metrics</h2>
            <span className="text-sm text-text-muted">{orderedMetrics.filter(m => m.goal != null || m.type === 'boolean').length} active goals</span>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={orderedMetrics.map((m) => m.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-3">
                {orderedMetrics.map((m) => (
                  <SortableMetricRow key={m.id} metric={m} entry={m.entry} date={date} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-bg">
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full py-3 bg-primary text-white font-medium rounded-full hover:bg-primary-container transition-colors min-h-[44px] max-w-lg mx-auto block"
        >
          Add Metric
        </button>
      </div>

      <MetricForm open={showAddForm} onClose={() => setShowAddForm(false)} />
    </div>
  );
}
