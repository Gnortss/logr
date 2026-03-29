# Metric Goals Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support multiple goal directions (at least, at most, approximately), optional goals, habit display cleanup, and single-unit auto-selection.

**Architecture:** Add a `goal_direction` column to the metrics table. Extract a shared `isGoalMet()` helper. Update the MetricForm to support toggling goals on/off and selecting direction. Update all display components to use direction-aware goal evaluation.

**Tech Stack:** React Router, Drizzle ORM, SQLite (Cloudflare D1), TypeScript

---

### Task 1: Add types and constants

**Files:**
- Modify: `app/lib/types.ts`

- [ ] **Step 1: Add goal direction types and tolerance constant**

In `app/lib/types.ts`, add after line 23 (after the `UNITS_BY_TYPE` block):

```typescript
export const GOAL_DIRECTIONS = ["at_least", "at_most", "approximately"] as const;
export type GoalDirection = (typeof GOAL_DIRECTIONS)[number];

export const APPROX_TOLERANCE = 0.1; // 10% tolerance for "approximately" direction
```

- [ ] **Step 2: Add `isGoalMet` helper function**

In `app/lib/types.ts`, add after the constants:

```typescript
export function isGoalMet(
  value: number,
  goal: number | null,
  direction: GoalDirection | null,
  tolerance: number = APPROX_TOLERANCE
): boolean {
  if (goal == null || direction == null) return false;
  switch (direction) {
    case "at_least":
      return value >= goal;
    case "at_most":
      return value <= goal;
    case "approximately":
      return value >= goal * (1 - tolerance) && value <= goal * (1 + tolerance);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/lib/types.ts
git commit -m "feat: add goal direction types and isGoalMet helper"
```

---

### Task 2: Update database schema and generate migration

**Files:**
- Modify: `app/db/schema.ts`

- [ ] **Step 1: Add `goalDirection` column to metrics table**

In `app/db/schema.ts`, add after line 25 (`goal: real("goal"),`):

```typescript
  goalDirection: text("goal_direction"),
```

- [ ] **Step 2: Generate the migration**

Run:
```bash
npx drizzle-kit generate
```

Expected: A new migration file in `db/migrations/` with an `ALTER TABLE` adding `goal_direction`.

- [ ] **Step 3: Add data migration SQL for existing metrics**

The generated migration will only add the column. After the `ALTER TABLE` statement in the new migration file, add:

```sql
--> statement-breakpoint
UPDATE `metrics` SET `goal_direction` = 'at_least' WHERE `goal` IS NOT NULL;
```

This backfills existing metrics that have a goal with the current behavior (`at_least`).

- [ ] **Step 4: Commit**

```bash
git add app/db/schema.ts db/migrations/
git commit -m "feat: add goal_direction column to metrics table with migration"
```

---

### Task 3: Update MetricForm — goal toggle, direction selector, unit auto-select

**Files:**
- Modify: `app/components/metric-form.tsx`

- [ ] **Step 1: Update the MetricFormProps interface**

In `app/components/metric-form.tsx`, replace the `metric` prop type (lines 8-14):

```typescript
interface MetricFormProps {
  open: boolean;
  onClose: () => void;
  metric?: {
    id: number;
    name: string;
    type: MetricType;
    unit: string | null;
    goal: number | null;
    goalDirection: string | null;
  };
}
```

- [ ] **Step 2: Add state for goal toggle and direction**

In the `MetricForm` component, after line 21 (`const navigation = useNavigation();`), add:

```typescript
  const [goalEnabled, setGoalEnabled] = useState(
    isEdit ? metric.goal != null : true
  );
  const [goalDirection, setGoalDirection] = useState(
    metric?.goalDirection ?? "at_least"
  );
```

- [ ] **Step 3: Update the unit selector for auto-selection**

Replace the unit block (lines 53-62) with:

```typescript
            {units.length > 0 && (
              <div>
                <label htmlFor="unit" className="block text-sm font-medium text-text mb-1">Unit</label>
                <select id="unit" name="unit" disabled={isEdit || units.length === 1}
                  defaultValue={metric?.unit ?? units[0]}
                  className="w-full px-3 py-3 rounded-lg bg-surface-container-high text-text focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50">
                  {units.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            )}
```

