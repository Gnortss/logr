import { Form, useNavigation } from "react-router";
import { useState } from "react";
import { METRIC_TYPES, UNITS_BY_TYPE, type MetricType, type GoalDirection } from "~/lib/types";

interface MetricFormProps {
  open: boolean;
  onClose: () => void;
  metric?: {
    id: number;
    name: string;
    type: MetricType;
    unit: string | null;
    goal: number | null;
    goalDirection: GoalDirection | null;
    weeklyTarget: number | null;
  };
}

export function MetricForm({ open, onClose, metric }: MetricFormProps) {
  const isEdit = !!metric;
  const [type, setType] = useState<MetricType>(metric?.type ?? "boolean");
  const units = UNITS_BY_TYPE[type];
  const navigation = useNavigation();
  const [goalEnabled, setGoalEnabled] = useState(
    isEdit ? metric.goal != null : true
  );
  const [goalDirection, setGoalDirection] = useState(
    metric?.goalDirection ?? "at_least"
  );
  const [isWeekly, setIsWeekly] = useState(isEdit ? (metric.weeklyTarget != null) : false);
  const [weeklyTarget, setWeeklyTarget] = useState(metric?.weeklyTarget ?? 3);
  const isSubmitting = navigation.state === "submitting";

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-bg-card rounded-t-[28px] p-4 pb-8 max-h-[90%] overflow-y-auto">
        <div className="w-9 h-1 rounded-full bg-border-strong mx-auto mb-4" />
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-[17px] font-semibold text-text">
            {isEdit ? "Edit metric" : "New metric"}
          </h2>
          <button type="button" onClick={onClose} className="text-outline p-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <Form method="post" onSubmit={() => setTimeout(onClose, 100)}>
          <input type="hidden" name="intent" value={isEdit ? "edit-metric" : "add-metric"} />
          {isEdit && <input type="hidden" name="metricId" value={metric.id} />}
          {isWeekly && <input type="hidden" name="weeklyTarget" value={weeklyTarget} />}
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-text mb-1">Name</label>
              <input id="name" name="name" type="text" required defaultValue={metric?.name}
                placeholder="e.g. Gym session"
                className="w-full px-3 py-3 rounded-lg bg-surface-container-high text-text placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-text mb-1">Type</label>
              <select id="type" name="type" disabled={isEdit} value={type}
                onChange={(e) => setType(e.target.value as MetricType)}
                className="w-full px-3 py-3 rounded-lg bg-surface-container-high text-text focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50">
                {METRIC_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            {units.length > 0 && (
              <div>
                <label htmlFor="unit" className="block text-sm font-medium text-text mb-1">Unit</label>
                <select id="unit" name="unit" disabled={isEdit || units.length === 1}
                  defaultValue={metric?.unit ?? units[0]}
                  className="w-full px-3 py-3 rounded-lg bg-surface-container-high text-text focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50">
                  {units.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            )}
            {/* Frequency */}
            <div className="bg-surface-container-high rounded-xl p-4">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-sm font-medium text-text">Not every day</span>
                  <span className="block text-xs text-text-muted mt-0.5">Set a weekly target instead</span>
                </div>
                <input
                  type="checkbox"
                  checked={isWeekly}
                  onChange={(e) => setIsWeekly(e.target.checked)}
                  className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary"
                />
              </label>
              {isWeekly && (
                <div className="mt-4 pt-4 border-t border-outline-variant">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-text">Days per week</span>
                    <span className="text-xs text-text-muted font-mono">any {weeklyTarget} of 7</span>
                  </div>
                  <div className="flex items-center border border-outline-variant rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setWeeklyTarget((v) => Math.max(1, v - 1))}
                      disabled={weeklyTarget <= 1}
                      className="w-12 h-10 text-lg text-text disabled:text-text-muted flex items-center justify-center"
                    >
                      −
                    </button>
                    <div className="flex-1 text-center font-mono text-lg font-semibold text-text">
                      {weeklyTarget}
                    </div>
                    <button
                      type="button"
                      onClick={() => setWeeklyTarget((v) => Math.min(6, v + 1))}
                      disabled={weeklyTarget >= 6}
                      className="w-12 h-10 text-lg text-text disabled:text-text-muted flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                  <div className="flex gap-1 mt-3 justify-center">
                    {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => (
                      <div
                        key={i}
                        className={`w-8 h-8 rounded-md flex items-center justify-center text-xs font-semibold font-mono ${
                          i < weeklyTarget
                            ? "bg-primary-fixed text-primary border border-primary"
                            : "bg-surface-container-high text-text-muted"
                        }`}
                      >
                        {day}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-text-muted text-center mt-2">
                    Any {weeklyTarget} days — order doesn't matter
                  </p>
                </div>
              )}
            </div>
            {type !== "boolean" && (
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={goalEnabled}
                    onChange={(e) => setGoalEnabled(e.target.checked)}
                    className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary"
                  />
                  <span className="text-sm font-medium text-text">Set a daily goal</span>
                </label>
                {goalEnabled && (
                  <>
                    <div>
                      <label htmlFor="goalDirection" className="block text-sm font-medium text-text mb-1">Direction</label>
                      <select
                        id="goalDirection"
                        name="goalDirection"
                        value={goalDirection}
                        onChange={(e) => setGoalDirection(e.target.value)}
                        className="w-full px-3 py-3 rounded-lg bg-surface-container-high text-text focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="at_least">At least</option>
                        <option value="at_most">At most</option>
                        <option value="approximately">Approximately</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="goal" className="block text-sm font-medium text-text mb-1">Daily Goal</label>
                      <input id="goal" name="goal" type="number" step="any" required
                        defaultValue={metric?.goal ?? undefined} placeholder="e.g. 3"
                        className="w-full px-3 py-3 rounded-lg bg-surface-container-high text-text placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                    {isEdit && (
                      <p className="text-xs text-text-muted">
                        Changing the goal applies to all tracked data, including past entries.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
            <button type="submit" disabled={isSubmitting}
              className="w-full py-3.5 bg-primary text-white font-semibold text-base rounded-[14px] hover:bg-primary-hover transition-colors disabled:opacity-50 min-h-[44px] mt-1">
              {isSubmitting ? "..." : isEdit ? "Save" : "Save metric"}
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
