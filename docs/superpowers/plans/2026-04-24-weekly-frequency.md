# Weekly Frequency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow metrics to have a weekly frequency target (e.g., "3 days out of 7") instead of requiring daily tracking, with full UI support in metric rows, forms, detail views, and API.

**Architecture:** Add a `weekly_target` INTEGER column to the `metrics` table (null = every day, 1–6 = N days/week). The today-view loader computes how many days this week already have entries for each weekly metric. The UI shows frequency badges, 7-dot progress strips, and adapted stats/heatmap for weekly metrics. Weekly boolean metrics use a compact check button instead of a toggle.

**Tech Stack:** Remix (React Router v7), Drizzle ORM, Cloudflare D1 (SQLite), Tailwind CSS

---

### Task 1: Schema — Add `weekly_target` column

**Files:**
- Modify: `app/db/schema.ts:19-30`
- Create: `db/migrations/0002_add_weekly_target.sql`

- [ ] **Step 1: Add column to Drizzle schema**

In `app/db/schema.ts`, add `weeklyTarget` to the `metrics` table definition, after `goalDirection`:

```typescript
weeklyTarget: integer("weekly_target"),
```

The full metrics table should look like:

```typescript
export const metrics = sqliteTable("metrics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  unit: text("unit"),
  goal: real("goal"),
  goalDirection: text("goal_direction"),
  weeklyTarget: integer("weekly_target"),
  sortOrder: integer("sort_order").notNull().default(0),
  archived: integer("archived").notNull().default(0),
  createdAt: text("created_at").notNull(),
});
```

- [ ] **Step 2: Create migration file**

Create `db/migrations/0002_add_weekly_target.sql`:

```sql
ALTER TABLE `metrics` ADD `weekly_target` integer;
```

- [ ] **Step 3: Generate drizzle migration metadata**

Run:
```bash
npx drizzle-kit generate
```

If drizzle-kit detects the schema change was already manually created, it may produce an empty migration. That's fine — the manual SQL file is what matters. If it creates a new numbered migration with the same ALTER, delete the duplicate and keep `0002_add_weekly_target.sql`.

- [ ] **Step 4: Verify typecheck passes**

Run:
```bash
npm run typecheck
```

Expected: PASS (no type errors)

- [ ] **Step 5: Commit**

```bash
git add app/db/schema.ts db/migrations/
git commit -m "feat: add weekly_target column to metrics schema"
```

---

### Task 2: Types — Add weekly target helpers

**Files:**
- Modify: `app/lib/types.ts`

- [ ] **Step 1: Add weekly target validation constant and helper**

Add at the end of `app/lib/types.ts`:

```typescript
export const MAX_WEEKLY_TARGET = 6;
export const MIN_WEEKLY_TARGET = 1;

export function isValidWeeklyTarget(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= MIN_WEEKLY_TARGET && value <= MAX_WEEKLY_TARGET;
}
```

- [ ] **Step 2: Verify typecheck passes**

Run:
```bash
npm run typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/lib/types.ts
git commit -m "feat: add weekly target validation helpers"
```

---

### Task 3: Date helpers — Add `getWeekStartDate` helper

**Files:**
- Modify: `app/lib/date.ts`

The `getWeekDays` function already exists and returns all 7 days of the week (Mon–Sun) for a given date. We need the Monday date to query entries for the current week. `getWeekDays` already does this — we'll use `getWeekDays(date)[0]` for the start and `getWeekDays(date)[6]` for the end. No new helper needed.

- [ ] **Step 1: Verify existing `getWeekDays` works for our needs**

`getWeekDays("2026-04-24")` should return `["2026-04-20", "2026-04-21", ..., "2026-04-26"]` (Monday through Sunday). This is already implemented at `app/lib/date.ts:29-36`. No changes needed.

- [ ] **Step 2: Commit (skip — no changes)**

No commit needed for this task.

---

### Task 4: Today-view loader — Compute weekly progress

**Files:**
- Modify: `app/routes/_app._index.tsx:30-66` (loader function)

The loader needs to: for each metric with a `weeklyTarget`, count how many days this week (Mon–Sun) have entries.

- [ ] **Step 1: Add weekly entry counting to the loader**

In `app/routes/_app._index.tsx`, add the import for `getWeekDays`:

```typescript
import { today, getWeekDays } from "~/lib/date";
```

(Replace the existing `import { today } from "~/lib/date";`)

Then, after fetching `dayEntries` and before building `entriesByMetricId`, add this block to fetch the full week's entries for weekly metrics:

