export function todayInTz(tz: string | undefined, now: Date = new Date()): string {
  if (!tz) return now.toISOString().slice(0, 10);
  try {
    // en-CA produces YYYY-MM-DD format reliably.
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return fmt.format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}
