/**
 * Fetch today's workout from the mailbox using .env.local, and print it.
 *
 *   npm run fetch                 # today in APP_TIMEZONE
 *   npm run fetch -- --date 2026-09-10
 *   npm run fetch -- --json
 */
import { existsSync } from "node:fs";
import { createImapSource, mailConfigFromEnv } from "../src/lib/mail";
import { fetchWorkoutFor } from "../src/lib/workout/fetch-today";
import { formatClock } from "../src/lib/workout";
import { appTimeZone, todayIn } from "../src/lib/date";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const date = opt("date") ?? todayIn(appTimeZone());
const ftp = process.env.FTP_WATTS ? Number(process.env.FTP_WATTS) : undefined;

async function main() {
  const source = createImapSource(mailConfigFromEnv());
  const result = await fetchWorkoutFor(source, date, { ftp });

  if (args.includes("--json")) {
    console.log(JSON.stringify({ date, ...result }, null, 2));
  } else {
    console.log(`Looking for ${date}. Days seen: ${result.days.map((d) => `${d.date}${d.isRestDay ? " (rest)" : ""}`).join(", ") || "none"}`);
    if (result.email) console.log(`From email: "${result.email.subject}" received ${result.email.receivedAt}`);
    const w = result.workout;
    if (w) {
      console.log(`\n${w.date}  ${w.title}${w.isRestDay ? "  (rest day)" : ""}  total ${formatClock(w.totalSec)}`);
      for (const b of w.blocks) {
        const t = b.target.watts ? `${b.target.watts.lo}-${b.target.watts.hi} W` : b.target.raw || "—";
        const set = b.set ? ` ${b.set.index}/${b.set.count}` : "";
        console.log(`${String(b.index + 1).padStart(2)}  ${formatClock(b.durationSec).padStart(6)}  ${b.kind.padEnd(8)}${set.padEnd(5)}  ${t.padEnd(12)}  ${b.title}`);
      }
      for (const u of w.unparsed) console.log(`UNPARSED: ${u}`);
      for (const m of w.warnings) console.log(`WARNING:  ${m}`);
    }
    for (const m of result.warnings) console.log(`NOTE: ${m}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