The key change: `disabled={isEdit || units.length === 1}` — disables when there's only one unit.

- [ ] **Step 4: Replace the goal input section with toggle + direction + value**

Replace the goal block (lines 64-71) with:

```typescript
            {type !== "boolean" && (
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={goalEnabled}
                    onChange={(e) => setGoalEnabled(e.target.checked)}
                    className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary"
                  />
                  <span className="text-sm font-medium text-text">Set a daily goal</span>
                </label>
                {goalEnabled && (
                  <>
                    <div>
                      <label htmlFor="goalDirection" className="block text-sm font-medium text-text mb-1">Direction</label>
                      <select
                        id="goalDirection"
                        name="goalDirection"
                        value={goalDirection}
                        onChange={(e) => setGoalDirection(e.target.value)}
                        className="w-full px-3 py-3 rounded-lg bg-surface-container-high text-text focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="at_least">At least</option>
                        <option value="at_most">At most</option>
                        <option value="approximately">Approximately</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="goal" className="block text-sm font-medium text-text mb-1">Daily Goal</label>
                      <input id="goal" name="goal" type="number" step="any" required
                        defaultValue={metric?.goal ?? undefined} placeholder="e.g. 3"
                        className="w-full px-3 py-3 rounded-lg bg-surface-container-high text-text placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                    {isEdit && (
                      <p className="text-xs text-text-muted">
                        Changing the goal applies to all tracked data, including past entries.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
```

- [ ] **Step 5: Commit**

```bash
git add app/components/metric-form.tsx
git commit -m "feat: add goal toggle, direction selector, and unit auto-select to MetricForm"
```

---

### Task 4: Update action handlers to persist goalDirection

**Files:**
- Modify: `app/routes/_app._index.tsx`
- Modify: `app/routes/_app.settings.tsx`

- [ ] **Step 1: Update the `add-metric` action in `_app._index.tsx`**

Replace the `add-metric` block (lines 85-109) with:

```typescript
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
```

Key changes: removed the "Goal is required" validation, added `goalDirection` extraction and persistence.

- [ ] **Step 2: Update the `edit-metric` action in `_app._index.tsx`**

Replace the `edit-metric` block (lines 111-125) with:

```typescript
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
```

- [ ] **Step 3: Update the `edit-metric` action in `_app.settings.tsx`**

Replace the `edit-metric` block (lines 59-68) with:

```typescript
  if (intent === "edit-metric") {
    const metricId = parseInt(formData.get("metricId") as string);
    const name = (formData.get("name") as string)?.trim();
    const goalStr = formData.get("goal") as string;
    const goal = goalStr ? parseFloat(goalStr) : null;
    const goalDirection = (formData.get("goalDirection") as string) || null;
    if (!name) return { error: "Name is required." };
    await db.update(metrics).set({ name, goal, goalDirection: goal != null ? goalDirection : null })
      .where(and(eq(metrics.id, metricId), eq(metrics.userId, user.userId)));
    return { ok: true };
  }
```

- [ ] **Step 4: Update settings view to pass `goalDirection` to MetricForm**

In `app/routes/_app.settings.tsx`, update the `MetricForm` usage (lines 193-203). Replace:

```typescript
        <MetricForm
          open={!!editingMetric}
          onClose={() => setEditingMetric(null)}
          metric={{
            id: editingMetric.id,
            name: editingMetric.name,
            type: editingMetric.type as MetricType,
            unit: editingMetric.unit,
            goal: editingMetric.goal,
          }}
        />
```

With:

```typescript
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
          }}
        />
```

- [ ] **Step 5: Commit**

```bash
git add app/routes/_app._index.tsx app/routes/_app.settings.tsx
git commit -m "feat: persist goalDirection in add/edit metric actions"
```

---

### Task 5: Update MetricRow to use direction-aware goal evaluation

**Files:**
- Modify: `app/components/metric-row.tsx`

- [ ] **Step 1: Update MetricRowProps**

In `app/components/metric-row.tsx`, replace the props interface (lines 5-15):

```typescript
interface MetricRowProps {
  metric: {
    id: number;
    name: string;
    type: MetricType;
    unit: string | null;
    goal: number | null;
    goalDirection: string | null;
  };
  entry: { value: number } | null;
  date: string;
}
```

