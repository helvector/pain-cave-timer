"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Workout } from "@/lib/workout/types";
import { Cues } from "@/lib/audio";
import { clock, positionAt, wattsLabel, zoneLabel } from "@/lib/timer";
import { SlidingNumber } from "@/components/animate-ui/primitives/texts/sliding-number";
import { CountingNumber } from "@/components/animate-ui/primitives/texts/counting-number";
import { Blur } from "@/components/animate-ui/primitives/effects/blur";

/** Quick, non-bouncy spring for digits that change every second. */
const DIGIT_SPRING = { stiffness: 320, damping: 32, mass: 0.5 };
/** Watts settle in about half a second on a block change. */
const WATTS_SPRING = { stiffness: 140, damping: 28 };

interface Props {
  workout: Workout;
  onDone: (elapsedSec: number) => void;
  onExit: () => void;
}

/**
 * The riding screen. Time is wall-clock based: elapsed = now − startedAt − paused,
 * so a throttled tab or a slow tick never drifts the schedule. Cues fire when
 * the block index changes; 3-2-1 ticks lead into every transition.
 */
export function Ride({ workout, onDone, onExit }: Props) {
  const cues = useMemo(() => new Cues(), []);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const lastIndex = useRef(0);
  const lastTick = useRef<string>("");
  const doneRef = useRef(false);
  const wakeLock = useRef<WakeLockSentinel | null>(null);

  const elapsedSec = ((pausedAt ?? now) - startedAt) / 1000;
  const pos = positionAt(workout, elapsedSec);

  // Unlock audio, go fullscreen, keep the screen awake. All from the Start tap.
  useEffect(() => {
    window.scrollTo(0, 0);
    void cues.unlock().then(() => cues.play("start"));
    document.documentElement.requestFullscreen?.().catch(() => undefined);
    const lock = async () => {
      try { wakeLock.current = await navigator.wakeLock?.request("screen"); } catch { /* unsupported */ }
    };
    void lock();
    const onVisible = () => { if (document.visibilityState === "visible") void lock(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void wakeLock.current?.release();
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);
    };
  }, [cues]);

  // Tick.
  useEffect(() => {
    if (pausedAt !== null) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [pausedAt]);

  // Transitions and countdown ticks.
  useEffect(() => {
    if (pos.finished) {
      if (!doneRef.current) {
        doneRef.current = true;
        cues.play("finish");
        onDone(workout.totalSec);
      }
      return;
    }
    if (pos.index !== lastIndex.current) {
      lastIndex.current = pos.index;
      cues.play(pos.block.cue);
    }
    if (pos.remainingSec <= 3 && pos.remainingSec >= 1) {
      const key = `${pos.index}:${pos.remainingSec}`;
      if (lastTick.current !== key) {
        lastTick.current = key;
        cues.play("tick");
      }
    }
  }, [pos.finished, pos.index, pos.remainingSec, pos.block.cue, cues, onDone, workout.totalSec]);

  const togglePause = useCallback(() => {
    if (pausedAt === null) {
      setPausedAt(Date.now());
    } else {
      setStartedAt((s) => s + (Date.now() - pausedAt));
      setPausedAt(null);
      setNow(Date.now());
    }
  }, [pausedAt]);

  /** Jump so that elapsed time equals a block's start. */
  const jumpTo = useCallback((index: number) => {
    const target = workout.blocks[Math.max(0, Math.min(index, workout.blocks.length - 1))];
    const base = pausedAt ?? Date.now();
    setStartedAt(base - target.startSec * 1000);
    setNow(Date.now());
  }, [workout.blocks, pausedAt]);

  const b = pos.block;
  const next = pos.next;

  return (
    <main className={`ride ${b.kind}${pausedAt !== null ? " paused" : ""}`}>
      <Blur key={`top-${pos.index}`} className="top" initialBlur={8} transition={{ duration: 0.35 }}>
        <span className="label">{zoneLabel(b)}</span>
        <span>{b.set ? `${b.set.index} of ${b.set.count}` : `${pos.index + 1} / ${workout.blocks.length}`}</span>
      </Blur>

      <div className="main" onClick={togglePause} role="button" aria-label={pausedAt !== null ? "Resume" : "Pause"}>
        <div className={`time${pos.remainingSec >= 3600 ? " long" : ""}`} aria-label={clock(pos.remainingSec)}>
          <RollingClock sec={pos.remainingSec} />
        </div>
        {b.target.watts ? (
          <div className="watts">
            <CountingNumber number={b.target.watts.lo} initiallyStable transition={WATTS_SPRING} />
            {b.target.watts.hi !== b.target.watts.lo && (
              <>–<CountingNumber number={b.target.watts.hi} initiallyStable transition={WATTS_SPRING} /></>
            )}
            <small>W</small>
          </div>
        ) : (
          <div className="watts" style={{ fontSize: "clamp(1.6rem, 6vmin, 4rem)" }}>{b.target.raw || b.title}</div>
        )}
        {pausedAt !== null && <p className="muted" style={{ fontSize: "1.4rem" }}>Paused · tap to resume</p>}
      </div>

      <Blur key={`next-${pos.index}`} className="next" initialBlur={8} delay={0.1} transition={{ duration: 0.35 }}>
        {next ? (
          <>Next <b>{zoneLabel(next)}</b> · {clock(next.durationSec)}{wattsLabel(next) ? <> · <b>{wattsLabel(next)} W</b></> : null}</>
        ) : (
          <>Last block · {clock(workout.totalSec - elapsedSec)} to go</>
        )}
      </Blur>

      <div>
        <div className="progress" aria-hidden>
          {workout.blocks.map((blk) => {
            const state = blk.index < pos.index ? "done" : blk.index === pos.index ? "current" : "";
            const fill = blk.index === pos.index ? Math.min(100, (pos.elapsedInBlockSec / blk.durationSec) * 100) : 0;
            return (
              <span key={blk.index} className={`${blk.kind} ${state}`} style={{ flexGrow: blk.durationSec }}>
                <i style={fill ? { width: `${fill}%` } : undefined} />
              </span>
            );
          })}
        </div>
        <div className="controls">
          <button onClick={onExit}>Exit</button>
          <button onClick={() => jumpTo(pos.index - 1)} disabled={pos.index === 0}>Back</button>
          <button onClick={togglePause}>{pausedAt !== null ? "Resume" : "Pause"}</button>
          <button onClick={() => jumpTo(pos.index + 1)} disabled={!next}>Skip</button>
        </div>
      </div>
    </main>
  );
}

/**
 * m:ss (or h:mm:ss) with each digit on its own roller, so a change rolls the
 * digit rather than swapping it. Every roller is a fixed-width cell, which
 * keeps the proportional Balfron figures from shifting the number.
 */
function RollingClock({ sec }: { sec: number }) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const digits = (n: number, pad: number) => String(n).padStart(pad, "0").split("").map(Number);
  const cells = [
    ...(h ? [...digits(h, 1), ":"] : []),
    ...digits(m, h ? 2 : 1),
    ":",
    ...digits(s, 2),
  ];
  return (
    <>
      {cells.map((c, i) =>
        typeof c === "number" ? (
          <SlidingNumber key={i} number={c} initiallyStable transition={DIGIT_SPRING} className="d" aria-hidden />
        ) : (
          <span key={i} className="c" aria-hidden>{c}</span>
        ),
      )}
    </>
  );
}
