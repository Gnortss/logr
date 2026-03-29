import { useFetcher, Link } from "react-router";
import { useState } from "react";
import { isGoalMet, type MetricType, type GoalDirection } from "~/lib/types";

interface MetricRowProps {
  metric: {
    id: number;
    name: string;
    type: MetricType;
    unit: string | null;
    goal: number | null;
    goalDirection: GoalDirection | null;
  };
  entry: { value: number } | null;
  date: string;
}

export function MetricRow({ metric, entry, date }: MetricRowProps) {
  if (metric.type === "boolean") {
    return <BooleanRow metric={metric} entry={entry} date={date} />;
  }
  return <NumericRow metric={metric} entry={entry} date={date} />;
}

function CheckCircle() {
  return (
    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    </div>
  );
}

function EmptyCircle() {
  return (
    <div className="w-8 h-8 rounded-full border-2 border-outline-variant flex-shrink-0" />
  );
}

function BooleanRow({ metric, entry, date }: MetricRowProps) {
  const fetcher = useFetcher();
  const isChecked = entry?.value === 1;
  const optimisticChecked =
    fetcher.formData ? fetcher.formData.get("value") === "1" : isChecked;

  const subtitle = optimisticChecked ? "" : "Not tracked";

  return (
    <div className="bg-bg-card rounded-xl p-4 flex items-center gap-3">
      <Link to={`/metrics/${metric.id}`} className="flex-1 min-w-0">
        <div className="font-heading font-semibold text-base text-text">{metric.name}</div>
        {subtitle && <div className="text-sm text-text-muted mt-0.5">{subtitle}</div>}
      </Link>
      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="log-entry" />
        <input type="hidden" name="metricId" value={metric.id} />
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="value" value={optimisticChecked ? "0" : "1"} />
        <button type="submit" className="min-w-[44px] min-h-[44px] flex items-center justify-center">
          {optimisticChecked ? <CheckCircle /> : <EmptyCircle />}
        </button>
      </fetcher.Form>
    </div>
  );
}

function NumericRow({ metric, entry, date }: MetricRowProps) {
  const fetcher = useFetcher();
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(entry?.value?.toString() ?? "");

  const direction = metric.goalDirection;
  const goalMet = entry?.value != null && isGoalMet(entry.value, metric.goal, direction);
  const unitLabel = metric.unit ?? "";

  let subtitle: string;
  if (metric.goal == null || direction == null) {
    // No goal set
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
    // approximately
    subtitle = `${entry.value} / ${metric.goal} ${unitLabel}`.trim();
  }

  function handleSubmit() {
    const val = parseFloat(inputValue);
    if (isNaN(val)) return;
    fetcher.submit(
      { intent: "log-entry", metricId: metric.id.toString(), date, value: val.toString() },
      { method: "post" }
    );
    setEditing(false);
  }

  return (
    <div className="bg-bg-card rounded-xl p-4 flex items-center gap-3">
      <Link to={`/metrics/${metric.id}`} className="flex-1 min-w-0">
        <div className="font-heading font-semibold text-base text-text">{metric.name}</div>
        <div className="text-sm text-text-muted mt-0.5">{subtitle}</div>
      </Link>
      {editing ? (
        <div className="flex items-center gap-2">
          <input type="number" step="any" value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            autoFocus
            className="w-20 px-3 py-2 rounded-lg bg-surface-container-high text-text text-right focus:outline-none focus:ring-2 focus:ring-primary" />
          <button onClick={handleSubmit}
            className="px-3 py-2 bg-primary text-white rounded-full text-sm font-medium min-h-[36px]">Save</button>
          <button onClick={() => setEditing(false)}
            className="px-2 py-2 text-text-muted text-sm min-h-[36px]">Cancel</button>
        </div>
      ) : goalMet ? (
        <button
          onClick={() => { setInputValue(entry?.value?.toString() ?? ""); setEditing(true); }}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <CheckCircle />
        </button>
      ) : (
        <button
          onClick={() => { setInputValue(entry?.value?.toString() ?? ""); setEditing(true); }}
          className="px-3 py-1.5 rounded-full bg-surface-container-high text-sm font-medium text-text-muted min-h-[36px]"
        >
          {metric.goal != null && direction === "at_least" && entry?.value != null
            ? `${parseFloat(Math.max(0, metric.goal - entry.value).toFixed(2))} LEFT`
            : "Log"}
        </button>
      )}
    </div>
  );
}
