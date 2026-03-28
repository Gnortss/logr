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

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-bg rounded-xl p-3 text-center">
      <div className="text-lg font-semibold text-text">{value}</div>
      <div className="text-xs text-text-muted">{label}</div>
    </div>
  );
}

function BooleanStatsPanel({ stats }: { stats: BooleanStats }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <StatCard label="Current Streak" value={`${stats.currentStreak}d`} />
      <StatCard label="Longest Streak" value={`${stats.longestStreak}d`} />
      <StatCard label="Total Days" value={stats.totalDaysDone} />
      <StatCard label="Completion" value={`${Math.round(stats.completionRate)}%`} />
    </div>
  );
}

function NumericStatsPanel({ stats, trend, unit }: { stats: NumericStats; trend: Trend; unit: string | null }) {
  const u = unit ? ` ${unit}` : "";
  const trendIcon = trend === "up" ? "↑" : trend === "down" ? "↓" : "→";

  return (
    <div className="grid grid-cols-2 gap-2">
      <StatCard label="Average" value={`${stats.average.toFixed(1)}${u}`} />
      <StatCard label="Total" value={`${stats.total.toFixed(1)}${u}`} />
      <StatCard label="Min" value={`${stats.min}${u}`} />
      <StatCard label="Max" value={`${stats.max}${u}`} />
      <StatCard label="Days Tracked" value={stats.daysTracked} />
      <StatCard label="Goal Hit Rate" value={`${Math.round(stats.goalHitRate)}%`} />
      <StatCard label="Days Goal Met" value={stats.daysGoalMet} />
      <StatCard label="Trend" value={trendIcon} />
    </div>
  );
}
