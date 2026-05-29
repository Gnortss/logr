# E-ink Renderer Microservice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Node/TypeScript microservice (in Docker, LAN-only) that fetches the logr dashboard SVG, rasterizes it via sharp, applies threshold or Floyd-Steinberg dither, and returns a 15,000-byte 1-bit packed buffer for a Waveshare 4.2" e-ink panel. Also adds the supporting `/dashboard.svg` route to logr.

**Architecture:** Two deliverables — (1) a small additive route in logr (`app/routes/dashboard[.svg].tsx`) returning the BW SVG with API-key auth; (2) a separate Node project at `D:/dev/eink-renderer/` that wraps sharp + a 40-line Floyd-Steinberg + a bit-packer behind a Fastify endpoint, with a small in-memory cache.

**Tech Stack:**
- Logr: existing React Router 7 + Cloudflare Workers + drizzle (no new deps).
- Microservice: Node 22 + TypeScript + Fastify 5 + sharp 0.33 + vitest 4 + Docker (Alpine).

**Locations:**
- Logr changes: `D:/dev/logr/` (existing repo).
- Microservice: `D:/dev/eink-renderer/` (new, sibling of logr).

**Reference spec:** `docs/superpowers/specs/2026-05-28-eink-renderer-design.md`.

---

## Task 1: Add `/dashboard.svg` route to logr

**Files:**
- Create: `D:/dev/logr/app/routes/dashboard[.svg].tsx`
- Create: `D:/dev/logr/tests/api/dashboard-svg.test.ts`

- [ ] **Step 1: Write the failing test**

Create `D:/dev/logr/tests/api/dashboard-svg.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { loader } from "../../app/routes/dashboard[.svg]";

describe("/dashboard.svg loader", () => {
  it("throws 401 Response when Authorization header is missing", async () => {
    const request = new Request("https://example.com/dashboard.svg");
    const context = { cloudflare: { env: { DB: {} } } } as any;
    try {
      await loader({ request, context, params: {} } as any);
      throw new Error("loader should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(Response);
      expect((e as Response).status).toBe(401);
    }
  });

  it("throws 401 Response when Authorization header is malformed", async () => {
    const request = new Request("https://example.com/dashboard.svg", {
      headers: { Authorization: "NotBearer somekey" },
    });
    const context = { cloudflare: { env: { DB: {} } } } as any;
    try {
      await loader({ request, context, params: {} } as any);
      throw new Error("loader should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(Response);
      expect((e as Response).status).toBe(401);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd D:/dev/logr && npx vitest run tests/api/dashboard-svg.test.ts`
Expected: FAIL with "Cannot find module" or similar (the route file doesn't exist yet).

- [ ] **Step 3: Create the route file**

Create `D:/dev/logr/app/routes/dashboard[.svg].tsx`:

```tsx
import type { Route } from "./+types/dashboard[.svg]";
import { requireApiKey } from "~/lib/api-key.server";
import { getDb } from "~/lib/db.server";
import { getDashboardData } from "~/lib/dashboard.server";
import { renderDashboardSvg } from "~/lib/dashboard-svg";
import { todayInTz } from "~/lib/tz";

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

- [ ] **Step 4: Generate route types and run tests**

Run: `cd D:/dev/logr && npx react-router typegen`
Then: `cd D:/dev/logr && npx vitest run tests/api/dashboard-svg.test.ts`
Expected: both tests PASS.

- [ ] **Step 5: Run typecheck to verify nothing else broke**

Run: `cd D:/dev/logr && npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd D:/dev/logr && git add app/routes/dashboard\[.svg\].tsx tests/api/dashboard-svg.test.ts && git commit -m "feat(api): add /dashboard.svg route returning BW SVG with API-key auth"
```

---

## Task 2: Scaffold `eink-renderer` project

**Files:**
- Create: `D:/dev/eink-renderer/package.json`
- Create: `D:/dev/eink-renderer/tsconfig.json`
- Create: `D:/dev/eink-renderer/vitest.config.ts`
- Create: `D:/dev/eink-renderer/.gitignore`
- Create: `D:/dev/eink-renderer/.env.example`
- Create: `D:/dev/eink-renderer/.dockerignore`
- Create: `D:/dev/eink-renderer/README.md`

- [ ] **Step 1: Create directory and initialize git**

```bash
mkdir D:/dev/eink-renderer
cd D:/dev/eink-renderer
git init
mkdir src test test/fixtures
```

- [ ] **Step 2: Write `package.json`**

Create `D:/dev/eink-renderer/package.json`:

```json
{
  "name": "eink-renderer",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/server.ts",
    "start": "node dist/server.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "smoke": "tsx scripts/smoke.ts"
  },
  "dependencies": {
    "fastify": "^5.0.0",
    "sharp": "^0.33.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.9.0",
    "vitest": "^4.1.0"
  }
}
```

- [ ] **Step 3: Write `tsconfig.json`**

Create `D:/dev/eink-renderer/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": false,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}
```

- [ ] **Step 4: Write `vitest.config.ts`**

Create `D:/dev/eink-renderer/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    include: ["test/**/*.test.ts"],
  },
});
```

- [ ] **Step 5: Write `.gitignore`**

Create `D:/dev/eink-renderer/.gitignore`:

```
node_modules/
dist/
.env
*.log
.DS_Store
```

- [ ] **Step 6: Write `.env.example`**

Create `D:/dev/eink-renderer/.env.example`:

```
LOGR_URL=https://logr.devsoup.xyz
LOGR_API_KEY=logr_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
LOGR_TZ=Europe/Ljubljana
CACHE_TTL_SECONDS=30
PORT=3000
```

- [ ] **Step 7: Write `.dockerignore`**

Create `D:/dev/eink-renderer/.dockerignore`:

```
node_modules
dist
.env
.git
.gitignore
test
README.md
*.log
```

- [ ] **Step 8: Write `README.md`**

Create `D:/dev/eink-renderer/README.md`:

```markdown
# eink-renderer