```typescript
// For weekly metrics, count how many days this week have entries
const weeklyMetricIds = userMetrics.filter((m) => m.weeklyTarget != null).map((m) => m.id);
const weekDays = getWeekDays(date);
const weekStart = weekDays[0];
const weekEnd = weekDays[6];

let weeklyDoneCounts = new Map<number, number>();
if (weeklyMetricIds.length > 0) {
  const weekEntries = await db
    .select({ metricId: metricEntries.metricId, date: metricEntries.date, value: metricEntries.value })
    .from(metricEntries)
    .where(
      and(
        gte(metricEntries.date, weekStart),
        lte(metricEntries.date, weekEnd)
      )
    )
    .all();

  const weeklyIdSet = new Set(weeklyMetricIds);
  for (const e of weekEntries) {
    if (!weeklyIdSet.has(e.metricId)) continue;
    // For boolean: value === 1 counts. For numeric: any entry counts.
    const metric = userMetrics.find((m) => m.id === e.metricId);
    const counts = metric?.type === "boolean" ? (e.value === 1 ? 1 : 0) : 1;
    weeklyDoneCounts.set(e.metricId, (weeklyDoneCounts.get(e.metricId) ?? 0) + counts);
  }
}
```

Add `gte` and `lte` to the drizzle-orm imports:

```typescript
import { eq, and, asc, gte, lte } from "drizzle-orm";
```

Then update the return to include `weeklyDone`:

```typescript
return {
  date,
  metrics: userMetrics.map((m) => ({
    ...m,
    entry: entriesByMetricId.get(m.id) ?? null,
    weeklyDone: weeklyDoneCounts.get(m.id) ?? 0,
  })),
};
```

- [ ] **Step 2: Verify typecheck passes**

Run:
```bash
npm run typecheck
```

Expected: PASS (or type warnings in components that don't yet use `weeklyDone` — that's fine, we fix those next)

- [ ] **Step 3: Commit**

```bash
git add app/routes/_app._index.tsx
git commit -m "feat: compute weekly progress counts in today-view loader"
```

---

### Task 5: Today-view action — Accept `weeklyTarget` on add-metric

**Files:**
- Modify: `app/routes/_app._index.tsx:86-117` (action, add-metric intent)

- [ ] **Step 1: Parse and validate `weeklyTarget` in add-metric**

In the `add-metric` intent block, after parsing `goalDirection`, add:

```typescript
const weeklyTargetStr = formData.get("weeklyTarget") as string;
const weeklyTarget = weeklyTargetStr ? parseInt(weeklyTargetStr) : null;

if (weeklyTarget != null && (weeklyTarget < 1 || weeklyTarget > 6)) {
  return { error: "Weekly target must be between 1 and 6." };
}
```

Then add `weeklyTarget` to the `db.insert` values:

```typescript
await db.insert(metrics).values({
  userId: user.userId,
  name, type, unit, goal,
  goalDirection: goal != null ? goalDirection : null,
  weeklyTarget,
  sortOrder: (maxOrder?.max ?? -1) + 1,
  createdAt: now,
});
```

- [ ] **Step 2: Verify typecheck passes**

Run:
```bash
npm run typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/routes/_app._index.tsx
git commit -m "feat: accept weeklyTarget when creating metrics"
```

---

### Task 6: Metric Form — Add "Not every day" toggle with stepper

**Files:**
- Modify: `app/components/metric-form.tsx`

- [ ] **Step 1: Add weekly frequency state and UI**

Add `weeklyTarget` to the `MetricFormProps` metric interface:

```typescript
metric?: {
  id: number;
  name: string;
  type: MetricType;
  unit: string | null;
  goal: number | null;
  goalDirection: GoalDirection | null;
  weeklyTarget: number | null;
};
```

Add state variables after the existing state declarations:

```typescript
const [isWeekly, setIsWeekly] = useState(isEdit ? (metric.weeklyTarget != null) : false);
const [weeklyTarget, setWeeklyTarget] = useState(metric?.weeklyTarget ?? 3);
```

Add hidden input fields inside the `<Form>`, after the existing hidden inputs and before the `<div className="space-y-4">`:

```tsx
{isWeekly && <input type="hidden" name="weeklyTarget" value={weeklyTarget} />}
```

Add the frequency section UI. Insert this block inside the `<div className="space-y-4">`, after the unit selector and before the goal section (before `{type !== "boolean" && (`):

