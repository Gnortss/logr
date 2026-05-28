# E-ink Dashboard — Design

**Date:** 2026-05-26
**Branch:** feat/settings-metric-layout (continuing)
**Status:** Approved layout (C1 v4), pending implementation plan

## Goal

Add a compact dashboard view to logr, exactly 400×300 px, available as both:

- **`/dashboard`** — colored HTML page matching the rest of the app (browser-viewable)
- **`/dashboard.png`** — black-and-white PNG with pattern-based "dithering", served to a Waveshare 4.2" e-ink panel driven by an ESP32 polling over HTTP

Single source of truth — the same SVG renderer drives both, with `mode: 'color' | 'bw'` switching styles. The PNG variant runs through `@resvg/resvg-wasm` to rasterize on the Cloudflare Worker.

## Constraints

- **Display:** Waveshare 4.2" 400×300, 1-bit B/W (effectively; can use patterns to simulate gray)
- **Runtime:** Cloudflare Workers (React Router 7, D1, drizzle-orm)
- **No caching** — regenerate on every request
- **Auth:** JWT session for HTML view, API key (header *or* `?key=` query) for PNG
- **Timezone-aware:** accept `?tz=Europe/Ljubljana` for week alignment

## Routes

### `/dashboard`

- File: `app/routes/_app.dashboard.tsx`
- Auth: JWT (existing `requireAuth`)
- Renders inside the app shell (same `_app` layout as `/` and `/settings`)
- Body: the 400×300 dashboard SVG (color mode) centered with a thin frame, plus utility actions below — for now just a "Copy device URL" button that copies `/dashboard.png?key=...&tz=...` to clipboard
- Loader returns the same data shape used by the PNG route, computed via `getDashboardData(userId, db, date, tz)`

### `/dashboard.png`

- File: `app/routes/dashboard[.png].tsx` (flat-route escape for the dot)
- Auth: API key via `Authorization: Bearer logr_...` header **or** `?key=logr_...` query parameter — either is accepted
- Optional `?tz=` query for timezone; defaults to UTC
- Response: `image/png` body, status 200; `Cache-Control: no-store`
- Auth failure: returns a small 400×300 PNG that says "Unauthorized" (so the device shows *something* identifiable) with status 401, not a JSON body

## Auth helper changes

Existing `requireApiKey(request, db)` only checks the `Authorization` header. We add a new entry point that also accepts `?key=` query strings:

```ts
// app/lib/api-key.server.ts
export async function requireApiKeyFromRequest(
  request: Request,
  db: Database
): Promise<{ userId: number; keyId: number }> {
  // 1. Authorization: Bearer logr_...
  // 2. ?key=logr_...
  // First match wins. Fail with 401 if neither present or invalid.
}
```

Existing `requireApiKey` is kept untouched so the `/api/v1/*` routes don't change behavior.

## Data shape

Computed once per request:

```ts
type DashboardData = {
  date: string;           // YYYY-MM-DD in user's tz
  weekDays: string[];     // 7 ISO dates, Mon..Sun
  todayIndex: number;     // 0..6, position of `date` in weekDays
  weekNumber: number;     // ISO week number
  hero: {
    done: number;         // sum of capped-done across counted metrics
    total: number;        // sum of weekly targets across counted metrics
    onTrackCount: number; // metrics pacing to hit target by Sunday
    totalGoals: number;   // metrics with a success criterion (counted in hero)
    dayStates: ('full' | 'partial' | 'empty' | 'future')[]; // length 7
  };
  metrics: DashboardMetric[]; // max 5, ordered by sortOrder asc
};

type DashboardMetric = {
  id: number;
  name: string;
  type: MetricType;
  unit: string | null;
  goal: number | null;
  goalDirection: GoalDirection | null;
  weeklyTarget: number | null;
  // computed:
  weeklyTargetEffective: number; // weeklyTarget OR (daily-with-goal-or-boolean ? 7 : 0)
  weeklyDone: number;            // 0..weeklyTargetEffective, capped
  dayValues: (number | null)[];  // 7 entries for Mon..Sun (raw values or null)
  daySuccess: boolean[];         // whether each day "counts as done"
  status: 'met' | 'on_track' | 'behind' | 'tracking'; // see below
  displayKind: 'weekly_ratio' | 'streak' | 'today_value';
  streak: number;                // current streak in days; 0 if not applicable
  todayValue: number | null;     // raw value logged today, for `today_value` display
};
```

`getDashboardData` lives in `app/lib/dashboard.server.ts`. It reads up to 5 non-archived metrics by `sortOrder asc`, and fetches all entries for the week.

## Counting rules

These are explicit so the implementation matches the mockups exactly.