- [ ] **Step 2: Update BooleanRow subtitle**

In the `BooleanRow` function, replace lines 46-48:

```typescript
  const subtitle = optimisticChecked
    ? `Goal Met`
    : "Not tracked";
```

With:

```typescript
  const subtitle = optimisticChecked ? "" : "Not tracked";
```

And update the subtitle rendering in the JSX (line 54). Replace:

```typescript
        <div className="text-sm text-text-muted mt-0.5">{subtitle}</div>
```

With:

```typescript
        {subtitle && <div className="text-sm text-text-muted mt-0.5">{subtitle}</div>}
```

- [ ] **Step 3: Update NumericRow to use `isGoalMet` and direction-aware subtitles**

Add the import at the top of `app/components/metric-row.tsx`:

```typescript
import { isGoalMet, type GoalDirection } from "~/lib/types";
```

Replace the NumericRow logic (lines 74-85) with:

```typescript
  const direction = metric.goalDirection as GoalDirection | null;
  const goalMet = entry?.value != null && isGoalMet(entry.value, metric.goal, direction);
  const unitLabel = metric.unit ?? "";

  let subtitle: string;
  if (metric.goal == null || direction == null) {
    // No goal set
    subtitle = entry?.value != null
      ? `${entry.value} ${unitLabel}`.trim()
      : "Not tracked";
  } else if (entry?.value == null) {
    subtitle = `Goal: ${metric.goal} ${unitLabel}`.trim();
  } else if (goalMet) {
    subtitle = `Goal Met · ${entry.value} ${unitLabel}`.trim();
  } else if (direction === "at_least") {
    const remaining = Math.max(0, metric.goal - entry.value);
    subtitle = `Current: ${entry.value} / Goal: ${metric.goal} ${unitLabel}`.trim();
  } else if (direction === "at_most") {
    subtitle = `${entry.value} / ${metric.goal} ${unitLabel}`.trim();
  } else {
    // approximately
    subtitle = `${entry.value} / ${metric.goal} ${unitLabel}`.trim();
  }
```

- [ ] **Step 4: Update the remaining/button display in NumericRow**

Replace the button logic (lines 115-131) with:

```typescript
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
```

- [ ] **Step 5: Commit**

```bash
git add app/components/metric-row.tsx
git commit -m "feat: update MetricRow with direction-aware goal evaluation"
```

---

### Task 6: Update stats computation to use goal direction

**Files:**
- Modify: `app/lib/stats.server.ts`

- [ ] **Step 1: Update `computeNumericStats` signature and logic**

In `app/lib/stats.server.ts`, add the import at the top:

```typescript
import { isGoalMet, type GoalDirection } from "~/lib/types";
```

Replace the `computeNumericStats` function (lines 76-94) with:

```typescript
export function computeNumericStats(
  entries: Entry[],
  goal: number | null,
  goalDirection: GoalDirection | null = "at_least"
): NumericStats {
  if (entries.length === 0) {
    return { average: 0, min: 0, max: 0, total: 0, daysTracked: 0, daysGoalMet: 0, goalHitRate: 0 };
  }

  const values = entries.map((e) => e.value);
  const total = values.reduce((sum, v) => sum + v, 0);
  const daysGoalMet = goal != null && goalDirection != null
    ? values.filter((v) => isGoalMet(v, goal, goalDirection)).length
    : 0;

  return {
    average: total / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    total,
    daysTracked: entries.length,
    daysGoalMet,
    goalHitRate: goal != null && goalDirection != null ? (daysGoalMet / entries.length) * 100 : 0,
  };
}
```

- [ ] **Step 2: Update the caller in `_app.metrics.$id.tsx`**

In `app/routes/_app.metrics.$id.tsx`, replace line 46:

```typescript
    stats = computeNumericStats(entries, metric.goal);
```

With:

```typescript
    stats = computeNumericStats(entries, metric.goal, metric.goalDirection as GoalDirection | null);
```

Add the import at the top:

```typescript
import type { GoalDirection } from "~/lib/types";
```

- [ ] **Step 3: Commit**

```bash
git add app/lib/stats.server.ts app/routes/_app.metrics.$id.tsx
git commit -m "feat: use goal direction in stats computation"
```

---

### Task 7: Update Heatmap for direction-aware coloring and no-goal mode

