"use client";

import type { Block, StrengthSession, Workout } from "@/lib/workout/types";
import { cadenceLabel, clock, wattsLabel, zoneLabel } from "@/lib/timer";
import { blockZone, type PowerZone } from "@/lib/profile";
import { WorkoutProfile } from "./WorkoutProfile";
import { MetricIcon } from "./MetricIcon";

/**
 * The confirmation screen layout ("Hero", chosen Oct 2026): tall profile with
 * each block's time and watts on its bar, time in zone, a stacked list of block rows,
 * Start pinned to the bottom for the thumb. Header pieces, warnings, the
 * heart-rate row and buttons are built by Confirm and passed in.
 */

interface Parts {
  w: Workout;
  zones: PowerZone[];
  dateLine: string;
  dayTabs: React.ReactNode;
  issues: React.ReactNode;
  heartRate: React.ReactNode;
  startButton: React.ReactNode;
  reloadButton: React.ReactNode;
  /** Showing sample data: the Demo link becomes Exit demo. */
  demo?: boolean;
}

const zoneOf = (b: Block, zones: PowerZone[]) => zones.find((z) => z.id === blockZone(b, undefined, zones));

/** Minutes per rider zone, like the coach's "time in zone" table. */
function timeInZone(w: Workout, zones: PowerZone[]) {
  const sec = new Map<string, number>();
  for (const b of w.blocks) { const z = zoneOf(b, zones); if (z) sec.set(z.id, (sec.get(z.id) ?? 0) + b.durationSec); }
  return zones.map((z) => ({ zone: z, sec: sec.get(z.id) ?? 0 })).filter((x) => x.sec > 0);
}

function Stats({ w }: { w: Workout }) {
  // A gym-only day has no ride numbers: show the session's own.
  if (!w.blocks.length && w.strength?.length) {
    const sets = w.strength.reduce((a, g) => a + (g.sets ?? 0), 0);
    const exercises = w.strength.reduce((a, g) => a + (g.exercises ?? 0), 0);
    return (
      <div className="chips">
        {sets ? <span className="chip"><b>{sets}</b> sets</span> : null}
        {exercises ? <span className="chip"><b>{exercises}</b> exercises</span> : null}
      </div>
    );
  }
  return (
    <div className="chips">
      <span className="chip"><b>{clock(w.totalSec)}</b> total</span>
      <span className="chip"><b>{w.blocks.length}</b> blocks</span>
      {w.tss ? <span className="chip"><b>{w.tss}</b> TSS</span> : null}
      {w.cadenceRpm ? <span className="chip"><MetricIcon metric="cadence" className="chip__icon" /><b>{w.cadenceRpm.lo === w.cadenceRpm.hi ? w.cadenceRpm.lo : `${w.cadenceRpm.lo}–${w.cadenceRpm.hi}`}</b> rpm</span> : null}
    </div>
  );
}

/**
 * The coach's gym session as text: title in the display face (left out when it
 * is already the day's title), sets and exercises as chips, then the notes.
 */
function Gym({ sessions, showTitle }: { sessions: StrengthSession[]; showTitle: boolean }) {
  return (
    <section className="gym" aria-label="Gym">
      {sessions.map((g, i) => (
        <div key={i} className="gym__session">
          {showTitle && (
            <>
              <p className="gym__kicker">Gym</p>
              <h2 className="gym__title">{g.title}</h2>
              <div className="chips">
                {g.sets ? <span className="chip"><b>{g.sets}</b> sets</span> : null}
                {g.exercises ? <span className="chip"><b>{g.exercises}</b> exercises</span> : null}
              </div>
            </>
          )}
          {g.notes.map((n, j) => <p key={j} className="gym__note">{n}</p>)}
          <p className="gym__where">The exercises are listed in the TrainingPeaks app.</p>
        </div>
      ))}
    </section>
  );
}

/** C · Hero: tall chart, time in zone, a stacked list of block rows, Start pinned for the thumb. */
export function ConfirmHero(p: Parts) {
  const { w, zones } = p;
  const tiz = timeInZone(w, zones);
  const total = Math.max(w.totalSec, 1);
  return (
    <main className="screen cv cv--c">
      <div className="cv__wrap cv__wrap--dock">
        <header className="cv__head">
          <p className="muted small">{p.dateLine}</p>
          <h1 className="cv__title">{w.title}</h1>
          <Stats w={w} />
        </header>
        {p.dayTabs}
        {p.issues}
        {w.isRestDay && <p className="cv__rest">Rest day. Nothing to ride.</p>}
        {!w.isRestDay && w.blocks.length > 0 && <WorkoutProfile workout={w} className="profile--hero" blockLabels />}
        {!w.blocks.length && w.strength?.length ? <Gym sessions={w.strength} showTitle={false} /> : null}
        {w.blocks.length > 0 && <div className="tiz" aria-label="Time in zone">
          <div className="tiz__bar">
            {tiz.map(({ zone, sec }) => <span key={zone.id} style={{ flexGrow: sec / total, background: zone.color }} />)}
          </div>
          <ul className="tiz__list">
            {tiz.map(({ zone, sec }) => (
              <li key={zone.id}><span className="dot" style={{ background: zone.color }} />{zone.name}<b>{clock(sec)}</b></li>
            ))}
          </ul>
        </div>}
        <div className="cards" role="list">
          {w.blocks.map((b) => {
            const z = zoneOf(b, zones);
            return (
              <div key={b.index} role="listitem" className="cards__card" style={{ "--z": z?.color ?? "#888" } as React.CSSProperties}>
                <span className="cards__n">{b.index + 1}</span>
                <span className="cards__dur">{clock(b.durationSec)}</span>
                <span className="cards__info">
                  <span className="cards__w">{wattsLabel(b) ?? "—"}<small>W</small></span>
                  <span className="cards__name">{z?.name ?? zoneLabel(b)}{b.set ? `\u2009·\u2009${b.set.index}/${b.set.count}` : ""}</span>
                  <span className={`cards__rpm${b.target.cadenceRpm ? "" : " cards__rpm--open"}`}>{cadenceLabel(b).replace(/ rpm$/, "")}{b.target.cadenceRpm && <small>rpm</small>}</span>
                </span>
              </div>
            );
          })}
        </div>
        {w.blocks.length > 0 && w.strength?.length ? <Gym sessions={w.strength} showTitle /> : null}
        <nav className="cv__links">
          <a className="cv__link" href="/admin">Admin</a>
          {/* Demo runs on the redacted sample sessions, no mailbox or token. Plain links on purpose:
              App reads ?demo once on load, so switching needs a full page load, not a client route. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          {p.demo ? <a className="cv__link" href="/">Exit demo</a> : <a className="cv__link" href="/?demo=1&fixture=review">Demo</a>}
        </nav>
      </div>
      <div className="dock">
        <div className="dock__hr">{p.heartRate}</div>
        <div className="dock__actions">{p.reloadButton}{p.startButton}</div>
      </div>
    </main>
  );
}
