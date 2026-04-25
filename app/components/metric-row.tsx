import { useFetcher, Link } from "react-router";
import { isGoalMet, type MetricType, type GoalDirection } from "~/lib/types";

interface MetricRowProps {
  metric: {
    id: number;
    name: string;
    type: MetricType;
    unit: string | null;
    goal: number | null;
    goalDirection: GoalDirection | null;
    weeklyTarget: number | null;
  };
  entry: { value: number } | null;
  date: string;
  weeklyDone: number;
  onValueTap?: () => void;
}

export function MetricRow({ metric, entry, date, weeklyDone, onValueTap }: MetricRowProps) {
  if (metric.type === "boolean") {
    return <BooleanRow metric={metric} entry={entry} date={date} weeklyDone={weeklyDone} />;
  }
  return <NumericRow metric={metric} entry={entry} date={date} weeklyDone={weeklyDone} onValueTap={onValueTap} />;
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex-shrink-0 relative"
      style={{
        width: 46, height: 28, borderRadius: 14, border: "none",
        background: on ? "var(--color-success)" : "var(--color-outline-variant)",
        transition: "background 160ms ease", cursor: "pointer",
      }}
    >
      <div
        className="absolute rounded-full bg-white"
        style={{
          top: 4, width: 20, height: 20,
          boxShadow: "0 1px 3px rgba(0,0,0,.18)",
          transition: "left 160ms ease",
          left: on ? 22 : 4,
        }}
      />
    </button>
  );
}

function FreqBadge({ weeklyTarget }: { weeklyTarget: number }) {
  return (
    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-surface-container-high text-text-muted border border-outline-variant whitespace-nowrap">
      {weeklyTarget}× / week
    </span>
  );
}

function WeekDots({ done, target }: { done: number; target: number }) {
  return (
    <div className="flex gap-1 items-center">
      {Array.from({ length: 7 }, (_, i) => {
        const filled = i < done;
        const metTarget = done >= target;
        return (
          <div
            key={i}
            className={`w-2 h-2 rounded-full ${
              filled
                ? metTarget
                  ? "bg-success"
                  : "bg-primary"
                : "bg-outline-variant"
            } ${i >= target ? "opacity-35" : ""}`}
            style={
              i === target - 1 && !metTarget
                ? { outline: "1.5px solid var(--color-primary)", outlineOffset: 1 }
                : undefined
            }
          />
        );
      })}
    </div>
  );
}

function BooleanRow({ metric, entry, date, weeklyDone }: MetricRowProps) {
  const fetcher = useFetcher();
  const isChecked = entry?.value === 1;
  const optimisticChecked =
    fetcher.formData ? fetcher.formData.get("value") === "1" : isChecked;

  const isWeekly = metric.weeklyTarget != null;
  const weeklyMet = isWeekly && weeklyDone >= metric.weeklyTarget!;

  let subtitle: string;
  if (isWeekly) {
    subtitle = weeklyMet
      ? `${weeklyDone} / ${metric.weeklyTarget} this week · done`
      : `${weeklyDone} / ${metric.weeklyTarget} this week`;
  } else {
    subtitle = optimisticChecked ? "" : "Not tracked";
  }

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    const formData = new FormData();
    formData.set("intent", "log-entry");
    formData.set("metricId", metric.id.toString());
    formData.set("date", date);
    formData.set("value", optimisticChecked ? "0" : "1");
    fetcher.submit(formData, { method: "post" });
  }

  return (
    <div className="bg-bg-card rounded-[14px] px-3 flex items-center gap-2.5 border border-outline-variant" style={{ minHeight: 56, padding: "0 12px" }}>
      <Link to={`/metrics/${metric.id}`} className="flex-1 min-w-0 py-2.5">
        <div className="flex items-center gap-1.5" style={{ marginBottom: subtitle || isWeekly ? 3 : 0 }}>
          <div className="font-medium text-[15px] text-text whitespace-nowrap overflow-hidden text-ellipsis">{metric.name}</div>
          {isWeekly && <FreqBadge weeklyTarget={metric.weeklyTarget!} />}
        </div>
        {isWeekly ? (
          <WeekDots done={weeklyDone} target={metric.weeklyTarget!} />
        ) : (
          subtitle && <div className="text-xs text-outline font-mono mt-0.5">{subtitle}</div>
        )}
      </Link>
      {isWeekly ? (
        <button
          onClick={handleToggle}
          className={`w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0 ${
            optimisticChecked ? "bg-success" : "bg-outline-variant"
          }`}
          style={{ transition: "background 160ms ease" }}
        >
          {optimisticChecked && (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          )}
        </button>
      ) : (
        <Toggle on={optimisticChecked} onToggle={() => handleToggle({stopPropagation: () => {}} as React.MouseEvent)} />
      )}
    </div>
  );
}