**Files:**
- Modify: `app/components/heatmap.tsx`

- [ ] **Step 1: Update HeatmapProps and getCellColor**

In `app/components/heatmap.tsx`, add the import:

```typescript
import { isGoalMet, type GoalDirection } from "~/lib/types";
```

Replace the `HeatmapProps` interface (lines 3-8):

```typescript
interface HeatmapProps {
  entries: { date: string; value: number }[];
  from: string;
  to: string;
  type: "boolean" | string;
  goal: number | null;
  goalDirection: GoalDirection | null;
}
```

Update the component signature (line 11):

```typescript
export function Heatmap({ entries, from, to, type, goal, goalDirection }: HeatmapProps) {
```

Replace the `getCellColor` function (lines 46-58):

```typescript
  function getCellColor(value: number | null): string {
    if (value === null) return "bg-surface-container-highest";
    if (type === "boolean") {
      return value === 1 ? "bg-primary" : "bg-surface-container-high";
    }
    if (goal == null || goalDirection == null) {
      // No goal: binary — tracked vs not tracked
      return value > 0 ? "bg-primary" : "bg-surface-container-high";
    }
    if (isGoalMet(value, goal, goalDirection)) return "bg-primary";
    const range = maxVal - minVal;
    const intensity = range > 0 ? (value - minVal) / range : 0.5;
    if (intensity >= 0.75) return "bg-primary";
    if (intensity >= 0.5) return "bg-primary-container";
    if (intensity >= 0.25) return "bg-primary-fixed-dim";
    return "bg-primary-fixed";
  }
```

- [ ] **Step 2: Update the Heatmap caller in `_app.metrics.$id.tsx`**

In `app/routes/_app.metrics.$id.tsx`, replace line 127:

```typescript
        <Heatmap entries={entries} from={from} to={to} type={metric.type} goal={metric.goal} />
```

With:

```typescript
        <Heatmap entries={entries} from={from} to={to} type={metric.type} goal={metric.goal} goalDirection={metric.goalDirection as GoalDirection | null} />
```

- [ ] **Step 3: Commit**

```bash
git add app/components/heatmap.tsx app/routes/_app.metrics.$id.tsx
git commit -m "feat: update heatmap with direction-aware coloring and no-goal mode"
```

---

### Task 8: Update StatsPanel to hide goal stats when no goal

**Files:**
- Modify: `app/components/stats-panel.tsx`

- [ ] **Step 1: Add `hasGoal` prop to NumericStatsPanelProps**

In `app/components/stats-panel.tsx`, update the interface (lines 9-13):

```typescript
interface NumericStatsPanelProps {
  type: "numeric";
  stats: NumericStats;
  trend: Trend;
  unit: string | null;
  hasGoal: boolean;
}
```

- [ ] **Step 2: Update NumericStatsPanel to conditionally render goal sections**

Replace the `NumericStatsPanel` function (lines 53-91):

```typescript
function NumericStatsPanel({ stats, trend, unit, hasGoal }: { stats: NumericStats; trend: Trend; unit: string | null; hasGoal: boolean }) {
  const u = unit ?? "";
  const trendIcon = trend === "up" ? "\u2191" : trend === "down" ? "\u2193" : "\u2192";

  return (
    <div className="space-y-3">
      <div className="bg-surface-container-low rounded-xl p-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-xs font-semibold text-text-muted uppercase tracking-wide">Average</div>
            <div className="text-2xl font-bold font-heading text-text">{stats.average.toFixed(1)}</div>
            <div className="text-xs text-text-muted">{u}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-text-muted uppercase tracking-wide">Peak</div>
            <div className="text-2xl font-bold font-heading text-text">{stats.max}</div>
            <div className="text-xs text-text-muted">{u}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-text-muted uppercase tracking-wide">Total</div>
            <div className="text-2xl font-bold font-heading text-text">{stats.total.toFixed(0)}</div>
            <div className="text-xs text-text-muted">{u}</div>
          </div>
        </div>
      </div>
      <div className={`grid ${hasGoal ? "grid-cols-2" : "grid-cols-1"} gap-3`}>
        {hasGoal && <StatCard label="Longest Streak" value={stats.daysGoalMet} sublabel="Days" />}
        <StatCard label="Current Trend" value={trendIcon} sublabel={trend} />
      </div>
      {hasGoal && (
        <div className="bg-primary rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-white/70 uppercase tracking-wide">Goal Hit Rate</div>
            <div className="text-3xl font-bold font-heading text-white">{Math.round(stats.goalHitRate)}%</div>
          </div>
          <CompletionRing percent={stats.goalHitRate} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update the StatsPanel caller in `_app.metrics.$id.tsx`**

In `app/routes/_app.metrics.$id.tsx`, replace lines 119-123:

```typescript
        <StatsPanel
          type={isBoolean ? "boolean" : "numeric"}
          stats={stats as any}
          {...(!isBoolean && { trend: trend as any, unit: metric.unit })}
        />
