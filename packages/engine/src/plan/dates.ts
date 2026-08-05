/**
 * Converts a UTC Date to a local ISO date string (YYYY-MM-DD) in the given
 * timezone. Uses the "en-CA" locale which produces ISO 8601 date format.
 *
 * Throws a RangeError when the timezone is not recognized by the runtime.
 */
export function toLocalDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
