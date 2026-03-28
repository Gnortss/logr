import { useNavigate } from "react-router";
import { addDays, formatDateDisplay, today as getToday } from "~/lib/date";

interface DateNavProps {
  date: string;
}

export function DateNav({ date }: DateNavProps) {
  const navigate = useNavigate();
  const isToday = date === getToday();

  function goTo(newDate: string) {
    if (newDate === getToday()) {
      navigate("/");
    } else {
      navigate(`/?date=${newDate}`);
    }
  }

  return (
    <div className="flex items-center justify-center gap-4 px-4 py-3 border-b border-border bg-bg-card">
      <button onClick={() => goTo(addDays(date, -1))}
        className="p-2 rounded-lg hover:bg-border transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
        aria-label="Previous day">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
          <path d="m15 18-6-6 6-6"/>
        </svg>
      </button>
      <span className={`text-base font-medium ${isToday ? "text-accent" : "text-text"}`}>
        {isToday ? "Today" : formatDateDisplay(date)}
      </span>
      <button onClick={() => !isToday && goTo(addDays(date, 1))}
        disabled={isToday}
        className="p-2 rounded-lg hover:bg-border transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center disabled:opacity-30"
        aria-label="Next day">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
          <path d="m9 18 6-6-6-6"/>
        </svg>
      </button>
    </div>
  );
}
