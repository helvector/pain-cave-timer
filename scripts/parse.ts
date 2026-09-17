/**
 * Parse a saved TrainingPeaks email (.html or .eml) or a plain-text workout
 * and print the flat block list the runtime would receive.
 *
 *   npm run parse -- fixtures/trainingpeaks-sweet-spot-3x15.html
 *   npm run parse -- fixtures/raw/some-email.eml --date 2026-09-10 --ftp 250
 *   npm run parse -- my-workout.txt --json
 */
import { readFileSync } from "node:fs";
import { formatClock, parseTrainingPeaksEmail, parseWorkoutFromText, pickWorkout, type Workout } from "../src/lib/workout";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
if (!file) {
  console.error("usage: parse <file.html|file.eml|file.txt> [--ftp N] [--thr N] [--date yyyy-mm-dd] [--json]");
  process.exit(2);
}
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const ftp = opt("ftp") ? Number(opt("ftp")) : undefined;
const thr = opt("thr") ? Number(opt("thr")) : undefined;
const json = args.includes("--json");
const raw = readFileSync(file, "utf8");

let workouts: Workout[];
let emailWarnings: string[] = [];
if (/\.(html?|eml)$/i.test(file)) {
  let html = raw;
  let subject: string | undefined;
  if (/\.eml$/i.test(file)) {
    // Minimal .eml handling: take the Subject header and the HTML part.
    subject = raw.match(/^Subject:\s*(.+)$/im)?.[1];
    const start = raw.search(/<html/i);
    html = start >= 0 ? raw.slice(start) : raw;
  }
  const parsed = parseTrainingPeaksEmail(html, { ftp, thr, subject });
  emailWarnings = parsed.warnings;
  const date = opt("date");
  workouts = date ? [pickWorkout(parsed.days, date)].filter((w): w is Workout => Boolean(w)) : parsed.days;
} else {
  workouts = [parseWorkoutFromText(raw, { ftp, thr })];
}

if (json) {
  console.log(JSON.stringify({ warnings: emailWarnings, workouts }, null, 2));
  process.exit(0);
}

for (const w of workouts) {
  console.log(`\n${w.date}  ${w.title}${w.isRestDay ? "  (rest day)" : ""}`);
  if (w.tss) console.log(`TSS ${w.tss}`);
  console.log(`total ${formatClock(w.totalSec)}${w.plannedSec ? `  (email says ${formatClock(w.plannedSec)})` : ""}`);
  if (w.blocks.length) {
    console.log("");
    console.log(" #   start   length  kind      set   target        zone                 cue       title");
    for (const b of w.blocks) {
      const t = b.target.watts ? `${b.target.watts.lo}-${b.target.watts.hi} W` : b.target.raw || "—";
      const set = b.set ? `${b.set.index}/${b.set.count}` : "";
      console.log(
        `${String(b.index + 1).padStart(2)}  ${formatClock(b.startSec).padStart(7)}  ${formatClock(b.durationSec).padStart(6)}  ${b.kind.padEnd(8)}  ${set.padEnd(4)}  ${t.padEnd(12)}  ${(b.target.zone?.label ?? "").padEnd(20)} ${b.cue.padEnd(8)}  ${b.title}`,
      );
    }
  }
  for (const u of w.unparsed) console.log(`UNPARSED: ${u}`);
  for (const m of w.warnings) console.log(`WARNING:  ${m}`);
}
for (const m of emailWarnings) console.log(`EMAIL WARNING: ${m}`);
