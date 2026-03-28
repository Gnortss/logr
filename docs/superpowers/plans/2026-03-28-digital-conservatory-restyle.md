# Digital Conservatory Restyle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle all Logr UI pages to match the "Lumiere Organic / Digital Conservatory" design system from Stitch, preserving all existing functionality.

**Architecture:** Theme-layer swap — replace Tailwind CSS tokens and update component markup across all pages. No logic changes, no new routes, no schema changes. The design system uses Manrope for headlines, Plus Jakarta Sans for body text, a moss-green/cream palette, tonal layering (no borders), and generous rounded corners.

**Tech Stack:** React Router v7, Tailwind CSS v4, TypeScript, Google Fonts

**Spec:** `docs/superpowers/specs/2026-03-28-digital-conservatory-restyle.md`

---

### Task 1: Theme Tokens & Fonts

**Files:**
- Modify: `app/styles/tailwind.css`
- Modify: `app/root.tsx`

- [ ] **Step 1: Replace tailwind.css theme**

Replace the entire contents of `app/styles/tailwind.css` with:

```css
@import "tailwindcss";

@theme {
  --font-sans: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif,
    "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
  --font-heading: "Manrope", ui-sans-serif, system-ui, sans-serif;
  --color-primary: #334537;
  --color-primary-container: #4a5d4e;
  --color-primary-fixed: #d3e8d5;
  --color-primary-fixed-dim: #b7ccb9;
  --color-bg: #fbf9f5;
  --color-bg-card: #ffffff;
  --color-surface-dim: #dbdad6;
  --color-surface-container: #efeeea;
  --color-surface-container-low: #f5f3ef;
  --color-surface-container-high: #eae8e4;
  --color-surface-container-highest: #e4e2de;
  --color-text: #1b1c1a;
  --color-text-muted: #434843;
  --color-outline: #737872;
  --color-outline-variant: #c3c8c1;
  --color-success: #334537;
  --color-danger: #ba1a1a;
  --color-secondary: #5b6054;
  --color-secondary-container: #dde2d3;
  --color-tertiary: #464136;
  --color-tertiary-container: #5e584c;
}
```

- [ ] **Step 2: Add Google Fonts and update meta in root.tsx**

In `app/root.tsx`, update the `meta` function:

```tsx
export function meta() {
  return [
    { title: "Logr" },
    { name: "description", content: "Mobile-first daily metrics tracker" },
    { name: "theme-color", content: "#334537" },
  ];
}
```

In the `Layout` component's `<head>`, add the Google Fonts preconnect and stylesheet links before `<Meta />`:

```tsx
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

- [ ] **Step 3: Update ErrorBoundary colors in root.tsx**

Replace the ErrorBoundary component in `app/root.tsx`:

```tsx
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (isRouteErrorResponse(error)) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-4xl font-bold font-heading text-primary mb-2">{error.status}</h1>
          <p className="text-text-muted">{error.statusText || "Page not found"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold font-heading text-danger mb-2">Error</h1>
        <p className="text-text-muted">Something went wrong</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify the app still loads**

Run: `npm run dev`

Open in browser. The page should render with the new cream background (`#fbf9f5`) and Manrope/Plus Jakarta Sans fonts. Colors will look broken on components — that's expected at this stage.

- [ ] **Step 5: Commit**

```bash
git add app/styles/tailwind.css app/root.tsx
git commit -m "feat: replace theme tokens with Digital Conservatory palette and fonts"
```

---

### Task 2: App Layout & Header

**Files:**
- Modify: `app/routes/_app.tsx`

- [ ] **Step 1: Restyle the header and layout**

Replace the entire default export in `app/routes/_app.tsx`:

```tsx
export default function AppLayout() {
  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-10 bg-surface-container-low px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-primary">
            <path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8z"/>
          </svg>
          <span className="text-xl font-semibold font-heading text-primary">Logr</span>
        </Link>
        <Link to="/settings" className="p-2 rounded-lg hover:bg-surface-container-high transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Settings">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-outline">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </Link>
      </header>
      <main className="max-w-lg mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
```

Key changes: removed `border-b border-border`, changed `bg-bg-card` to `bg-surface-container-low`, added leaf icon, changed font classes to `font-heading text-primary`, settings icon color to `text-outline`.

- [ ] **Step 2: Verify header renders correctly**

Run the dev server. Header should show: leaf icon + "Logr" in moss green Manrope, subtle warm-cream header background, no bottom border, settings gear in grey.

- [ ] **Step 3: Commit**

```bash
git add app/routes/_app.tsx
git commit -m "feat: restyle app header with Digital Conservatory theme"
```

---

### Task 3: Date Navigation (Week Strip)

**Files:**
- Modify: `app/components/date-nav.tsx`
- Modify: `app/lib/date.ts` (add helper)

- [ ] **Step 1: Add week helpers to date.ts**

Add these functions to the end of `app/lib/date.ts`:

```ts
export function getWeekDays(dateStr: string): string[] {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = date.getUTCDay(); // 0=Sun
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = addDays(dateStr, mondayOffset);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function formatDayAbbr(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }).toUpperCase();
}

export function formatDayNum(dateStr: string): number {
  return parseInt(dateStr.split("-")[2], 10);
}
```

- [ ] **Step 2: Rewrite date-nav.tsx as a week strip**

Replace the entire contents of `app/components/date-nav.tsx`:

```tsx
import { useNavigate } from "react-router";
import { getWeekDays, formatDayAbbr, formatDayNum, today as getToday, addDays } from "~/lib/date";

interface DateNavProps {
  date: string;
}

export function DateNav({ date }: DateNavProps) {
  const navigate = useNavigate();
  const todayStr = getToday();
  const weekDays = getWeekDays(date);
  const todayWeek = getWeekDays(todayStr);
  const isCurrentWeek = weekDays[0] === todayWeek[0];

  function goTo(newDate: string) {
    if (newDate === getToday()) {
      navigate("/");
    } else {
      navigate(`/?date=${newDate}`);
    }
  }

  function goToPrevWeek() {
    goTo(addDays(weekDays[0], -7));
  }

  function goToNextWeek() {
    goTo(addDays(weekDays[0], 7));
  }

  const isToday = date === todayStr;

  return (
    <div className="px-4 pt-4 pb-2">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold font-heading text-text">
          {isToday ? "Today" : new Date(date + "T00:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" })}
        </h1>
        {!isCurrentWeek && (
          <div className="flex gap-1">
            <button
              onClick={goToPrevWeek}
              className="p-2 rounded-lg hover:bg-surface-container-high transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Previous week"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
                <path d="m15 18-6-6 6-6"/>
              </svg>
            </button>
            <button
              onClick={goToNextWeek}
              className="p-2 rounded-lg hover:bg-surface-container-high transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Next week"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
                <path d="m9 18 6-6-6-6"/>
              </svg>
            </button>
          </div>
        )}
      </div>
      <div className="flex justify-between">
        {weekDays.map((day) => {
          const isActive = day === date;
          const isFuture = day > todayStr;
          return (
            <button
              key={day}
              onClick={() => !isFuture && goTo(day)}
              disabled={isFuture}
              className={`flex flex-col items-center gap-1 py-2 px-2 min-w-[44px] rounded-xl transition-colors ${
                isActive
                  ? "bg-primary text-white"
                  : isFuture
                  ? "text-surface-dim cursor-not-allowed"
                  : "text-text-muted hover:bg-surface-container-high"
              }`}
            >
              <span className="text-[11px] font-semibold tracking-wide">
                {formatDayAbbr(day)}
              </span>
              <span className={`text-base font-semibold ${isActive ? "text-white" : ""}`}>
                {formatDayNum(day)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify the week strip renders**

Run dev server. The home page should show "Today" heading with a horizontal week strip below it. The current day should be highlighted with a dark green rounded square. Future days should be dimmed. Tapping a past day should navigate to that date.

- [ ] **Step 4: Commit**

```bash
git add app/lib/date.ts app/components/date-nav.tsx
git commit -m "feat: replace date nav with horizontal week strip"
```

---

### Task 4: Metric Rows (Card Style)

**Files:**
- Modify: `app/components/metric-row.tsx`
- Modify: `app/routes/_app._index.tsx`

- [ ] **Step 1: Rewrite metric-row.tsx with card layout**

Replace the entire contents of `app/components/metric-row.tsx`:

```tsx
import { useFetcher, Link } from "react-router";
import { useState } from "react";
import type { MetricType } from "~/lib/types";

interface MetricRowProps {
  metric: {
    id: number;
    name: string;
    type: MetricType;
    unit: string | null;
    goal: number | null;
  };
  entry: { value: number } | null;
  date: string;
}

export function MetricRow({ metric, entry, date }: MetricRowProps) {
  if (metric.type === "boolean") {
    return <BooleanRow metric={metric} entry={entry} date={date} />;
  }
  return <NumericRow metric={metric} entry={entry} date={date} />;
}

function CheckCircle() {
  return (
    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    </div>
  );
}

function EmptyCircle() {
  return (
    <div className="w-8 h-8 rounded-full border-2 border-outline-variant flex-shrink-0" />
  );
}

function BooleanRow({ metric, entry, date }: MetricRowProps) {
  const fetcher = useFetcher();
  const isChecked = entry?.value === 1;
  const optimisticChecked =
    fetcher.formData ? fetcher.formData.get("value") === "1" : isChecked;

  const subtitle = optimisticChecked
    ? `Goal Met`
    : "Not tracked";

  return (
    <div className="bg-bg-card rounded-xl p-4 flex items-center gap-3">
      <Link to={`/metrics/${metric.id}`} className="flex-1 min-w-0">
        <div className="font-heading font-semibold text-base text-text">{metric.name}</div>
        <div className="text-sm text-text-muted mt-0.5">{subtitle}</div>
      </Link>
      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="log-entry" />
        <input type="hidden" name="metricId" value={metric.id} />
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="value" value={optimisticChecked ? "0" : "1"} />
        <button type="submit" className="min-w-[44px] min-h-[44px] flex items-center justify-center">
          {optimisticChecked ? <CheckCircle /> : <EmptyCircle />}
        </button>
      </fetcher.Form>
    </div>
  );
}

function NumericRow({ metric, entry, date }: MetricRowProps) {
  const fetcher = useFetcher();
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(entry?.value?.toString() ?? "");

  const goalMet = metric.goal != null && entry?.value != null && entry.value >= metric.goal;
  const remaining = metric.goal != null && entry?.value != null ? Math.max(0, metric.goal - entry.value) : metric.goal;
  const unitLabel = metric.unit ?? "";

  let subtitle: string;
  if (entry?.value == null) {
    subtitle = `Goal: ${metric.goal ?? "—"} ${unitLabel}`.trim();
  } else if (goalMet) {
    subtitle = `Goal Met \u00b7 ${entry.value} ${unitLabel}`.trim();
  } else {
    subtitle = `Current: ${entry.value} / Goal: ${metric.goal} ${unitLabel}`.trim();
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
        <div className="font-heading font-semibold text-base text-text">{metric.name}</div>
        <div className="text-sm text-text-muted mt-0.5">{subtitle}</div>
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
          {remaining != null && entry?.value != null
            ? `${Math.round(remaining)} LEFT`
            : "Log"}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update _app._index.tsx for card layout**

In `app/routes/_app._index.tsx`, make these changes:

Replace the `divide-y divide-border` wrapper and add a section header. Change the metrics list section (inside the `orderedMetrics.length === 0` else branch) from:

```tsx
<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
  <SortableContext items={orderedMetrics.map((m) => m.id)} strategy={verticalListSortingStrategy}>
    <div className="divide-y divide-border">
      {orderedMetrics.map((m) => (
        <SortableMetricRow key={m.id} metric={m} entry={m.entry} date={date} />
      ))}
    </div>
  </SortableContext>
</DndContext>
```

to:

```tsx
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
```

Also update the empty state:

```tsx
<div className="p-8 text-center text-text-muted">
  <p className="mb-2 font-heading font-semibold">No metrics yet.</p>
  <p className="text-sm">Tap "Add Metric" below to get started.</p>
</div>
```

And update the Add Metric button at the bottom:

```tsx
<div className="fixed bottom-0 left-0 right-0 p-4 bg-bg">
  <button
    onClick={() => setShowAddForm(true)}
    className="w-full py-3 bg-primary text-white font-medium rounded-full hover:bg-primary-container transition-colors min-h-[44px] max-w-lg mx-auto block"
  >
    Add Metric
  </button>
</div>
```

- [ ] **Step 3: Update drag handle color in SortableMetricRow**

In the same file, update the drag handle button class in `SortableMetricRow`:

```tsx
<button
  {...attributes}
  {...listeners}
  className="px-2 py-3 text-outline-variant cursor-grab active:cursor-grabbing min-w-[32px] min-h-[44px] flex items-center"
  aria-label="Drag to reorder"
>
```

- [ ] **Step 4: Verify metric cards render**

Run dev server. Home page should show "Core Metrics" header with goal count, and each metric as a white rounded card on cream background. Boolean metrics show checkmark circle or empty circle. Numeric metrics show "X LEFT" pill or checkmark when goal met. No borders anywhere.

- [ ] **Step 5: Commit**

```bash
git add app/components/metric-row.tsx app/routes/_app._index.tsx
git commit -m "feat: restyle metric rows as tonal cards with status indicators"
```

---

### Task 5: Metric Form (Bottom Sheet)

**Files:**
- Modify: `app/components/metric-form.tsx`

- [ ] **Step 1: Restyle the metric form**

Replace the entire contents of `app/components/metric-form.tsx`:

```tsx
import { Form, useNavigation } from "react-router";
import { useState } from "react";
import { METRIC_TYPES, UNITS_BY_TYPE, type MetricType } from "~/lib/types";

interface MetricFormProps {
  open: boolean;
  onClose: () => void;
  metric?: {
    id: number;
    name: string;
    type: MetricType;
    unit: string | null;
    goal: number | null;
  };
}

export function MetricForm({ open, onClose, metric }: MetricFormProps) {
  const isEdit = !!metric;
  const [type, setType] = useState<MetricType>(metric?.type ?? "boolean");
  const units = UNITS_BY_TYPE[type];
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-bg-card rounded-t-2xl p-6 pb-8">
        <h2 className="text-lg font-semibold font-heading text-text mb-4">
          {isEdit ? "Edit Metric" : "Add Metric"}
        </h2>
        <Form method="post" onSubmit={() => setTimeout(onClose, 100)}>
          <input type="hidden" name="intent" value={isEdit ? "edit-metric" : "add-metric"} />
          {isEdit && <input type="hidden" name="metricId" value={metric.id} />}
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-text mb-1">Name</label>
              <input id="name" name="name" type="text" required defaultValue={metric?.name}
                placeholder="e.g. Water intake"
                className="w-full px-3 py-3 rounded-lg bg-surface-container-high text-text placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-text mb-1">Type</label>
              <select id="type" name="type" disabled={isEdit} value={type}
                onChange={(e) => setType(e.target.value as MetricType)}
                className="w-full px-3 py-3 rounded-lg bg-surface-container-high text-text focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50">
                {METRIC_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            {units.length > 0 && (
              <div>
                <label htmlFor="unit" className="block text-sm font-medium text-text mb-1">Unit</label>
                <select id="unit" name="unit" disabled={isEdit} defaultValue={metric?.unit ?? units[0]}
                  className="w-full px-3 py-3 rounded-lg bg-surface-container-high text-text focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50">
                  {units.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            )}
            {type !== "boolean" && (
              <div>
                <label htmlFor="goal" className="block text-sm font-medium text-text mb-1">Daily Goal</label>
                <input id="goal" name="goal" type="number" step="any" required
                  defaultValue={metric?.goal ?? undefined} placeholder="e.g. 3"
                  className="w-full px-3 py-3 rounded-lg bg-surface-container-high text-text placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="flex-1 py-3 rounded-full bg-surface-container-high text-text font-medium min-h-[44px]">
                Cancel
              </button>
              <button type="submit" disabled={isSubmitting}
                className="flex-1 py-3 bg-primary text-white font-medium rounded-full hover:bg-primary-container transition-colors disabled:opacity-50 min-h-[44px]">
                {isSubmitting ? "..." : isEdit ? "Save" : "Add"}
              </button>
            </div>
          </div>
        </Form>
      </div>
    </div>
  );
}
```

Key changes: removed all `border border-border`, inputs use `bg-surface-container-high` with no border, buttons use `rounded-full`, heading uses `font-heading`, removed `border-t` from sheet.

- [ ] **Step 2: Verify the form**

Open the Add Metric form. It should have a clean bottom sheet with no borders, rounded pill buttons, and surface-tinted input fields.

- [ ] **Step 3: Commit**

```bash
git add app/components/metric-form.tsx
git commit -m "feat: restyle metric form bottom sheet"
```

---

### Task 6: Metric Detail Page (Deep Insights)

**Files:**
- Modify: `app/routes/_app.metrics.$id.tsx`
- Modify: `app/components/stats-panel.tsx`
- Modify: `app/components/heatmap.tsx`
- Modify: `app/components/entries-table.tsx`

- [ ] **Step 1: Restyle the metric detail page**

Replace the default export in `app/routes/_app.metrics.$id.tsx`:

```tsx
export default function MetricDetailView() {
  const { metric, entries, stats, trend, from, to } = useLoaderData<typeof loader>();
  const isBoolean = metric.type === "boolean";

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/" className="p-2 -ml-2 rounded-lg hover:bg-surface-container-high transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </a>
          <h2 className="text-xl font-bold font-heading text-text">Deep Insights</h2>
        </div>
        <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center">
          <span className="text-xs font-semibold text-text-muted uppercase">{metric.type.slice(0, 3)}</span>
        </div>
      </div>

      <div className="bg-bg-card rounded-xl p-4">
        <div className="text-lg font-heading font-semibold text-text mb-1">{metric.name}</div>
        {metric.unit && <span className="text-sm text-text-muted">{metric.unit}</span>}
        {metric.goal != null && (
          <span className="text-sm text-text-muted ml-2">Goal: {metric.goal} {metric.unit ?? ""}</span>
        )}
      </div>

      <div>
        <StatsPanel
          type={isBoolean ? "boolean" : "numeric"}
          stats={stats as any}
          {...(!isBoolean && { trend: trend as any, unit: metric.unit })}
        />
      </div>

      <div>
        <Heatmap entries={entries} from={from} to={to} type={metric.type} goal={metric.goal} />
      </div>

      {entries.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold font-heading text-text-muted mb-3 uppercase tracking-wide">Entries</h3>
          <EntriesTable entries={entries} metricId={metric.id} type={metric.type} unit={metric.unit} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Restyle stats-panel.tsx**

Replace the entire contents of `app/components/stats-panel.tsx`:

```tsx
import type { BooleanStats, NumericStats, Trend } from "~/lib/stats.server";

interface BooleanStatsPanelProps {
  type: "boolean";
  stats: BooleanStats;
}

interface NumericStatsPanelProps {
  type: "numeric";
  stats: NumericStats;
  trend: Trend;
  unit: string | null;
}

type StatsPanelProps = BooleanStatsPanelProps | NumericStatsPanelProps;

export function StatsPanel(props: StatsPanelProps) {
  if (props.type === "boolean") {
    return <BooleanStatsPanel stats={props.stats} />;
  }
  return <NumericStatsPanel stats={props.stats} trend={props.trend} unit={props.unit} />;
}

function StatCard({ label, value, sublabel }: { label: string; value: string | number; sublabel?: string }) {
  return (
    <div className="bg-bg-card rounded-xl p-4 text-center">
      <div className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">{label}</div>
      <div className="text-2xl font-bold font-heading text-text">{value}</div>
      {sublabel && <div className="text-xs text-text-muted mt-0.5">{sublabel}</div>}
    </div>
  );
}

function BooleanStatsPanel({ stats }: { stats: BooleanStats }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Current" value={`${stats.currentStreak}`} sublabel="day streak" />
        <StatCard label="Longest" value={`${stats.longestStreak}`} sublabel="day streak" />
        <StatCard label="Total" value={stats.totalDaysDone} sublabel="days done" />
      </div>
      <div className="bg-primary rounded-xl p-4 flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-white/70 uppercase tracking-wide">Completion Rate</div>
          <div className="text-3xl font-bold font-heading text-white">{Math.round(stats.completionRate)}%</div>
        </div>
        <CompletionRing percent={stats.completionRate} />
      </div>
    </div>
  );
}

function NumericStatsPanel({ stats, trend, unit }: { stats: NumericStats; trend: Trend; unit: string | null }) {
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
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Longest Streak" value={stats.daysGoalMet} sublabel="Days" />
        <StatCard label="Current Trend" value={trendIcon} sublabel={trend} />
      </div>
      <div className="bg-primary rounded-xl p-4 flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-white/70 uppercase tracking-wide">Goal Hit Rate</div>
          <div className="text-3xl font-bold font-heading text-white">{Math.round(stats.goalHitRate)}%</div>
        </div>
        <CompletionRing percent={stats.goalHitRate} />
      </div>
    </div>
  );
}

function CompletionRing({ percent }: { percent: number }) {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <svg width="56" height="56" viewBox="0 0 56 56">
      <circle cx="28" cy="28" r={radius} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
      <circle
        cx="28" cy="28" r={radius} fill="none" stroke="white" strokeWidth="4"
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 28 28)"
      />
    </svg>
  );
}
```

- [ ] **Step 3: Restyle heatmap.tsx**

Replace the entire contents of `app/components/heatmap.tsx`:

```tsx
import { addDays } from "~/lib/date";

