import type { MailSource } from "../mail/types";
import { addDays } from "../date";
import { parseTrainingPeaksEmail, pickWorkout } from "./index";
import type { Workout } from "./types";

export interface TodayResult {
  workout?: Workout;
  /** Which email it came from, for the confirmation screen. */
  email?: { id: string; subject: string; receivedAt: string };
  /** Every day seen across the emails checked, one per date, newest email wins. */
  days: Workout[];
  warnings: string[];
}

/**
 * Walk recent workout emails, newest first, and return the workout for
 * `date`. The nightly email holds today and tomorrow, so the newest one
 * almost always answers; older ones cover a missed night. Yesterday's
 * session (from the email before) is added to `days` too, so the start
 * screen can show it; nothing else is taken from older emails once the
 * date is found.
 */
export async function fetchWorkoutFor(source: MailSource, date: string, opts: { ftp?: number; thr?: number; limit?: number } = {}): Promise<TodayResult> {
  const messages = await source.latest(opts.limit ?? 5);
  const yesterday = addDays(date, -1);
  const warnings: string[] = [];
  const days: Workout[] = [];
  const has = (iso: string) => days.some((d) => d.date === iso);
  const add = (d: Workout) => { if (!has(d.date)) days.push(d); };
  let found: Omit<TodayResult, "days"> | undefined;
  if (messages.length === 0) warnings.push("No workout emails found in the mailbox.");

  for (const m of messages) {
    const parsed = parseTrainingPeaksEmail(m.html, { ftp: opts.ftp, thr: opts.thr, subject: m.subject, receivedAt: m.receivedAt });
    if (!found) {
      parsed.days.forEach(add);
      const workout = pickWorkout(parsed.days, date);
      if (workout) {
        found = {
          workout,
          email: { id: m.id, subject: m.subject, receivedAt: m.receivedAt.toISOString() },
          warnings: [...warnings, ...parsed.warnings],
        };
      }
    } else {
      const prev = pickWorkout(parsed.days, yesterday);
      if (prev) add(prev);
    }
    if (found && has(yesterday)) break;
  }
  if (found) return { ...found, days };
  warnings.push(`No workout scheduled for ${date} in the last ${messages.length} email(s).`);
  return { days, warnings };
}
