"use client";

import type { Block, Workout } from "@/lib/workout/types";
import { clock, wattsLabel, zoneLabel } from "@/lib/timer";
import { blockZone, type PowerZone } from "@/lib/profile";
import { WorkoutProfile } from "./WorkoutProfile";

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
}

const zoneOf = (b: Block, zones: PowerZone[]) => zones.find((z) => z.id === blockZone(b, undefined, zones));

/** Minutes per rider zone, like the coach's "time in zone" table. */
function timeInZone(w: Workout, zones: PowerZone[]) {
  const sec = new Map<string, number>();
  for (const b of w.blocks) { const z = zoneOf(b, zones); if (z) sec.set(z.id, (sec.get(z.id) ?? 0) + b.durationSec); }
  return zones.map((z) => ({ zone: z, sec: sec.get(z.id) ?? 0 })).filter((x) => x.sec > 0);
}

function Stats({ w }: { w: Workout }) {
  return (
    <div className="chips">
      <span className="chip"><b>{clock(w.totalSec)}</b> total</span>
      <span className="chip"><b>{w.blocks.length}</b> blocks</span>
      {w.tss ? <span className="chip"><b>{w.tss}</b> TSS</span> : null}
    </div>
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
        {!w.isRestDay && <WorkoutProfile workout={w} className="profile--hero" blockLabels />}
        <div className="tiz" aria-label="Time in zone">
          <div className="tiz__bar">
            {tiz.map(({ zone, sec }) => <span key={zone.id} style={{ flexGrow: sec / total, background: zone.color }} />)}
          </div>
          <ul className="tiz__list">
            {tiz.map(({ zone, sec }) => (
              <li key={zone.id}><span className="dot" style={{ background: zone.color }} />{zone.name}<b>{clock(sec)}</b></li>
            ))}
          </ul>
        </div>
        <div className="cards" role="list">
          {w.blocks.map((b) => {
            const z = zoneOf(b, zones);
            return (
              <div key={b.index} role="listitem" className="cards__card" style={{ "--z": z?.color ?? "#888" } as React.CSSProperties}>
                <span className="cards__n">{b.index + 1}</span>
                <span className="cards__dur">{clock(b.durationSec)}</span>
                <span className="cards__info">
                  <span className="cards__w">{wattsLabel(b) ?? "—"}<small>W</small></span>
                  <span className="cards__name">{z?.name ?? zoneLabel(b)}{b.set ? ` · ${b.set.index}/${b.set.count}` : ""}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="dock">
        <div className="dock__hr">{p.heartRate}</div>
        <div className="dock__actions">{p.reloadButton}{p.startButton}</div>
      </div>
    </main>
  );
}
