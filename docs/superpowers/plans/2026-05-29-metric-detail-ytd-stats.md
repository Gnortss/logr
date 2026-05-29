# Metric Detail Page YTD Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch metric detail stats to year-to-date, make the current streak ignore an unlogged/failed today, and consolidate the page into a single scroll view (stats then heatmap) without the entries table.

**Architecture:** Bottom-up. First add a pure `startOfYear` date helper. Then change `computeCurrentStreak` to a today-aware semantics (used app-wide). Then update the metric detail route in one go — loader switches to year-to-date for stats, the component drops tabs and the entries table, and the now-unused `action` is removed.

**Tech Stack:** React Router 7, Drizzle ORM (D1), Vitest, TypeScript.

**Spec:** `docs/superpowers/specs/2026-05-29-metric-detail-ytd-stats-design.md`

---

## File Map

- Modify `app/lib/date.ts` — add `startOfYear`.
- Create `tests/lib/date.test.ts` — unit test for `startOfYear`.
- Modify `app/lib/streak.ts` — today-aware `computeCurrentStreak`.
- Modify `tests/lib/streak.test.ts` — update one existing test, add three new ones.
- Modify `app/routes/_app.metrics.$id.tsx` — loader uses YTD for stats; component drops tabs + entries table + action.

`app/components/heatmap.tsx`, `app/components/stats-panel.tsx`, `app/components/entries-table.tsx`, `app/lib/stats.server.ts`, and `app/lib/dashboard.ts` are **not** touched. The dashboard inherits the new streak behavior automatically via `computeCurrentStreak`.

---

## Task 1: Add `startOfYear` date helper

**Files:**
- Modify: `app/lib/date.ts`
- Create: `tests/lib/date.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/date.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { startOfYear } from "~/lib/date";

describe("startOfYear", () => {
  it("returns Jan 1 of the year in the given date string", () => {
    expect(startOfYear("2026-05-29")).toBe("2026-01-01");
  });

  it("returns the same string when input is already Jan 1", () => {
    expect(startOfYear("2026-01-01")).toBe("2026-01-01");
  });

  it("handles different years", () => {
    expect(startOfYear("2025-12-31")).toBe("2025-01-01");
    expect(startOfYear("2030-07-04")).toBe("2030-01-01");
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run tests/lib/date.test.ts`
Expected: FAIL with an import error or `startOfYear is not a function`.

- [ ] **Step 3: Implement `startOfYear`**

Append to `app/lib/date.ts`:

```ts
export function startOfYear(dateStr: string): string {
  return `${dateStr.slice(0, 4)}-01-01`;
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run tests/lib/date.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add app/lib/date.ts tests/lib/date.test.ts
git commit -m "feat(date): add startOfYear helper"
```

---

## Task 2: Today-aware `computeCurrentStreak`

**Files:**
- Modify: `app/lib/streak.ts`
- Modify: `tests/lib/streak.test.ts`

**Behavior change:** If today is logged AND successful, today contributes to the streak (existing behavior). Otherwise (today missing OR today failed), the cursor starts at yesterday and walks back — today neither breaks nor contributes.

- [ ] **Step 1: Update existing test cases and add new ones**

Replace the contents of `tests/lib/streak.test.ts` with:

```ts
import { describe, it, expect } from "vitest";
import { computeCurrentStreak } from "~/lib/streak";

describe("computeCurrentStreak", () => {
  it("returns 0 when no entries", () => {
    expect(computeCurrentStreak([], "2026-05-27", () => true)).toBe(0);
  });

  it("counts consecutive successful days ending at todayDate", () => {
    const entries = [
      { date: "2026-05-25", value: 1 },
      { date: "2026-05-26", value: 1 },
      { date: "2026-05-27", value: 1 },
    ];
    expect(computeCurrentStreak(entries, "2026-05-27", (v) => v === 1)).toBe(3);
  });

  it("stops at the first failed or missing day before today", () => {
    const entries = [
      { date: "2026-05-25", value: 1 },
      { date: "2026-05-26", value: 0 }, // failed
      { date: "2026-05-27", value: 1 },
    ];
    expect(computeCurrentStreak(entries, "2026-05-27", (v) => v === 1)).toBe(1);
  });

  it("skips today and counts back from yesterday when today is failed", () => {
    const entries = [
      { date: "2026-05-26", value: 1 },
      { date: "2026-05-27", value: 0 },
    ];
    expect(computeCurrentStreak(entries, "2026-05-27", (v) => v === 1)).toBe(1);
  });

  it("skips today and counts back from yesterday when today is missing", () => {
    const entries = [
      { date: "2026-05-25", value: 1 },
      { date: "2026-05-26", value: 1 },
      // no entry for 2026-05-27
    ];
    expect(computeCurrentStreak(entries, "2026-05-27", (v) => v === 1)).toBe(2);
  });

  it("returns 0 when today is failed and yesterday is also failed", () => {
    const entries = [
      { date: "2026-05-26", value: 0 },
      { date: "2026-05-27", value: 0 },
    ];
    expect(computeCurrentStreak(entries, "2026-05-27", (v) => v === 1)).toBe(0);
  });

  it("returns 0 when today is missing and yesterday is missing", () => {
    expect(computeCurrentStreak([], "2026-05-27", (v) => v === 1)).toBe(0);
  });

  it("works with custom predicate (numeric goal)", () => {
    const entries = [
      { date: "2026-05-26", value: 2.5 },
      { date: "2026-05-27", value: 1.8 },
    ];
    // today (5-27) fails the >=2 predicate, so cursor starts at 5-26 which passes.
    expect(computeCurrentStreak(entries, "2026-05-27", (v) => v >= 2)).toBe(1);
    expect(computeCurrentStreak(entries, "2026-05-26", (v) => v >= 2)).toBe(1);
  });
});
```

- [ ] **Step 2: Run the streak tests and confirm the new behaviors fail**

Run: `npx vitest run tests/lib/streak.test.ts`
Expected: FAIL. The two "skips today …" tests, the "returns 0 when today failed and yesterday failed" test, and the custom-predicate test now expect non-zero results that the current implementation returns as 0 (or vice versa for the failed-failed case which still passes incidentally).

- [ ] **Step 3: Implement the today-aware streak**

Replace the body of `computeCurrentStreak` in `app/lib/streak.ts` so the function reads:

```ts
import { addDays } from "~/lib/date";

export interface StreakEntry {
  date: string;
  value: number;
}

export function computeCurrentStreak(
  entries: StreakEntry[],
  todayDate: string,
  isSuccess: (value: number) => boolean
): number {
  const successByDate = new Map<string, boolean>();
  for (const e of entries) {
    successByDate.set(e.date, isSuccess(e.value));
  }

  let streak = 0;
  let cursor = successByDate.get(todayDate) === true ? todayDate : addDays(todayDate, -1);
  while (successByDate.get(cursor) === true) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
```

- [ ] **Step 4: Run the streak tests and confirm they all pass**

Run: `npx vitest run tests/lib/streak.test.ts`
Expected: PASS — 8 tests.

- [ ] **Step 5: Run the full test suite to confirm no regressions**

Run: `npx vitest run`
Expected: All tests pass. In particular, `tests/lib/stats.test.ts` still passes — its existing `computeBooleanStats` fixture has a successful today (`2026-03-28` value `1`), so streak semantics are unchanged for that test.

- [ ] **Step 6: Commit**

```bash
git add app/lib/streak.ts tests/lib/streak.test.ts
git commit -m "feat(streak): ignore today unless logged and successful"
```

---

## Task 3: Metric detail route — YTD loader, single-page layout, drop action

**Files:**
- Modify: `app/routes/_app.metrics.$id.tsx`

This task combines the loader change, the component layout change, and the action removal. They must land together because the loader's return shape changes (`from` → `heatmapFrom`) and the component must update in lockstep.

- [ ] **Step 1: Rewrite `app/routes/_app.metrics.$id.tsx`**

Replace the entire file contents with:

```tsx
import { useLoaderData } from "react-router";
import type { Route } from "./+types/_app.metrics.$id";
import { requireAuth } from "~/lib/auth.server";
import { getDb } from "~/lib/db.server";
import { metrics, metricEntries } from "~/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { addDays, startOfYear, today } from "~/lib/date";
import { computeBooleanStats, computeNumericStats, computeTrend, computeWeeklyBooleanStats } from "~/lib/stats.server";
import type { GoalDirection } from "~/lib/types";
import { Heatmap } from "~/components/heatmap";
import { StatsPanel } from "~/components/stats-panel";

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
  const statsFrom = startOfYear(to);
  const heatmapFrom = addDays(to, -62);
  const fetchFrom = statsFrom < heatmapFrom ? statsFrom : heatmapFrom;

  const entries = await db
    .select({ date: metricEntries.date, value: metricEntries.value })
    .from(metricEntries)
    .where(
      and(
        eq(metricEntries.metricId, metricId),
        gte(metricEntries.date, fetchFrom),
        lte(metricEntries.date, to)
      )
    )
    .all();

  const statsEntries = entries.filter((e) => e.date >= statsFrom && e.date <= to);

  let stats;
  let trend;
  if (metric.type === "boolean") {
    if (metric.weeklyTarget != null) {
      stats = computeWeeklyBooleanStats(statsEntries, metric.weeklyTarget, statsFrom, to);
    } else {
      stats = computeBooleanStats(statsEntries, statsFrom, to);
    }
  } else {
    stats = computeNumericStats(statsEntries, metric.goal, metric.goalDirection as GoalDirection | null);
    trend = computeTrend(statsEntries);
  }

  return { metric, entries, stats, trend, heatmapFrom, to };
}

export default function MetricDetailView() {
  const { metric, entries, stats, trend, heatmapFrom, to } = useLoaderData<typeof loader>();
  const isBoolean = metric.type === "boolean";

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

      {/* Content: stats first, heatmap below */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isBoolean && metric.weeklyTarget != null
          ? <StatsPanel type="weekly-boolean" stats={stats as any} />
          : isBoolean
          ? <StatsPanel type="boolean" stats={stats as any} />
          : <StatsPanel type="numeric" stats={stats as any} trend={trend as any} unit={metric.unit} hasGoal={metric.goal != null} />
        }

        <Heatmap
          entries={entries}
          from={heatmapFrom}
          to={to}
          type={metric.type}
          goal={metric.goal}
          goalDirection={metric.goalDirection as GoalDirection | null}
          weeklyTarget={metric.weeklyTarget}
        />
      </div>
    </div>
  );
}
```

This single edit:
- Drops the `useState` import and `tab` state.
- Drops the `EntriesTable` import and JSX.
- Drops the entire `action` export (the previous handler only served the entries table).
- Adds `startOfYear` to the date imports.
- Renames the loader's `from` to `heatmapFrom` and adds `statsFrom`.
- Filters entries to the YTD window before passing them into stats functions; the full fetched range is still passed to `Heatmap` so heatmap rendering is unchanged.
- Reorders content: `StatsPanel` before `Heatmap`.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: No errors. (Route types regenerate; the loader return shape change is consumed only by the component in this file.)

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 4: Manual verification in the browser**

Start dev server:

```bash
npm run dev
```

Then in a browser, visit a metric detail page (e.g., `/metrics/<id>`) for at least one boolean metric and one numeric metric you have data for. Verify:

- Header looks unchanged.
- No tab bar is visible.
- Stats panel appears first, heatmap below it.
- Entries table is gone.
- For a metric where today is unlogged: the current streak (boolean metrics) reflects the run ending yesterday, not 0.
- For a metric where today is logged successfully: the current streak includes today.
- Heatmap still shows ~9 weeks.

If anything looks off, fix in place before committing.

- [ ] **Step 5: Commit**

```bash
git add app/routes/_app.metrics.$id.tsx
git commit -m "feat(metric-detail): YTD stats, drop tabs and entries table"
```

---

## Done

After Task 3 commit, the spec is fully implemented:

- Stats now span Jan 1 of the current year to today.
- Current streak ignores today unless today is logged and successful — applied app-wide via `computeCurrentStreak`.
- Metric detail page is a single scroll view: header → stats → heatmap.
- Entries table and its supporting action are gone.

The component file `app/components/entries-table.tsx` is now unused. Per project guidelines (don't delete pre-existing files unilaterally), leave it in place — surface it to the user for a follow-up cleanup decision.
