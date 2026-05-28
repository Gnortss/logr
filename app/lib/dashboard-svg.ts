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
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDateLong(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  const mon = date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  return `${dow} · ${mon} ${d}`;
}

function dayLetters(): string[] {
  return ["M", "T", "W", "T", "F", "S", "S"];
}

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
  } else {
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

export function renderDashboardSvg(data: DashboardData, opts: RenderOpts): string {
  const c = p(opts.mode);
  const w = 400, h = 300;

  const header = `
    <text x="14" y="22" font-family="Inter, system-ui, sans-serif" font-size="12" font-weight="600" fill="${c.text}">${esc(formatDateLong(data.date))}</text>
    <text x="${w - 14}" y="22" font-family="ui-monospace, monospace" font-size="10" fill="${c.textMuted}" text-anchor="end">Wk ${data.weekNumber}</text>
  `;

  const heroX = 12, heroY = 32, heroW = w - 24, heroH = 80;
  const heroFill = opts.mode === "color" ? c.primaryFixed : "#ffffff";
  const heroStroke = opts.mode === "bw" ? c.outline : "none";

  const heroLabel = `<text x="${heroX + 12}" y="${heroY + 16}" font-family="Inter, system-ui, sans-serif" font-size="8" font-weight="700" fill="${c.primaryContainer}" letter-spacing="0.6">WEEKLY PROGRESS</text>`;
  const heroBig = `
    <text x="${heroX + 12}" y="${heroY + 50}" font-family="JetBrainsMono Bold, ui-monospace, monospace" font-size="36" font-weight="800" fill="${c.primaryContainer}">${data.hero.done}<tspan font-size="16" fill="${c.textMuted}">/${data.hero.total}</tspan></text>
  `;
  const heroSub = `<text x="${heroX + 12}" y="${heroY + 68}" font-family="ui-monospace, monospace" font-size="9" fill="${c.textMuted}">${data.hero.onTrackCount} of ${data.hero.totalGoals} on track</text>`;

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

  const rowsStartY = heroY + heroH + 8;
  const rowH = 28;
  const rowGap = 3;
  const rowX = 12;
  const rowW = w - 24;
  let rows = "";
  if (data.metrics.length === 0) {
    rows += `
    <rect x="${rowX}" y="${rowsStartY}" width="${rowW}" height="${rowH * 3}" rx="7" fill="${c.card}" stroke="${c.outline}" stroke-width="1"/>
    <text x="${rowX + rowW / 2}" y="${rowsStartY + 40}" font-family="Inter, system-ui, sans-serif" font-size="13" font-weight="600" fill="${c.textMuted}" text-anchor="middle">No habits yet — add one in the app</text>
  `;
  } else {
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
  }

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
