/** Calendar date (yyyy-mm-dd) right now in the given IANA time zone. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function appTimeZone(env: Record<string, string | undefined> = process.env): string {
  return env.APP_TIMEZONE?.trim() || "America/Los_Angeles";
}

/** The calendar date `n` days after `iso` (negative for before). */
export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
