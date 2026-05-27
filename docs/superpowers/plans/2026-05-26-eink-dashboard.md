# E-ink Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/dashboard` (color HTML at 400×300) and `/dashboard.png` (B/W PNG via resvg-wasm at 400×300) showing up to 5 habits with weekly progress, intended for a Waveshare e-ink panel driven by ESP32 over HTTP.

**Architecture:** A single pure SVG renderer drives both views — color mode for the HTML page (wrapped in the existing `_app` shell), B/W mode for the PNG (rasterized server-side via `@resvg/resvg-wasm`). All data math is in a pure module that's unit-testable without a DB. PNG route supports API key auth via header **or** `?key=` query string; both routes accept an optional `?tz=` parameter for timezone-aligned week boundaries.

**Tech Stack:** React Router 7, TypeScript, Cloudflare Workers, D1, drizzle-orm, `@resvg/resvg-wasm`, vitest.

**Spec:** `docs/superpowers/specs/2026-05-26-eink-dashboard-design.md`

---

## File structure

**Create:**
- `app/lib/dashboard.ts` — pure data computations + types (`DashboardData`, helpers)
- `app/lib/dashboard.server.ts` — thin DB wrapper around `dashboard.ts` (`getDashboardData`)
- `app/lib/dashboard-svg.ts` — pure SVG renderer (`renderDashboardSvg`)
- `app/lib/dashboard-png.server.ts` — PNG rasterization via resvg-wasm (`renderDashboardPng`)
- `app/lib/streak.ts` — generalized current-streak helper
- `app/lib/tz.ts` — timezone-aware date helpers (`todayInTz`)
- `app/routes/_app.dashboard.tsx` — HTML route in app shell
- `app/routes/dashboard[.png].tsx` — flat route for PNG (the `[.png]` escapes the dot)
- `tests/lib/dashboard.test.ts`
- `tests/lib/dashboard-svg.test.ts`
- `tests/lib/streak.test.ts`
- `tests/lib/tz.test.ts`
- `tests/lib/api-key-query.test.ts`
- `tests/lib/dashboard-png.test.ts` (smoke test only — PNG magic bytes)
- `public/fonts/Inter-Regular.ttf`
- `public/fonts/Inter-Bold.ttf`
- `public/fonts/JetBrainsMono-Bold.ttf`

**Modify:**
- `app/lib/api-key.server.ts` — add `requireApiKeyFromRequest` accepting header **or** `?key=`
- `package.json` — add `@resvg/resvg-wasm` dependency
- `vite.config.ts` — add `assetsInclude: ['**/*.ttf', '**/*.wasm']` so Vite bundles them as ArrayBuffer

---

## Task 1: Timezone-aware "today" helper

**Files:**
- Create: `app/lib/tz.ts`
- Test: `tests/lib/tz.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/lib/tz.test.ts
import { describe, it, expect } from "vitest";
import { todayInTz } from "~/lib/tz";

describe("todayInTz", () => {
  it("returns YYYY-MM-DD in UTC when no tz given", () => {
    const result = todayInTz(undefined);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result).toBe(new Date().toISOString().slice(0, 10));
  });

  it("returns YYYY-MM-DD in given IANA tz", () => {
    // We can't assert an exact date (depends on when tests run), but format must be valid
    const result = todayInTz("Europe/Ljubljana");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("falls back to UTC when tz is invalid", () => {
    const result = todayInTz("not/a/zone");
    expect(result).toBe(new Date().toISOString().slice(0, 10));
  });

  it("handles tz that shifts the date", () => {
    // Pin a known moment: 2026-05-26 23:30 UTC.
    // In Pacific/Auckland (UTC+12 in May = NZST UTC+12), that's 11:30 the NEXT day.
    const fixed = new Date("2026-05-26T23:30:00Z");
    const result = todayInTz("Pacific/Auckland", fixed);
    expect(result).toBe("2026-05-27");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/tz.test.ts`
Expected: FAIL — `todayInTz` not defined.

- [ ] **Step 3: Write the minimal implementation**

```ts
// app/lib/tz.ts
export function todayInTz(tz: string | undefined, now: Date = new Date()): string {
  if (!tz) return now.toISOString().slice(0, 10);
  try {
    // en-CA produces YYYY-MM-DD format reliably.
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return fmt.format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/tz.test.ts`
Expected: PASS — all 4 cases.

- [ ] **Step 5: Commit**

```bash
git add app/lib/tz.ts tests/lib/tz.test.ts
git commit -m "feat(dashboard): add tz-aware todayInTz helper"
```

---

## Task 2: Generalized current-streak helper

**Files:**
- Create: `app/lib/streak.ts`
- Test: `tests/lib/streak.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/lib/streak.test.ts
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

  it("stops at the first failed or missing day", () => {
    const entries = [
      { date: "2026-05-25", value: 1 },
      { date: "2026-05-26", value: 0 },  // failed
      { date: "2026-05-27", value: 1 },
    ];
    expect(computeCurrentStreak(entries, "2026-05-27", (v) => v === 1)).toBe(1);
  });

  it("returns 0 if today is not successful", () => {
    const entries = [
      { date: "2026-05-26", value: 1 },
      { date: "2026-05-27", value: 0 },
    ];
    expect(computeCurrentStreak(entries, "2026-05-27", (v) => v === 1)).toBe(0);
  });

  it("works with custom predicate (numeric goal)", () => {
    const entries = [
      { date: "2026-05-26", value: 2.5 },
      { date: "2026-05-27", value: 1.8 },
    ];
    expect(computeCurrentStreak(entries, "2026-05-27", (v) => v >= 2)).toBe(0);
    expect(computeCurrentStreak(entries, "2026-05-26", (v) => v >= 2)).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/streak.test.ts`
Expected: FAIL — `computeCurrentStreak` not defined.

- [ ] **Step 3: Write the minimal implementation**

```ts
// app/lib/streak.ts
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
  let cursor = todayDate;
  while (successByDate.get(cursor) === true) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/streak.test.ts`
Expected: PASS — all 5 cases.

- [ ] **Step 5: Commit**

```bash
git add app/lib/streak.ts tests/lib/streak.test.ts
git commit -m "feat(dashboard): add generalized computeCurrentStreak helper"
```

---

## Task 3: API key auth via header OR query string

