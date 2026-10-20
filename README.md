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

5. **Nested step lists** — TrainingPeaks puts several steps in one list item
   via a nested `<ul>`. A "Repeat 4 times" item rides its steps 4 times over,
   using each step's own label ("Steady State", "Recovery") and numbering them
   "1 of 4" … "4 of 4". Any other title (e.g. "Ramp up in 4 steps"
   over-unders) is one interval ridden once, one block per step, tagged `part` ("step 2/4"). Two alternating targets are
   labelled Under / Over, a step down plays the recovery cue, and repeated
   identical intervals get set numbers ("2 of 3") carried onto their recovery.

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

## Heart rate

Optional readout, not a target. Turn on **Broadcast Heart Rate** in the Whoop
app, tap **Connect Whoop** on the confirmation screen, pick the strap in the
browser's device picker, and the ride screen shows live BPM under the watts.
Uses Web Bluetooth (`src/lib/heart-rate.ts`, `src/hooks/use-heart-rate.ts`),
so it works in Chrome/Edge on macOS, Windows and Android, and in the Bluefy
browser on iPhone; Safari has no Web Bluetooth. Readings go stale after 8 s
without a notification and the client retries a dropped link five times.

If `THR_BPM` is set, the coach's "Heart Rate: 84-92% of THR" notes are
resolved to a BPM range on each block (`target.hrBpm`) for anything that
wants it later; the UI does not colour the readout against it.

## Workout profile

The bottom of the ride screen, and the top of the confirmation screen, show
the session's shape (`WorkoutProfile`, geometry in `src/lib/profile.ts`): one
bar per block, width = duration, height = top of the watt target, colour =
the rider's own power zone, set in `src/lib/power-zones.ts` (absolute watts
from the coach): Recovery 0–145 light blue, Endurance 146–197 green, Tempo
198–236 yellow, Threshold 237–275 yellow-orange, VO2 Max 276–314 orange,
Anaerobic 315+ red. The middle of a block's watt target picks its zone;
blocks without watts fall back to %FTP × `FTP_WATTS`, then the coach's zone
label, then the block kind. Update that table when the zones change. The height axis starts at a baseline
below the easiest block, as training apps do, so small target steps show.
Ridden time is drawn at full strength with a playhead; the current block is
outlined. With a heart-rate strap connected, a 2 px red line plots heart rate
over the bars (one reading every 2 s, fixed 60–200 bpm scale with max HR at
the top); it breaks on dropouts and across Skip/Back jumps, and pauses with
the timer.

## Living background

The ride screen sits on Animate UI's Bubble Background, ported to plain CSS
in `src/components/animate-ui/components/backgrounds/bubble.tsx` and wrapped by
`RideBackground`. Blob colours follow the block's intensity (work reds,
recovery blues, warm-up/cool-down greys) at reduced opacity so the numerals
keep their contrast, and the whole field pulses once per heartbeat: the CSS
animation period is 60 / BPM, so a changing rate re-times the loop without
restarting it. With no strap it breathes slowly. The BPM readout sits under
the watt target, matching it in size. Preview without a strap: `/?demo=1&bpm=142`; add `&fixture=overunder` or
`&fixture=steadystate` for those fixtures.
Reduced-motion users get the flat tint.

## Motion

Animations come from [Animate UI](https://animate-ui.com) primitives copied
into `src/components/animate-ui/` (the registry's manual install; they need
only Motion, not Tailwind). Used: SlidingNumber for the rolling countdown
digits, CountingNumber for watts on a block change, Blur for the zone label
and next-up line on transitions, Fades to stagger the confirmation screen in,
and RippleButton for Start. `MotionConfig reducedMotion="user"` disables them
when the OS asks for reduced motion. That directory is excluded from lint.

## Typeface

Display sizes (countdown, watts, labels, titles) use II Balfron by Evan
Lelliott / Increments Type Foundry, loaded from `src/fonts/` with
`next/font/local`. Its figures are proportional, so the countdown renders each
digit in a fixed-width cell (0.27em, its typical digit advance) to stop the
number shifting as it counts, and the narrow "1" is nudged onto its optical
centre. Reading
text uses Inter with tabular figures. Check the Balfron licence permits web
embedding and redistribution before making this repository public.

## Secrets

None in the repo. Mailbox settings and tokens live in Vercel environment
variables; see `.env.example` for the names.
