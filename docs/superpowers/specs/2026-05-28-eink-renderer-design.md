# E-ink Renderer Microservice — Design

**Date:** 2026-05-28
**Status:** Approved design, pending implementation plan
**Related:** `docs/superpowers/specs/2026-05-26-eink-dashboard-design.md` (superseded for the rasterization path — `/dashboard.png` no longer in logr; replaced by this microservice)

## Goal

A standalone Node/TypeScript microservice, running in Docker on a LAN, that:

1. Fetches the logr dashboard SVG via API key.
2. Rasterizes it to a 400×300 1-bit buffer suitable for a Waveshare 4.2" e-ink panel.
3. Returns the packed buffer to an ESP32 caller for direct `epd.DrawBitmap` use.

Two render modes are exposed — a hard threshold (crisp text/geometry) and Floyd-Steinberg dithering (smoother gradients) — selected per request.

## Constraints

- **Panel:** Waveshare 4.2" 400×300, 1-bit B/W.
- **Output format:** 15,000-byte buffer (50 bytes × 300 rows), MSB-first within byte, white=1 / black=0, row-major top-left to bottom-right.
- **Runtime:** Node.js 22 on Alpine in Docker. Sharp ships prebuilt for `linux/amd64` and `linux/arm64`.
- **Deployment:** LAN-only. ESP32 reaches the service over local WiFi. No Internet exposure.
- **Auth (caller → service):** none. Network-level trust.
- **Auth (service → logr):** `Authorization: Bearer logr_...` header. API key held in `LOGR_API_KEY` env var.
- **Timezone:** hardcoded via `LOGR_TZ` env var, default `Europe/Ljubljana`. Sent to logr as `?tz=...`.

## Architecture

```
┌──────────┐  GET /frame?mode=dither   ┌────────────────────────┐  GET /dashboard.svg?tz=...   ┌──────────────┐
│  ESP32   │ ─────────────────────────▶│  eink-renderer (Node)  │ ────────────────────────────▶│ logr (Worker)│
│  (LAN)   │ ◀──── 15,000-byte buf ────│  Docker, port 3000     │ ◀──── SVG string ────────────│              │
└──────────┘                           └────────────────────────┘   Authorization: Bearer ...   └──────────────┘
```

**Two pieces of work:**

1. **New repository / directory: `eink-renderer`** — the microservice itself.
2. **Small change to logr:** add `app/routes/dashboard[.svg].tsx` returning the existing BW SVG with API-key auth.

**Trust boundary:** the API key never leaves the microservice container — it's not passed to the ESP32 in any form. The ESP32 hits the renderer with no auth.

**Statefulness:** in-memory cache keyed by render mode, holding `{ buffer, expiresAt }`. Cleared on process restart. No disk, no DB.

## Logr-side change

### New route: `app/routes/dashboard[.svg].tsx`

~25 lines, mirrors the existing `app/routes/dashboard.tsx` but:

- Auth: `requireApiKey(request, db)` (header-only Bearer, existing helper from `app/lib/api-key.server.ts`) instead of `requireAuth`.
- Returns `image/svg+xml` Response with the SVG string instead of JSX.
- Uses `renderDashboardSvg(data, { mode: 'bw' })` (the existing BW renderer).

```ts
export async function loader({ request, context }: Route.LoaderArgs) {
  const db = getDb(context.cloudflare.env.DB);
  const { userId } = await requireApiKey(request, db);
  const url = new URL(request.url);
  const tz = url.searchParams.get("tz") ?? undefined;
  const todayDate = todayInTz(tz);
  const data = await getDashboardData(db, userId, todayDate);
  const svg = renderDashboardSvg(data, { mode: "bw" });
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "no-store",
    },
  });
}
```