### Per-day "success"

For each metric, a day "counts as done" iff:

- **Boolean metric:** entry exists and `value === 1`
- **Numeric metric WITH goal:** entry exists and `isGoalMet(value, goal, goalDirection)` (reuse from `app/lib/types.ts`)
- **Numeric metric WITHOUT goal:** entry exists and `value > 0` (matches existing weeklyDoneCounts behavior at `app/routes/_app._index.tsx:84`)

### Per-metric weekly target

- `weeklyTarget` if set
- else `7` if boolean (no goal needed) OR numeric-with-goal
- else `0` (numeric-no-goal — pure tracking; not counted in hero)

### Per-metric status

Given `daysElapsed = todayIndex + 1` (Mon=1 .. Sun=7) and `target = weeklyTargetEffective`:

- If `target === 0` → `'tracking'` (no success criterion to evaluate)
- If `weeklyDone >= target` → `'met'`
- Else compute `expected = ceil(target * daysElapsed / 7)`
  - If `weeklyDone >= expected` → `'on_track'`
  - Else → `'behind'`

### Per-metric display kind

What appears in the right-hand stat block on each row:

| Metric shape | `displayKind` | Right-hand value | Right-hand label |
| --- | --- | --- | --- |
| `weeklyTarget` set | `weekly_ratio` | `weeklyDone / weeklyTarget` | `met` / `on track` / `behind` |
| `weeklyTarget` null, daily (boolean OR numeric-with-goal) | `streak` | current streak | `streak` |
| `weeklyTarget` null, numeric-no-goal | `today_value` | `todayValue` + unit | `today` |

The `streak` calculation reuses logic from `computeBooleanStats` / streak-ish counting at `app/lib/stats.server.ts` — currently boolean-specific; we'll generalize a helper `computeCurrentStreak(entries, todayDate, isSuccess)` that takes a predicate.

### Hero

- `done = sum over counted metrics of min(weeklyDone, weeklyTargetEffective)`
- `total = sum over counted metrics of weeklyTargetEffective`
- `onTrackCount = count of counted metrics with status in {'met', 'on_track'}`
- `totalGoals = count of counted metrics`

### Day states (the 7 hero boxes)

For each day index `i` in 0..6:

- If `i > todayIndex` → `'future'`
- Else count `successesOnDay = (number of metrics with daySuccess[i] === true)`
  - `0` → `'empty'`
  - `metrics.length` → `'full'`
  - else → `'partial'`

This intentionally treats all metrics equally (not "expected today"), per the conversation — it answers "how active was this day".

## Rendering pipeline

### SVG renderer

`app/lib/dashboard-svg.ts` exports:

```ts
export function renderDashboardSvg(
  data: DashboardData,
  opts: { mode: 'color' | 'bw' }
): string;
```

Pure function. Outputs a complete `<svg width="400" height="300" viewBox="0 0 400 300">…</svg>` string. No DOM, no React.

Internal structure mirrors the locked C1 v4 layout:

1. Background rect (cream `#f9f8f6` in color, white in bw)
2. Header row: date left, week number right (y=18)
3. Hero card (rounded rect):
   - Color: filled `#eceaff` (primary-fixed)
   - BW: white with 1px black border
   - "WEEKLY PROGRESS" label, big `done/total` number, "X of Y on track" subtitle
   - 7 day boxes on the right, each 20×20 with a 3px gap
     - `full`: solid primary (color) / solid black (bw)
     - `partial`: light primary `#dad6ff` (color) / 45° hatch pattern (bw)
     - `empty`: white with 1px outline-variant border (color) / white with 1px black border (bw)
     - `future`: transparent + dashed outline border with 0.6 opacity
     - `today`: 2px outer outline added on top of whatever state
4. Metric rows (up to 5), each a 28px tall rounded rect:
   - Name + target subtitle on the left (truncated with ellipsis if too long)
   - 7 weekday dots: 8px circles, filled if `daySuccess` true; dimmed (35% opacity) past `weeklyTargetEffective` slot for weekly metrics
   - Status block on the right: big number + small label ("met ✓", "streak", "today", "on track", "behind")

### BW patterns / "dithering"

We don't do pixel-level Floyd-Steinberg. We use SVG `<pattern>` elements with diagonal hatch lines (1px black on white at 45°, 2–3px spacing) to simulate ~50% gray for "partial" states. Specifically:

- `id="hatch-50"` — black 1px line every 2px → ~50% coverage
- Used for: partial day boxes, partial numeric heatmap cells (not in C1 but kept for future)

resvg renders patterns deterministically. On the 4.2" panel at 400×300 native (no upscaling) the result is crisp and very legible — pre-rasterized into the PNG, no work needed on the ESP32 side.