LAN microservice that fetches the logr dashboard SVG, rasterizes it, and returns a 15,000-byte 1-bit packed buffer for a Waveshare 4.2" e-ink panel.

## Endpoints

- `GET /frame?mode=dither|threshold` — returns `application/octet-stream`, 15,000 bytes (50×300, MSB-first, white=1).
- `GET /healthz` — returns `200 OK`.

## Run

```
cp .env.example .env  # fill in LOGR_API_KEY
docker compose up -d --build
```

See `docs/superpowers/specs/2026-05-28-eink-renderer-design.md` in the logr repo for the full design.
```

- [ ] **Step 9: Install dependencies**

Run: `cd D:/dev/eink-renderer && npm install`
Expected: `node_modules/` populated, no errors. Sharp downloads prebuilt binaries for the host platform.

- [ ] **Step 10: Commit**

```bash
cd D:/dev/eink-renderer && git add -A && git commit -m "chore: scaffold eink-renderer project"
```

---

## Task 3: Implement `pack1bit` (TDD)

**Files:**
- Create: `D:/dev/eink-renderer/src/pack.ts`
- Create: `D:/dev/eink-renderer/test/pack.test.ts`

- [ ] **Step 1: Write the failing test**

Create `D:/dev/eink-renderer/test/pack.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { pack1bit } from "../src/pack.js";