```tsx
{/* Frequency */}
<div className="bg-surface-container-high rounded-xl p-4">
  <label className="flex items-center justify-between cursor-pointer">
    <div>
      <span className="text-sm font-medium text-text">Not every day</span>
      <span className="block text-xs text-text-muted mt-0.5">Set a weekly target instead</span>
    </div>
    <input
      type="checkbox"
      checked={isWeekly}
      onChange={(e) => setIsWeekly(e.target.checked)}
      className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary"
    />
  </label>
  {isWeekly && (
    <div className="mt-4 pt-4 border-t border-outline-variant">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-text">Days per week</span>
        <span className="text-xs text-text-muted font-mono">any {weeklyTarget} of 7</span>
      </div>
      <div className="flex items-center border border-outline-variant rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setWeeklyTarget((v) => Math.max(1, v - 1))}
          disabled={weeklyTarget <= 1}
          className="w-12 h-10 text-lg text-text disabled:text-text-muted flex items-center justify-center"
        >
          −
        </button>
        <div className="flex-1 text-center font-mono text-lg font-semibold text-text">
          {weeklyTarget}
        </div>
        <button
          type="button"
          onClick={() => setWeeklyTarget((v) => Math.min(6, v + 1))}
          disabled={weeklyTarget >= 6}
          className="w-12 h-10 text-lg text-text disabled:text-text-muted flex items-center justify-center"
        >
          +
        </button>
      </div>
      <div className="flex gap-1 mt-3 justify-center">
        {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => (
          <div
            key={i}
            className={`w-8 h-8 rounded-md flex items-center justify-center text-xs font-semibold font-mono ${
              i < weeklyTarget
                ? "bg-primary-fixed text-primary border border-primary"
                : "bg-surface-container-high text-text-muted"
            }`}
          >
            {day}
          </div>
        ))}
      </div>
      <p className="text-xs text-text-muted text-center mt-2">
        Any {weeklyTarget} days — order doesn't matter
      </p>
    </div>
  )}
</div>
```

- [ ] **Step 2: Verify typecheck passes**

Run:
```bash
npm run typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/components/metric-form.tsx
git commit -m "feat: add weekly frequency toggle and stepper to metric form"
```

---

### Task 7: Metric Row — Weekly frequency badge, dots, and compact check

**Files:**
- Modify: `app/components/metric-row.tsx`

- [ ] **Step 1: Update MetricRowProps to include weekly fields**

Update the `MetricRowProps` interface:

```typescript
interface MetricRowProps {
  metric: {
    id: number;
    name: string;
    type: MetricType;
    unit: string | null;
    goal: number | null;
    goalDirection: GoalDirection | null;
    weeklyTarget: number | null;
  };
  entry: { value: number } | null;
  date: string;
  weeklyDone: number;
}
```

Update the `MetricRow` function signature and routing:

```typescript
export function MetricRow({ metric, entry, date, weeklyDone }: MetricRowProps) {
  if (metric.type === "boolean") {
    return <BooleanRow metric={metric} entry={entry} date={date} weeklyDone={weeklyDone} />;
  }
  return <NumericRow metric={metric} entry={entry} date={date} weeklyDone={weeklyDone} />;
}
```

- [ ] **Step 2: Add FreqBadge and WeekDots components**

Add these components after the existing `EmptyCircle` component:

