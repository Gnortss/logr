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
    <div className="divide-y divide-border">
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
    <div className="flex items-center py-2 px-1 min-h-[44px]">
      <span className="text-sm text-text-muted w-28">{formatDateDisplay(entry.date)}</span>
      {editing ? (
        <div className="flex items-center gap-2 flex-1 justify-end">
          <input type="number" step="any" value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            autoFocus
            className="w-20 px-2 py-1 rounded border border-border bg-bg text-text text-right text-sm" />
          <button onClick={handleSave} className="text-sm text-accent font-medium">Save</button>
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
