# Logr UI Restyle: Digital Conservatory

## Overview

Restyle all Logr pages to match the "Lumiere Organic / Digital Conservatory" design system from Stitch, keeping all existing functionality intact. No new features, no functionality changes — purely a visual skin swap.

**Target screens:** "Today (Refined)" and "Deep Insights (No Nav)" from Stitch project `11946778515780719389`. The favourited design system is "Lumiere Organic" (Digital Conservatory).

**Approach:** Theme-Layer Swap — replace Tailwind theme tokens and update component markup to match the new visual patterns while preserving the existing component files and route structure.

---

## 1. Theme Tokens

Replace the entire `@theme` block in `app/styles/tailwind.css` with the Digital Conservatory palette. Remove the dark mode `@media (prefers-color-scheme: dark)` block entirely (design system is light-only).

### Fonts

Load via Google Fonts (added to `root.tsx` `<head>`):
- **Manrope** (weights: 600, 700) — headlines and display text
- **Plus Jakarta Sans** (weights: 400, 500, 600, 700) — body, labels, everything else

Tailwind tokens:
- `--font-sans`: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif
- `--font-heading`: "Manrope", ui-sans-serif, system-ui, sans-serif

### Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--color-primary` | `#334537` | Primary actions, active states, logo |
| `--color-primary-container` | `#4a5d4e` | Gradients, dark cards |
| `--color-primary-fixed` | `#d3e8d5` | Light tinted backgrounds |
| `--color-primary-fixed-dim` | `#b7ccb9` | Muted green accents |
| `--color-bg` | `#fbf9f5` | Universal page background |
| `--color-bg-card` | `#ffffff` | Card backgrounds (surface-container-lowest) |
| `--color-surface-dim` | `#dbdad6` | Inactive/disabled states |
| `--color-surface-container` | `#efeeea` | Mid-level surface |
| `--color-surface-container-low` | `#f5f3ef` | Subtle section backgrounds |
| `--color-surface-container-high` | `#eae8e4` | Input field backgrounds, hover states |
| `--color-surface-container-highest` | `#e4e2de` | Prominent interactive zones |
| `--color-text` | `#1b1c1a` | Primary text (never pure black) |
| `--color-text-muted` | `#434843` | Secondary text, labels, metadata |
| `--color-outline` | `#737872` | Icons, subtle elements |
| `--color-outline-variant` | `#c3c8c1` | Ghost borders (at 15% opacity only) |
| `--color-success` | `#334537` | Goal met (same as primary) |
| `--color-danger` | `#ba1a1a` | Destructive actions, errors |
| `--color-secondary` | `#5b6054` | Secondary text/actions |
| `--color-secondary-container` | `#dde2d3` | Badges, pills, secondary backgrounds |
| `--color-tertiary` | `#464136` | Tertiary accents |
| `--color-tertiary-container` | `#5e584c` | Tertiary containers |

### Spacing & Roundness

Design system uses `ROUND_EIGHT` roundness. Practical mapping:
- Cards: `rounded-xl` (1rem)
- Buttons (primary): `rounded-full` (pill)
- Inputs: `rounded-lg` (0.5rem)
- Heatmap cells: `rounded-sm` (0.25rem)
- Bottom sheets: `rounded-t-2xl`

### Meta theme-color

Update `root.tsx` meta theme-color from `#9b8ec4` to `#334537`.

---

## 2. Layout & Header (`_app.tsx`)

- Remove `border-b` from header (No-Line rule)
- Header background: `surface-container-low` (`#f5f3ef`) for tonal separation from `bg`
- Logo: small leaf/dot icon + "Logr" in `font-heading` (Manrope), `font-semibold`, `text-primary`
- Settings icon: `outline` color (`#737872`)
- Main content: `max-w-lg mx-auto` (unchanged)

---

## 3. Auth Layout & Login (`_auth.tsx`, `_auth.login.tsx`)

- Background: `bg` (`#fbf9f5`)
- Card: `bg-card` (white), `rounded-xl`, no border (tonal contrast provides lift)
- "Logr" heading: `font-heading` (Manrope), `text-primary`
- Login/signup toggle: active tab = `primary` fill with white text; inactive = `surface-container-high` with muted text. No borders.
- Input fields: `surface-container-high` background, no border, `rounded-lg`
- Primary button: `primary` fill, white text, `rounded-full`
- Error text: `danger` color

---

## 4. Today Page / Home (`_app._index.tsx`)

### Date Navigation (replaces `date-nav.tsx`)

Transform from prev/next arrows to a **horizontal week strip**:
- Shows 7 days (Mon–Sun) of the current week as columns
- Each column: 3-letter day abbreviation (MON, TUE...) on top, date number below
- Active day: `primary` (`#334537`) filled `rounded-lg` square with white text
- Other days: plain text in `text-muted`
- Tapping a day navigates to that date
- If viewing a non-current-week date, arrows appear to navigate between weeks

### Section Header

- "Core Metrics" in `font-heading` (Manrope), `text-lg`, `font-semibold`
- Right-aligned: "X active goals" in `text-muted`, `text-sm`

### Metric Rows (replaces `metric-row.tsx` visual pattern)

