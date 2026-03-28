# Logr — Mobile-First Daily Metrics Tracker

## Overview

Logr is a mobile-first web app for tracking daily personal metrics (habits, measurements, counts). It runs on Cloudflare Pages with D1 as the database, targets 375px as the primary viewport, and exposes a REST API for integrations.

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | Remix (Cloudflare Workers template) | First-class CF Workers support, loader/action model fits CRUD |
| Database | Cloudflare D1 (SQLite) | Free, zero-config, native to Workers |
| ORM | Drizzle | Type-safe, lightweight, excellent D1 support |
| Auth | JWT in httpOnly cookie (jose) | Stateless, no session table, works in Workers |
| Passwords | bcryptjs (pure JS) | No native deps, works in Workers runtime |
| Styling | Tailwind CSS | Utility-first, built-in dark mode, mobile-first |
| Testing | Vitest + Miniflare | Fast, D1-compatible test environment |
| Drag & Drop | @dnd-kit/core | Lightweight, accessible, React-based |
| Deployment | Cloudflare Pages + GitHub integration | Push to main triggers automatic build & deploy |

No heavy charting libraries. Heatmap is CSS grid. No component library.

## Data Model

### users

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY |
| email | TEXT | UNIQUE NOT NULL |
| password_hash | TEXT | NOT NULL |
| created_at | TEXT | NOT NULL (ISO 8601) |

### api_keys

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY |
| user_id | INTEGER | NOT NULL, FK → users(id) |
| key_hash | TEXT | NOT NULL (SHA-256) |
| created_at | TEXT | NOT NULL |
| last_used_at | TEXT | nullable |
| active | INTEGER | NOT NULL DEFAULT 1 |

### metrics

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY |
| user_id | INTEGER | NOT NULL, FK → users(id) |
| name | TEXT | NOT NULL |
| type | TEXT | NOT NULL (boolean, volume, weight, count, energy, duration, distance, percent) |
| unit | TEXT | nullable (null for boolean) |
| goal | REAL | nullable (required for non-boolean, null for boolean) |
| sort_order | INTEGER | NOT NULL DEFAULT 0 |
| archived | INTEGER | NOT NULL DEFAULT 0 |
| created_at | TEXT | NOT NULL |

### metric_entries

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY |
| metric_id | INTEGER | NOT NULL, FK → metrics(id) |
| date | TEXT | NOT NULL (YYYY-MM-DD) |
| value | REAL | NOT NULL |
| created_at | TEXT | NOT NULL |
| updated_at | TEXT | NOT NULL |
| | | UNIQUE(metric_id, date) |

### Metric Types and Units

| Type | Unit Options | Value Stored |
|------|-------------|--------------|
| boolean | (none) | 1 or 0 |
| volume | liters, milliliters | numeric |
| weight | kilograms, grams, pounds | numeric |
| count | count | numeric integer |
| energy | kilocalories, kilojoules | numeric |
| duration | minutes, hours | numeric |
| distance | kilometers, miles, meters | numeric |
| percent | % | numeric 0-100 |

Type and unit are immutable after metric creation.

## Authentication

### Sign Up
1. POST email + password (min 8 chars)
2. Hash password with bcryptjs
3. Insert user
4. Generate JWT (`{ userId, email }`, 7-day expiry) via jose
5. Set as httpOnly, secure, sameSite=lax cookie
6. Redirect to Today View

### Log In
1. POST email + password
2. Find user by email, bcrypt compare
3. Same JWT + cookie flow
4. Redirect to Today View

### Auth Middleware
- Every loader/action (except login/signup) verifies JWT from cookie
- Invalid/expired → redirect to login
- Valid → userId available in context

### Log Out
- Clear cookie, redirect to login

### No Password Reset
Not implemented. If needed, reset directly via `wrangler d1 execute`.

### JWT Secret
Stored as Cloudflare Workers secret (`JWT_SECRET`).

## UI/UX Screens

### Design Principles
- Mobile-first: 375px primary target, scale up gracefully
- Large touch targets: minimum 44px
- Bottom-anchored primary actions on mobile
- No unnecessary animations, snappy transitions only
- Pastel color palette: soft, low-saturation tones (lavender, mint, peach, sky blue)
- Slightly deeper pastel shade as accent color
- Light mode: warm off-white background (not stark white)
- Dark mode: muted dark tone background (not pure black), desaturated pastels
- CSS custom properties for theme switching via prefers-color-scheme
- System font stack

### Login / Sign Up
- Single page with tab toggle between Login and Sign Up
- Two fields: email, password. One submit button.
- Error messages inline below the form
- Centered card layout

