import { addDays } from "~/lib/date";
import { isGoalMet, type GoalDirection } from "~/lib/types";

interface HeatmapProps {
  entries: { date: string; value: number }[];
  from: string;
  to: string;
  type: "boolean" | string;
  goal: number | null;
  goalDirection: GoalDirection | null;
  weeklyTarget: number | null;
}

export function Heatmap({ entries, from, to, type, goal, goalDirection, weeklyTarget }: HeatmapProps) {
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
    if (goal == null || goalDirection == null) {
      // No goal: binary — tracked vs not tracked
      return value > 0 ? "bg-primary" : "bg-surface-container-high";
    }
    if (isGoalMet(value, goal, goalDirection)) return "bg-primary";
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
      {weeklyTarget != null && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-primary-fixed rounded-lg">
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth={2} strokeLinecap="round">
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
          </svg>
          <span className="text-xs text-primary font-medium">Target: {weeklyTarget} days / week</span>
        </div>
      )}
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
      {weeklyTarget != null && (
        <div className="mt-2">
          <div
            className="inline-grid gap-1"
            style={{
              gridTemplateRows: "4px",
              gridTemplateColumns: `20px repeat(${totalWeeks}, 16px)`,
            }}
          >
            <div />
            {Array.from({ length: totalWeeks }, (_, wi) => {
              const weekCells = cells.filter((c) => c.weekIndex === wi);
              const daysLogged = weekCells.filter(
                (c) => c.value != null && (type === "boolean" ? c.value === 1 : c.value > 0)
              ).length;
              const met = daysLogged >= weeklyTarget;
              return (
                <div
                  key={wi}
                  className={`rounded-sm ${met ? "bg-primary" : "bg-surface-container-highest"}`}
                />
              );
            })}
          </div>
          <div className="text-[9px] text-text-muted mt-1 ml-5">weekly target met</div>
        </div>
      )}
    </div>
  );
}