describe("pack1bit", () => {
  it("all-white 8x1 input produces single 0xFF byte", () => {
    const grey = new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255]);
    const out = pack1bit(grey, 8, 1);
    expect(out.length).toBe(1);
    expect(out[0]).toBe(0xff);
  });

  it("all-black 8x1 input produces single 0x00 byte", () => {
    const grey = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]);
    const out = pack1bit(grey, 8, 1);
    expect(out.length).toBe(1);
    expect(out[0]).toBe(0x00);
  });

  it("single black pixel at (0,0) yields byte 0 = 0x7F (MSB cleared)", () => {
    const grey = new Uint8Array([0, 255, 255, 255, 255, 255, 255, 255]);
    const out = pack1bit(grey, 8, 1);
    expect(out[0]).toBe(0x7f);
  });

  it("single black pixel at (7,0) yields byte 0 = 0xFE (LSB cleared)", () => {
    const grey = new Uint8Array([255, 255, 255, 255, 255, 255, 255, 0]);
    const out = pack1bit(grey, 8, 1);
    expect(out[0]).toBe(0xfe);
  });

  it("single black pixel at (0,1) of 8x2 yields byte 1 = 0x7F", () => {
    const grey = new Uint8Array(16).fill(255);
    grey[8] = 0; // (0,1)
    const out = pack1bit(grey, 8, 2);
    expect(out.length).toBe(2);
    expect(out[0]).toBe(0xff);
    expect(out[1]).toBe(0x7f);
  });

  it("400x300 all-white input produces 15000 bytes of 0xFF", () => {
    const grey = new Uint8Array(400 * 300).fill(255);
    const out = pack1bit(grey, 400, 300);
    expect(out.length).toBe(15000);
    expect(out.every((b) => b === 0xff)).toBe(true);
  });

  it("400x300 left-half-black / right-half-white produces 25 black + 25 white per row", () => {
    const grey = new Uint8Array(400 * 300);
    for (let row = 0; row < 300; row++) {
      for (let col = 0; col < 400; col++) {
        grey[row * 400 + col] = col < 200 ? 0 : 255;
      }
    }
    const out = pack1bit(grey, 400, 300);
    expect(out.length).toBe(15000);
    for (let row = 0; row < 300; row++) {
      for (let i = 0; i < 25; i++) expect(out[row * 50 + i]).toBe(0x00);
      for (let i = 25; i < 50; i++) expect(out[row * 50 + i]).toBe(0xff);
    }
  });

  it("threshold semantics: 128 maps to white (>=128 is 1)", () => {
    const grey = new Uint8Array([128, 127, 128, 127, 128, 127, 128, 127]);
    const out = pack1bit(grey, 8, 1);
    expect(out[0]).toBe(0b10101010);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd D:/dev/eink-renderer && npm test -- pack`
Expected: FAIL with "Cannot find module '../src/pack.js'".

- [ ] **Step 3: Implement `pack1bit`**

Create `D:/dev/eink-renderer/src/pack.ts`:

```ts
export function pack1bit(grey: Uint8Array, w: number, h: number): Buffer {
  const total = w * h;
  if (grey.length !== total) {
    throw new Error(`pack1bit: expected ${total} bytes, got ${grey.length}`);
  }
  if ((total & 7) !== 0) {
    throw new Error(`pack1bit: w*h (${total}) must be a multiple of 8`);
  }
  const out = Buffer.alloc(total / 8);
  for (let i = 0; i < total; i++) {
    if (grey[i] >= 128) {
      out[i >> 3] |= 0x80 >> (i & 7);
    }
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd D:/dev/eink-renderer && npm test -- pack`
Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd D:/dev/eink-renderer && git add src/pack.ts test/pack.test.ts && git commit -m "feat: implement pack1bit (MSB-first, white=1) with tests"
```

---

## Task 4: Implement Floyd-Steinberg dither (TDD)

**Files:**
- Create: `D:/dev/eink-renderer/src/dither.ts`
- Create: `D:/dev/eink-renderer/test/dither.test.ts`

- [ ] **Step 1: Write the failing test**

Create `D:/dev/eink-renderer/test/dither.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { threshold, floydSteinberg } from "../src/dither.js";

describe("threshold", () => {
  it("values >=128 map to 255, else to 0", () => {
    const grey = new Uint8Array([0, 127, 128, 255, 64, 192]);
    const out = threshold(grey, 128);
    expect(Array.from(out)).toEqual([0, 0, 255, 255, 0, 255]);
  });

  it("does not mutate input", () => {
    const grey = new Uint8Array([100, 200]);
    threshold(grey, 128);
    expect(Array.from(grey)).toEqual([100, 200]);
  });
});

describe("floydSteinberg", () => {
  it("pure white input yields pure white output", () => {
    const grey = new Uint8Array(400 * 300).fill(255);
    const out = floydSteinberg(grey, 400, 300);
    expect(out.length).toBe(grey.length);
    expect(out.every((v) => v === 255)).toBe(true);
  });

  it("pure black input yields pure black output", () => {
    const grey = new Uint8Array(400 * 300).fill(0);
    const out = floydSteinberg(grey, 400, 300);
    expect(out.every((v) => v === 0)).toBe(true);
  });

  it("output values are only 0 or 255", () => {
    const grey = new Uint8Array(40 * 30);
    for (let i = 0; i < grey.length; i++) grey[i] = i % 256;
    const out = floydSteinberg(grey, 40, 30);
    expect(out.every((v) => v === 0 || v === 255)).toBe(true);
  });

  it("uniform mid-grey produces a mix of 0 and 255 with mean near 128", () => {
    const grey = new Uint8Array(40 * 30).fill(128);
    const out = floydSteinberg(grey, 40, 30);
    const whites = out.filter((v) => v === 255).length;
    const blacks = out.filter((v) => v === 0).length;
    expect(whites).toBeGreaterThan(0);
    expect(blacks).toBeGreaterThan(0);
    const mean = out.reduce((s, v) => s + v, 0) / out.length;
    expect(mean).toBeGreaterThan(120);
    expect(mean).toBeLessThan(136);
  });

  it("is deterministic — same input twice produces byte-identical output", () => {
    const grey = new Uint8Array(40 * 30);
    for (let i = 0; i < grey.length; i++) grey[i] = (i * 7) % 256;
    const out1 = floydSteinberg(grey, 40, 30);
    const out2 = floydSteinberg(grey, 40, 30);
    expect(out1).toEqual(out2);
  });

  it("does not mutate input", () => {
    const grey = new Uint8Array(40 * 30).fill(128);
    const snapshot = new Uint8Array(grey);
    floydSteinberg(grey, 40, 30);
    expect(grey).toEqual(snapshot);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd D:/dev/eink-renderer && npm test -- dither`
Expected: FAIL with "Cannot find module '../src/dither.js'".

- [ ] **Step 3: Implement `threshold` and `floydSteinberg`**

Create `D:/dev/eink-renderer/src/dither.ts`:

```ts
export function threshold(grey: Uint8Array, cutoff: number): Uint8Array {
  const out = new Uint8Array(grey.length);
  for (let i = 0; i < grey.length; i++) {
    out[i] = grey[i] >= cutoff ? 255 : 0;
  }
  return out;
}

export function floydSteinberg(
  grey: Uint8Array,
  w: number,
  h: number
): Uint8Array {
  if (grey.length !== w * h) {
    throw new Error(`floydSteinberg: expected ${w * h} bytes, got ${grey.length}`);
  }
  // Work in Int16Array so error diffusion doesn't overflow Uint8.
  const buf = new Int16Array(grey);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const old = buf[i];
      const next = old < 128 ? 0 : 255;
      buf[i] = next;
      const err = old - next;
      if (x + 1 < w) buf[i + 1] += (err * 7) >> 4;
      if (y + 1 < h) {
        if (x > 0) buf[i + w - 1] += (err * 3) >> 4;
        buf[i + w] += (err * 5) >> 4;
        if (x + 1 < w) buf[i + w + 1] += (err * 1) >> 4;
      }
    }
  }
  const out = new Uint8Array(buf.length);
  for (let i = 0; i < buf.length; i++) out[i] = buf[i] === 255 ? 255 : 0;
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd D:/dev/eink-renderer && npm test -- dither`
Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd D:/dev/eink-renderer && git add src/dither.ts test/dither.test.ts && git commit -m "feat: implement threshold and Floyd-Steinberg dither with tests"
```

---

## Task 5: Implement `config` (TDD)

**Files:**
- Create: `D:/dev/eink-renderer/src/config.ts`
- Create: `D:/dev/eink-renderer/test/config.test.ts`

- [ ] **Step 1: Write the failing test**

Create `D:/dev/eink-renderer/test/config.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("returns parsed config when all required vars are present", () => {
    const cfg = loadConfig({
      LOGR_URL: "https://logr.devsoup.xyz",
      LOGR_API_KEY: "logr_abc",
      LOGR_TZ: "Europe/Ljubljana",
      CACHE_TTL_SECONDS: "30",
      PORT: "3000",
    });
    expect(cfg).toEqual({
      LOGR_URL: "https://logr.devsoup.xyz",
      LOGR_API_KEY: "logr_abc",
      LOGR_TZ: "Europe/Ljubljana",
      CACHE_TTL_SECONDS: 30,
      PORT: 3000,
    });
  });

  it("applies defaults for optional vars", () => {
    const cfg = loadConfig({
      LOGR_URL: "https://logr.devsoup.xyz",
      LOGR_API_KEY: "logr_abc",
    });
    expect(cfg.LOGR_TZ).toBe("Europe/Ljubljana");
    expect(cfg.CACHE_TTL_SECONDS).toBe(30);
    expect(cfg.PORT).toBe(3000);
  });

  it("throws when LOGR_URL is missing", () => {
    expect(() => loadConfig({ LOGR_API_KEY: "logr_abc" })).toThrow(/LOGR_URL/);
  });

  it("throws when LOGR_API_KEY is missing", () => {
    expect(() =>
      loadConfig({ LOGR_URL: "https://logr.devsoup.xyz" })
    ).toThrow(/LOGR_API_KEY/);
  });

  it("throws when CACHE_TTL_SECONDS is not a number", () => {
    expect(() =>
      loadConfig({
        LOGR_URL: "x",
        LOGR_API_KEY: "y",
        CACHE_TTL_SECONDS: "abc",
      })
    ).toThrow(/CACHE_TTL_SECONDS/);
  });

  it("throws when PORT is not a number", () => {
    expect(() =>
      loadConfig({
        LOGR_URL: "x",
        LOGR_API_KEY: "y",
        PORT: "abc",
      })
    ).toThrow(/PORT/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd D:/dev/eink-renderer && npm test -- config`
Expected: FAIL with "Cannot find module '../src/config.js'".

- [ ] **Step 3: Implement `loadConfig`**

Create `D:/dev/eink-renderer/src/config.ts`:

```ts
export type Config = {
  LOGR_URL: string;
  LOGR_API_KEY: string;
  LOGR_TZ: string;
  CACHE_TTL_SECONDS: number;
  PORT: number;
};

function requireStr(env: NodeJS.ProcessEnv | Record<string, string | undefined>, key: string): string {
  const v = env[key];
  if (!v || v.length === 0) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return v;
}

function parseInt10(env: NodeJS.ProcessEnv | Record<string, string | undefined>, key: string, fallback: number): number {
  const raw = env[key];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`Invalid integer for env var ${key}: ${raw}`);
  }
  return n;
}

export function loadConfig(env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env): Config {
  return {
    LOGR_URL: requireStr(env, "LOGR_URL"),
    LOGR_API_KEY: requireStr(env, "LOGR_API_KEY"),
    LOGR_TZ: env.LOGR_TZ ?? "Europe/Ljubljana",
    CACHE_TTL_SECONDS: parseInt10(env, "CACHE_TTL_SECONDS", 30),
    PORT: parseInt10(env, "PORT", 3000),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd D:/dev/eink-renderer && npm test -- config`
Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd D:/dev/eink-renderer && git add src/config.ts test/config.test.ts && git commit -m "feat: implement loadConfig with required/optional env vars"
```

---

## Task 6: Add test fixtures

**Files:**
- Create: `D:/dev/eink-renderer/test/fixtures/bw-halves.svg`
- Create: `D:/dev/eink-renderer/test/fixtures/gradient.svg`

- [ ] **Step 1: Write `bw-halves.svg`**

Create `D:/dev/eink-renderer/test/fixtures/bw-halves.svg`:

```xml
<svg width="400" height="300" viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
  <rect x="0" y="0" width="200" height="300" fill="black"/>
  <rect x="200" y="0" width="200" height="300" fill="white"/>
</svg>
```

After sharp rasterization at 400×300 greyscale, this produces 120,000 bytes where columns 0–199 are 0 (black) and columns 200–399 are 255 (white). `shape-rendering="crispEdges"` disables anti-aliasing at the boundary so the output is pixel-perfect and the test can do exact byte assertions.

- [ ] **Step 2: Write `gradient.svg`**

Create `D:/dev/eink-renderer/test/fixtures/gradient.svg`:

```xml
<svg width="400" height="300" viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="black"/>
      <stop offset="100%" stop-color="white"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="400" height="300" fill="url(#g)"/>
</svg>
```

- [ ] **Step 3: Commit**

```bash
cd D:/dev/eink-renderer && git add test/fixtures/bw-halves.svg test/fixtures/gradient.svg && git commit -m "test: add SVG fixtures (bw halves, horizontal gradient)"
```

---

## Task 7: Implement `pipeline` (TDD)

**Files:**
- Create: `D:/dev/eink-renderer/src/pipeline.ts`
- Create: `D:/dev/eink-renderer/test/pipeline.test.ts`

- [ ] **Step 1: Write the failing test**

Create `D:/dev/eink-renderer/test/pipeline.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, UpstreamError } from "../src/pipeline.js";

const bwSvg = readFileSync(
  resolve(__dirname, "fixtures/bw-halves.svg")
);
const gradientSvg = readFileSync(
  resolve(__dirname, "fixtures/gradient.svg")
);

const config = {
  LOGR_URL: "https://logr.example",
  LOGR_API_KEY: "logr_test",
  LOGR_TZ: "Europe/Ljubljana",
  CACHE_TTL_SECONDS: 30,
  PORT: 3000,
};

function mockFetchOk(body: Buffer) {
  return vi.fn(async (_url: string | URL, _init?: RequestInit) => {
    return new Response(body, { status: 200, headers: { "Content-Type": "image/svg+xml" } });
  });
}

describe("render", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetchOk(bwSvg));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 15,000 bytes in threshold mode", async () => {
    const buf = await render("threshold", config);
    expect(buf.length).toBe(15000);
  });

  it("threshold output: bw-halves yields 25 bytes 0x00 + 25 bytes 0xFF per row", async () => {
    const buf = await render("threshold", config);
    for (let row = 0; row < 300; row++) {
      for (let i = 0; i < 25; i++) {
        expect(buf[row * 50 + i]).toBe(0x00);
      }
      for (let i = 25; i < 50; i++) {
        expect(buf[row * 50 + i]).toBe(0xff);
      }
    }
  });

  it("dither mode on bw-halves matches threshold (no mid-tones)", async () => {
    const thresh = await render("threshold", config);
    const dither = await render("dither", config);
    expect(dither).toEqual(thresh);
  });

  it("dither mode on gradient produces mixed bytes (not all 0x00 or 0xFF)", async () => {
    vi.stubGlobal("fetch", mockFetchOk(gradientSvg));
    const buf = await render("dither", config);
    expect(buf.length).toBe(15000);
    const allSame = buf.every((b) => b === buf[0]);
    expect(allSame).toBe(false);
    // Some bytes should be partial bit-patterns (not 0x00 or 0xFF)
    const partial = buf.filter((b) => b !== 0x00 && b !== 0xff).length;
    expect(partial).toBeGreaterThan(0);
  });

  it("dither is deterministic — same input twice produces byte-identical output", async () => {
    vi.stubGlobal("fetch", mockFetchOk(gradientSvg));
    const a = await render("dither", config);
    const b = await render("dither", config);
    expect(a).toEqual(b);
  });

  it("calls logr with Authorization Bearer header and tz query", async () => {
    const mock = mockFetchOk(bwSvg);
    vi.stubGlobal("fetch", mock);
    await render("threshold", config);
    expect(mock).toHaveBeenCalledTimes(1);
    const [url, init] = mock.mock.calls[0];
    expect(String(url)).toBe(
      "https://logr.example/dashboard.svg?tz=Europe%2FLjubljana"
    );
    expect((init as RequestInit).headers).toEqual({
      Authorization: "Bearer logr_test",
    });
  });

  it("throws UpstreamError when fetch returns non-2xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 401 }))
    );
    await expect(render("threshold", config)).rejects.toBeInstanceOf(UpstreamError);
    try {
      await render("threshold", config);
    } catch (e) {
      expect((e as UpstreamError).status).toBe(401);
    }
  });

  it("throws UpstreamError when fetch throws (network error)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("network error");
      })
    );
    await expect(render("threshold", config)).rejects.toBeInstanceOf(UpstreamError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd D:/dev/eink-renderer && npm test -- pipeline`
Expected: FAIL with "Cannot find module '../src/pipeline.js'".

- [ ] **Step 3: Implement `pipeline.ts`**

Create `D:/dev/eink-renderer/src/pipeline.ts`:

```ts
import sharp from "sharp";
import { threshold, floydSteinberg } from "./dither.js";
import { pack1bit } from "./pack.js";
import type { Config } from "./config.js";

export type Mode = "dither" | "threshold";

export class UpstreamError extends Error {
  constructor(public status: number, message?: string) {
    super(message ?? `Upstream error: ${status}`);
    this.name = "UpstreamError";
  }
}

sharp.concurrency(1);

const FETCH_TIMEOUT_MS = 10_000;

export async function render(mode: Mode, config: Config): Promise<Buffer> {
  const url = `${config.LOGR_URL}/dashboard.svg?tz=${encodeURIComponent(config.LOGR_TZ)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${config.LOGR_API_KEY}` },
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeout);
    if ((e as Error).name === "AbortError") {
      throw new UpstreamError(504, "Upstream timeout");
    }
    throw new UpstreamError(502, `Upstream fetch failed: ${(e as Error).message}`);
  }
  clearTimeout(timeout);

  if (!res.ok) {
    throw new UpstreamError(res.status, `Upstream returned ${res.status}`);
  }

  const svg = Buffer.from(await res.arrayBuffer());

  const grey = await sharp(svg)
    .resize(400, 300, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer();

  if (grey.length !== 400 * 300) {
    throw new Error(`Unexpected raw buffer length: ${grey.length}`);
  }

  const oneBit =
    mode === "threshold"
      ? threshold(grey, 128)
      : floydSteinberg(grey, 400, 300);

  return pack1bit(oneBit, 400, 300);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd D:/dev/eink-renderer && npm test -- pipeline`
Expected: all 8 tests PASS.

- [ ] **Step 5: Run all tests to make sure nothing regressed**

Run: `cd D:/dev/eink-renderer && npm test`
Expected: all tests across pack/dither/config/pipeline PASS.

- [ ] **Step 6: Commit**

```bash
cd D:/dev/eink-renderer && git add src/pipeline.ts test/pipeline.test.ts && git commit -m "feat: implement render pipeline (fetch + sharp + dither + pack)"
```

---

## Task 8: Implement `server` (Fastify + cache)

**Files:**
- Create: `D:/dev/eink-renderer/src/server.ts`

No test file for the server itself — Fastify route plumbing is thin and the pipeline is already covered. Manual smoke test in Task 10.

- [ ] **Step 1: Implement `server.ts`**

Create `D:/dev/eink-renderer/src/server.ts`:

```ts
import Fastify from "fastify";
import { loadConfig } from "./config.js";
import { render, UpstreamError, type Mode } from "./pipeline.js";

const config = loadConfig();

const cache = new Map<Mode, { buffer: Buffer; expiresAt: number }>();

function getCached(mode: Mode): Buffer | null {
  const entry = cache.get(mode);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    cache.delete(mode);
    return null;
  }
  return entry.buffer;
}

function setCached(mode: Mode, buffer: Buffer): void {
  cache.set(mode, {
    buffer,
    expiresAt: Date.now() + config.CACHE_TTL_SECONDS * 1000,
  });
}

const app = Fastify({ logger: true });

app.get("/healthz", async () => {
  return "ok";
});

app.get<{ Querystring: { mode?: string } }>("/frame", async (req, reply) => {
  const raw = req.query.mode ?? "dither";
  if (raw !== "dither" && raw !== "threshold") {
    reply.code(400).type("text/plain");
    return "invalid mode";
  }
  const mode: Mode = raw;

  const cached = getCached(mode);
  if (cached) {
    req.log.info({ mode, cache: "hit" }, "serving cached frame");
    reply.type("application/octet-stream");
    return cached;
  }

  req.log.info({ mode, cache: "miss" }, "rendering frame");
  let buffer: Buffer;
  try {
    buffer = await render(mode, config);
  } catch (e) {
    if (e instanceof UpstreamError) {
      const status = e.status === 504 ? 504 : 502;
      req.log.error({ err: e.message, status: e.status }, "upstream error");
      reply.code(status);
      return;
    }
    req.log.error({ err: (e as Error).message }, "render error");
    reply.code(500);
    return;
  }

  setCached(mode, buffer);
  reply.type("application/octet-stream");
  return buffer;
});

const start = async () => {
  try {
    await app.listen({ host: "0.0.0.0", port: config.PORT });
    app.log.info(`eink-renderer listening on :${config.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
```

- [ ] **Step 2: Build to verify TypeScript compiles**

Run: `cd D:/dev/eink-renderer && npm run build`
Expected: `dist/` populated, no errors.

- [ ] **Step 3: Start the server with stub env to verify it boots and `/healthz` works**

In one terminal:
```bash
cd D:/dev/eink-renderer && LOGR_URL=http://localhost:9999 LOGR_API_KEY=logr_dummy node dist/server.js
```

In another terminal:
```bash
curl -s http://localhost:3000/healthz
```
Expected: prints `ok`.

Stop the server (Ctrl+C in the first terminal).

- [ ] **Step 4: Commit**

```bash
cd D:/dev/eink-renderer && git add src/server.ts && git commit -m "feat: implement Fastify server with /frame and /healthz routes + per-mode cache"
```

---

## Task 9: Dockerfile and docker-compose

**Files:**
- Create: `D:/dev/eink-renderer/Dockerfile`
- Create: `D:/dev/eink-renderer/docker-compose.yml`

- [ ] **Step 1: Write `Dockerfile`**

Create `D:/dev/eink-renderer/Dockerfile`:

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

- [ ] **Step 2: Write `docker-compose.yml`**

Create `D:/dev/eink-renderer/docker-compose.yml`:

```yaml
services:
  eink-renderer:
    build: .
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      LOGR_URL: https://logr.devsoup.xyz
      LOGR_API_KEY: ${LOGR_API_KEY}
      LOGR_TZ: Europe/Ljubljana
      CACHE_TTL_SECONDS: 30
```

- [ ] **Step 3: Build the Docker image**

Run: `cd D:/dev/eink-renderer && docker build -t eink-renderer:dev .`
Expected: build succeeds; final image present in `docker images`.

- [ ] **Step 4: Verify the image starts and `/healthz` responds**

```bash
docker run --rm -d --name eink-test -p 3001:3000 \
  -e LOGR_URL=http://localhost:9999 \
  -e LOGR_API_KEY=logr_dummy \
  eink-renderer:dev
sleep 1
curl -s http://localhost:3001/healthz
docker stop eink-test
```
Expected: prints `ok`; container stops cleanly.

- [ ] **Step 5: Commit**

```bash
cd D:/dev/eink-renderer && git add Dockerfile docker-compose.yml && git commit -m "build: add Dockerfile (multi-stage, alpine) and docker-compose"
```

---

## Task 10: End-to-end smoke test

**Files:**
- Create: `D:/dev/eink-renderer/scripts/smoke.ts`

- [ ] **Step 1: Write smoke script**

Create `D:/dev/eink-renderer/scripts/smoke.ts`:

```ts
// Smoke test: hits the running service and verifies the response shape.
// Requires: service running locally with valid LOGR_URL/LOGR_API_KEY,
// and the logr-side /dashboard.svg route deployed.
//
// Usage: SERVICE_URL=http://localhost:3000 npm run smoke

import { writeFileSync } from "node:fs";

const SERVICE_URL = process.env.SERVICE_URL ?? "http://localhost:3000";

async function checkMode(mode: "dither" | "threshold") {
  const res = await fetch(`${SERVICE_URL}/frame?mode=${mode}`);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for mode=${mode}`);
  }
  const ct = res.headers.get("content-type");
  if (ct !== "application/octet-stream") {
    throw new Error(`Unexpected content-type: ${ct}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length !== 15000) {
    throw new Error(`Unexpected buffer length: ${buf.length}`);
  }
  writeFileSync(`frame-${mode}.bin`, buf);
  console.log(`mode=${mode}: ${buf.length} bytes OK, saved to frame-${mode}.bin`);
}

async function main() {
  const h = await fetch(`${SERVICE_URL}/healthz`);
  if (!h.ok) throw new Error(`/healthz returned ${h.status}`);
  console.log("/healthz OK");

  await checkMode("threshold");
  await checkMode("dither");

  console.log("smoke test passed");
}

main().catch((e) => {
  console.error("smoke failed:", e);
  process.exit(1);
});
```

- [ ] **Step 2: Verify the smoke script runs against a live service**

This requires:
- The logr `/dashboard.svg` route deployed (Task 1 done + deployed).
- The microservice running with a valid `LOGR_API_KEY` in `.env`.

Run in one terminal:
```bash
cd D:/dev/eink-renderer && cp .env.example .env
# Edit .env to set a real LOGR_API_KEY and LOGR_URL.
docker compose up --build
```

In another terminal:
```bash
cd D:/dev/eink-renderer && npm run smoke
```
Expected: both modes return 15,000-byte buffers; `frame-dither.bin` and `frame-threshold.bin` written to the repo root.

- [ ] **Step 3: Inspect the output buffers**

Optional sanity check: convert one of the buffers back to a PNG to visually verify.

```bash
cd D:/dev/eink-renderer
node -e "
const fs = require('fs');
const sharp = require('sharp');
const raw = fs.readFileSync('frame-threshold.bin');
const out = Buffer.alloc(400 * 300);
for (let i = 0; i < 400 * 300; i++) {
  out[i] = (raw[i >> 3] & (0x80 >> (i & 7))) ? 255 : 0;
}
sharp(out, { raw: { width: 400, height: 300, channels: 1 } })
  .png()
  .toFile('frame-threshold.png')
  .then(() => console.log('wrote frame-threshold.png'));
"
```
Expected: `frame-threshold.png` is a recognizable 400×300 BW dashboard image.

- [ ] **Step 4: Add `frame-*.bin` and `frame-*.png` to `.gitignore`**

Edit `D:/dev/eink-renderer/.gitignore`, append:

```
frame-*.bin
frame-*.png
```

- [ ] **Step 5: Commit the smoke script and .gitignore update**

```bash
cd D:/dev/eink-renderer && git add scripts/smoke.ts .gitignore && git commit -m "test: add end-to-end smoke script"
```

---

## Task 11: Final pass

- [ ] **Step 1: Run all microservice tests**

Run: `cd D:/dev/eink-renderer && npm test`
Expected: all suites pass (pack: 8, dither: 8, config: 6, pipeline: 8).

- [ ] **Step 2: Run logr tests**

Run: `cd D:/dev/logr && npx vitest run`
Expected: all tests pass, including the new `dashboard-svg.test.ts`.

- [ ] **Step 3: Run logr typecheck**

Run: `cd D:/dev/logr && npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Verify the design's "Out of scope" items are honored**

Confirm none of these snuck into the implementation:
- No caller auth in microservice (only network-level).
- No stale-while-revalidate (cache is hard-expiry).
- No in-flight dedup.
- No query-string API key support on logr's new route.
- No `@resvg/resvg-wasm` reintroduction.
- No multi-user logic.

- [ ] **Step 5: Verify `.env` is NOT committed in either repo**

Run: `cd D:/dev/eink-renderer && git status --ignored | grep -i env`
Expected: `.env` is shown as ignored (not staged, not committed).

---

## Done

At this point both deliverables are complete:

- Logr serves `/dashboard.svg` with API-key auth (one new route, one test).
- `eink-renderer` is a working Docker microservice exposing `GET /frame?mode=...` and `GET /healthz`, with full unit-test coverage of pure modules and a manual end-to-end smoke script.

Next step (out of scope here): point the ESP32 firmware at `http://<lan-ip>:3000/frame?mode=dither` and use the 15,000-byte response directly with `epd.DrawBitmap(buf, ...)`.
