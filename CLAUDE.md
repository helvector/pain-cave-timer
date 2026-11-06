# Pain Cave Timer

A glanceable interval timer for coached indoor cycling. The coach's nightly
TrainingPeaks "Schedule for …" emails are fetched over IMAP, parsed into a flat
list of blocks, shown on a confirmation screen, then ridden with auto-advance
and audio cues. Next.js 16 (App Router, Turbopack), React 19, TypeScript,
deployed on Vercel. The README is the full reference; this file is how to work
on it.

## Who rides it, on what

- One rider, iPhone 17 Pro in **portrait, 402×874**, in the **Bluefy** browser
  (Web Bluetooth) with a Whoop broadcasting heart rate. Design and verify at
  that size first. TV/landscape (1920×1080) is secondary and currently overflows
  on the ride screen (known, not fixed).
- Readouts are read mid-effort: big, high-contrast, one line where possible, no
  sideways scrolling, nothing that needs a precise tap.

## Commands

```
npm run dev -- --port 3111   # or preview_start "pain-cave-timer" (launch.json in ../.claude)
npm test                     # vitest
npm run lint                 # eslint, React Compiler rules
npm run typecheck
npm run parse -- fixtures/trainingpeaks-overunder-3x16.html [--json]
npm run redact -- fixtures/raw/x.html fixtures/trainingpeaks-x.html
vercel deploy --yes          # preview (behind Vercel sign-in)
vercel deploy --prod --yes   # production: https://paincavetimer.vercel.app
```

Run lint, typecheck and tests before every deploy. The dev server rewrites
`next-env.d.ts`; `git checkout -- next-env.d.ts` before committing.

## Map

- `src/lib/workout/` parser: `email-html.ts` (TrainingPeaks markup), `step.ts`
  (one step line), `target.ts` (watts, cadence, heart rate), `expand.ts`
  (repeats, over-under groups, set numbering), `index.ts` (assembles a
  `Workout`), `demo.ts` (demo fixtures).
- `src/lib/mail/` IMAP fetch. `src/app/api/workout` (bearer `APP_TOKEN`),
  `src/app/api/settings` (GET open, PUT needs `APP_TOKEN`; Blob store).
- `src/components/`: `App` (phases), `Confirm` + `ConfirmVariants` (`ConfirmHero`
  is the confirmation screen), `Ride`, `Summary` (end-of-ride image),
  `WorkoutProfile` (bar chart), `PlayheadFx`, `Admin` (/admin), `Splash`
  (opening animation, "Stamp", once per page load).
- `src/lib/settings.ts` zones, playhead style, hrRest/hrMax defaults;
  `power-zones.ts` the rider's watt zones; `summary-card.ts` canvas share image;
  `playhead-fx.ts` the "now" line.
- `src/components/animate-ui/` is copied Animate UI source: lint-excluded,
  don't restyle it in place.

## Parser facts (from real emails)

- Steps arrive flattened with absolute watts:
  `15 min @ 220-235 W - Tempo-Threshold - 80-95 rpm`.
- A nested `<ul>` under one step is either a multi-step interval ("Ramp up in 4
  steps", over-unders) or "Repeat N times" (ride the sub-steps N times). The
  title decides which.
- Cadence: the step's own rpm wins; work intervals without one take the
  description's "Intensity Ranges … Cadence: 80-100 RPM"; anything else shows
  **Open**.
- Emails cover two days and can include rest days, strength sessions and
  non-ride items (a "Monthly Call"); ignore those.
- Add a fixture for every new email shape and a test against it. Raw mail goes
  in gitignored `fixtures/raw/`; commit only the `npm run redact` output and
  check it for names first.

## Demo and design review

`/?demo=1` runs without a mailbox or token. Params:
`fixture=sweetspot|overunder|steadystate|review` (`review` = ten real sessions
as ten day tabs), `bpm=150` (simulated heart rate), `at=end` (start 8 s before
the finish with a synthetic heart-rate trace, to see the end screen),
`fx=ember|comet|plasma|stardust`.

## Rules

- **Never commit secrets.** Mail config, `APP_TOKEN`, `BLOB_READ_WRITE_TOKEN`
  live in Vercel env vars only. Treat the repo as public.
- **No real names** of the coach or anyone else in code, fixtures, commits.
- **Preview before production.** For any visual change, deploy a preview and
  send links (demo URLs with the right fixture) before committing. Commit and
  `--prod` only when the rider says so ("push it").
- **When asked for design options, give three**, each on its own preview link.
  Once one is picked, delete the losers and their switches.
- **Don't touch what's been signed off.** The ride-screen countdown digits
  ("numbers look great, don't mess") and the rider-tuned ride layout stay as
  they are unless asked.
- **II Balfron is licensed and must never be committed.** It lives in gitignored
  `private/fonts/` locally and in the private Blob store (`fonts/ii-balfron.woff`)
  for production; `src/app/fonts/display/route.ts` serves it, League Gothic is
  the public fallback. Code is MIT; the font is not.
- Fixture reads in `demo.ts` use **literal paths**; a computed path makes Next's
  file tracer bundle `fixtures/raw/`.
- React Compiler lint: no `setState` synchronously in effects, no reading refs
  during render.
- iOS share sheet (`navigator.share` with files) must run synchronously inside
  the tap; prepare blobs ahead of time.

## Verifying UI

- Check at 402×874: no horizontal overflow (`scrollWidth > innerWidth`), no
  clipped text in rows (`scrollWidth > clientWidth`), last row clears the
  pinned dock. Check every day of `fixture=review`, not just one.
- The hidden preview pane pauses `requestAnimationFrame`, and Motion/Blur
  transitions don't finish there; screenshots can be stale or blank. Assert
  via DOM state, or patch rAF to `setTimeout` before mounting canvas effects.
- Still untested on device: "Save to Photos" in Bluefy.
