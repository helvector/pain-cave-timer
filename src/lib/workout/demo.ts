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
  steadystate: {
    read: () => readFileSync(path.join(process.cwd(), "fixtures/trainingpeaks-steadystate-4x8.html"), "utf8"),
    subject: "Schedule for Tuesday 10/13/2026 to Wednesday 10/14/2026",
  },
} as const;

/**
 * Ten real rides from the coach's emails (Sep 15 – Oct 24, 2026), one per
 * day tab, for reviewing designs across very different sessions: steady
 * state, sweet spot, long endurance, recovery, power ladders, step ramps and
 * two shapes of over-under. Each entry is an email plus the day to take from it.
 */
const REVIEW: { read: () => string; subject: string; date: string }[] = [
  { read: () => readFileSync(path.join(process.cwd(), "fixtures/trainingpeaks-2026-10-24.html"), "utf8"), subject: "Schedule for Saturday 10/24/2026 to Sunday 10/25/2026", date: "2026-10-24" },
  { read: () => readFileSync(path.join(process.cwd(), "fixtures/trainingpeaks-2026-10-21.html"), "utf8"), subject: "Schedule for Wednesday 10/21/2026 to Thursday 10/22/2026", date: "2026-10-22" },
  { read: () => readFileSync(path.join(process.cwd(), "fixtures/trainingpeaks-2026-10-21.html"), "utf8"), subject: "Schedule for Wednesday 10/21/2026 to Thursday 10/22/2026", date: "2026-10-21" },
  { read: () => readFileSync(path.join(process.cwd(), "fixtures/trainingpeaks-2026-10-17.html"), "utf8"), subject: "Schedule for Saturday 10/17/2026 to Sunday 10/18/2026", date: "2026-10-18" },
  { read: () => readFileSync(path.join(process.cwd(), "fixtures/trainingpeaks-2026-10-17.html"), "utf8"), subject: "Schedule for Saturday 10/17/2026 to Sunday 10/18/2026", date: "2026-10-17" },
  { read: () => readFileSync(path.join(process.cwd(), "fixtures/trainingpeaks-steadystate-4x8.html"), "utf8"), subject: "Schedule for Tuesday 10/13/2026 to Wednesday 10/14/2026", date: "2026-10-14" },
  { read: () => readFileSync(path.join(process.cwd(), "fixtures/trainingpeaks-overunder-3x16.html"), "utf8"), subject: "Schedule for Tuesday 10/06/2026 to Wednesday 10/07/2026", date: "2026-10-06" },
  { read: () => readFileSync(path.join(process.cwd(), "fixtures/trainingpeaks-2026-09-30.html"), "utf8"), subject: "Schedule for Wednesday 09/30/2026 to Thursday 10/01/2026", date: "2026-09-30" },
  { read: () => readFileSync(path.join(process.cwd(), "fixtures/trainingpeaks-2026-09-24.html"), "utf8"), subject: "Schedule for Thursday 09/24/2026 to Friday 09/25/2026", date: "2026-09-24" },
  { read: () => readFileSync(path.join(process.cwd(), "fixtures/trainingpeaks-2026-09-15.html"), "utf8"), subject: "Schedule for Tuesday 09/15/2026 to Wednesday 09/16/2026", date: "2026-09-15" },
];

export type DemoFixture = keyof typeof FIXTURES | "review";

export function isDemoFixture(name: string | null): name is DemoFixture {
  return name !== null && (name in FIXTURES || name === "review");
}

/** `iso` plus `n` days. */
function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function demoWorkouts(todayISO: string, opts: { ftp?: number; thr?: number; fixture?: DemoFixture } = {}): Workout[] {
  if (opts.fixture === "review") {
    // Shifted onto today and the nine days after it, so each gets its own tab.
    return REVIEW.map((r, i) => {
      const { days } = parseTrainingPeaksEmail(r.read(), { ftp: opts.ftp, thr: opts.thr, subject: r.subject });
      const day = days.find((d) => d.date === r.date);
      if (!day) throw new Error(`Review fixture has no ${r.date}`);
      return { ...day, date: addDays(todayISO, i), title: `${day.title} (demo)` };
    });
  }
  const fx = FIXTURES[opts.fixture ?? "sweetspot"];
  const { days } = parseTrainingPeaksEmail(fx.read(), { ftp: opts.ftp, thr: opts.thr, subject: fx.subject });
  const dates = [todayISO, addDays(todayISO, 1)];
  return days.map((d, i) => ({ ...d, date: dates[i] ?? d.date, title: `${d.title} (demo)` }));
}
