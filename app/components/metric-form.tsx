import { Form, useNavigation } from "react-router";
import { useState } from "react";
import { METRIC_TYPES, UNITS_BY_TYPE, type MetricType } from "~/lib/types";

interface MetricFormProps {
  open: boolean;
  onClose: () => void;
  metric?: {
    id: number;
    name: string;
    type: MetricType;
    unit: string | null;
    goal: number | null;
  };
}

export function MetricForm({ open, onClose, metric }: MetricFormProps) {
  const isEdit = !!metric;
  const [type, setType] = useState<MetricType>(metric?.type ?? "boolean");
  const units = UNITS_BY_TYPE[type];
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-bg-card rounded-t-2xl p-6 pb-8">
        <h2 className="text-lg font-semibold font-heading text-text mb-4">
          {isEdit ? "Edit Metric" : "Add Metric"}
        </h2>
        <Form method="post" onSubmit={() => setTimeout(onClose, 100)}>
          <input type="hidden" name="intent" value={isEdit ? "edit-metric" : "add-metric"} />
          {isEdit && <input type="hidden" name="metricId" value={metric.id} />}
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-text mb-1">Name</label>
              <input id="name" name="name" type="text" required defaultValue={metric?.name}
                placeholder="e.g. Water intake"
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
                <select id="unit" name="unit" disabled={isEdit} defaultValue={metric?.unit ?? units[0]}
                  className="w-full px-3 py-3 rounded-lg bg-surface-container-high text-text focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50">
                  {units.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            )}
            {type !== "boolean" && (
              <div>
                <label htmlFor="goal" className="block text-sm font-medium text-text mb-1">Daily Goal</label>
                <input id="goal" name="goal" type="number" step="any" required
                  defaultValue={metric?.goal ?? undefined} placeholder="e.g. 3"
                  className="w-full px-3 py-3 rounded-lg bg-surface-container-high text-text placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="flex-1 py-3 rounded-full bg-surface-container-high text-text font-medium min-h-[44px]">
                Cancel
              </button>
              <button type="submit" disabled={isSubmitting}
                className="flex-1 py-3 bg-primary text-white font-medium rounded-full hover:bg-primary-container transition-colors disabled:opacity-50 min-h-[44px]">
                {isSubmitting ? "..." : isEdit ? "Save" : "Add"}
              </button>
            </div>
          </div>
        </Form>
      </div>
    </div>
  );
}
