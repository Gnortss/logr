import { Resvg, initWasm } from "@resvg/resvg-wasm";
import resvgWasmUrl from "@resvg/resvg-wasm/index_bg.wasm?url";
import { renderDashboardSvg } from "~/lib/dashboard-svg";
import type { DashboardData } from "~/lib/dashboard";

// Fonts live in public/fonts/ and are served at /fonts/<name> in both dev and prod.
const FONT_URLS = [
  "/fonts/Inter-Regular.ttf",
  "/fonts/Inter-Bold.ttf",
  "/fonts/JetBrainsMono-Bold.ttf",
];

// Stored once per Worker lifetime so renderDashboardPng / renderErrorPng
// do not need to carry a `request` parameter in their public signatures.
let _baseUrl: string | undefined;

/**
 * Must be called from the route loader (which has access to `request`) before
 * the first call to renderDashboardPng or renderErrorPng.  Subsequent calls
 * after the wasm is already initialised are no-ops.
 */
export function setRequestContext(request: Request): void {
  if (!_baseUrl) _baseUrl = request.url;
}

let initialized = false;
async function ensureInit(): Promise<void> {
  if (initialized) return;
  const base = _baseUrl ?? "http://localhost/";
  const origin = new URL(base).origin;
  const [wasmBuf, ...fontBufs] = await Promise.all([
    fetch(new URL(resvgWasmUrl, base)).then((r) => r.arrayBuffer()),
    ...FONT_URLS.map((p) => fetch(new URL(p, origin)).then((r) => r.arrayBuffer())),
  ]);
  try {
    await initWasm(wasmBuf);
  } catch (e) {
    // resvg-wasm throws "Already initialized" if the underlying wasm module was not
    // re-evaluated (e.g. during Vite HMR when only this module reloads). Safe to ignore.
    if (!(e instanceof Error && e.message.includes("Already initialized"))) throw e;
  }
  _fontBuffers = fontBufs.map((buf) => new Uint8Array(buf));
  initialized = true;
}

let _fontBuffers: Uint8Array[] = [];

export async function renderDashboardPng(data: DashboardData): Promise<Uint8Array> {
  await ensureInit();
  const svg = renderDashboardSvg(data, { mode: "bw" });
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 400 },
    font: {
      fontBuffers: _fontBuffers,
      loadSystemFonts: false,
      defaultFontFamily: "Inter",
    },
  });
  return resvg.render().asPng();
}

export async function renderErrorPng(message: string): Promise<Uint8Array> {
  await ensureInit();
  const safe = message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
    <rect width="400" height="300" fill="#ffffff" stroke="#000000" stroke-width="2"/>
    <text x="200" y="140" text-anchor="middle" font-family="Inter, sans-serif" font-size="22" font-weight="700" fill="#000000">${safe}</text>
    <text x="200" y="170" text-anchor="middle" font-family="Inter, sans-serif" font-size="11" fill="#000000">logr · dashboard</text>
  </svg>`;
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 400 },
    font: {
      fontBuffers: _fontBuffers,
      loadSystemFonts: false,
      defaultFontFamily: "Inter",
    },
  });
  return resvg.render().asPng();
}
