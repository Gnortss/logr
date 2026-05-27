import { Resvg, initWasm } from "@resvg/resvg-wasm";
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm?arraybuffer";
import interRegular from "../../public/fonts/Inter-Regular.ttf?arraybuffer";
import interBold from "../../public/fonts/Inter-Bold.ttf?arraybuffer";
import jbMonoBold from "../../public/fonts/JetBrainsMono-Bold.ttf?arraybuffer";
import { renderDashboardSvg } from "~/lib/dashboard-svg";
import type { DashboardData } from "~/lib/dashboard";

let initialized = false;
async function ensureInit(): Promise<void> {
  if (!initialized) {
    await initWasm(resvgWasm as ArrayBuffer);
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
        new Uint8Array(interRegular as ArrayBuffer),
        new Uint8Array(interBold as ArrayBuffer),
        new Uint8Array(jbMonoBold as ArrayBuffer),
      ],
      loadSystemFonts: false,
      defaultFontFamily: "Inter",
    },
  });
  return resvg.render().asPng();
}
