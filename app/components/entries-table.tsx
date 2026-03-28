import { useFetcher } from "react-router";
import { useState } from "react";
import { formatDateDisplay } from "~/lib/date";

interface EntriesTableProps {
  entries: { date: string; value: number }[];
  metricId: number;
  type: string;
  unit: string | null;
}

export function EntriesTable({ entries, metricId, type, unit }: EntriesTableProps) {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((entry) => (
        <EntryRow key={entry.date} entry={entry} metricId={metricId} type={type} unit={unit} />
      ))}
    </div>
  );
}

function EntryRow({ entry, metricId, type, unit }: {
  entry: { date: string; value: number };
  metricId: number;
  type: string;
  unit: string | null;
}) {
  const fetcher = useFetcher();
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(entry.value.toString());

  const displayValue = type === "boolean"
    ? entry.value === 1 ? "Done" : "Missed"
    : `${entry.value} ${unit ?? ""}`.trim();

  function handleSave() {
    const val = parseFloat(inputValue);
    if (isNaN(val)) return;
    fetcher.submit(
      { intent: "update-entry", metricId: metricId.toString(), date: entry.date, value: val.toString() },
      { method: "post" }
    );
    setEditing(false);
  }

  return (
    <div className="flex items-center py-3 px-4 min-h-[44px] bg-surface-container-low rounded-lg">
      <span className="text-sm text-text-muted w-28">{formatDateDisplay(entry.date)}</span>
      {editing ? (
        <div className="flex items-center gap-2 flex-1 justify-end">
          <input type="number" step="any" value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            autoFocus
            className="w-20 px-3 py-1 rounded-lg bg-surface-container-high text-text text-right text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <button onClick={handleSave} className="text-sm text-primary font-medium">Save</button>
          <button onClick={() => setEditing(false)} className="text-sm text-text-muted">Cancel</button>
        </div>
      ) : (
        <button
          onClick={() => { setInputValue(entry.value.toString()); setEditing(true); }}
          className="flex-1 text-right text-sm text-text font-medium">
          {displayValue}
        </button>
      )}
    </div>
  );
}