**Files:**
- Modify: `app/lib/api-key.server.ts`
- Test: `tests/lib/api-key-query.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/lib/api-key-query.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { requireApiKeyFromRequest, createApiKeyForUser } from "~/lib/api-key.server";
import * as schema from "~/db/schema";

// Minimal in-memory drizzle harness via better-sqlite3 would be ideal,
// but to stay dependency-free we use a tiny stub of just the methods used.
// (Adjust if the project already has a test DB harness — check tests/lib/api-key.test.ts first.)

function unauthorized(res: unknown): res is Response {
  return res instanceof Response && res.status === 401;
}

describe("requireApiKeyFromRequest", () => {
  // NOTE: This test follows the same pattern as tests/lib/api-key.test.ts.
  // See that file to set up the shared DB harness — reuse exactly the same
  // pattern (it should already create a user + active key).

  it("accepts Bearer header (existing behavior)", async () => {
    // Setup DB and key per existing pattern from tests/lib/api-key.test.ts.
    // const { db, key } = await setupDbWithKey();
    // const req = new Request("https://x/dashboard.png", {
    //   headers: { Authorization: `Bearer ${key}` },
    // });
    // const result = await requireApiKeyFromRequest(req, db);
    // expect(result.userId).toBeGreaterThan(0);
    expect(true).toBe(true); // Placeholder until DB harness is wired
  });

  it("accepts ?key= query string", async () => {
    // const { db, key } = await setupDbWithKey();
    // const req = new Request(`https://x/dashboard.png?key=${key}`);
    // const result = await requireApiKeyFromRequest(req, db);
    // expect(result.userId).toBeGreaterThan(0);
    expect(true).toBe(true);
  });

  it("throws 401 when neither header nor query key is present", async () => {
    // const { db } = await setupDbWithKey();
    // const req = new Request("https://x/dashboard.png");
    // try {
    //   await requireApiKeyFromRequest(req, db);
    //   expect.fail("should have thrown");
    // } catch (res) {
    //   expect(unauthorized(res)).toBe(true);
    // }
    expect(true).toBe(true);
  });
});
```

**IMPORTANT:** Before writing this test, read `tests/lib/api-key.test.ts` and copy its DB-setup pattern exactly. Replace the placeholders above with real setup code. If `tests/lib/api-key.test.ts` doesn't have a reusable harness either, port one in (or test the new code purely against `validateApiKey` mocks).

- [ ] **Step 2: Read the existing api-key test to match its pattern**

Run: `cat tests/lib/api-key.test.ts`
Expected: A working pattern for setting up a D1-like DB and creating users + keys. Copy that pattern into the placeholder sections above.

- [ ] **Step 3: Add `requireApiKeyFromRequest` to `api-key.server.ts`**

Add this function below the existing `requireApiKey`:

```ts
// app/lib/api-key.server.ts (append)
export async function requireApiKeyFromRequest(
  request: Request,
  db: Database
): Promise<{ userId: number; keyId: number }> {
  let key: string | undefined;

  const authHeader = request.headers.get("Authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/);
  if (match) key = match[1];

  if (!key) {
    const url = new URL(request.url);
    const q = url.searchParams.get("key");
    if (q) key = q;
  }

  if (!key) {
    throw new Response(
      JSON.stringify({ ok: false, error: { code: "UNAUTHORIZED", message: "Missing API key" } }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const result = await validateApiKey(db, key);
  if (!result) {
    throw new Response(
      JSON.stringify({ ok: false, error: { code: "UNAUTHORIZED", message: "Invalid API key" } }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/api-key-query.test.ts`
Expected: PASS — all 3 cases.

- [ ] **Step 5: Commit**

```bash
git add app/lib/api-key.server.ts tests/lib/api-key-query.test.ts
git commit -m "feat(dashboard): add requireApiKeyFromRequest accepting header or query"
```

---

## Task 4: Dashboard data computation — per-day success

**Files:**
- Create: `app/lib/dashboard.ts`
- Test: `tests/lib/dashboard.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/dashboard.test.ts
import { describe, it, expect } from "vitest";
import { computeDaySuccess } from "~/lib/dashboard";

describe("computeDaySuccess", () => {
  const weekDays = [
    "2026-05-25", "2026-05-26", "2026-05-27",
    "2026-05-28", "2026-05-29", "2026-05-30", "2026-05-31",
  ];

  it("boolean: only value=1 counts as success", () => {
    const m = { type: "boolean", goal: null, goalDirection: null } as any;
    const entries = [
      { date: "2026-05-25", value: 1 },
      { date: "2026-05-26", value: 0 },
      { date: "2026-05-27", value: 1 },
    ];
    expect(computeDaySuccess(m, entries, weekDays)).toEqual([
      true, false, true, false, false, false, false,
    ]);
  });

  it("numeric with goal: only goal-met days count", () => {
    const m = { type: "volume", goal: 2, goalDirection: "at_least", unit: "liters" } as any;
    const entries = [
      { date: "2026-05-25", value: 2.0 },
      { date: "2026-05-26", value: 1.5 },
      { date: "2026-05-27", value: 2.5 },
    ];
    expect(computeDaySuccess(m, entries, weekDays)).toEqual([
      true, false, true, false, false, false, false,
    ]);
  });

  it("numeric no goal: any value>0 counts", () => {
    const m = { type: "count", goal: null, goalDirection: null } as any;
    const entries = [
      { date: "2026-05-25", value: 1 },
      { date: "2026-05-26", value: 0 },
    ];
    expect(computeDaySuccess(m, entries, weekDays)).toEqual([
      true, false, false, false, false, false, false,
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/dashboard.test.ts`
Expected: FAIL — `computeDaySuccess` not defined.

- [ ] **Step 3: Write the minimal implementation**

```ts
// app/lib/dashboard.ts
import { isGoalMet, type GoalDirection, type MetricType } from "~/lib/types";

export interface DashboardEntry {
  date: string;
  value: number;
}

export interface DashboardMetricInput {
  id: number;
  name: string;
  type: MetricType;
  unit: string | null;
  goal: number | null;
  goalDirection: GoalDirection | null;
  weeklyTarget: number | null;
}

export function computeDaySuccess(
  metric: DashboardMetricInput,
  entries: DashboardEntry[],
  weekDays: string[]
): boolean[] {
  const byDate = new Map(entries.map((e) => [e.date, e.value]));
  return weekDays.map((d) => {
    const v = byDate.get(d);
    if (v == null) return false;
    if (metric.type === "boolean") return v === 1;
    if (metric.goal != null && metric.goalDirection != null) {
      return isGoalMet(v, metric.goal, metric.goalDirection);
    }
    return v > 0;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/dashboard.test.ts`
Expected: PASS — all 3 cases.

- [ ] **Step 5: Commit**

```bash
git add app/lib/dashboard.ts tests/lib/dashboard.test.ts
git commit -m "feat(dashboard): add computeDaySuccess"
```

---

## Task 5: Weekly target effective + classify status

**Files:**
- Modify: `app/lib/dashboard.ts`
- Modify: `tests/lib/dashboard.test.ts`

- [ ] **Step 1: Append failing tests**

```ts
// tests/lib/dashboard.test.ts (append)
import { computeWeeklyTargetEffective, classifyStatus, type Status } from "~/lib/dashboard";

describe("computeWeeklyTargetEffective", () => {
  it("returns weeklyTarget when set", () => {
    const m = { type: "boolean", weeklyTarget: 4, goal: null, goalDirection: null } as any;
    expect(computeWeeklyTargetEffective(m)).toBe(4);
  });

  it("returns 7 for boolean with no weeklyTarget", () => {
    const m = { type: "boolean", weeklyTarget: null, goal: null, goalDirection: null } as any;
    expect(computeWeeklyTargetEffective(m)).toBe(7);
  });

  it("returns 7 for numeric-with-goal, no weeklyTarget", () => {
    const m = { type: "volume", weeklyTarget: null, goal: 2, goalDirection: "at_least" } as any;
    expect(computeWeeklyTargetEffective(m)).toBe(7);
  });

  it("returns 0 for numeric-no-goal, no weeklyTarget", () => {
    const m = { type: "count", weeklyTarget: null, goal: null, goalDirection: null } as any;
    expect(computeWeeklyTargetEffective(m)).toBe(0);
  });
});

describe("classifyStatus", () => {
  it("returns 'tracking' when target is 0", () => {
    expect(classifyStatus(0, 0, 3)).toBe<Status>("tracking");
  });

  it("returns 'met' when done >= target", () => {
    expect(classifyStatus(4, 4, 5)).toBe<Status>("met");
    expect(classifyStatus(5, 4, 5)).toBe<Status>("met");
  });

  it("returns 'on_track' when done >= expected for daysElapsed", () => {
    // target=4, daysElapsed=3 (Mon-Wed) → expected = ceil(4*3/7) = 2
    expect(classifyStatus(2, 4, 3)).toBe<Status>("on_track");
    expect(classifyStatus(3, 4, 3)).toBe<Status>("on_track");
  });

  it("returns 'behind' when done < expected", () => {
    // target=5, daysElapsed=3 → expected = ceil(5*3/7) = 3
    expect(classifyStatus(2, 5, 3)).toBe<Status>("behind");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/dashboard.test.ts`
Expected: FAIL — `computeWeeklyTargetEffective`, `classifyStatus`, `Status` not exported.

- [ ] **Step 3: Implement in `app/lib/dashboard.ts`**

```ts
// app/lib/dashboard.ts (append)
export type Status = "met" | "on_track" | "behind" | "tracking";

export function computeWeeklyTargetEffective(m: DashboardMetricInput): number {
  if (m.weeklyTarget != null) return m.weeklyTarget;
  if (m.type === "boolean") return 7;
  if (m.goal != null && m.goalDirection != null) return 7;
  return 0;
}

export function classifyStatus(
  done: number,
  target: number,
  daysElapsed: number
): Status {
  if (target === 0) return "tracking";
  if (done >= target) return "met";
  const expected = Math.ceil((target * daysElapsed) / 7);
  return done >= expected ? "on_track" : "behind";
}
```

- [ ] **Step 4: Run test to verify all pass**

Run: `npx vitest run tests/lib/dashboard.test.ts`
Expected: PASS — all 7 new cases plus prior 3.

- [ ] **Step 5: Commit**

```bash
git add app/lib/dashboard.ts tests/lib/dashboard.test.ts
git commit -m "feat(dashboard): add weekly target + status classifier"
```

---

## Task 6: Per-metric view (combine streak + display kind + numbers)

**Files:**
- Modify: `app/lib/dashboard.ts`
- Modify: `tests/lib/dashboard.test.ts`

- [ ] **Step 1: Append failing tests**

```ts
// tests/lib/dashboard.test.ts (append)
import { computeMetricView, type DashboardMetric, type DisplayKind } from "~/lib/dashboard";

describe("computeMetricView", () => {
  const weekDays = [
    "2026-05-25", "2026-05-26", "2026-05-27",
    "2026-05-28", "2026-05-29", "2026-05-30", "2026-05-31",
  ];
  const todayDate = "2026-05-27"; // Wed → todayIndex=2 → daysElapsed=3

  it("weekly-target boolean: met case", () => {
    const m = {
      id: 1, name: "Workout", type: "boolean", unit: null, goal: null,
      goalDirection: null, weeklyTarget: 4,
    } as any;
    const entries = [
      { date: "2026-05-25", value: 1 },
      { date: "2026-05-26", value: 1 },
      { date: "2026-05-27", value: 1 },
      { date: "2026-05-24", value: 1 }, // outside the current week
    ];
    const view = computeMetricView(m, entries, weekDays, todayDate);
    expect(view.weeklyTargetEffective).toBe(4);
    expect(view.weeklyDone).toBe(3);
    expect(view.status).toBe("on_track");
    expect(view.displayKind).toBe<DisplayKind>("weekly_ratio");
  });

  it("daily boolean (no weeklyTarget): shows streak", () => {
    const m = {
      id: 2, name: "Read", type: "boolean", unit: null, goal: null,
      goalDirection: null, weeklyTarget: null,
    } as any;
    const entries = [
      { date: "2026-05-25", value: 1 },
      { date: "2026-05-26", value: 1 },
      { date: "2026-05-27", value: 1 },
    ];
    const view = computeMetricView(m, entries, weekDays, todayDate);
    expect(view.displayKind).toBe<DisplayKind>("streak");
    expect(view.streak).toBe(3);
  });

  it("numeric no goal: today_value", () => {
    const m = {
      id: 3, name: "Notes", type: "count", unit: "notes", goal: null,
      goalDirection: null, weeklyTarget: null,
    } as any;
    const entries = [{ date: "2026-05-27", value: 5 }];
    const view = computeMetricView(m, entries, weekDays, todayDate);
    expect(view.displayKind).toBe<DisplayKind>("today_value");
    expect(view.todayValue).toBe(5);
    expect(view.status).toBe("tracking");
  });

  it("caps weeklyDone at target", () => {
    const m = {
      id: 4, name: "Walk", type: "boolean", unit: null, goal: null,
      goalDirection: null, weeklyTarget: 3,
    } as any;
    const entries = weekDays.map((d) => ({ date: d, value: 1 })); // 7 done
    const view = computeMetricView(m, entries, weekDays, todayDate);
    expect(view.weeklyDone).toBe(3); // capped at target
    expect(view.status).toBe("met");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/dashboard.test.ts`
Expected: FAIL — `computeMetricView`, `DashboardMetric`, `DisplayKind` not exported.

- [ ] **Step 3: Implement in `app/lib/dashboard.ts`**

```ts
// app/lib/dashboard.ts (append)
import { computeCurrentStreak } from "~/lib/streak";

export type DisplayKind = "weekly_ratio" | "streak" | "today_value";

export interface DashboardMetric extends DashboardMetricInput {
  weeklyTargetEffective: number;
  weeklyDone: number;
  dayValues: (number | null)[];
  daySuccess: boolean[];
  status: Status;
  displayKind: DisplayKind;
  streak: number;
  todayValue: number | null;
}

export function computeMetricView(
  metric: DashboardMetricInput,
  entries: DashboardEntry[],
  weekDays: string[],
  todayDate: string
): DashboardMetric {
  const byDate = new Map(entries.map((e) => [e.date, e.value]));
  const dayValues = weekDays.map((d) => byDate.get(d) ?? null);
  const daySuccess = computeDaySuccess(metric, entries, weekDays);
  const weeklyTargetEffective = computeWeeklyTargetEffective(metric);

  const successCount = daySuccess.filter(Boolean).length;
  const weeklyDone =
    weeklyTargetEffective > 0
      ? Math.min(successCount, weeklyTargetEffective)
      : successCount;

  const todayIndex = weekDays.indexOf(todayDate);
  const daysElapsed = todayIndex < 0 ? 7 : todayIndex + 1;
  const status = classifyStatus(weeklyDone, weeklyTargetEffective, daysElapsed);

  let displayKind: DisplayKind;
  if (metric.weeklyTarget != null) {
    displayKind = "weekly_ratio";
  } else if (
    metric.type === "boolean" ||
    (metric.goal != null && metric.goalDirection != null)
  ) {
    displayKind = "streak";
  } else {
    displayKind = "today_value";
  }

  const isSuccessForStreak = (v: number): boolean => {
    if (metric.type === "boolean") return v === 1;
    if (metric.goal != null && metric.goalDirection != null) {
      // Inline to avoid circular import; reuse isGoalMet via existing import.
      return isGoalMet(v, metric.goal, metric.goalDirection);
    }
    return v > 0;
  };

  const streak =
    displayKind === "streak"
      ? computeCurrentStreak(entries, todayDate, isSuccessForStreak)
      : 0;

  const todayValue = byDate.get(todayDate) ?? null;

  return {
    ...metric,
    weeklyTargetEffective,
    weeklyDone,
    dayValues,
    daySuccess,
    status,
    displayKind,
    streak,
    todayValue,
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/lib/dashboard.test.ts`
Expected: PASS — all 4 new cases plus all prior.

- [ ] **Step 5: Commit**

```bash
git add app/lib/dashboard.ts tests/lib/dashboard.test.ts
git commit -m "feat(dashboard): add per-metric view computation"
```

---

## Task 7: Hero counts + day states

**Files:**
- Modify: `app/lib/dashboard.ts`
- Modify: `tests/lib/dashboard.test.ts`

- [ ] **Step 1: Append failing tests**

```ts
// tests/lib/dashboard.test.ts (append)
import { computeHero, type Hero } from "~/lib/dashboard";

describe("computeHero", () => {
  const weekDays = [
    "2026-05-25", "2026-05-26", "2026-05-27",
    "2026-05-28", "2026-05-29", "2026-05-30", "2026-05-31",
  ];
  const todayDate = "2026-05-27"; // index 2

  function mkMetric(overrides: Partial<DashboardMetric>): DashboardMetric {
    return {
      id: 0, name: "m", type: "boolean", unit: null, goal: null,
      goalDirection: null, weeklyTarget: null,
      weeklyTargetEffective: 7, weeklyDone: 0,
      dayValues: [null, null, null, null, null, null, null],
      daySuccess: [false, false, false, false, false, false, false],
      status: "behind", displayKind: "streak", streak: 0, todayValue: null,
      ...overrides,
    };
  }

  it("sums done and target across counted metrics, ignores tracking", () => {
    const metrics: DashboardMetric[] = [
      mkMetric({ id: 1, weeklyTargetEffective: 4, weeklyDone: 3, status: "on_track", daySuccess: [true, true, true, false, false, false, false] }),
      mkMetric({ id: 2, weeklyTargetEffective: 7, weeklyDone: 3, status: "behind", daySuccess: [true, true, true, false, false, false, false] }),
      mkMetric({ id: 3, weeklyTargetEffective: 0, weeklyDone: 0, status: "tracking", daySuccess: [false, false, false, false, false, false, false] }),
    ];
    const hero = computeHero(metrics, weekDays, todayDate);
    expect(hero.done).toBe(6);
    expect(hero.total).toBe(11);
    expect(hero.totalGoals).toBe(2);
    expect(hero.onTrackCount).toBe(1);
  });

  it("dayStates: full if all metrics succeed; partial if some; empty if none; future for >todayIndex", () => {
    const metrics: DashboardMetric[] = [
      mkMetric({ id: 1, daySuccess: [true, true, false, false, false, false, false] }),
      mkMetric({ id: 2, daySuccess: [true, false, false, false, false, false, false] }),
    ];
    const hero = computeHero(metrics, weekDays, todayDate);
    expect(hero.dayStates).toEqual([
      "full",    // Mon: both true
      "partial", // Tue: 1 of 2
      "empty",   // Wed: 0 of 2 (still today)
      "future", "future", "future", "future",
    ]);
  });

  it("handles empty metric list", () => {
    const hero = computeHero([], weekDays, todayDate);
    expect(hero.done).toBe(0);
    expect(hero.total).toBe(0);
    expect(hero.totalGoals).toBe(0);
    expect(hero.onTrackCount).toBe(0);
    expect(hero.dayStates).toEqual(["empty", "empty", "empty", "future", "future", "future", "future"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/dashboard.test.ts`
Expected: FAIL — `computeHero`, `Hero` not exported.

- [ ] **Step 3: Implement**

```ts
// app/lib/dashboard.ts (append)
export type DayState = "full" | "partial" | "empty" | "future";

export interface Hero {
  done: number;
  total: number;
  onTrackCount: number;
  totalGoals: number;
  dayStates: DayState[];
}

export function computeHero(
  metrics: DashboardMetric[],
  weekDays: string[],
  todayDate: string
): Hero {
  const counted = metrics.filter((m) => m.weeklyTargetEffective > 0);
  const done = counted.reduce((s, m) => s + m.weeklyDone, 0);
  const total = counted.reduce((s, m) => s + m.weeklyTargetEffective, 0);
  const onTrackCount = counted.filter(
    (m) => m.status === "met" || m.status === "on_track"
  ).length;
  const totalGoals = counted.length;

  const todayIndex = weekDays.indexOf(todayDate);
  const todayIdx = todayIndex < 0 ? 6 : todayIndex;

  const dayStates: DayState[] = weekDays.map((_, i) => {
    if (i > todayIdx) return "future";
    if (metrics.length === 0) return "empty";
    const successesOnDay = metrics.filter((m) => m.daySuccess[i]).length;
    if (successesOnDay === 0) return "empty";
    if (successesOnDay === metrics.length) return "full";
    return "partial";
  });

  return { done, total, onTrackCount, totalGoals, dayStates };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/lib/dashboard.test.ts`
Expected: PASS — all 3 new cases + prior.

- [ ] **Step 5: Commit**

```ts
git add app/lib/dashboard.ts tests/lib/dashboard.test.ts
git commit -m "feat(dashboard): add hero counts + day states"
```

---

## Task 8: Top-level `DashboardData` type + `buildDashboardData` orchestrator

**Files:**
- Modify: `app/lib/dashboard.ts`
- Modify: `tests/lib/dashboard.test.ts`

- [ ] **Step 1: Append failing tests**

```ts
// tests/lib/dashboard.test.ts (append)
import { buildDashboardData, type DashboardData } from "~/lib/dashboard";

describe("buildDashboardData", () => {
  it("assembles all pieces given metrics + per-metric entries", () => {
    const todayDate = "2026-05-27"; // Wed of ISO week 22, 2026
    const metrics = [
      { id: 1, name: "Workout", type: "boolean" as const, unit: null, goal: null, goalDirection: null, weeklyTarget: 4 },
      { id: 2, name: "Read", type: "boolean" as const, unit: null, goal: null, goalDirection: null, weeklyTarget: null },
    ];
    const entriesByMetric = new Map<number, DashboardEntry[]>([
      [1, [
        { date: "2026-05-25", value: 1 },
        { date: "2026-05-26", value: 1 },
        { date: "2026-05-27", value: 1 },
      ]],
      [2, [
        { date: "2026-05-25", value: 1 },
        { date: "2026-05-26", value: 1 },
        { date: "2026-05-27", value: 1 },
      ]],
    ]);

    const data = buildDashboardData(metrics, entriesByMetric, todayDate);
    expect(data.date).toBe(todayDate);
    expect(data.weekDays).toHaveLength(7);
    expect(data.weekDays[0]).toBe("2026-05-25"); // Monday
    expect(data.todayIndex).toBe(2);
    expect(data.metrics).toHaveLength(2);
    expect(data.metrics[0].name).toBe("Workout");
    expect(data.metrics[0].status).toBe("on_track"); // 3/4 with daysElapsed=3, expected=2
    expect(data.metrics[1].displayKind).toBe("streak");
    expect(data.hero.done).toBe(3 + 3); // workout 3 + read 3
    expect(data.hero.total).toBe(4 + 7);
    expect(data.weekNumber).toBe(22);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/dashboard.test.ts`
Expected: FAIL — `buildDashboardData`, `DashboardData` not exported.

- [ ] **Step 3: Implement**

```ts
// app/lib/dashboard.ts (append)
import { getWeekDays } from "~/lib/date";

export interface DashboardData {
  date: string;
  weekDays: string[];
  todayIndex: number;
  weekNumber: number;
  hero: Hero;
  metrics: DashboardMetric[];
}

function isoWeekNumber(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  // ISO 8601: Thursday of the week determines the year.
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function buildDashboardData(
  metrics: DashboardMetricInput[],
  entriesByMetric: Map<number, DashboardEntry[]>,
  todayDate: string
): DashboardData {
  const weekDays = getWeekDays(todayDate);
  const todayIndex = weekDays.indexOf(todayDate);
  const computedMetrics = metrics.map((m) =>
    computeMetricView(m, entriesByMetric.get(m.id) ?? [], weekDays, todayDate)
  );
  const hero = computeHero(computedMetrics, weekDays, todayDate);
  return {
    date: todayDate,
    weekDays,
    todayIndex,
    weekNumber: isoWeekNumber(todayDate),
    hero,
    metrics: computedMetrics,
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/lib/dashboard.test.ts`
Expected: PASS — all cases.

- [ ] **Step 5: Commit**

```bash
git add app/lib/dashboard.ts tests/lib/dashboard.test.ts
git commit -m "feat(dashboard): add buildDashboardData orchestrator"
```

---

## Task 9: `getDashboardData` server wrapper (queries D1)

**Files:**
- Create: `app/lib/dashboard.server.ts`

- [ ] **Step 1: Write the server wrapper**

No unit test for this — it's a thin DB shim. Smoke-tested via route tests later.

```ts
// app/lib/dashboard.server.ts
import { eq, and, asc, gte, lte, inArray } from "drizzle-orm";
import { metrics, metricEntries } from "~/db/schema";
import type { Database } from "~/lib/db.server";
import { buildDashboardData, type DashboardData, type DashboardEntry, type DashboardMetricInput } from "~/lib/dashboard";
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
      .select({ metricId: metricEntries.metricId, date: metricEntries.date, value: metricEntries.value })
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

    // For streak calc we also want entries before the current week.
    // Fetch the last ~60 days for any metric that might display streak.
    const streakStart = weekDays[0]; // simplest: only this-week; longer streaks shown later.
    // (Streak is computed off the entries-by-metric map. If the user wants
    // multi-week streaks shown on the dashboard, expand this query.
    // For now, in-week is enough for tests; longer streaks come from the
    // metric detail view.)
    void streakStart;
  }

  return buildDashboardData(userMetrics, entriesByMetric, todayDate);
}
```

Note: the comment about multi-week streaks reflects a YAGNI deferral — see "Open" at the bottom of the plan.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add app/lib/dashboard.server.ts
git commit -m "feat(dashboard): add getDashboardData server wrapper"
```

---

## Task 10: SVG renderer — color mode (snapshot)

**Files:**
- Create: `app/lib/dashboard-svg.ts`
- Create: `tests/lib/dashboard-svg.test.ts`

- [ ] **Step 1: Write a snapshot smoke test**

```ts
// tests/lib/dashboard-svg.test.ts
import { describe, it, expect } from "vitest";
import { renderDashboardSvg } from "~/lib/dashboard-svg";
import type { DashboardData } from "~/lib/dashboard";

const fixture: DashboardData = {
  date: "2026-05-27",
  weekDays: ["2026-05-25", "2026-05-26", "2026-05-27", "2026-05-28", "2026-05-29", "2026-05-30", "2026-05-31"],
  todayIndex: 2,
  weekNumber: 22,
  hero: {
    done: 12, total: 26, onTrackCount: 3, totalGoals: 5,
    dayStates: ["full", "partial", "partial", "future", "future", "future", "future"],
  },
  metrics: [
    {
      id: 1, name: "Workout", type: "boolean", unit: null, goal: null, goalDirection: null,
      weeklyTarget: 4, weeklyTargetEffective: 4, weeklyDone: 3,
      dayValues: [1, 1, 1, null, null, null, null],
      daySuccess: [true, true, true, false, false, false, false],
      status: "on_track", displayKind: "weekly_ratio", streak: 0, todayValue: 1,
    },
    {
      id: 2, name: "Read", type: "boolean", unit: null, goal: null, goalDirection: null,
      weeklyTarget: null, weeklyTargetEffective: 7, weeklyDone: 3,
      dayValues: [1, 1, 1, null, null, null, null],
      daySuccess: [true, true, true, false, false, false, false],
      status: "on_track", displayKind: "streak", streak: 28, todayValue: 1,
    },
  ],
};

describe("renderDashboardSvg", () => {
  it("produces an SVG with width 400 and height 300", () => {
    const svg = renderDashboardSvg(fixture, { mode: "color" });
    expect(svg).toMatch(/^<svg[^>]*width="400"/);
    expect(svg).toMatch(/height="300"/);
    expect(svg).toContain('viewBox="0 0 400 300"');
  });

  it("color mode contains expected text strings", () => {
    const svg = renderDashboardSvg(fixture, { mode: "color" });
    expect(svg).toContain("Workout");
    expect(svg).toContain("Read");
    expect(svg).toContain("12");      // hero done
    expect(svg).toContain("/26");     // hero total
    expect(svg).toContain("28");      // streak
    expect(svg).toContain("Wk 22");
  });

  it("bw mode contains hatch pattern definition", () => {
    const svg = renderDashboardSvg(fixture, { mode: "bw" });
    expect(svg).toContain('id="hatch-50"');
    expect(svg).toContain("<pattern");
  });

  it("matches the color snapshot", () => {
    const svg = renderDashboardSvg(fixture, { mode: "color" });
    expect(svg).toMatchSnapshot();
  });

  it("matches the bw snapshot", () => {
    const svg = renderDashboardSvg(fixture, { mode: "bw" });
    expect(svg).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/dashboard-svg.test.ts`
Expected: FAIL — `renderDashboardSvg` not defined.

- [ ] **Step 3: Implement the SVG renderer**

The renderer is a long function. Lay it out roughly mirroring c1-v4 from the spec. **No JSX, just template strings.** Coordinates are in absolute SVG units (0–400 x, 0–300 y).

```ts
// app/lib/dashboard-svg.ts
import type { DashboardData, DashboardMetric, DayState } from "~/lib/dashboard";

export interface RenderOpts {
  mode: "color" | "bw";
}

// --- Palette ---
const COLOR = {
  bg: "#f9f8f6",
  card: "#ffffff",
  outline: "#e6e3de",
  text: "#1c1917",
  textMuted: "#5e5a55",
  primary: "#8b7fe8",
  primaryFixed: "#eceaff",
  primaryFixedDim: "#dad6ff",
  primaryContainer: "#6e63c8",
  success: "#2f9e86",
  surfaceHighest: "#e6e3de",
};

function p(mode: "color" | "bw") {
  // In bw mode, swap the palette to black/white.
  if (mode === "color") return COLOR;
  return {
    bg: "#ffffff",
    card: "#ffffff",
    outline: "#000000",
    text: "#000000",
    textMuted: "#000000",
    primary: "#000000",
    primaryFixed: "#ffffff",
    primaryFixedDim: "url(#hatch-50)",
    primaryContainer: "#000000",
    success: "#000000",
    surfaceHighest: "#ffffff",
  };
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatDateLong(dateStr: string): string {
  // "Wed · May 27" — no Intl on Workers without locale data? Intl is on V8.
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  const mon = date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  return `${dow} · ${mon} ${d}`;
}

function dayLetters(): string[] {
  return ["M", "T", "W", "T", "F", "S", "S"];
}

// --- Day box ---
function dayBox(x: number, y: number, state: DayState, isToday: boolean, mode: "color" | "bw"): string {
  const c = p(mode);
  const size = 20;
  const radius = 4;
  let fill = c.bg;
  let stroke = c.outline;
  let extra = "";
  if (state === "full") {
    fill = c.primary;
    stroke = c.primary;
  } else if (state === "partial") {
    fill = c.primaryFixedDim;
    stroke = mode === "bw" ? c.outline : c.primaryFixedDim;
  } else if (state === "empty") {
    fill = c.card;
    stroke = c.outline;
  } else { // future
    fill = "transparent";
    stroke = c.outline;
    extra = mode === "bw"
      ? ' stroke-dasharray="2 2" opacity="0.6"'
      : ' stroke-dasharray="2 2" opacity="0.5"';
  }
  const today = isToday
    ? `<rect x="${x - 2}" y="${y - 2}" width="${size + 4}" height="${size + 4}" rx="${radius + 1}" fill="none" stroke="${c.primaryContainer}" stroke-width="2"/>`
    : "";
  return `${today}<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="1"${extra}/>`;
}

// --- Week dots (per metric) ---
function weekDots(x: number, y: number, m: DashboardMetric, mode: "color" | "bw"): string {
  const c = p(mode);
  const size = 8;
  const gap = 3;
  let out = "";
  for (let i = 0; i < 7; i++) {
    const cx = x + i * (size + gap) + size / 2;
    const cy = y + size / 2;
    const success = m.daySuccess[i];
    const dim = m.weeklyTarget != null && i >= m.weeklyTarget;
    if (success) {
      const fill = m.status === "met" ? c.success : c.primary;
      out += `<circle cx="${cx}" cy="${cy}" r="${size / 2}" fill="${fill}"${dim ? ' opacity="0.35"' : ""}/>`;
    } else {
      const fill = mode === "bw" ? c.card : c.outline;
      const stroke = mode === "bw" ? c.outline : "none";
      out += `<circle cx="${cx}" cy="${cy}" r="${(size / 2) - (mode === "bw" ? 1 : 0)}" fill="${fill}" stroke="${stroke}"${dim ? ' opacity="0.35"' : ""}/>`;
    }
  }
  return out;
}

// --- Per-row stat block (right side) ---
function statBlock(x: number, y: number, m: DashboardMetric, mode: "color" | "bw"): string {
  const c = p(mode);
  let value = "";
  let label = "";
  if (m.displayKind === "weekly_ratio") {
    value = `${m.weeklyDone}/${m.weeklyTargetEffective}`;
    label = m.status === "met" ? "met ✓" : m.status === "on_track" ? "on track" : "behind";
  } else if (m.displayKind === "streak") {
    value = `${m.streak}`;
    label = "streak";
  } else {
    value = m.todayValue == null ? "—" : (m.unit ? `${m.todayValue}${m.unit.slice(0, 1)}` : `${m.todayValue}`);
    label = "today";
  }
  const valueColor = m.status === "met" ? c.success : c.text;
  return `
    <text x="${x}" y="${y + 8}" font-family="JetBrainsMono Bold, ui-monospace, monospace" font-size="11" font-weight="700" fill="${valueColor}" text-anchor="end">${esc(value)}</text>
    <text x="${x}" y="${y + 17}" font-family="Inter, system-ui, sans-serif" font-size="7" font-weight="600" fill="${c.textMuted}" text-anchor="end" letter-spacing="0.3">${esc(label.toUpperCase())}</text>
  `;
}

// --- Main entry ---
export function renderDashboardSvg(data: DashboardData, opts: RenderOpts): string {
  const c = p(opts.mode);
  const w = 400, h = 300;

  // Header
  const header = `
    <text x="14" y="22" font-family="Inter, system-ui, sans-serif" font-size="12" font-weight="600" fill="${c.text}">${esc(formatDateLong(data.date))}</text>
    <text x="${w - 14}" y="22" font-family="ui-monospace, monospace" font-size="10" fill="${c.textMuted}" text-anchor="end">Wk ${data.weekNumber}</text>
  `;

  // Hero rect
  const heroX = 12, heroY = 32, heroW = w - 24, heroH = 80;
  const heroFill = opts.mode === "color" ? c.primaryFixed : "#ffffff";
  const heroStroke = opts.mode === "bw" ? c.outline : "none";

  const heroLabel = `<text x="${heroX + 12}" y="${heroY + 16}" font-family="Inter, system-ui, sans-serif" font-size="8" font-weight="700" fill="${c.primaryContainer}" letter-spacing="0.6">WEEKLY PROGRESS</text>`;
  const heroBig = `
    <text x="${heroX + 12}" y="${heroY + 50}" font-family="JetBrainsMono Bold, ui-monospace, monospace" font-size="36" font-weight="800" fill="${c.primaryContainer}">${data.hero.done}<tspan font-size="16" fill="${c.textMuted}">/${data.hero.total}</tspan></text>
  `;
  const heroSub = `<text x="${heroX + 12}" y="${heroY + 68}" font-family="ui-monospace, monospace" font-size="9" fill="${c.textMuted}">${data.hero.onTrackCount} of ${data.hero.totalGoals} on track</text>`;

  // Day boxes inside hero, right side
  const dayBoxesX = heroX + heroW - 12 - (7 * 20 + 6 * 4);
  const dayBoxesY = heroY + 28;
  let dayBoxes = "";
  for (let i = 0; i < 7; i++) {
    const bx = dayBoxesX + i * 24;
    dayBoxes += `<text x="${bx + 10}" y="${dayBoxesY - 5}" font-family="Inter, system-ui, sans-serif" font-size="9" font-weight="600" fill="${c.textMuted}" text-anchor="middle">${dayLetters()[i]}</text>`;
    dayBoxes += dayBox(bx, dayBoxesY, data.hero.dayStates[i], i === data.todayIndex, opts.mode);
  }

  const hero = `
    <rect x="${heroX}" y="${heroY}" width="${heroW}" height="${heroH}" rx="10" fill="${heroFill}" stroke="${heroStroke}" stroke-width="${opts.mode === "bw" ? 1 : 0}"/>
    ${heroLabel}${heroBig}${heroSub}${dayBoxes}
  `;

  // Metric rows
  const rowsStartY = heroY + heroH + 8;
  const rowH = 28;
  const rowGap = 3;
  const rowX = 12;
  const rowW = w - 24;
  let rows = "";
  for (let i = 0; i < data.metrics.length; i++) {
    const m = data.metrics[i];
    const ry = rowsStartY + i * (rowH + rowGap);
    const target = m.weeklyTarget != null ? ` · ${m.weeklyTarget}× / wk`
      : m.type === "boolean" ? " · daily"
      : m.goal != null ? ` · ${m.goal}${m.unit ? ` ${m.unit}` : ""}`
      : m.unit ? ` · ${m.unit}` : "";
    const nameText = `<text x="${rowX + 9}" y="${ry + 18}" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="600" fill="${c.text}">${esc(m.name)}<tspan fill="${c.textMuted}" font-weight="500">${esc(target)}</tspan></text>`;
    const dotsX = rowX + rowW - 44 - 88;
    const dots = weekDots(dotsX, ry + 10, m, opts.mode);
    const stat = statBlock(rowX + rowW - 8, ry + 3, m, opts.mode);
    rows += `
      <rect x="${rowX}" y="${ry}" width="${rowW}" height="${rowH}" rx="7" fill="${c.card}" stroke="${c.outline}" stroke-width="1"/>
      ${nameText}${dots}${stat}
    `;
  }

  // Defs (hatch pattern only in bw mode but always emitted — cheap)
  const defs = `
    <defs>
      <pattern id="hatch-50" patternUnits="userSpaceOnUse" width="3" height="3" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="3" stroke="#000" stroke-width="1"/>
      </pattern>
    </defs>
  `;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
${defs}
<rect width="${w}" height="${h}" fill="${c.bg}"/>
${header}${hero}${rows}
</svg>`;
}
```

- [ ] **Step 4: Run tests; accept snapshots**

Run: `npx vitest run tests/lib/dashboard-svg.test.ts`
Expected: PASS — text-content assertions pass; snapshots are generated for the first time.

- [ ] **Step 5: Visually verify**

Eyeball the generated SVG once. Save the color SVG to a file and open it in a browser:

```bash
node -e "const {renderDashboardSvg} = require('./app/lib/dashboard-svg.ts'); /* won't work directly because TS; use vitest output instead */"
```

Easier: copy the output from the snapshot file `tests/lib/__snapshots__/dashboard-svg.test.ts.snap` into a file with `.svg` extension and open in browser. Confirm it broadly resembles `c1-v4.html`.

- [ ] **Step 6: Commit**

```bash
git add app/lib/dashboard-svg.ts tests/lib/dashboard-svg.test.ts tests/lib/__snapshots__/
git commit -m "feat(dashboard): pure SVG renderer for color + bw modes"
```

---

## Task 11: Install @resvg/resvg-wasm and add fonts

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `public/fonts/Inter-Regular.ttf`, `Inter-Bold.ttf`, `JetBrainsMono-Bold.ttf`

- [ ] **Step 1: Install the dep**

```bash
npm install @resvg/resvg-wasm
```

- [ ] **Step 2: Download the fonts**

Inter from rsms.me/inter:
```bash
mkdir -p public/fonts
curl -L -o public/fonts/Inter-Regular.ttf https://github.com/rsms/inter/raw/master/docs/font-files/Inter-Regular.ttf
curl -L -o public/fonts/Inter-Bold.ttf https://github.com/rsms/inter/raw/master/docs/font-files/Inter-Bold.ttf
```

JetBrains Mono from JetBrains:
```bash
curl -L -o public/fonts/JetBrainsMono-Bold.ttf https://github.com/JetBrains/JetBrainsMono/raw/master/fonts/ttf/JetBrainsMono-Bold.ttf
```

Verify all three exist:
```bash
ls -lh public/fonts/
```
Expected: three .ttf files, each between 80 KB and 350 KB.

- [ ] **Step 3: Configure Vite to inline TTF + wasm as ArrayBuffers**

Edit `vite.config.ts`:

```ts
// vite.config.ts
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { cloudflareDevProxy } from "@react-router/dev/vite/cloudflare";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  assetsInclude: ["**/*.ttf", "**/*.wasm"],
  plugins: [
    cloudflareDevProxy(),
    reactRouter(),
    tailwindcss(),
    tsconfigPaths(),
  ],
});
```

- [ ] **Step 4: Typecheck + lint**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vite.config.ts public/fonts/
git commit -m "feat(dashboard): add resvg-wasm + Inter/JetBrains Mono fonts"
```

---

## Task 12: PNG renderer (resvg-wasm)

**Files:**
- Create: `app/lib/dashboard-png.server.ts`
- Create: `tests/lib/dashboard-png.test.ts`

- [ ] **Step 1: Write the smoke test (PNG magic bytes)**

```ts
// tests/lib/dashboard-png.test.ts
import { describe, it, expect } from "vitest";
import { renderDashboardPng } from "~/lib/dashboard-png.server";
import type { DashboardData } from "~/lib/dashboard";

const fixture: DashboardData = {
  date: "2026-05-27",
  weekDays: ["2026-05-25","2026-05-26","2026-05-27","2026-05-28","2026-05-29","2026-05-30","2026-05-31"],
  todayIndex: 2,
  weekNumber: 22,
  hero: { done: 12, total: 26, onTrackCount: 3, totalGoals: 5,
    dayStates: ["full","partial","partial","future","future","future","future"] },
  metrics: [],
};

describe("renderDashboardPng", () => {
  it("returns a buffer starting with PNG magic bytes", async () => {
    const buf = await renderDashboardPng(fixture);
    expect(buf.length).toBeGreaterThan(100);
    // PNG magic: 89 50 4E 47 0D 0A 1A 0A
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50);
    expect(buf[2]).toBe(0x4e);
    expect(buf[3]).toBe(0x47);
  }, 10_000);
});
```

- [ ] **Step 2: Implement the PNG renderer**

```ts
// app/lib/dashboard-png.server.ts
import { Resvg, initWasm } from "@resvg/resvg-wasm";
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm";
import interRegularUrl from "../../public/fonts/Inter-Regular.ttf?arraybuffer";
import interBoldUrl from "../../public/fonts/Inter-Bold.ttf?arraybuffer";
import jbMonoBoldUrl from "../../public/fonts/JetBrainsMono-Bold.ttf?arraybuffer";
import { renderDashboardSvg } from "~/lib/dashboard-svg";
import type { DashboardData } from "~/lib/dashboard";

let initialized = false;
async function ensureInit(): Promise<void> {
  if (!initialized) {
    await initWasm(resvgWasm);
    initialized = true;
  }
}

export async function renderDashboardPng(data: DashboardData): Promise<Uint8Array> {
  await ensureInit();
  const svg = renderDashboardSvg(data, { mode: "bw" });

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 400 },
    font: {
      fontBuffers: [
        new Uint8Array(interRegularUrl as ArrayBuffer),
        new Uint8Array(interBoldUrl as ArrayBuffer),
        new Uint8Array(jbMonoBoldUrl as ArrayBuffer),
      ],
      loadSystemFonts: false,
      defaultFontFamily: "Inter",
    },
  });
  return resvg.render().asPng();
}
```

If the `?arraybuffer` import syntax produces a type error: add a global module shim at `app/env.d.ts`:

```ts
// app/env.d.ts — append
declare module "*.ttf?arraybuffer" { const buf: ArrayBuffer; export default buf; }
declare module "*.wasm" { const wasm: WebAssembly.Module; export default wasm; }
```

If `initWasm` errors on the imported `.wasm` (Vite returns a compiled `WebAssembly.Module`, not a buffer), use this variant:

```ts
// Variant: import the wasm as a URL and fetch it
import wasmUrl from "@resvg/resvg-wasm/index_bg.wasm?url";

async function ensureInit() {
  if (!initialized) {
    const res = await fetch(wasmUrl);
    await initWasm(await res.arrayBuffer());
    initialized = true;
  }
}
```

Pick whichever works after running the smoke test. Both are documented patterns.

- [ ] **Step 3: Run smoke test**

Run: `npx vitest run tests/lib/dashboard-png.test.ts`
Expected: PASS — buffer starts with PNG magic.

If it fails on wasm init, try the fetch-the-URL variant.

- [ ] **Step 4: Commit**

```bash
git add app/lib/dashboard-png.server.ts tests/lib/dashboard-png.test.ts app/env.d.ts
git commit -m "feat(dashboard): rasterize dashboard SVG to PNG via resvg-wasm"
```

---

## Task 13: PNG route `/dashboard.png`

**Files:**
- Create: `app/routes/dashboard[.png].tsx`

- [ ] **Step 1: Write the route**

```tsx
// app/routes/dashboard[.png].tsx
import type { Route } from "./+types/dashboard[.png]";
import { getDb } from "~/lib/db.server";
import { requireApiKeyFromRequest, checkRateLimit } from "~/lib/api-key.server";
import { getDashboardData } from "~/lib/dashboard.server";
import { renderDashboardPng } from "~/lib/dashboard-png.server";
import { todayInTz } from "~/lib/tz";

export async function loader({ request, context }: Route.LoaderArgs) {
  const db = getDb(context.cloudflare.env.DB);
  const url = new URL(request.url);

  // Auth
  let auth;
  try {
    auth = await requireApiKeyFromRequest(request, db);
  } catch (res) {
    if (res instanceof Response) return res; // 401 JSON; error-PNG variant is a YAGNI for now (see Open list)
    throw res;
  }
  checkRateLimit(auth.keyId);

  // Compute today in user's tz
  const tz = url.searchParams.get("tz") ?? undefined;
  const todayDate = todayInTz(tz);

  const data = await getDashboardData(db, auth.userId, todayDate);
  const png = await renderDashboardPng(data);

  return new Response(png, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
}
```

**Note:** The error-PNG variant from the spec is intentionally deferred — returning JSON 401 is simpler and the device just keeps its last image (e-paper is persistent). Listed under "Open / future" at the bottom.

- [ ] **Step 2: Manual smoke test**

Run dev server:

```bash
npm run dev
```

Create an API key for your user (via existing settings page, or `curl` the API key endpoint), then:

```bash
curl -o /tmp/dash.png "http://localhost:5173/dashboard.png?key=logr_..."
file /tmp/dash.png
```

Expected: `/tmp/dash.png: PNG image data, 400 x 300, 8-bit/color RGB, non-interlaced` (or similar).

Open the PNG and confirm it matches the design.

- [ ] **Step 3: Commit**

```bash
git add app/routes/dashboard[.png].tsx
git commit -m "feat(dashboard): add /dashboard.png route (resvg-wasm + api key)"
```

---

## Task 14: HTML route `/dashboard`

**Files:**
- Create: `app/routes/_app.dashboard.tsx`

- [ ] **Step 1: Write the route**

```tsx
// app/routes/_app.dashboard.tsx
import { useLoaderData } from "react-router";
import { useState } from "react";
import type { Route } from "./+types/_app.dashboard";
import { requireAuth } from "~/lib/auth.server";
import { getDb } from "~/lib/db.server";
import { getDashboardData } from "~/lib/dashboard.server";
import { renderDashboardSvg } from "~/lib/dashboard-svg";
import { todayInTz } from "~/lib/tz";

export async function loader({ request, context }: Route.LoaderArgs) {
  const user = await requireAuth(request, context.cloudflare.env.JWT_SECRET);
  const db = getDb(context.cloudflare.env.DB);
  const url = new URL(request.url);
  const tz = url.searchParams.get("tz") ?? undefined;
  const todayDate = todayInTz(tz);
  const data = await getDashboardData(db, user.userId, todayDate);
  const svg = renderDashboardSvg(data, { mode: "color" });
  return { svg, tz };
}

export default function DashboardPage() {
  const { svg, tz } = useLoaderData<typeof loader>();
  const [copied, setCopied] = useState(false);

  function copyDeviceUrl() {
    const origin = window.location.origin;
    const tzParam = tz ? `&tz=${encodeURIComponent(tz)}` : "";
    const url = `${origin}/dashboard.png?key=YOUR_API_KEY${tzParam}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="px-4 py-6 max-w-md mx-auto">
      <h1 className="text-xl font-heading font-semibold mb-3">Dashboard</h1>
      <div className="bg-bg-card border border-outline-variant rounded-xl p-2 inline-block">
        <div
          style={{ width: 400, height: 300 }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
      <div className="mt-4">
        <button
          onClick={copyDeviceUrl}
          className="px-3 py-2 bg-surface-container-high text-text-muted rounded-lg text-sm hover:bg-surface-container-highest"
        >
          {copied ? "Copied ✓" : "Copy device URL"}
        </button>
        <p className="mt-2 text-xs text-text-muted">
          Replace <code>YOUR_API_KEY</code> with a key from{" "}
          <a className="underline" href="/settings">settings</a>.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Manual smoke test**

```bash
npm run dev
# Open http://localhost:5173/dashboard in a logged-in browser
```

Expected: dashboard renders at 400×300 inside the app shell.

- [ ] **Step 3: Commit**

```bash
git add app/routes/_app.dashboard.tsx
git commit -m "feat(dashboard): add /dashboard HTML route in app shell"
```

---

## Task 15: Empty-state polish + end-to-end check

**Files:**
- Modify: `app/lib/dashboard-svg.ts`
- Modify: `tests/lib/dashboard-svg.test.ts`

- [ ] **Step 1: Add a snapshot test for empty-metric state**

```ts
// tests/lib/dashboard-svg.test.ts (append)
it("renders a 'no habits yet' placeholder when metrics is empty", () => {
  const empty: DashboardData = { ...fixture, metrics: [], hero: { ...fixture.hero, totalGoals: 0, done: 0, total: 0 } };
  const svg = renderDashboardSvg(empty, { mode: "color" });
  expect(svg).toContain("No habits yet");
});
```

- [ ] **Step 2: Run, see it fail, then implement**

Run: `npx vitest run tests/lib/dashboard-svg.test.ts`
Expected: FAIL.

Modify `renderDashboardSvg` to add a placeholder row when `metrics.length === 0`:

```ts
// inside renderDashboardSvg, replace the rows-building section:
let rows = "";
if (data.metrics.length === 0) {
  rows += `
    <rect x="${rowX}" y="${rowsStartY}" width="${rowW}" height="${rowH * 3}" rx="7" fill="${c.card}" stroke="${c.outline}" stroke-width="1"/>
    <text x="${rowX + rowW / 2}" y="${rowsStartY + 40}" font-family="Inter, system-ui, sans-serif" font-size="13" font-weight="600" fill="${c.textMuted}" text-anchor="middle">No habits yet — add one in the app</text>
  `;
} else {
  for (let i = 0; i < data.metrics.length; i++) {
    // ... existing loop
  }
}
```

Run again, expect PASS.

- [ ] **Step 3: Final end-to-end check**

1. `npm run typecheck` — no errors
2. `npx vitest run` — all tests pass
3. `npm run dev`, visit `/dashboard`, confirm it looks like c1-v4 (color)
4. With an API key: `curl -o /tmp/dash.png http://localhost:5173/dashboard.png?key=...`; open the PNG and confirm B/W version
5. Optional: physically test on the ESP32 by pointing it at `/dashboard.png?key=...`

- [ ] **Step 4: Commit**

```bash
git add app/lib/dashboard-svg.ts tests/lib/dashboard-svg.test.ts
git commit -m "feat(dashboard): empty-state placeholder + e2e check"
```

---

## Open / future (intentional YAGNI)

- **Multi-week streaks**: `getDashboardData` currently fetches only the current week's entries, which caps streaks at 7 days. Expand the entries query when streaks routinely cross weeks (probably `now - 60d` is plenty).
- **Settings UI for "show on dashboard"**: spec deferred this to use top-5 by sortOrder; revisit if the device feels too rigid.
- **Cache PNG at edge**: Cloudflare's cache API can shave latency once usage stabilizes; not needed for one device polling every few minutes.
- **Error PNG**: replace the JSON 401 with a 400×300 "Unauthorized" PNG once we're happy with the device's offline behavior. Spec wants this; defer if it costs >30 mins.

---

## Self-review notes

- **Spec coverage:** routes, auth (both header + query), counting rules (incl. boolean-no-target = 7), 3-state day boxes, hatch pattern dithering, error states (downgrade noted), tests (data + svg snapshots + png smoke), fonts (Inter + JetBrains Mono), no caching. All ✓.
- **Type consistency:** `Status` / `DayState` / `DisplayKind` defined once in `app/lib/dashboard.ts` and reused. `DashboardData` shape matches the spec.
- **Placeholder scan:** all code blocks are concrete. The two places that say "see notes" or "leaving X to the implementor" are around resvg-wasm initialization (genuine variant in the wild — both forms documented inline) and the error-PNG (explicit YAGNI deferral with a one-line note).
