import { useFetcher, Link } from "react-router";
import { useState } from "react";
import type { MetricType } from "~/lib/types";

interface MetricRowProps {
  metric: {
    id: number;
    name: string;
    type: MetricType;
    unit: string | null;
    goal: number | null;
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

function BooleanRow({ metric, entry, date }: MetricRowProps) {
  const fetcher = useFetcher();
  const isChecked = entry?.value === 1;
  const optimisticChecked =
    fetcher.formData ? fetcher.formData.get("value") === "1" : isChecked;

  return (
    <div className="flex items-center px-4 py-3 min-h-[56px]">
      <Link to={`/metrics/${metric.id}`} className="flex-1 text-text font-medium">
        {metric.name}
      </Link>
      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="log-entry" />
        <input type="hidden" name="metricId" value={metric.id} />
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="value" value={optimisticChecked ? "0" : "1"} />
        <button
          type="submit"
          className={`w-12 h-7 rounded-full transition-colors relative ${
            optimisticChecked ? "bg-success" : "bg-border"
          }`}
          aria-label={`Toggle ${metric.name}`}
        >
          <span
            className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
              optimisticChecked ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </fetcher.Form>
    </div>
  );
}

function NumericRow({ metric, entry, date }: MetricRowProps) {
  const fetcher = useFetcher();
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(entry?.value?.toString() ?? "");

  const displayValue = entry?.value != null ? `${entry.value} ${metric.unit ?? ""}`.trim() : "—";
  const goalMet = metric.goal != null && entry?.value != null && entry.value >= metric.goal;

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
    <div className="flex items-center px-4 py-3 min-h-[56px]">
      <Link to={`/metrics/${metric.id}`} className="flex-1 text-text font-medium">
        {metric.name}
      </Link>
      {editing ? (
        <div className="flex items-center gap-2">
          <input type="number" step="any" value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            autoFocus
            className="w-20 px-2 py-1 rounded-lg border border-border bg-bg text-text text-right focus:outline-none focus:ring-2 focus:ring-accent" />
          <button onClick={handleSubmit}
            className="px-3 py-1 bg-accent text-white rounded-lg text-sm min-h-[36px]">Save</button>
          <button onClick={() => setEditing(false)}
            className="px-2 py-1 text-text-muted text-sm min-h-[36px]">Cancel</button>
        </div>
      ) : (
        <button
          onClick={() => { setInputValue(entry?.value?.toString() ?? ""); setEditing(true); }}
          className={`px-3 py-1 rounded-lg min-h-[36px] text-sm font-medium ${
            goalMet ? "bg-success/20 text-success"
              : entry?.value != null ? "bg-accent/10 text-accent"
              : "bg-border text-text-muted"
          }`}>
          {displayValue}
        </button>
      )}
    </div>
  );
}
