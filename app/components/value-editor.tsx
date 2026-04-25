import { useFetcher } from "react-router";
import { useState } from "react";
import type { GoalDirection } from "~/lib/types";

const GOAL_DIR_LABELS: Record<string, string> = {
  at_least: "At least",
  at_most: "At most",
  approximately: "Approximately",
};

interface ValueEditorProps {
  metric: {
    id: number;
    name: string;
    unit: string | null;
    goal: number | null;
    goalDirection: GoalDirection | null;
  };
  currentValue: number | null;
  date: string;
  onClose: () => void;
}

export function ValueEditor({ metric, currentValue, date, onClose }: ValueEditorProps) {
  const [val, setVal] = useState(currentValue != null ? String(currentValue) : "");
  const fetcher = useFetcher();

  function handleSave() {
    const parsed = parseFloat(val);
    if (isNaN(parsed) || parsed < 0) return;
    fetcher.submit(
      { intent: "log-entry", metricId: metric.id.toString(), date, value: parsed.toString() },
      { method: "post" }
    );
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(28, 25, 23, 0.5)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg bg-bg-card rounded-t-[28px] px-4 pt-5 pb-8">
        <div className="flex justify-between items-center mb-3.5">
          <div>
            <div className="font-semibold text-base text-text">{metric.name}</div>
            {metric.goal != null && metric.goalDirection != null && (
              <div className="text-xs text-outline font-mono mt-0.5">
                goal: {GOAL_DIR_LABELS[metric.goalDirection] ?? metric.goalDirection} {metric.goal} {metric.unit ?? ""}
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-outline p-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex gap-2 items-stretch">
          <input
            type="number"
            step="any"
            min="0"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            autoFocus
            placeholder="Enter value"
            className="flex-1 text-xl font-mono font-semibold rounded-[10px] px-3.5 py-2.5 text-text bg-bg border-[1.5px] border-primary outline-none"
            style={{ boxShadow: "var(--color-shadow-focus)" }}
          />
          {metric.unit && (
            <div className="flex items-center text-[15px] text-text-muted pr-1">{metric.unit}</div>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={!val}
          className={`w-full mt-3 py-3.5 font-semibold text-base rounded-[14px] min-h-[44px] transition-colors ${
            val
              ? "bg-primary text-white hover:bg-primary-hover cursor-pointer"
              : "bg-outline-variant text-outline cursor-not-allowed"
          }`}
        >
          Save
        </button>
      </div>
    </div>
  );
}
