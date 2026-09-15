import type { ParsedEmail, Workout, WorkoutNode } from "./types";
import { extractDays, resolveDate } from "./email-html";
import { buildBlocks, expandRepeats } from "./expand";
import { parseWorkoutText } from "./text";

export * from "./types";
export { formatClock, formatDuration, parseDuration } from "./duration";
export { ZONES, zoneCodesFor } from "./zones";
export { parseStepLine } from "./step";
export { parseWorkoutText } from "./text";
export { expandRepeats, buildBlocks, annotateSets } from "./expand";
export { extractDays, resolveDate } from "./email-html";

export interface ParseOptions {
  /** Athlete FTP in watts, for %FTP or zone-only targets. */
  ftp?: number;
  subject?: string;
  receivedAt?: Date;
}

/** Tree → Workout. Shared by the email and text entry points. */
export function assembleWorkout(
  nodes: WorkoutNode[],
  meta: Pick<Workout, "date" | "title" | "isRestDay" | "plannedSec" | "tss" | "description"> & { warnings?: string[]; unparsed?: string[] },
  ftp?: number,
): Workout {
  const { blocks, warnings } = buildBlocks(expandRepeats(nodes), ftp);
  const totalSec = blocks.reduce((a, b) => a + b.durationSec, 0);
  const all = [...(meta.warnings ?? []), ...warnings];

  if (meta.plannedSec !== undefined && Math.abs(meta.plannedSec - totalSec) > 60) {
    all.push(`Steps add up to ${Math.round(totalSec / 60)} min but the email says ${Math.round(meta.plannedSec / 60)} min.`);
  }
  for (const b of blocks) {
    if (!b.target.watts) all.push(`Step ${b.index + 1} ("${b.title}") has no watt target${b.target.raw ? ` (${b.target.raw})` : ""}.`);
  }
  if (!meta.isRestDay && blocks.length === 0) all.push("No steps parsed.");

  return { ...meta, blocks, totalSec, warnings: all, unparsed: meta.unparsed ?? [] };
}

/** Parse a TrainingPeaks "Schedule for …" email (HTML body) into per-day workouts. */
export function parseTrainingPeaksEmail(html: string, opts: ParseOptions = {}): ParsedEmail {
  const warnings: string[] = [];
  const days = extractDays(html, { ftp: opts.ftp }).map((d) => {
    const date = resolveDate(d.dateText, opts.subject, opts.receivedAt);
    if (!date) warnings.push(`Could not work out the date for "${d.dateText}".`);
    return assembleWorkout(d.nodes, {
      date: date ?? d.dateText,
      title: d.title,
      isRestDay: d.isRestDay,
      plannedSec: d.plannedSec,
      tss: d.tss,
      description: d.description,
      warnings: d.warnings,
      unparsed: d.unparsed,
    }, opts.ftp);
  });
  if (days.length === 0) warnings.push("No workout days found in this email.");
  return { subject: opts.subject, receivedAt: opts.receivedAt?.toISOString(), days, warnings };
}

/** Parse pasted / typed workout text (one workout) into a Workout. */
export function parseWorkoutFromText(text: string, opts: ParseOptions & { title?: string; date?: string } = {}): Workout {
  const { nodes, unparsed } = parseWorkoutText(text, { ftp: opts.ftp });
  return assembleWorkout(nodes, {
    date: opts.date ?? new Date().toISOString().slice(0, 10),
    title: opts.title ?? "Workout",
    isRestDay: false,
    unparsed,
  }, opts.ftp);
}

/** Choose the day to ride: exact date match, else the first non-rest day on or after it. */
export function pickWorkout(days: Workout[], dateISO: string): Workout | undefined {
  return days.find((d) => d.date === dateISO) ?? days.find((d) => d.date >= dateISO && !d.isRestDay);
}