Each metric is a **tonal card** instead of a divided list row:
- Card: `bg-card` (white) on `bg` background — tonal lift, no borders
- `rounded-xl`, padding `p-4`
- Spacing between cards: `gap-3`
- Left side:
  - Metric name: `font-heading` (Manrope), `font-semibold`, `text-base`
  - Status subtitle: Plus Jakarta Sans, `text-sm`, `text-muted`
    - Numeric not met: "Current: {value} / Goal: {goal}"
    - Numeric met: "Goal Met - {value} {unit}"
    - Boolean done: "Goal Met - {formatted value}"
    - Boolean not done: "Not tracked"
- Right side:
  - Goal met: filled `primary` circle (32px) with white checkmark SVG
  - Numeric not met: pill badge showing "{remaining} LEFT" in `surface-container-high` background, `text-sm`, `rounded-full`
  - Boolean not done: empty circle outline in `outline-variant`
- Tapping the card body (name/subtitle area) navigates to `/metrics/:id`
- Tapping the right-side pill/circle triggers the existing inline edit behavior (numeric input for numbers, toggle for booleans)
- Drag handle: styled in `outline-variant`, same position

### Add Metric Button

- Fixed bottom: `primary` background, white text, `rounded-full`
- Full width within max-w-lg container

### Metric Form (bottom sheet, `metric-form.tsx`)

- Backdrop overlay stays
- Sheet: `bg-card`, `rounded-t-2xl`, no border
- Input fields: `surface-container-high` background, no border, `rounded-lg`
- Primary (submit) button: `primary` fill, `rounded-full`
- Cancel button: `surface-container-high` background, `rounded-full`

---

## 5. Metric Detail Page (`_app.metrics.$id.tsx`)

### Header

- Back arrow icon + page title in `font-heading` (Manrope), `text-xl`
- Title: metric name or "Deep Insights"
- Right side: small circular icon (metric type indicator) in `surface-container-high` circle

### Stats Row

Top of page, 3-column layout (for numeric metrics):
- Labels: uppercase `text-xs`, `font-semibold`, `text-muted` (AVERAGE / PEAK / TOTAL or relevant stats)
- Values: `font-heading` (Manrope), `text-2xl`, `font-bold`
- Unit/delta below in `text-muted`, `text-xs`
- Container: `surface-container-low` card, `rounded-xl`, `p-4`

For boolean metrics, show 2x2 grid: Current Streak / Longest Streak / Total Days / Completion Rate.

### Heatmap (`heatmap.tsx`)

- Section title: metric name in `font-heading`, `font-semibold`
- Subtitle: "Consistency over the last 12 months" (or "last 9 weeks" matching current data range)
- Legend strip: "LESS" + 5 gradient squares + "MORE", right-aligned
- Month labels above month groupings
- Cell colors (green palette):
  - Empty: `surface-container-highest` (`#e4e2de`)
  - Low: `primary-fixed` (`#d3e8d5`)
  - Medium: `primary-fixed-dim` (`#b7ccb9`)
  - High: `primary-container` (`#4a5d4e`)
  - Max/goal met: `primary` (`#334537`)
- Cells: `rounded-sm`

### Streaks Section

Two side-by-side cards:
- "LONGEST STREAK" / "CURRENT STREAK" as uppercase `label-sm`
- Number: `font-heading`, `text-3xl`, `font-bold`
- "Days" label below
- Card: `bg-card` (white), `rounded-xl`

### Completion Rate

Dark card:
- Background: `primary` (`#334537`)
- "COMPLETION RATE" in uppercase, white, `text-xs`
- Percentage: white, `font-heading`, `text-3xl`, `font-bold`
- Right side: circular progress ring (SVG) in white/primary-fixed

### Entries Table (`entries-table.tsx`)

- Remove `divide-y` dividers
- Each entry row: `surface-container-low` background, `rounded-lg`, `mb-2`
- Date in `text-muted`, value in `text-text`, `font-medium`
- Edit inputs: `surface-container-high` background, no border

---

## 6. Settings Page (`_app.settings.tsx`)

- Back link: "← Back" in `primary` color, `font-heading` weight
- Section titles: `font-heading` (Manrope), `text-lg`, `font-semibold`
- Metric list items: `bg-card` cards, `rounded-xl`, no borders
- Type badge: `secondary-container` (`#dde2d3`) pill, `rounded-full`
- Action buttons (Edit/Archive/Delete): text-only, no containers. Edit = `primary`, Archive = `text-muted`, Delete = `danger`
- Archived metrics: same cards but with `opacity-60`
- API key section: cards with `bg-card`, `rounded-xl`, no borders. New key alert uses `primary-fixed` background instead of accent border
- Account section:
  - "Log Out": `surface-container-high` background, `rounded-xl`, no border
  - "Delete Account": `danger` text, no fill, `rounded-xl`
  - Confirm delete: `danger` fill, white text

---

## 7. Error Boundary (`root.tsx`)

- Status code: `font-heading`, `text-primary`
- Error state: `danger` color for error heading
- Background: `bg`

---

## Design Principles Applied

1. **No-Line Rule**: Zero `border-b`, `divide-y`, or `1px solid` for sectioning. All boundaries via tonal shifts.
2. **Tonal Layering**: Depth via surface tier stacking, not shadows.
3. **Ghost Borders**: If accessibility requires a container edge, use `outline-variant` at 15% opacity only.
4. **Typography hierarchy**: Large Manrope headlines paired with small Plus Jakarta Sans labels for editorial contrast.
5. **No pure black**: All text uses `on-surface` (`#1b1c1a`), never `#000000`.
6. **Generous spacing**: `gap-3` between cards, `p-4` internal padding minimum.