```tsx
function FreqBadge({ weeklyTarget }: { weeklyTarget: number }) {
  return (
    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-surface-container-high text-text-muted border border-outline-variant whitespace-nowrap">
      {weeklyTarget}× / week
    </span>
  );
}

function WeekDots({ done, target }: { done: number; target: number }) {
  return (
    <div className="flex gap-1 items-center">
      {Array.from({ length: 7 }, (_, i) => {
        const filled = i < done;
        const metTarget = done >= target;
        return (
          <div
            key={i}
            className={`w-2 h-2 rounded-full ${
              filled
                ? metTarget
                  ? "bg-success"
                  : "bg-primary"
                : "bg-outline-variant"
            } ${i >= target ? "opacity-35" : ""}`}
            style={
              i === target - 1 && !metTarget
                ? { outline: "1.5px solid var(--color-primary)", outlineOffset: 1 }
                : undefined
            }
          />
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Update BooleanRow to handle weekly metrics**

Replace the `BooleanRow` function entirely:

```tsx
function BooleanRow({ metric, entry, date, weeklyDone }: MetricRowProps) {
  const fetcher = useFetcher();
  const isChecked = entry?.value === 1;
  const optimisticChecked =
    fetcher.formData ? fetcher.formData.get("value") === "1" : isChecked;

  const isWeekly = metric.weeklyTarget != null;
  const weeklyMet = isWeekly && weeklyDone >= metric.weeklyTarget!;

  let subtitle: string;
  if (isWeekly) {
    subtitle = weeklyMet
      ? `${weeklyDone} / ${metric.weeklyTarget} this week · done`
      : `${weeklyDone} / ${metric.weeklyTarget} this week`;
  } else {
    subtitle = optimisticChecked ? "" : "Not tracked";
  }

  return (
    <div className="bg-bg-card rounded-xl p-4 flex items-center gap-3">
      <Link to={`/metrics/${metric.id}`} className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <div className="font-heading font-semibold text-base text-text">{metric.name}</div>
          {isWeekly && <FreqBadge weeklyTarget={metric.weeklyTarget!} />}
        </div>
        {isWeekly ? (
          <WeekDots done={weeklyDone} target={metric.weeklyTarget!} />
        ) : (
          subtitle && <div className="text-sm text-text-muted mt-0.5">{subtitle}</div>
        )}
      </Link>
      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="log-entry" />
        <input type="hidden" name="metricId" value={metric.id} />
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="value" value={optimisticChecked ? "0" : "1"} />
        {isWeekly ? (
          <button
            type="submit"
            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              optimisticChecked ? "bg-success" : "bg-outline-variant"
            }`}
          >
            {optimisticChecked && (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            )}
          </button>
        ) : (
          <button type="submit" className="min-w-[44px] min-h-[44px] flex items-center justify-center">
            {optimisticChecked ? <CheckCircle /> : <EmptyCircle />}
          </button>
        )}
      </fetcher.Form>
    </div>
  );
}
```

- [ ] **Step 4: Update NumericRow to show weekly badge and dots**

Replace the `NumericRow` function entirely:

```tsx
function NumericRow({ metric, entry, date, weeklyDone }: MetricRowProps) {
  const fetcher = useFetcher();
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(entry?.value?.toString() ?? "");

  const direction = metric.goalDirection;
  const goalMet = entry?.value != null && isGoalMet(entry.value, metric.goal, direction);
  const unitLabel = metric.unit ?? "";
  const isWeekly = metric.weeklyTarget != null;

  let subtitle: string;
  if (isWeekly) {
    const weeklyMet = weeklyDone >= metric.weeklyTarget!;
    subtitle = weeklyMet
      ? `${weeklyDone} / ${metric.weeklyTarget} this week · done`
      : `${weeklyDone} / ${metric.weeklyTarget} this week`;
  } else if (metric.goal == null || direction == null) {
    subtitle = entry?.value != null
      ? `${entry.value} ${unitLabel}`.trim()
      : "Not tracked";
  } else if (entry?.value == null) {
    subtitle = `Goal: ${metric.goal} ${unitLabel}`.trim();
  } else if (goalMet) {
    subtitle = `Goal Met · ${entry.value} ${unitLabel}`.trim();
  } else if (direction === "at_least") {
    subtitle = `Current: ${entry.value} / Goal: ${metric.goal} ${unitLabel}`.trim();
  } else if (direction === "at_most") {
    subtitle = `${entry.value} / ${metric.goal} ${unitLabel}`.trim();
  } else {
    subtitle = `${entry.value} / ${metric.goal} ${unitLabel}`.trim();
  }

  function handleSubmit() {
    const val = parseFloat(inputValue);
    if (isNaN(val)) return;
    fetcher.submit(
      { intent: "log-entry", metricId: metric.id.toString(), date, value: val.toString() },
      { method: "post" }
    );
    setEditing(false);
  }

  return (
    <div className="bg-bg-card rounded-xl p-4 flex items-center gap-3">
      <Link to={`/metrics/${metric.id}`} className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <div className="font-heading font-semibold text-base text-text">{metric.name}</div>
          {isWeekly && <FreqBadge weeklyTarget={metric.weeklyTarget!} />}
        </div>
        {isWeekly ? (
          <WeekDots done={weeklyDone} target={metric.weeklyTarget!} />
        ) : (
          <div className="text-sm text-text-muted mt-0.5">{subtitle}</div>
        )}
      </Link>
      {editing ? (
        <div className="flex items-center gap-2">
          <input type="number" step="any" value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            autoFocus
            className="w-20 px-3 py-2 rounded-lg bg-surface-container-high text-text text-right focus:outline-none focus:ring-2 focus:ring-primary" />
          <button onClick={handleSubmit}
            className="px-3 py-2 bg-primary text-white rounded-full text-sm font-medium min-h-[36px]">Save</button>
          <button onClick={() => setEditing(false)}
            className="px-2 py-2 text-text-muted text-sm min-h-[36px]">Cancel</button>
        </div>
      ) : goalMet ? (
        <button
          onClick={() => { setInputValue(entry?.value?.toString() ?? ""); setEditing(true); }}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <CheckCircle />
        </button>
      ) : (
        <button
          onClick={() => { setInputValue(entry?.value?.toString() ?? ""); setEditing(true); }}
          className="px-3 py-1.5 rounded-full bg-surface-container-high text-sm font-medium text-text-muted min-h-[36px]"
        >
          {metric.goal != null && direction === "at_least" && entry?.value != null
            ? `${parseFloat(Math.max(0, metric.goal - entry.value).toFixed(2))} LEFT`
            : "Log"}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Verify typecheck passes**

Run:
```bash
npm run typecheck
```

Expected: Type errors in `_app._index.tsx` where `MetricRow` is called without `weeklyDone` — we fix that in the next step.

- [ ] **Step 6: Commit**

```bash
git add app/components/metric-row.tsx
git commit -m "feat: add weekly frequency badge, dots, and compact check to metric rows"
```

---

### Task 8: Today View — Wire up `weeklyDone` prop to MetricRow

**Files:**
- Modify: `app/routes/_app._index.tsx:172-198` (SortableMetricRow and usage)

- [ ] **Step 1: Pass weeklyDone through SortableMetricRow**

Update the `SortableMetricRow` component to accept and pass `weeklyDone`:

```tsx
function SortableMetricRow({ metric, entry, date, weeklyDone }: { metric: any; entry: any; date: string; weeklyDone: number }) {
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
        <MetricRow metric={metric} entry={entry} date={date} weeklyDone={weeklyDone} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update the rendering in TodayView**

In the `TodayView` component, update where `SortableMetricRow` is rendered (inside the `.map()`):

```tsx
{orderedMetrics.map((m) => (
  <SortableMetricRow key={m.id} metric={m} entry={m.entry} date={date} weeklyDone={m.weeklyDone} />
))}
```

- [ ] **Step 3: Update daily progress calculation**

The "active goals" count in the header should also account for weekly metrics. Update the header `<span>`:

```tsx
<span className="text-sm text-text-muted">
  {orderedMetrics.filter(m =>
    m.weeklyTarget != null ||
    (m.goal != null && m.goalDirection != null) ||
    m.type === 'boolean'
  ).length} active goals
</span>
```

- [ ] **Step 4: Verify typecheck passes**

Run:
```bash
npm run typecheck
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/routes/_app._index.tsx
git commit -m "feat: wire weekly progress to metric rows in today view"
```

---

### Task 9: Heatmap — Weekly target indicator row

**Files:**
- Modify: `app/components/heatmap.tsx`

- [ ] **Step 1: Add `weeklyTarget` prop to Heatmap**

Update the `HeatmapProps` interface:

```typescript
interface HeatmapProps {
  entries: { date: string; value: number }[];
  from: string;
  to: string;
  type: "boolean" | string;
  goal: number | null;
  goalDirection: GoalDirection | null;
  weeklyTarget: number | null;
}
```

Update the function signature:

```typescript
export function Heatmap({ entries, from, to, type, goal, goalDirection, weeklyTarget }: HeatmapProps) {
```

- [ ] **Step 2: Add weekly target banner and indicator row**

After the existing legend `<div>` (the flex with LESS/MORE), add this block inside the outer card `<div>`, right before the `<div className="overflow-x-auto">`:

```tsx
{weeklyTarget != null && (
  <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-primary-fixed rounded-lg">
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth={2} strokeLinecap="round">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
    </svg>
    <span className="text-xs text-primary font-medium">Target: {weeklyTarget} days / week</span>
  </div>
)}
```

Then, after the heatmap grid `</div>` (the `overflow-x-auto` div), add the weekly target-met indicator row:

```tsx
{weeklyTarget != null && (
  <div className="mt-2">
    <div
      className="inline-grid gap-1"
      style={{
        gridTemplateRows: "4px",
        gridTemplateColumns: `20px repeat(${totalWeeks}, 16px)`,
      }}
    >
      <div />
      {Array.from({ length: totalWeeks }, (_, wi) => {
        const weekCells = cells.filter((c) => c.weekIndex === wi);
        const daysLogged = weekCells.filter(
          (c) => c.value != null && (type === "boolean" ? c.value === 1 : c.value > 0)
        ).length;
        const met = daysLogged >= weeklyTarget;
        return (
          <div
            key={wi}
            className={`rounded-sm ${met ? "bg-primary" : "bg-surface-container-highest"}`}
          />
        );
      })}
    </div>
    <div className="text-[9px] text-text-muted mt-1 ml-5">weekly target met</div>
  </div>
)}
```

- [ ] **Step 3: Verify typecheck passes**

Run:
```bash
npm run typecheck
```

Expected: Type errors in `_app.metrics.$id.tsx` where `Heatmap` is used without `weeklyTarget` — we fix that in Task 11.

- [ ] **Step 4: Commit**

```bash
git add app/components/heatmap.tsx
git commit -m "feat: add weekly target indicator row to heatmap"
```

---

### Task 10: Stats — Weekly-aware boolean stats

**Files:**
- Modify: `app/lib/stats.server.ts`

- [ ] **Step 1: Add weekly boolean stats computation**

Add a new exported interface and function after the existing `computeBooleanStats`:

```typescript
export interface WeeklyBooleanStats {
  thisWeekDone: number;
  thisWeekTarget: number;
  weeklyRate: number;
  weeksPerfect: number;
  totalLogged: number;
}

export function computeWeeklyBooleanStats(
  entries: Entry[],
  weeklyTarget: number,
  from: string,
  to: string
): WeeklyBooleanStats {
  const doneSet = new Set(entries.filter((e) => e.value === 1).map((e) => e.date));
  const totalLogged = doneSet.size;

  // Group entries by ISO week (Mon-Sun)
  const weekBuckets = new Map<string, number>();
  for (const dateStr of doneSet) {
    const d = parseDateUTC(dateStr);
    const dow = d.getUTCDay();
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(d);
    monday.setUTCDate(monday.getUTCDate() + mondayOffset);
    const weekKey = monday.toISOString().slice(0, 10);
    weekBuckets.set(weekKey, (weekBuckets.get(weekKey) ?? 0) + 1);
  }

  // Count total weeks in range and how many met target
  const totalDays = daysBetweenUTC(from, to) + 1;
  const fromDate = parseDateUTC(from);
  const fromDow = fromDate.getUTCDay();
  const firstMondayOffset = fromDow === 0 ? -6 : 1 - fromDow;
  const firstMonday = new Date(fromDate);
  firstMonday.setUTCDate(firstMonday.getUTCDate() + firstMondayOffset);

  let totalWeeks = 0;
  let weeksPerfect = 0;
  const current = new Date(firstMonday);
  while (current.toISOString().slice(0, 10) <= to) {
    totalWeeks++;
    const weekKey = current.toISOString().slice(0, 10);
    if ((weekBuckets.get(weekKey) ?? 0) >= weeklyTarget) {
      weeksPerfect++;
    }
    current.setUTCDate(current.getUTCDate() + 7);
  }

  // Current week done count
  const todayDate = parseDateUTC(to);
  const todayDow = todayDate.getUTCDay();
  const thisMondayOffset = todayDow === 0 ? -6 : 1 - todayDow;
  const thisMonday = new Date(todayDate);
  thisMonday.setUTCDate(thisMonday.getUTCDate() + thisMondayOffset);
  const thisWeekKey = thisMonday.toISOString().slice(0, 10);
  const thisWeekDone = weekBuckets.get(thisWeekKey) ?? 0;

  return {
    thisWeekDone,
    thisWeekTarget: weeklyTarget,
    weeklyRate: totalWeeks > 0 ? (weeksPerfect / totalWeeks) * 100 : 0,
    weeksPerfect,
    totalLogged,
  };
}
```

- [ ] **Step 2: Verify typecheck passes**

Run:
```bash
npm run typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/lib/stats.server.ts
git commit -m "feat: add weekly-aware boolean stats computation"
```

---

### Task 11: Stats Panel — Display weekly stats

**Files:**
- Modify: `app/components/stats-panel.tsx`

- [ ] **Step 1: Add weekly boolean stats panel variant**

Import the new type:

```typescript
import type { BooleanStats, NumericStats, Trend, WeeklyBooleanStats } from "~/lib/stats.server";
```

Add a new props variant to the union type:

```typescript
interface WeeklyBooleanStatsPanelProps {
  type: "weekly-boolean";
  stats: WeeklyBooleanStats;
}

type StatsPanelProps = BooleanStatsPanelProps | NumericStatsPanelProps | WeeklyBooleanStatsPanelProps;
```

Update the `StatsPanel` function to handle the new type:

```typescript
export function StatsPanel(props: StatsPanelProps) {
  if (props.type === "weekly-boolean") {
    return <WeeklyBooleanStatsPanel stats={props.stats} />;
  }
  if (props.type === "boolean") {
    return <BooleanStatsPanel stats={props.stats} />;
  }
  return <NumericStatsPanel stats={props.stats} trend={props.trend} unit={props.unit} hasGoal={props.hasGoal} />;
}
```

Add the new panel component before the `CompletionRing` function:

```tsx
function WeeklyBooleanStatsPanel({ stats }: { stats: WeeklyBooleanStats }) {
  return (
    <div className="space-y-3">
      <div className="bg-primary-fixed rounded-xl p-4 flex items-center gap-3">
        <div className="text-3xl font-bold font-heading text-primary">{stats.thisWeekTarget}×</div>
        <div>
          <div className="text-sm text-text-muted">per week target</div>
          <div className="text-xs text-text-muted">any {stats.thisWeekTarget} of 7 days</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="This Week" value={`${stats.thisWeekDone} / ${stats.thisWeekTarget}`} sublabel="days" />
        <StatCard label="Weekly Rate" value={`${Math.round(stats.weeklyRate)}%`} />
        <StatCard label="Weeks Perfect" value={stats.weeksPerfect} />
        <StatCard label="Total Logged" value={stats.totalLogged} sublabel="days" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck passes**

Run:
```bash
npm run typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/components/stats-panel.tsx
git commit -m "feat: add weekly boolean stats panel variant"
```

---

### Task 12: Detail View — Pass weekly target to components

**Files:**
- Modify: `app/routes/_app.metrics.$id.tsx`

- [ ] **Step 1: Use weekly stats for weekly boolean metrics**

Import the new stats function:

```typescript
import { computeBooleanStats, computeNumericStats, computeTrend, computeWeeklyBooleanStats } from "~/lib/stats.server";
```

Update the stats computation in the loader:

```typescript
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
```

- [ ] **Step 2: Update the component to pass weekly info**

In the `MetricDetailView` component, update the `StatsPanel` usage:

```tsx
<StatsPanel
  type={isBoolean ? (metric.weeklyTarget != null ? "weekly-boolean" : "boolean") : "numeric"}
  stats={stats as any}
  {...(!isBoolean && { trend: trend as any, unit: metric.unit, hasGoal: metric.goal != null })}
/>
```

Update the `Heatmap` to include `weeklyTarget`:

```tsx
<Heatmap entries={entries} from={from} to={to} type={metric.type} goal={metric.goal} goalDirection={metric.goalDirection as GoalDirection | null} weeklyTarget={metric.weeklyTarget} />
```

Add a weekly target badge in the metric header. After the existing goal span:

```tsx
{metric.weeklyTarget != null && (
  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary-fixed text-primary">
    {metric.weeklyTarget}× / week
  </span>
)}
```

- [ ] **Step 3: Verify typecheck passes**

Run:
```bash
npm run typecheck
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add app/routes/_app.metrics.$id.tsx
git commit -m "feat: pass weekly target to heatmap and stats in detail view"
```

---

### Task 13: Settings — Show frequency badge on metrics

**Files:**
- Modify: `app/routes/_app.settings.tsx:117-141`

- [ ] **Step 1: Add frequency badge to metric cards**

In the settings metric list, after the type badge `<span>`, add the frequency badge:

```tsx
{m.weeklyTarget != null && (
  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-surface-container-high text-text-muted border border-outline-variant">
    {m.weeklyTarget}× / week
  </span>
)}
```

The full metric card inner content should be:

```tsx
<div className="flex flex-col gap-1">
  <span className="text-text font-medium">{m.name}</span>
  <div className="flex gap-1.5 items-center flex-wrap">
    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary-container text-secondary font-medium w-fit">{m.type}</span>
    {m.weeklyTarget != null && (
      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-surface-container-high text-text-muted border border-outline-variant">
        {m.weeklyTarget}× / week
      </span>
    )}
  </div>
</div>
```

- [ ] **Step 2: Pass weeklyTarget to MetricForm in edit mode**

Update the `editingMetric` rendering to include `weeklyTarget`:

```tsx
{editingMetric && (
  <MetricForm
    open={!!editingMetric}
    onClose={() => setEditingMetric(null)}
    metric={{
      id: editingMetric.id,
      name: editingMetric.name,
      type: editingMetric.type as MetricType,
      unit: editingMetric.unit,
      goal: editingMetric.goal,
      goalDirection: editingMetric.goalDirection,
      weeklyTarget: editingMetric.weeklyTarget,
    }}
  />
)}
```

- [ ] **Step 3: Update settings edit-metric action to persist weeklyTarget**

In the settings action `edit-metric` intent, parse and save `weeklyTarget`:

```typescript
if (intent === "edit-metric") {
  const metricId = parseInt(formData.get("metricId") as string);
  const name = (formData.get("name") as string)?.trim();
  const goalStr = formData.get("goal") as string;
  const goal = goalStr ? parseFloat(goalStr) : null;
  const goalDirection = (formData.get("goalDirection") as string) || null;
  const weeklyTargetStr = formData.get("weeklyTarget") as string;
  const weeklyTarget = weeklyTargetStr ? parseInt(weeklyTargetStr) : null;
  if (!name) return { error: "Name is required." };
  if (goalDirection && !GOAL_DIRECTIONS.includes(goalDirection as any)) {
    return { error: "Invalid goal direction." };
  }
  if (weeklyTarget != null && (weeklyTarget < 1 || weeklyTarget > 6)) {
    return { error: "Weekly target must be between 1 and 6." };
  }
  await db.update(metrics).set({
    name, goal,
    goalDirection: goal != null ? goalDirection : null,
    weeklyTarget,
  })
    .where(and(eq(metrics.id, metricId), eq(metrics.userId, user.userId)));
  return { ok: true };
}
```

- [ ] **Step 4: Also update the edit-metric action in _app._index.tsx**

In `app/routes/_app._index.tsx`, update the `edit-metric` intent to also handle `weeklyTarget`:

```typescript
if (intent === "edit-metric") {
  const metricId = parseInt(formData.get("metricId") as string);
  const name = (formData.get("name") as string)?.trim();
  const goalStr = formData.get("goal") as string;
  const goal = goalStr ? parseFloat(goalStr) : null;
  const goalDirection = (formData.get("goalDirection") as string) || null;
  const weeklyTargetStr = formData.get("weeklyTarget") as string;
  const weeklyTarget = weeklyTargetStr ? parseInt(weeklyTargetStr) : null;

  if (!name) return { error: "Name is required." };
  if (goalDirection && !GOAL_DIRECTIONS.includes(goalDirection as any)) {
    return { error: "Invalid goal direction." };
  }
  if (weeklyTarget != null && (weeklyTarget < 1 || weeklyTarget > 6)) {
    return { error: "Weekly target must be between 1 and 6." };
  }

  await db
    .update(metrics)
    .set({ name, goal, goalDirection: goal != null ? goalDirection : null, weeklyTarget })
    .where(and(eq(metrics.id, metricId), eq(metrics.userId, user.userId)));

  return { ok: true };
}
```

- [ ] **Step 5: Verify typecheck passes**

Run:
```bash
npm run typecheck
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/routes/_app.settings.tsx app/routes/_app._index.tsx
git commit -m "feat: show weekly badge in settings and persist weeklyTarget on edit"
```

---

### Task 14: API Routes — Include `weeklyTarget` in responses

**Files:**
- Modify: `app/routes/api.v1.metrics.tsx`
- Modify: `app/routes/api.v1.metrics.$id.tsx`

- [ ] **Step 1: Add weeklyTarget to metrics list API**

In `app/routes/api.v1.metrics.tsx`, update the select to include `weeklyTarget`:

```typescript
const result = await db
  .select({ id: metrics.id, name: metrics.name, type: metrics.type, unit: metrics.unit, goal: metrics.goal, goalDirection: metrics.goalDirection, weeklyTarget: metrics.weeklyTarget })
  .from(metrics)
  .where(and(eq(metrics.userId, userId), eq(metrics.archived, 0)))
  .all();
```

- [ ] **Step 2: Add weeklyTarget to single metric API**

In `app/routes/api.v1.metrics.$id.tsx`, update the response data:

```typescript
return Response.json({
  ok: true,
  data: { id: metric.id, name: metric.name, type: metric.type, unit: metric.unit, goal: metric.goal, goalDirection: metric.goalDirection, weeklyTarget: metric.weeklyTarget },
});
```

- [ ] **Step 3: Verify typecheck passes**

Run:
```bash
npm run typecheck
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add app/routes/api.v1.metrics.tsx app/routes/api.v1.metrics.$id.tsx
git commit -m "feat: include weeklyTarget in API metric responses"
```

---

### Task 15: Final typecheck and manual test

- [ ] **Step 1: Run full typecheck**

Run:
```bash
npm run typecheck
```

Expected: PASS with zero errors

- [ ] **Step 2: Run build**

Run:
```bash
npm run build
```

Expected: Build succeeds

- [ ] **Step 3: Start dev server and manually test**

Run:
```bash
npm run dev
```

Test these flows:
1. Create a new boolean metric with "Not every day" toggled on, target 3 days/week
2. Verify the metric row shows the `3× / week` badge and 7-dot progress strip
3. Tap the compact check button to log a day — dots should fill in
4. Create a numeric weekly metric (e.g., duration, 4×/week)
5. Tap into a weekly metric detail — verify heatmap shows the weekly target banner and met-indicator row
6. Check stats show weekly-specific stats for boolean weekly metrics
7. Go to settings — verify frequency badges appear on weekly metrics
8. Edit a weekly metric — verify the frequency toggle is pre-populated

- [ ] **Step 4: Commit any fixes**

If any fixes were needed during testing, commit them:
```bash
git add -A
git commit -m "fix: address issues found during weekly frequency testing"
```