interface HeatmapProps {
  entries: { date: string; value: number }[];
  from: string;
  to: string;
  type: "boolean" | string;
  goal: number | null;
}

export function Heatmap({ entries, from, to, type, goal }: HeatmapProps) {
  const entryMap = new Map(entries.map((e) => [e.date, e.value]));

  const values = entries.map((e) => e.value).filter((v) => v > 0);
  const minVal = values.length > 0 ? Math.min(...values) : 0;
  const maxVal = values.length > 0 ? Math.max(...values) : 1;

  const fromDate = new Date(from + "T00:00:00Z");
  const dayOfWeek = fromDate.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const gridStart = addDays(from, mondayOffset);

  const cells: { date: string; value: number | null; dayIndex: number; weekIndex: number }[] = [];
  let current = gridStart;
  let weekIndex = 0;

  while (current <= to) {
    const d = new Date(current + "T00:00:00Z");
    const dow = d.getUTCDay();
    const dayIndex = dow === 0 ? 6 : dow - 1;

    if (dayIndex === 0 && cells.length > 0) weekIndex++;

    const val = entryMap.get(current) ?? null;
    const inRange = current >= from && current <= to;
    if (inRange) {
      cells.push({ date: current, value: val, dayIndex, weekIndex });
    }

    current = addDays(current, 1);
  }

  const totalWeeks = weekIndex + 1;
  const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];

  function getCellColor(value: number | null): string {
    if (value === null) return "bg-surface-container-highest";
    if (type === "boolean") {
      return value === 1 ? "bg-primary" : "bg-surface-container-high";
    }
    if (goal != null && value >= goal) return "bg-primary";
    const range = maxVal - minVal;
    const intensity = range > 0 ? (value - minVal) / range : 0.5;
    if (intensity >= 0.75) return "bg-primary";
    if (intensity >= 0.5) return "bg-primary-container";
    if (intensity >= 0.25) return "bg-primary-fixed-dim";
    return "bg-primary-fixed";
  }

  return (
    <div className="bg-bg-card rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold font-heading text-text-muted uppercase tracking-wide">Activity</h3>
        <div className="flex items-center gap-1 text-[10px] text-text-muted">
          <span>LESS</span>
          <div className="w-3 h-3 rounded-sm bg-surface-container-highest" />
          <div className="w-3 h-3 rounded-sm bg-primary-fixed" />
          <div className="w-3 h-3 rounded-sm bg-primary-fixed-dim" />
          <div className="w-3 h-3 rounded-sm bg-primary-container" />
          <div className="w-3 h-3 rounded-sm bg-primary" />
          <span>MORE</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div
          className="inline-grid gap-1"
          style={{
            gridTemplateRows: `repeat(7, 16px)`,
            gridTemplateColumns: `20px repeat(${totalWeeks}, 16px)`,
          }}
        >
          {dayLabels.map((label, i) => (
            <div
              key={`label-${i}`}
              className="text-[10px] text-text-muted flex items-center"
              style={{ gridRow: i + 1, gridColumn: 1 }}
            >
              {i % 2 === 0 ? label : ""}
            </div>
          ))}

          {cells.map((cell) => (
            <div
              key={cell.date}
              className={`rounded-sm ${getCellColor(cell.value)}`}
              style={{
                gridRow: cell.dayIndex + 1,
                gridColumn: cell.weekIndex + 2,
              }}
              title={`${cell.date}: ${cell.value ?? "no entry"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Restyle entries-table.tsx**

Replace the entire contents of `app/components/entries-table.tsx`:

```tsx
import { useFetcher } from "react-router";
import { useState } from "react";
import { formatDateDisplay } from "~/lib/date";

interface EntriesTableProps {
  entries: { date: string; value: number }[];
  metricId: number;
  type: string;
  unit: string | null;
}

export function EntriesTable({ entries, metricId, type, unit }: EntriesTableProps) {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((entry) => (
        <EntryRow key={entry.date} entry={entry} metricId={metricId} type={type} unit={unit} />
      ))}
    </div>
  );
}

function EntryRow({ entry, metricId, type, unit }: {
  entry: { date: string; value: number };
  metricId: number;
  type: string;
  unit: string | null;
}) {
  const fetcher = useFetcher();
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(entry.value.toString());

  const displayValue = type === "boolean"
    ? entry.value === 1 ? "Done" : "Missed"
    : `${entry.value} ${unit ?? ""}`.trim();

  function handleSave() {
    const val = parseFloat(inputValue);
    if (isNaN(val)) return;
    fetcher.submit(
      { intent: "update-entry", metricId: metricId.toString(), date: entry.date, value: val.toString() },
      { method: "post" }
    );
    setEditing(false);
  }

  return (
    <div className="flex items-center py-3 px-4 min-h-[44px] bg-surface-container-low rounded-lg">
      <span className="text-sm text-text-muted w-28">{formatDateDisplay(entry.date)}</span>
      {editing ? (
        <div className="flex items-center gap-2 flex-1 justify-end">
          <input type="number" step="any" value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            autoFocus
            className="w-20 px-3 py-1 rounded-lg bg-surface-container-high text-text text-right text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <button onClick={handleSave} className="text-sm text-primary font-medium">Save</button>
          <button onClick={() => setEditing(false)} className="text-sm text-text-muted">Cancel</button>
        </div>
      ) : (
        <button
          onClick={() => { setInputValue(entry.value.toString()); setEditing(true); }}
          className="flex-1 text-right text-sm text-text font-medium">
          {displayValue}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Verify the detail page**

Navigate to a metric detail page. Should show: back arrow + "Deep Insights" header, stats row with large numbers in Manrope, green-toned heatmap with legend, dark completion rate card with circular progress ring, and tonal entry rows.

- [ ] **Step 6: Commit**

```bash
git add app/routes/_app.metrics.\$id.tsx app/components/stats-panel.tsx app/components/heatmap.tsx app/components/entries-table.tsx
git commit -m "feat: restyle metric detail page as Deep Insights view"
```

---

### Task 7: Settings Page

**Files:**
- Modify: `app/routes/_app.settings.tsx`

- [ ] **Step 1: Restyle the settings page**

Replace the default export `SettingsView` and `ApiKeySection` in `app/routes/_app.settings.tsx`:

```tsx
export default function SettingsView() {
  const { metrics: allMetrics, apiKey } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [editingMetric, setEditingMetric] = useState<typeof allMetrics[0] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);

  const activeMetrics = allMetrics.filter((m) => !m.archived);
  const archivedMetrics = allMetrics.filter((m) => m.archived);

  return (
    <div className="p-4 space-y-8">
      <div>
        <Link to="/" className="text-primary text-sm font-semibold font-heading">← Back</Link>
      </div>

      <section>
        <h2 className="text-lg font-semibold font-heading text-text mb-3">Metrics</h2>
        <div className="space-y-3">
          {activeMetrics.map((m) => (
            <div key={m.id} className="flex items-center justify-between bg-bg-card rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-text font-medium">{m.name}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-secondary-container text-secondary font-medium">{m.type}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditingMetric(m)}
                  className="text-xs text-primary font-medium min-h-[36px] px-2">Edit</button>
                <fetcher.Form method="post">
                  <input type="hidden" name="intent" value="archive-metric" />
                  <input type="hidden" name="metricId" value={m.id} />
                  <button type="submit" className="text-xs text-text-muted font-medium min-h-[36px] px-2">Archive</button>
                </fetcher.Form>
                {confirmDelete === m.id ? (
                  <fetcher.Form method="post">
                    <input type="hidden" name="intent" value="delete-metric" />
                    <input type="hidden" name="metricId" value={m.id} />
                    <button type="submit" className="text-xs text-danger font-medium min-h-[36px] px-2">Confirm</button>
                  </fetcher.Form>
                ) : (
                  <button onClick={() => setConfirmDelete(m.id)}
                    className="text-xs text-danger font-medium min-h-[36px] px-2">Delete</button>
                )}
              </div>
            </div>
          ))}
        </div>

        {archivedMetrics.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium font-heading text-text-muted mb-2">Archived</h3>
            <div className="space-y-3">
              {archivedMetrics.map((m) => (
                <div key={m.id} className="flex items-center justify-between bg-bg-card rounded-xl px-4 py-3 opacity-60">
                  <span className="text-text">{m.name}</span>
                  <fetcher.Form method="post">
                    <input type="hidden" name="intent" value="unarchive-metric" />
                    <input type="hidden" name="metricId" value={m.id} />
                    <button type="submit" className="text-xs text-primary font-medium min-h-[36px] px-2">Restore</button>
                  </fetcher.Form>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold font-heading text-text mb-3">API Key</h2>
        <ApiKeySection apiKey={apiKey} />
      </section>

      <section>
        <h2 className="text-lg font-semibold font-heading text-text mb-3">Account</h2>
        <div className="space-y-3">
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="logout" />
            <button type="submit"
              className="w-full py-3 bg-surface-container-high text-text font-medium rounded-xl min-h-[44px]">
              Log Out
            </button>
          </fetcher.Form>
          {confirmDeleteAccount ? (
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="delete-account" />
              <button type="submit"
                className="w-full py-3 bg-danger text-white font-medium rounded-xl min-h-[44px]">
                Confirm Delete Account
              </button>
            </fetcher.Form>
          ) : (
            <button onClick={() => setConfirmDeleteAccount(true)}
              className="w-full py-3 text-danger font-medium rounded-xl min-h-[44px]">
              Delete Account
            </button>
          )}
        </div>
      </section>

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
          }}
        />
      )}
    </div>
  );
}

function ApiKeySection({ apiKey }: { apiKey: { id: number; createdAt: string; lastUsedAt: string | null } | null }) {
  const fetcher = useFetcher<{ newApiKey?: string }>();
  const [copied, setCopied] = useState(false);
  const newKey = fetcher.data?.newApiKey;

  async function copyKey() {
    if (newKey) {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="space-y-3">
      {newKey ? (
        <div className="bg-primary-fixed rounded-xl p-4">
          <p className="text-xs text-danger font-medium mb-2">
            Copy this key now — it won't be shown again.
          </p>
          <code className="text-sm text-text break-all block mb-3">{newKey}</code>
          <button onClick={copyKey}
            className="px-4 py-2 bg-primary text-white rounded-full text-sm font-medium min-h-[36px]">
            {copied ? "Copied!" : "Copy to Clipboard"}
          </button>
        </div>
      ) : apiKey ? (
        <div className="bg-bg-card rounded-xl p-4">
          <div className="text-sm text-text-muted mb-1">Active Key</div>
          <div className="text-sm text-text font-mono">logr_****...****</div>
          {apiKey.lastUsedAt && (
            <div className="text-xs text-text-muted mt-1">
              Last used: {new Date(apiKey.lastUsedAt).toLocaleDateString()}
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-text-muted">No API key generated yet.</p>
      )}

      <fetcher.Form method="post">
        <input type="hidden" name="intent" value={apiKey ? "rotate-api-key" : "generate-api-key"} />
        <button type="submit"
          className="w-full py-3 bg-surface-container-high text-text font-medium rounded-xl min-h-[44px]">
          {apiKey ? "Rotate Key" : "Generate API Key"}
        </button>
      </fetcher.Form>
    </div>
  );
}
```

Key changes: all `border border-border` removed, type badges use `secondary-container`, buttons use tonal backgrounds, back link uses `font-heading`, API key alert uses `primary-fixed` background.

- [ ] **Step 2: Verify settings page**

Navigate to /settings. Should show: clean tonal cards, no borders, pill-shaped type badges in muted green, properly styled buttons.

- [ ] **Step 3: Commit**

```bash
git add app/routes/_app.settings.tsx
git commit -m "feat: restyle settings page with tonal cards"
```

---

### Task 8: Auth Layout & Login Page

**Files:**
- Modify: `app/routes/_auth.tsx`
- Modify: `app/routes/_auth.login.tsx`

- [ ] **Step 1: Restyle auth layout**

Replace the default export in `app/routes/_auth.tsx`:

```tsx
export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-primary">
            <path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8z"/>
          </svg>
          <h1 className="text-3xl font-bold font-heading text-primary">Logr</h1>
        </div>
        <div className="bg-bg-card rounded-xl p-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
```

Key changes: removed `shadow-sm border border-border`, added leaf icon, font changed to `font-heading text-primary`, card uses `rounded-xl` only.

- [ ] **Step 2: Restyle login page**

Replace the default export in `app/routes/_auth.login.tsx`:

```tsx
export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <>
      <div className="flex mb-6 rounded-full overflow-hidden bg-surface-container-high">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`flex-1 py-2.5 text-center font-medium text-sm transition-colors ${
            mode === "login"
              ? "bg-primary text-white rounded-full"
              : "text-text-muted"
          }`}
        >
          Log In
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`flex-1 py-2.5 text-center font-medium text-sm transition-colors ${
            mode === "signup"
              ? "bg-primary text-white rounded-full"
              : "text-text-muted"
          }`}
        >
          Sign Up
        </button>
      </div>

      <Form method="post">
        <input type="hidden" name="intent" value={mode} />
        <div className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-text mb-1">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email"
              className="w-full px-3 py-3 rounded-lg bg-surface-container-high text-text placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-text mb-1">Password</label>
            <input id="password" name="password" type="password" required minLength={8}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              className="w-full px-3 py-3 rounded-lg bg-surface-container-high text-text placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          {actionData && "error" in actionData && (
            <p className="text-danger text-sm">{actionData.error}</p>
          )}
          <button type="submit" disabled={isSubmitting}
            className="w-full py-3 bg-primary text-white font-medium rounded-full hover:bg-primary-container transition-colors disabled:opacity-50 min-h-[44px]">
            {isSubmitting ? "..." : mode === "login" ? "Log In" : "Sign Up"}
          </button>
        </div>
      </Form>
    </>
  );
}
```

Key changes: tab toggle uses `rounded-full` pill with `surface-container-high` background, inputs use `bg-surface-container-high` with no border, submit button is `rounded-full`.

- [ ] **Step 3: Verify the auth page**

Navigate to /login (logged out). Should show: leaf icon + "Logr" in Manrope, white card on cream background with no border/shadow, pill-shaped tab toggle, borderless inputs, pill-shaped submit button.

- [ ] **Step 4: Commit**

```bash
git add app/routes/_auth.tsx app/routes/_auth.login.tsx
git commit -m "feat: restyle auth pages with Digital Conservatory theme"
```

---

### Task 9: Final Cleanup & Verification

**Files:**
- Review all modified files

- [ ] **Step 1: Remove stale color references**

Search all files for any remaining references to the old theme tokens that no longer exist:

- `bg-accent` → should be `bg-primary`
- `text-accent` → should be `text-primary`
- `accent-dark` → should be `primary-container`
- `ring-accent` → should be `ring-primary`
- `border-border` → remove (no borders) or replace with tonal background
- `divide-border` → remove
- `bg-border` → should be `bg-surface-container-high`

Run: `grep -r "accent\|border-border\|divide-border\|bg-border" app/ --include="*.tsx" --include="*.ts"`

Fix any remaining references.

- [ ] **Step 2: Run the dev server and verify all pages**

Run: `npm run dev`

Check each page:
1. **Login page** (/login) — cream background, white card, pill toggle, borderless inputs
2. **Home page** (/) — week strip, "Core Metrics" header, tonal metric cards, pill Add button
3. **Metric detail** (/metrics/:id) — back arrow, Deep Insights header, stats row, green heatmap, dark completion card
4. **Settings** (/settings) — tonal cards, no borders, pill type badges

- [ ] **Step 3: Run existing tests**

Run: `npx vitest run`

All tests should pass — no logic was changed.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "fix: clean up stale theme token references"
```
