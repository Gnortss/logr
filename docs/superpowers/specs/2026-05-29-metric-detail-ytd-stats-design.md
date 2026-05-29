# Metric detail page: YTD stats, today-aware streak, single-page layout

**Date:** 2026-05-29
**Status:** Design
**Route affected:** `app/routes/_app.metrics.$id.tsx`

## Problem

The metric detail page currently:

1. Computes stats over a rolling 9-week window (`today − 62 days` to `today`), which is not what the user wants. Stats should reflect performance for the **current calendar year**.
2. Treats the current day as a normal streak day. If a user has not yet logged today, their streak resets to 0 — but the day is still ongoing, so this is misleading.
3. Splits content across `heatmap` / `stats` tabs and shows a separate entries table below. The user wants a single scrollable view with stats above the heatmap, and the entries table removed.

## Goals

- Stats range = year-to-date (Jan 1 of current year → today).
- Current streak ignores today unless today is logged with a successful value.
- Single-page layout: header → stats → heatmap. No tabs, no entries table.

## Non-goals

- Heatmap range stays at ~9 weeks (`today − 62`). Not changing.
- No new affordance for editing past entries on this page. Past entries are edited from the main dashboard by navigating to the relevant date.
- Weekly-boolean stats may show a partial first week when Jan 1 falls mid-week (the week containing Jan 1 has fewer than 7 days of eligible entries). Accepted as a known cosmetic issue — not worth reshaping `computeWeeklyBooleanStats`.

## Changes

### 1. Date helper (`app/lib/date.ts`)

Add a pure string helper:

```ts
export function startOfYear(dateStr: string): string {
  return `${dateStr.slice(0, 4)}-01-01`;
}
```

Consistent with the file's existing string-based UTC style.

### 2. Streak (`app/lib/streak.ts`)

Modify `computeCurrentStreak` so today is skipped unless successful:

- If `successByDate.get(todayDate) === true`: start cursor at `todayDate` (today contributes).
- Otherwise: start cursor at `addDays(todayDate, -1)` (today neither breaks nor contributes).
- Walk backwards as before (`while successByDate.get(cursor) === true`, increment streak, step back one day).

This applies app-wide. The dashboard streak (`app/lib/dashboard.ts`) automatically gets the same behavior, which is desired for consistency.

### 3. Route loader (`app/routes/_app.metrics.$id.tsx`)

In the loader, after resolving `metric`:

```ts
const to = today();
const statsFrom = startOfYear(to);
const heatmapFrom = addDays(to, -62);
const fetchFrom = statsFrom < heatmapFrom ? statsFrom : heatmapFrom;
```

(`fetchFrom` covers both ranges. After early March, `statsFrom` (Jan 1) is the earlier date. Before that, `heatmapFrom` reaches into the prior year and is earlier than `statsFrom`.)

Fetch entries between `fetchFrom` and `to`. Then:

- For boolean and weekly-boolean: pass `statsFrom` as the `from` argument.
- For numeric (`computeNumericStats`, `computeTrend`): filter the entries array to `[statsFrom, to]` before passing, since those functions operate on the entries directly without a range argument.

Loader returns `{ metric, entries, stats, trend, heatmapFrom, to }`. (Stats are already aggregated; the raw entries list returned is only used by the heatmap, so it can be the full set — the heatmap filters internally via its `from`/`to` props.)

### 4. Route component (`app/routes/_app.metrics.$id.tsx`)

- Remove `useState` import and the `tab` state.
- Remove `EntriesTable` import and usage.
- Remove the tabs bar JSX.
- Render order inside the main scroll area:
  1. Header (unchanged).
  2. `StatsPanel` — same branching logic that's already there (`weekly-boolean` / `boolean` / `numeric`).
  3. `Heatmap` with `from={heatmapFrom}` `to={to}`.

### 5. Route action (`app/routes/_app.metrics.$id.tsx`)

Remove the entire `action` function. Its only handler (`intent === "update-entry"`) existed solely for `EntriesTable`'s inline edit. The dashboard log flow uses `/api/v1/...` routes; nothing else posts to this route.

### 6. Tests

`tests/lib/streak.test.ts`:

- Update existing case `"returns 0 if today is not successful"`: with the new semantics, a successful prior day with a failed today should return **1** (not 0). Rename and reframe the assertion.
- Add: today missing, prior day successful → streak counts back from yesterday.
- Add: today successful → today included in streak count.
- Add: today failed AND yesterday failed → 0.

`tests/lib/stats.test.ts`:

- Re-run; any case that asserts streak behavior through `computeBooleanStats` may need updated expectations to match the new streak rule.

## Risks

- Removing the route `action` is irreversible in the sense that any future inline-edit feature on this page would need to add it back. Acceptable because the action body is trivial.
- Changing `computeCurrentStreak` semantics changes the dashboard display too. This is intentional but worth confirming visually after deploy.

## Out of scope

- Heatmap range changes.
- Inline edit affordance on the metric detail page.
- Reshaping weekly-boolean stats around the Jan 1 boundary.
