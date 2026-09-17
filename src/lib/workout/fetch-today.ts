import type { MailSource } from "../mail/types";
import { parseTrainingPeaksEmail, pickWorkout } from "./index";
import type { Workout } from "./types";

export interface TodayResult {
  workout?: Workout;
  /** Which email it came from, for the confirmation screen. */
  email?: { id: string; subject: string; receivedAt: string };
  /** Every day seen across the emails checked, newest first. */
  days: Workout[];
  warnings: string[];
}

/**
 * Walk recent workout emails, newest first, and return the workout for
 * `date`. The nightly email holds today and tomorrow, so the newest one
 * almost always answers; older ones cover a missed night.
 */
export async function fetchWorkoutFor(source: MailSource, date: string, opts: { ftp?: number; thr?: number; limit?: number } = {}): Promise<TodayResult> {
  const messages = await source.latest(opts.limit ?? 5);
  const warnings: string[] = [];
  const days: Workout[] = [];
  if (messages.length === 0) warnings.push("No workout emails found in the mailbox.");

  for (const m of messages) {
    const parsed = parseTrainingPeaksEmail(m.html, { ftp: opts.ftp, thr: opts.thr, subject: m.subject, receivedAt: m.receivedAt });
    days.push(...parsed.days);
    const workout = pickWorkout(parsed.days, date);
    if (workout) {
      return {
        workout,
        email: { id: m.id, subject: m.subject, receivedAt: m.receivedAt.toISOString() },
        days,
        warnings: [...warnings, ...parsed.warnings],
      };
    }
  }
  warnings.push(`No workout scheduled for ${date} in the last ${messages.length} email(s).`);
  return { days, warnings };
}
