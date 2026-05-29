import { addDays } from "~/lib/date";

export interface StreakEntry {
  date: string;
  value: number;
}

export function computeCurrentStreak(
  entries: StreakEntry[],
  todayDate: string,
  isSuccess: (value: number) => boolean
): number {
  const successByDate = new Map<string, boolean>();
  for (const e of entries) {
    successByDate.set(e.date, isSuccess(e.value));
  }

  let streak = 0;
  let cursor = successByDate.get(todayDate) === true ? todayDate : addDays(todayDate, -1);
  while (successByDate.get(cursor) === true) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