function NumericRow({ metric, entry, date, weeklyDone, onValueTap }: MetricRowProps) {
  const direction = metric.goalDirection;
  const goalMet = entry?.value != null && isGoalMet(entry.value, metric.goal, direction);
  const numericMet = metric.goal != null && goalMet;
  const unitLabel = metric.unit ?? "";
  const isWeekly = metric.weeklyTarget != null;

  let subtitle: string;
  if (isWeekly) {
    const weeklyMet = weeklyDone >= metric.weeklyTarget!;
    subtitle = weeklyMet
      ? `${weeklyDone} / ${metric.weeklyTarget} this week · done`
      : `${weeklyDone} / ${metric.weeklyTarget} this week`;
  } else if (metric.goal == null || direction == null) {
    subtitle = entry?.value != null
      ? `${entry.value} ${unitLabel}`.trim()
      : "Not tracked";
  } else if (entry?.value == null) {
    subtitle = `Goal: ${metric.goal} ${unitLabel}`.trim();
  } else if (goalMet) {
    subtitle = `Goal Met · ${entry.value} ${unitLabel}`.trim();
  } else if (direction === "at_least") {
    subtitle = `Current: ${entry.value} / Goal: ${metric.goal} ${unitLabel}`.trim();
  } else if (direction === "at_most") {
    subtitle = `${entry.value} / ${metric.goal} ${unitLabel}`.trim();
  } else {
    subtitle = `${entry.value} / ${metric.goal} ${unitLabel}`.trim();
  }

  return (
    <div className="bg-bg-card rounded-[14px] flex items-center gap-2.5 border border-outline-variant" style={{ minHeight: 56, padding: "0 12px" }}>
      <Link to={`/metrics/${metric.id}`} className="flex-1 min-w-0 py-2.5">
        <div className="flex items-center gap-1.5" style={{ marginBottom: isWeekly || subtitle ? 3 : 0 }}>
          <div className="font-medium text-[15px] text-text whitespace-nowrap overflow-hidden text-ellipsis">{metric.name}</div>
          {isWeekly && <FreqBadge weeklyTarget={metric.weeklyTarget!} />}
        </div>
        {isWeekly ? (
          <WeekDots done={weeklyDone} target={metric.weeklyTarget!} />
        ) : (
          <div className={`text-xs font-mono mt-px ${numericMet ? "text-success" : "text-outline"}`}>{subtitle}</div>
        )}
      </Link>
      <div
        onClick={(e) => { e.stopPropagation(); onValueTap?.(); }}
        className="cursor-pointer font-mono text-[15px] font-semibold min-w-[44px] text-right flex-shrink-0"
        style={{ color: numericMet ? 'var(--color-success)' : entry?.value == null ? 'var(--color-outline)' : 'var(--color-text)', padding: '10px 0' }}
      >
        {entry?.value == null ? "—" : `${entry.value}`}
        {entry?.value != null && metric.unit && (
          <span className="text-[11px] text-outline ml-0.5">{metric.unit}</span>
        )}
      </div>
    </div>
  );
}
