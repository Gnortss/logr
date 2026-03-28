import { useNavigate } from "react-router";
import { getWeekDays, formatDayAbbr, formatDayNum, today as getToday, addDays } from "~/lib/date";

interface DateNavProps {
  date: string;
}

export function DateNav({ date }: DateNavProps) {
  const navigate = useNavigate();
  const todayStr = getToday();
  const weekDays = getWeekDays(date);
  const todayWeek = getWeekDays(todayStr);
  const isCurrentWeek = weekDays[0] === todayWeek[0];

  function goTo(newDate: string) {
    if (newDate === getToday()) {
      navigate("/");
    } else {
      navigate(`/?date=${newDate}`);
    }
  }

  function goToPrevWeek() {
    goTo(addDays(weekDays[0], -7));
  }

  function goToNextWeek() {
    goTo(addDays(weekDays[0], 7));
  }

  const isToday = date === todayStr;

  return (
    <div className="px-4 pt-4 pb-2">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold font-heading text-text">
          {isToday ? "Today" : new Date(date + "T00:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" })}
        </h1>
        <div className="flex gap-1">
          <button
            onClick={goToPrevWeek}
            className="p-2 rounded-lg hover:bg-surface-container-high transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Previous week"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </button>
          {!isCurrentWeek && (
            <button
              onClick={goToNextWeek}
              className="p-2 rounded-lg hover:bg-surface-container-high transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Next week"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
                <path d="m9 18 6-6-6-6"/>
              </svg>
            </button>
          )}
        </div>
      </div>
      <div className="flex justify-between">
        {weekDays.map((day) => {
          const isActive = day === date;
          const isFuture = day > todayStr;
          return (
            <button
              key={day}
              onClick={() => !isFuture && goTo(day)}
              disabled={isFuture}
              className={`flex flex-col items-center gap-1 py-2 px-2 min-w-[44px] rounded-xl transition-colors ${
                isActive
                  ? "bg-primary text-white"
                  : isFuture
                  ? "text-surface-dim cursor-not-allowed"
                  : "text-text-muted hover:bg-surface-container-high"
              }`}
            >
              <span className="text-[11px] font-semibold tracking-wide">
                {formatDayAbbr(day)}
              </span>
              <span className={`text-base font-semibold ${isActive ? "text-white" : ""}`}>
                {formatDayNum(day)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
