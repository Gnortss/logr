# Metric Goals Redesign

## Overview

Redesign how metric goals work to support multiple goal directions, optional goals, and improved UX for unit selection and habit display.

## Problems

1. **Goal direction is always "at least"** — goals only evaluate as `value >= goal`, but users may want to track lowering a value (e.g., calories) or hitting an exact target (e.g., sleep hours).
2. **Goals are mandatory for numeric metrics** — some metrics are just for tracking without a target.
3. **Habits show redundant "Goal Met" text** — checking a habit already implies goal completion.
4. **Single-unit types require unnecessary selection** — types like `count` and `percent` have only one unit but still show an interactive dropdown.

## Data Model

### Schema change

Add `goal_direction TEXT` column to the `metrics` table:

- Values: `"at_least"` | `"at_most"` | `"approximately"` | `null`
- When `goal` is `null`, `goal_direction` must also be `null`
- When `goal` is set, `goal_direction` is required

### Migration

Existing metrics with a non-null `goal` receive `goal_direction = "at_least"` to preserve current behavior.

### Constants

In `app/lib/types.ts`:

```typescript
export const GOAL_DIRECTIONS = ["at_least", "at_most", "approximately"] as const;
export type GoalDirection = (typeof GOAL_DIRECTIONS)[number];
export const APPROX_TOLERANCE = 0.1; // 10% — easy to promote to per-metric field later
```

## Goal Evaluation Logic

A single shared helper function replaces all scattered `value >= goal` checks:

```typescript
isGoalMet(value: number, goal: number | null, direction: GoalDirection | null, tolerance?: number): boolean
```

- **`at_least`**: `value >= goal`
- **`at_most`**: `value <= goal`
- **`approximately`**: `value >= goal * (1 - tolerance) && value <= goal * (1 + tolerance)`
- **No goal** (`goal` or `direction` is null): returns `false`

### Remaining goal display (metric row subtitle)

- **`at_least`**: `Math.max(0, goal - value)` remaining
- **`at_most`**: show current value vs limit (e.g., "150 / 2000 kcal")
- **`approximately`**: show current vs target (e.g., "7.5 / 8.0 hrs")

### Affected files

- `app/components/metric-row.tsx` — subtitle and goal met indicator
- `app/lib/stats.server.ts` — `daysGoalMet` count and `goalHitRate`
- `app/components/heatmap.tsx` — cell coloring

## MetricForm Changes

### Goal toggle

- New "Set a daily goal" checkbox/switch, enabled by default
- When off: hides goal value input and direction selector
- When on: shows goal value input and direction dropdown

### Direction selector

- Dropdown with options: "At least", "At most", "Approximately"
- Defaults to "At least"
- Only visible when goal is enabled

### Unit auto-selection

- When a metric type has exactly one unit (e.g., `count` -> "count", `percent` -> "%"), the unit field is rendered but disabled with the single unit pre-selected
- When a type has multiple units, the dropdown remains interactive
- Boolean type still shows no unit field

### Edit mode

- Type and unit remain locked (current behavior)
- Goal toggle, goal value, and direction are editable
- Info note below goal fields: "Changing the goal applies to all tracked data, including past entries."

## Display Changes

### Metric row (`metric-row.tsx`)

- **Boolean metrics**: Show "Not tracked" when unchecked. No "Goal Met" text when checked — the checked state is sufficient.
- **Numeric with goal**: Subtitle adapts per direction (see remaining goal display above). Show "Goal Met" when met.
- **Numeric without goal**: Subtitle shows just the raw value and unit (e.g., "2500 kcal"). No goal-related text.

### Heatmap (`heatmap.tsx`)

- **With goal**: Color based on `isGoalMet()` using the metric's direction. Primary color when met, intensity gradient when not.
- **Without goal**: Binary coloring — primary color if any value was logged that day, empty/dim if not.

### Stats panel (`stats-panel.tsx`)

- **With goal**: Show goal hit rate ring and days goal met using direction-aware calculation.
- **Without goal**: Hide goal hit rate and days goal met sections entirely.

### API responses

- Add `goalDirection` field to metric endpoints:
  - `GET /api/v1/metrics`
  - `GET /api/v1/metrics/$id`