```

With:

```typescript
        <StatsPanel
          type={isBoolean ? "boolean" : "numeric"}
          stats={stats as any}
          {...(!isBoolean && { trend: trend as any, unit: metric.unit, hasGoal: metric.goal != null })}
        />
```

- [ ] **Step 4: Commit**

```bash
git add app/components/stats-panel.tsx app/routes/_app.metrics.$id.tsx
git commit -m "feat: hide goal stats in StatsPanel when metric has no goal"
```

---

### Task 9: Update metric detail page goal display

**Files:**
- Modify: `app/routes/_app.metrics.$id.tsx`

- [ ] **Step 1: Update goal display in the metric header**

In `app/routes/_app.metrics.$id.tsx`, replace lines 113-115:

```typescript
        {metric.goal != null && (
          <span className="text-sm text-text-muted ml-2">Goal: {metric.goal} {metric.unit ?? ""}</span>
        )}
```

With:

```typescript
        {metric.goal != null && metric.goalDirection != null && (
          <span className="text-sm text-text-muted ml-2">
            Goal: {metric.goalDirection === "at_least" ? "≥" : metric.goalDirection === "at_most" ? "≤" : "≈"} {metric.goal} {metric.unit ?? ""}
          </span>
        )}
```

- [ ] **Step 2: Commit**

```bash
git add app/routes/_app.metrics.$id.tsx
git commit -m "feat: show goal direction symbol in metric detail header"
```

---

### Task 10: Update API responses to include goalDirection

**Files:**
- Modify: `app/routes/api.v1.metrics.tsx`
- Modify: `app/routes/api.v1.metrics.$id.tsx`

- [ ] **Step 1: Add `goalDirection` to the metrics list endpoint**

In `app/routes/api.v1.metrics.tsx`, replace line 13:

```typescript
    .select({ id: metrics.id, name: metrics.name, type: metrics.type, unit: metrics.unit, goal: metrics.goal })
```

With:

```typescript
    .select({ id: metrics.id, name: metrics.name, type: metrics.type, unit: metrics.unit, goal: metrics.goal, goalDirection: metrics.goalDirection })
```

- [ ] **Step 2: Add `goalDirection` to the single metric endpoint**

In `app/routes/api.v1.metrics.$id.tsx`, replace line 23:

```typescript
    data: { id: metric.id, name: metric.name, type: metric.type, unit: metric.unit, goal: metric.goal },
```

With:

```typescript
    data: { id: metric.id, name: metric.name, type: metric.type, unit: metric.unit, goal: metric.goal, goalDirection: metric.goalDirection },
```

- [ ] **Step 3: Commit**

```bash
git add app/routes/api.v1.metrics.tsx app/routes/api.v1.metrics.$id.tsx
git commit -m "feat: include goalDirection in API metric responses"
```

---

### Task 11: Update active goals count on home screen

**Files:**
- Modify: `app/routes/_app._index.tsx`

- [ ] **Step 1: Update the active goals filter**

In `app/routes/_app._index.tsx`, replace line 236:

```typescript
            <span className="text-sm text-text-muted">{orderedMetrics.filter(m => m.goal != null || m.type === 'boolean').length} active goals</span>
```

With:

```typescript
            <span className="text-sm text-text-muted">{orderedMetrics.filter(m => (m.goal != null && m.goalDirection != null) || m.type === 'boolean').length} active goals</span>
```

- [ ] **Step 2: Commit**

```bash
git add app/routes/_app._index.tsx
git commit -m "feat: update active goals count to respect goalDirection"
```