### Today View (Home)
- Top bar: app name (left), settings gear icon (right)
- Date navigation bar: left arrow, date display (e.g. "Fri, Mar 28"), right arrow
  - Today is highlighted/bold
  - Arrows navigate past/future days, capped at today
  - Same view works for any selected day (history)
- Metric list:
  - Boolean: name (left), toggle switch (right). Tap to flip.
  - Numeric: name (left), current value or "—" (right). Tap value area for inline number input with save button.
  - Drag handle on left edge for reordering
  - Tapping metric name → Metric Detail View
- "Add Metric" button fixed at bottom, full-width, pastel accent

### Metric Detail View
- Header: metric name, type badge, unit, goal
- Heatmap (CSS grid): Mon-Sun rows x week columns, last ~9 weeks
  - Boolean: green = done, gray = missed, no entry = empty
  - Numeric: color intensity scales min to max; cells meeting/exceeding goal at full intensity
- Stats section (varies by type):
  - Boolean: current streak, longest streak, completion rate (%), total days done
  - Numeric: average, min, max, total (sum), trend (up/down/flat over 30 days), days tracked, days goal met, goal hit rate (%)
- Raw entries table: date, value, editable

### Add / Edit Metric Modal
- Bottom sheet slide-up on mobile
- Fields: name, type selector, unit selector (filtered by type), goal input
- Boolean: goal input hidden
- Edit mode: type and unit locked (shown disabled). Only name and goal editable.

### Settings View
- Full page, accessed from gear icon
- Sections:
  - **Metrics**: list with rename, archive, delete actions
  - **API Key**: masked display (`logr_****...****`), rotate button, copy button
  - **Account**: log out, delete account

## REST API

### Base URL
`/api/v1`

### Authentication
All endpoints require `Authorization: Bearer logr_xxx` header.
Key is SHA-256 hashed and looked up in api_keys table.
Invalid/inactive key → 401.

### Rate Limiting
100 requests per minute per API key. Tracked in-memory per isolate.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /metrics | List all user's active metrics (id, name, type, unit) |
| GET | /metrics/:id | Single metric detail |
| GET | /metrics/:id/entries?from=&to= | Entries for a metric in date range |
| POST | /metrics/:id/entries | Create or update entry `{ date, value }` |
| DELETE | /metrics/:id/entries/:date | Delete an entry |
| GET | /entries?from=&to= | All entries across all metrics in date range |

### Response Format
```json
{ "ok": true, "data": { ... } }
```

### Error Format
```json
{ "ok": false, "error": { "code": "NOT_FOUND", "message": "Metric not found" } }
```

### Date Handling
- Format: YYYY-MM-DD
- Default range: last 7 days if from/to omitted
- Max range: 365 days

### Implementation
Remix resource routes under `app/routes/api.v1.*` returning JSON only.

## API Key Management

- Format: `logr_` + 32 random bytes as hex (69 chars total)
- Storage: SHA-256 hash only in database
- One active key per user at a time
- Generated on demand in Settings. Full key shown once with copy button and warning.
- Rotate: generates new key, deactivates old one, shows new key once
- Display in settings: `logr_****...xxxx` (prefix + last 4 hex chars of the key)
- Generation: `crypto.getRandomValues()` (Workers runtime)

## Deployment

- Cloudflare Pages connected to GitHub repo
- Push to `main` → automatic build & deploy
- Build command: `npm run build`
- D1 binding in `wrangler.toml`
- Migrations: `wrangler d1 migrations apply` (manual or CI)
- JWT_SECRET: `wrangler secret put JWT_SECRET`

## Project Structure

```
app/
  routes/
    _auth.login.tsx           # Login/signup page
    _app.tsx                  # Authenticated layout (nav, date bar)
    _app._index.tsx           # Today view
    _app.metrics.$id.tsx      # Metric detail view
    _app.settings.tsx         # Settings page
    api.v1.metrics.tsx        # API: list metrics
    api.v1.metrics.$id.tsx    # API: single metric + entries
    api.v1.entries.tsx         # API: all entries
  components/                 # Shared UI components
  lib/
    db.server.ts              # Drizzle client + schema
    auth.server.ts            # JWT helpers, password hashing
    api-key.server.ts         # API key generation, hashing, validation
    stats.server.ts           # Stats calculation logic
  db/
    schema.ts                 # Drizzle schema definitions
    migrations/               # D1 migrations
tailwind.config.ts
wrangler.toml
```

## Testing

- Vitest + Miniflare for API endpoint tests
- Unit tests for stats calculation logic
- Run with `npm test`

## Security Checklist

- Passwords hashed with bcryptjs
- API keys hashed with SHA-256
- JWT in httpOnly, secure, sameSite=lax cookies
- All inputs sanitized
- All queries parameterized (via Drizzle)
- No secrets in client bundles
