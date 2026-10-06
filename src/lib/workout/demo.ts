import { readFileSync } from "node:fs";
import path from "node:path";
import { parseTrainingPeaksEmail } from "./index";
import type { Workout } from "./types";

/**
 * The redacted fixture as a workout, for trying the UI without a mailbox.
 * Dates are shifted so "today" always has a session.
 */
// Literal paths on purpose: a computed file name makes Next's file tracer
// bundle the whole fixtures folder, including the gitignored raw emails.
const FIXTURES = {
  sweetspot: {
    read: () => readFileSync(path.join(process.cwd(), "fixtures/trainingpeaks-sweet-spot-3x15.html"), "utf8"),
    subject: "Schedule for Thursday 09/10/2026 to Friday 09/11/2026",
  },
  overunder: {
    read: () => readFileSync(path.join(process.cwd(), "fixtures/trainingpeaks-overunder-3x16.html"), "utf8"),
    subject: "Schedule for Tuesday 10/06/2026 to Wednesday 10/07/2026",
  },
} as const;

export type DemoFixture = keyof typeof FIXTURES;

export function isDemoFixture(name: string | null): name is DemoFixture {
  return name !== null && name in FIXTURES;
}

export function demoWorkouts(todayISO: string, opts: { ftp?: number; thr?: number; fixture?: DemoFixture } = {}): Workout[] {
  const fx = FIXTURES[opts.fixture ?? "sweetspot"];
  const html = fx.read();
  const { days } = parseTrainingPeaksEmail(html, { ftp: opts.ftp, thr: opts.thr, subject: fx.subject });
  const next = new Date(`${todayISO}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const dates = [todayISO, next.toISOString().slice(0, 10)];
  return days.map((d, i) => ({ ...d, date: dates[i] ?? d.date, title: `${d.title} (demo)` }));
}