### PNG renderer

`app/lib/dashboard-png.server.ts` exports:

```ts
export async function renderDashboardPng(data: DashboardData): Promise<Uint8Array>;
```

Implementation:

```ts
import { Resvg, initWasm } from '@resvg/resvg-wasm';
// Wasm and font files imported as ArrayBuffers via Vite's ?arraybuffer suffix
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm?arraybuffer';
import interRegular from '../../public/fonts/Inter-Regular.ttf?arraybuffer';
import interBold from '../../public/fonts/Inter-Bold.ttf?arraybuffer';
import jbMonoBold from '../../public/fonts/JetBrainsMono-Bold.ttf?arraybuffer';

let initialized = false;
async function ensureInit() {
  if (!initialized) {
    await initWasm(resvgWasm);
    initialized = true;
  }
}

export async function renderDashboardPng(data: DashboardData): Promise<Uint8Array> {
  await ensureInit();
  const svg = renderDashboardSvg(data, { mode: 'bw' });
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 400 },
    font: {
      fontBuffers: [
        new Uint8Array(interRegular),
        new Uint8Array(interBold),
        new Uint8Array(jbMonoBold),
      ],
      loadSystemFonts: false,
      defaultFontFamily: 'Inter',
    },
  });
  return resvg.render().asPng();
}
```

### Fonts

resvg on Workers has no system fonts. We bundle:

- **Inter-Regular.ttf** (~120 KB) for body
- **Inter-Bold.ttf** (~125 KB) for emphasis
- **JetBrainsMono-Bold.ttf** (~85 KB) for the monospace big numbers

Stored under `public/fonts/` and imported as ArrayBuffers via Vite's `?arraybuffer` suffix. Total added bundle: ~330 KB. The Worker bundle limit on the free plan is 1 MB compressed; we're well under.

The HTML `/dashboard` view doesn't need bundled fonts — browser uses the existing app stylesheet.

## Error handling

| Case | Behavior |
| --- | --- |
| HTML `/dashboard`, not authed | Existing JWT middleware redirects to `/login` |
| PNG `/dashboard.png`, no key | Return 401 + 400×300 PNG saying "Unauthorized" |
| PNG, invalid key | Same as above |
| User has 0 metrics | Render hero with `0/0` + "No habits yet — add one in the app" placeholder row |
| User has fewer than 5 metrics | Render exactly the number they have; no empty rows |
| `tz` query invalid | Fall back to UTC, no error |
| Entry data missing for week | All days are `empty`/`future` as appropriate; no error |
| resvg render throws | Return 500 + 400×300 PNG saying "Render error" (the device should keep showing the last successful image — Waveshare e-paper is persistent) |

## Testing

`app/lib/dashboard.server.test.ts` (vitest with Cloudflare workers pool, matching existing test setup):

- Counting rules: boolean done, numeric-with-goal met, numeric-no-goal tracked, weekly target capped
- Per-metric status transitions: met / on_track / behind / streak / tracking
- Day states (full / partial / empty / future) with seeded data
- Hero math (12/26 case from the mock)
- Timezone shift: same UTC entries placed in different `tz` produce different `weekDays`
- Top-5 limiting + sortOrder

`app/lib/dashboard-svg.test.ts`:

- Snapshot test of `renderDashboardSvg` for a fixed seed of data in both color and bw modes (catches accidental visual regressions)
- The SVG output is checked to be valid XML and to contain expected text strings

PNG rendering itself doesn't get a unit test — we trust resvg-wasm. A single smoke test that confirms `renderDashboardPng` produces a PNG with PNG magic bytes (`89 50 4E 47`) is enough.

## Visual reference

Locked layout: `.superpowers/brainstorm/3592-1779868521/content/c1-v4.html` (kept for reference; the spec is the source of truth from here).

Considered alternative: `.superpowers/brainstorm/3592-1779868521/content/saved-c2.html` — 2×2 cards with per-card heatmap. Drops a per-row stat density gain for better individual habit detail. Filed in case the row layout proves cramped in real data.

## Out of scope (for now)

- Per-metric "show on dashboard" flag — relying on `sortOrder` top-5 for now (decision: option A from brainstorm)
- True Floyd-Steinberg dithering of color photos / gradients (not needed; layout is geometric)
- 4-gray-tone rendering — sticking with 1-bit + patterns
- Multi-device profiles (different sizes) — current spec is 400×300 only
- Plain HTML/`/dashboard` not embedded in the app shell (e.g. a kiosk variant) — can add later
- Dynamic refresh / SSE for the HTML view — page is static, refresh manually
