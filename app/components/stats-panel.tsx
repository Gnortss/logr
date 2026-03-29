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
  hasGoal: boolean;
}

type StatsPanelProps = BooleanStatsPanelProps | NumericStatsPanelProps;

export function StatsPanel(props: StatsPanelProps) {
  if (props.type === "boolean") {
    return <BooleanStatsPanel stats={props.stats} />;
  }
  return <NumericStatsPanel stats={props.stats} trend={props.trend} unit={props.unit} hasGoal={props.hasGoal} />;
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

function NumericStatsPanel({ stats, trend, unit, hasGoal }: { stats: NumericStats; trend: Trend; unit: string | null; hasGoal: boolean }) {
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
      <div className={`grid ${hasGoal ? "grid-cols-2" : "grid-cols-1"} gap-3`}>
        {hasGoal && <StatCard label="Longest Streak" value={stats.daysGoalMet} sublabel="Days" />}
        <StatCard label="Current Trend" value={trendIcon} sublabel={trend} />
      </div>
      {hasGoal && (
        <div className="bg-primary rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-white/70 uppercase tracking-wide">Goal Hit Rate</div>
            <div className="text-3xl font-bold font-heading text-white">{Math.round(stats.goalHitRate)}%</div>
          </div>
          <CompletionRing percent={stats.goalHitRate} />
        </div>
      )}
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
