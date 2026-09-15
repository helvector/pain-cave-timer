/** Calendar date (yyyy-mm-dd) right now in the given IANA time zone. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function appTimeZone(env: Record<string, string | undefined> = process.env): string {
  return env.APP_TIMEZONE?.trim() || "America/Los_Angeles";
}
