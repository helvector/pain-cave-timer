# Pain Cave Timer

A glanceable interval timer for coached indoor cycling workouts. The coach
schedules the session in TrainingPeaks; the nightly "Schedule for …" email
is parsed into a flat list of blocks; the screen shows one thing at a time:
zone, target watts, seconds remaining. Blocks auto-advance with an audio cue.

Status: **working end to end.** Parser, mail fetch, confirmation screen and
full-screen timer. Open `/?demo=1` to try the UI with the redacted fixture and
no mailbox.

## Layout

```
src/lib/workout/
  types.ts        Block / Workout / ParsedEmail and the pre-expansion tree
  zones.ts        Zone table (Z1–Z7 + sweet spot) and label aliases — config, not regex
  duration.ts     "20 min", "1 hr 30 min", "90s", "1:30" → seconds
  target.ts       "138-188 W", "76-85% FTP", "Z4", "sweet spot" → Target
  step.ts         one step line → StepNode; title/target → block kind
  text.ts         typed/pasted workouts, incl. "3x" repeat groups → tree
  email-html.ts   TrainingPeaks email HTML → per-day tree (+ Time, TSS, description)
  expand.ts       tree → flat blocks; set positions; cues; start offsets
  index.ts        parseTrainingPeaksEmail / parseWorkoutFromText / pickWorkout
src/lib/workout/fetch-today.ts  newest emails → workout for a date
src/lib/mail/           MailSource interface, env config, IMAP source (imapflow + mailparser)
src/app/api/workout/    GET /api/workout?date=… behind a bearer token (?demo=1 serves the fixture)
src/components/         App (token, load, phases) · Confirm (block list + warnings) · Ride (timer)
src/lib/timer.ts        pure position/format helpers used by the ride screen
src/lib/audio.ts        Web Audio cues: start, work, recovery, finish, 3-2-1 ticks
scripts/parse.ts        CLI: print the block list for a saved email or text file
scripts/fetch.ts        CLI: fetch today's workout from the mailbox using .env.local
fixtures/               redacted samples used by tests; fixtures/raw/ is gitignored
```

## Pipeline

1. **Extract** — `email-html.ts` anchors on the markup TrainingPeaks uses
   (`h1.formattedDate` per day, `h2` title, `Time`/`TSS` headers, an `<ol>` of
   steps with `.structureTitle` and target spans). One email covers two days.
2. **Parse steps** — `step.ts` reads `20 min @ 138-188 W - Recovery-Endurance - 80-95 rpm`
   into duration, target, zone codes, cadence, notes.
3. **Expand** — repeat groups are unrolled at parse time. TrainingPeaks already
   flattens repeats before emailing, so `annotateSets` also recovers "2 of 3"
   from runs of identical work blocks separated by recovery.
4. **Build** — each block gets `kind` (warmup / work / recovery / cooldown),
   `startSec`, and `cue` (`start` | `work` | `recovery`). The runtime never
   sees repeats, zones, or percentages.

Nothing is dropped silently. Every `Workout` carries `warnings` (planned time
mismatch, missing watt targets, guessed intensities) and `unparsed` lines for
the confirmation screen.

## Try it

```bash
npm install
npm test
npm run parse -- fixtures/trainingpeaks-sweet-spot-3x15.html
npm run parse -- fixtures/coach-text-repeats.txt --ftp 250
```

To check a real email: save it as `.eml` or its HTML body as `.html` under
`fixtures/raw/` (gitignored) and run `npm run parse -- fixtures/raw/<file> --date 2026-09-10`.
Before committing any sample, strip every URL: TrainingPeaks links carry
account and unsubscribe tokens.

## Mail fetch

`GET /api/workout` (header `Authorization: Bearer $APP_TOKEN`, optional
`?date=yyyy-mm-dd`) opens a short-lived IMAP connection, takes the newest
messages from `MAIL_FROM`, parses each until one contains the requested date,
and returns `{ date, workout, email, days, warnings }`. "Today" is computed in
`APP_TIMEZONE` because Vercel runs in UTC. There is no nearest-day fallback:
if the date is not in the last few emails you get a 404 with the days that
were seen.

Locally, copy `.env.example` to `.env.local` (Gmail needs an App Password)
and run:

```bash
npm run fetch
npm run fetch -- --date 2026-09-10 --json
```

## Secrets

None in the repo. Mailbox settings and tokens live in Vercel environment
variables; see `.env.example` for the names.
