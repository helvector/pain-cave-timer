import { readFileSync } from "node:fs";
import path from "node:path";
import { parseTrainingPeaksEmail } from "./index";
import type { Workout } from "./types";

/**
 * The redacted fixture as a workout, for trying the UI without a mailbox.
 * Dates are shifted so "today" always has a session.
 */
export function demoWorkouts(todayISO: string): Workout[] {
  const html = readFileSync(path.join(process.cwd(), "fixtures", "trainingpeaks-sweet-spot-3x15.html"), "utf8");
  const { days } = parseTrainingPeaksEmail(html, { subject: "Schedule for Thursday 09/10/2026 to Friday 09/11/2026" });
  const next = new Date(`${todayISO}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const dates = [todayISO, next.toISOString().slice(0, 10)];
  return days.map((d, i) => ({ ...d, date: dates[i] ?? d.date, title: `${d.title} (demo)` }));
}
