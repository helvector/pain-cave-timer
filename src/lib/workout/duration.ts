/**
 * Parse a human duration to whole seconds. Returns undefined when the text
 * is not a duration. Handles the forms seen in TrainingPeaks emails
 * ("20 min", "1 hr 30 min", "4.00 hrs") and the shorthand coaches type
 * ("90s", "10m", "1:30", "1:30:00", "10'", "30\"").
 */
export function parseDuration(text: string): number | undefined {
  const s = text.trim().toLowerCase();
  if (!s) return undefined;

  // mm:ss or h:mm:ss
  const clock = s.match(/^(\d+):(\d{1,2})(?::(\d{2}))?$/);
  if (clock) {
    const [, a, b, c] = clock;
    return c !== undefined
      ? Number(a) * 3600 + Number(b) * 60 + Number(c)
      : Number(a) * 60 + Number(b);
  }

  // Sequence of <number><unit> groups: "1 hr 30 min", "1h30m", "4.00 hrs", "10'", "30""
  const unit = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m|'|seconds?|secs?|s|")(?![a-z])/g;
  let total = 0;
  let matched = 0;
  let consumed = "";
  for (const m of s.matchAll(unit)) {
    const n = Number(m[1]);
    const u = m[2];
    if (u.startsWith("h")) total += n * 3600;
    else if (u.startsWith("m") || u === "'") total += n * 60;
    else total += n;
    matched++;
    consumed += m[0];
  }
  if (matched === 0) return undefined;
  // Reject if there is leftover text that isn't whitespace (e.g. "10 min @ ...").
  if (s.replace(/\s+/g, "") !== consumed.replace(/\s+/g, "")) return undefined;
  return Math.round(total);
}

/** "1 hr 30 min" style, used for planned time and for display in the CLI. */
export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h} hr`);
  if (m) parts.push(`${m} min`);
  if (s || parts.length === 0) parts.push(`${s} sec`);
  return parts.join(" ");
}

/** m:ss or h:mm:ss for tables. */
export function formatClock(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? h + ":" : ""}${mm}:${String(s).padStart(2, "0")}`;
}