No rate limiting on this route (the microservice's cache provides the natural rate limit). No query-string key support — header only.

### Test: `app/routes/dashboard[.svg].test.ts`

- Missing/invalid `Authorization` header → 401.
- Valid header → 200, `Content-Type: image/svg+xml`, body starts with `<svg`.
- `tz` query yields different `weekDays` than UTC for a fixed clock.

## Microservice

### Directory layout

```
eink-renderer/
├── src/
│   ├── server.ts       # Fastify app, routes, startup
│   ├── config.ts       # env var parsing + validation
│   ├── pipeline.ts     # fetch SVG → rasterize → dither/threshold → bit-pack
│   ├── dither.ts       # Floyd-Steinberg on a greyscale buffer
│   └── pack.ts         # 8-bit (0/255) → 1-bit MSB-first packed
├── test/
│   ├── pipeline.test.ts
│   ├── dither.test.ts
│   ├── pack.test.ts
│   └── fixtures/
│       └── test-pattern.svg
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

### Dependencies

Production:
- `fastify` — HTTP framework.
- `sharp` — SVG rasterization, greyscale conversion.

Development:
- `typescript`, `@types/node`
- `vitest`
- `tsx` (for `npm run dev`)

No other runtime dependencies. Floyd-Steinberg and bit-packing are written inline (~40 lines each).

### Configuration (`src/config.ts`)

Read once at startup, fail fast on missing required vars (exit code 1, print which vars are missing).

| Env var | Required | Default | Purpose |
| --- | --- | --- | --- |
| `LOGR_URL` | yes | — | Base URL, e.g. `https://logr.devsoup.xyz` |
| `LOGR_API_KEY` | yes | — | Bearer token for logr |
| `LOGR_TZ` | no | `Europe/Ljubljana` | IANA timezone passed to logr as `?tz=` |
| `CACHE_TTL_SECONDS` | no | `30` | In-memory cache TTL per mode |
| `PORT` | no | `3000` | HTTP listen port |

### HTTP surface (`src/server.ts`)

**`GET /frame?mode=dither|threshold`**

- `mode` query: `dither` (default) or `threshold`. Missing → treated as `dither`. Any other value → 400.
- Cache hit (not expired) → return cached buffer immediately.
- Cache miss → run pipeline, store in cache with `expiresAt = now + CACHE_TTL_SECONDS * 1000`, return buffer.
- Failure → 500/502/504 (see error table below). Cache is never populated with an error state.
- Response on success: `200 OK`, `Content-Type: application/octet-stream`, `Content-Length: 15000`, body = packed buffer.

**`GET /healthz`**

- Returns `200 OK` with body `ok`. No upstream check; just confirms the process is alive.

Service binds `0.0.0.0:PORT`. Bind to localhost only is not used — the container's port mapping is the firewall.

### Cache

```ts
const cache = new Map<'dither' | 'threshold', { buffer: Buffer; expiresAt: number }>();
```

- Keyed by mode. The two modes are distinct outputs and share no state.
- No in-flight dedup — two concurrent cache-miss requests for the same mode both trigger a render. For single-device LAN polling this never happens in practice.
- No size limit needed (at most 2 entries × 15,000 bytes).

### Pipeline (`src/pipeline.ts`)

```ts
async function render(mode: 'dither' | 'threshold'): Promise<Buffer> {
  const url = `${config.LOGR_URL}/dashboard.svg?tz=${encodeURIComponent(config.LOGR_TZ)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${config.LOGR_API_KEY}` },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) throw new UpstreamError(res.status);
  const svg = Buffer.from(await res.arrayBuffer());

  const grey = await sharp(svg)
    .resize(400, 300, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer(); // 120,000 bytes, one per pixel, 0..255

  const oneBit =
    mode === 'threshold'
      ? threshold(grey, 128)
      : floydSteinberg(grey, 400, 300);

  return pack1bit(oneBit, 400, 300);
}
```

- `UpstreamError` carries the status code so the server can map to 502/504.
- Fetch timeout is 10 s. Abort yields a `504 Gateway Timeout`.
- `sharp.concurrency(1)` is called at module load — single-tenant, no thread bursts.

### Threshold (`src/pipeline.ts` or inlined)

Trivial map: every byte ≥ 128 → 255, else → 0. ~3 lines.

### Floyd-Steinberg (`src/dither.ts`)

Standard error-diffusion with weights 7/16 (right), 3/16 (below-left), 5/16 (below), 1/16 (below-right). Operates on a copy of the 8-bit greyscale buffer; output is 0 or 255 per pixel.

- Pure function: `(grey: Uint8Array, w: number, h: number) => Uint8Array`.
- Deterministic — same input always produces byte-identical output.
- ~40 lines, no dependencies.

### Bit-packing (`src/pack.ts`)

```ts
export function pack1bit(grey: Uint8Array, w: number, h: number): Buffer {
  const out = Buffer.alloc((w * h) / 8);
  for (let i = 0; i < w * h; i++) {
    if (grey[i] >= 128) out[i >> 3] |= 0x80 >> (i & 7);
  }
  return out;
}
```

- White=1, black=0, MSB-first within byte, row-major (left→right, top→bottom).
- 400 × 300 / 8 = 15,000 bytes output.
- Handles both `threshold` and `dither` outputs since both feed in a 0/255-only buffer.

## Data flow

**Cold (cache miss):**

1. ESP32 → `GET http://eink-renderer.lan:3000/frame?mode=dither`
2. Cache miss for key `dither`.
3. Service → `GET https://logr.devsoup.xyz/dashboard.svg?tz=Europe/Ljubljana` with Bearer header.
4. Logr validates key, fetches data, renders BW SVG, returns ~5–15 KB SVG.
5. Service rasterizes via sharp → 120,000-byte 8-bit greyscale.
6. Service applies Floyd-Steinberg → 120,000 bytes of 0/255.
7. Service bit-packs → 15,000-byte buffer.
8. Service stores `{ buffer, expiresAt: now + 30 s }` in cache.
9. Service responds: `200 OK`, `application/octet-stream`, body = 15,000-byte buffer.

**Warm (cache hit):**

1. ESP32 → `GET .../frame?mode=dither`
2. Cache has entry, `expiresAt > now`.
3. Service returns the cached buffer immediately.

**Failure:**

- Any upstream/render error → service responds with appropriate 5xx, **no body**. Cache untouched. Next poll retries cleanly.

## Error handling

| Condition | Response | Cache effect |
| --- | --- | --- |
| Invalid `mode` query value | 400 Bad Request, body `invalid mode` | none |
| Logr fetch 4xx | 502 Bad Gateway, no body | none |
| Logr fetch 5xx | 502 Bad Gateway, no body | none |
| Logr fetch timeout (10 s) | 504 Gateway Timeout, no body | none |
| Network error / DNS / unreachable | 502 Bad Gateway, no body | none |
| Sharp throws | 500 Internal Server Error, no body | none |
| Required env var missing at startup | exit code 1, log which vars | n/a |

Failures never populate the cache. The Waveshare panel is persistent — the ESP32 firmware checks status, skips the update on non-200, and the last good image stays visible.

## Logging

`pino` via Fastify's default logger.

- `info`: server start (with port), every request line (method, path, status, duration ms).
- `info`: cache hits/misses with mode.
- `info`: each upstream fetch (URL without key, status, duration ms).
- `error`: any failure path with the underlying error message.

The API key is **never** logged. URLs in logs strip query strings that could contain secrets (currently none, but defensive).

## Security

- `LOGR_API_KEY` only ever in env / outgoing `Authorization` header. Not in URLs, logs, or error responses.
- Caller auth is not implemented — the deployment is LAN-only. Docker port mapping (`-p 3000:3000`) plus a non-Internet-routed network is the boundary.
- Sharp processes bytes from a trusted upstream (our own logr). Residual CVE risk accepted.
- No request body validation needed — both routes are `GET`, only the `mode` enum is parsed.
- Container runs as non-root `node` user (set in Dockerfile).

## Resource bounds

- Memory: cache holds at most 2 × 15,000 bytes ≈ 30 KB. Process RSS comfortably under 128 MB.
- CPU: a single render is ~100 ms (SVG decode + 120K-pixel Floyd-Steinberg). With 30 s cache TTL, sustained load is trivial.
- Image size: `node:22-alpine` + sharp ≈ 150 MB.
- Sharp threading: `sharp.concurrency(1)`.

## Testing

### Microservice

**`test/pack.test.ts`** — pure function, golden-byte assertions.
- All-white input → all `0xFF`.
- All-black input → all `0x00`.
- Single black pixel at `(0, 0)` → byte 0 is `0x7F`.
- Single black pixel at `(7, 0)` → byte 0 is `0xFE`.
- Single black pixel at `(0, 1)` → byte 50 is `0x7F`.

**`test/dither.test.ts`** — Floyd-Steinberg.
- Uniform mid-grey (128) → output mean ≈ 128 (within tolerance), every output value is 0 or 255.
- Pure white in → pure white out.
- Pure black in → pure black out.
- Determinism: same input twice → byte-identical output.

**`test/pipeline.test.ts`** — integration with mocked `fetch`.
- Mock global `fetch` to return a fixed tiny SVG fixture (`test/fixtures/test-pattern.svg`, a 400×300 BW pattern).
- `render('threshold')` → buffer length 15,000, matches a checked-in golden file byte-for-byte.
- `render('dither')` → buffer length 15,000, byte distribution is plausible (mix of bits, not all-zero or all-one).
- Mock `fetch` to throw → `render` throws `UpstreamError`.
- Mock `fetch` to return 500 → `render` throws `UpstreamError(500)`.

No HTTP-level test (Fastify's route layer is thin). No live integration in CI — a manual `npm run smoke` script hits localhost with a real `.env`.

### Logr-side

**`app/routes/dashboard[.svg].test.ts`** — matches existing route test patterns.
- Missing Bearer header → 401.
- Invalid key → 401.
- Valid key → 200, `Content-Type: image/svg+xml`, body starts with `<svg`.
- `tz=Europe/Ljubljana` vs. `tz=UTC` produces different `weekDays` for a fixed clock that straddles UTC midnight.

## Deployment

**`Dockerfile`** (multi-stage):

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

**`docker-compose.yml`** (in `eink-renderer/`):

```yaml
services:
  eink-renderer:
    build: .
    restart: unless-stopped
    ports: ["3000:3000"]
    environment:
      LOGR_URL: https://logr.devsoup.xyz
      LOGR_API_KEY: ${LOGR_API_KEY}
      LOGR_TZ: Europe/Ljubljana
      CACHE_TTL_SECONDS: 30
```

**`.env.example`** lists the variables; the real `.env` (gitignored) holds `LOGR_API_KEY=logr_...`.

Deploy: `docker compose up -d --build`.

## Out of scope

- Caller auth on the microservice (LAN-trusted).
- Stale-while-revalidate caching.
- In-flight request dedup.
- Per-day / historical dashboards (logr's dashboard is always "today").
- Multi-user / multi-key (one API key, one device).
- Prometheus metrics or deeper healthcheck.
- Pre-rasterization on the logr side (`@resvg/resvg-wasm` not reintroduced).
- True 4-gray rendering on the panel.
- Query-string API key support on logr's new route (`requireApiKeyFromRequest` not added).
- Live HTML-screenshot fallback via headless Chromium (not needed while the dashboard is SVG-only; revisit if logr adds non-SVG visuals to `/dashboard`).
