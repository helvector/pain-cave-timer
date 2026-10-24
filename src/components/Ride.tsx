"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import type { Workout } from "@/lib/workout/types";
import { Cues } from "@/lib/audio";
import { clock, positionAt, positionLabel, zoneLabel } from "@/lib/timer";
import { SlidingNumber } from "@/components/animate-ui/primitives/texts/sliding-number";
import { CountingNumber } from "@/components/animate-ui/primitives/texts/counting-number";
import { Blur } from "@/components/animate-ui/primitives/effects/blur";
import { RideBackground } from "./RideBackground";
import { WorkoutProfile } from "./WorkoutProfile";
import { addHrSample, type HrSample } from "@/lib/profile";
import { hrIntensity, type PlayheadStyle } from "@/lib/settings";
import { useSettings } from "./SettingsProvider";

/** Quick, non-bouncy spring for digits that change every second. */
const DIGIT_SPRING = { stiffness: 320, damping: 32, mass: 0.5 };
/** Watts settle in about half a second on a block change. */
const WATTS_SPRING = { stiffness: 140, damping: 28 };
/** Controls tuck away like the macOS dock: a quick spring with a touch of overshoot. */
const DOCK_SPRING = { type: "spring", stiffness: 420, damping: 30, mass: 0.9 } as const;
/** How long the controls stay up after the last tap. */
const CONTROLS_MS = 3000;

interface Props {
  workout: Workout;
  /** Called once when the last block ends, with the heart-rate trace for the summary. */
  onDone: (elapsedSec: number, hr: HrSample[]) => void;
  onExit: () => void;
  /** Live heart rate when a sensor is connected; shown, never steered by. */
  bpm?: number;
  /** Override the saved "now" line style (demo links for picking a style). */
  playhead?: PlayheadStyle;
  /** Demo only: start this many seconds into the workout. */
  startAtSec?: number;
  /** Demo only: heart-rate trace to start from. */
  seedHr?: HrSample[];
}

/**
 * The riding screen. Time is wall-clock based: elapsed = now − startedAt − paused,
 * so a throttled tab or a slow tick never drifts the schedule. Cues fire when
 * the block index changes; 3-2-1 ticks lead into every transition.
 */
export function Ride({ workout, onDone, onExit, bpm, playhead, startAtSec = 0, seedHr }: Props) {
  const { settings } = useSettings();
  // No strap: a calm quarter intensity. With one: resting → max heart rate maps to 0 → 1.
  const intensity = bpm === undefined ? 0.25 : hrIntensity(bpm, settings.hrRest, settings.hrMax);
  const cues = useMemo(() => new Cues(), []);
  const [startedAt, setStartedAt] = useState(() => Date.now() - startAtSec * 1000);
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const lastIndex = useRef(0);
  const lastTick = useRef<string>("");
  const doneRef = useRef(false);
  const wakeLock = useRef<WakeLockSentinel | null>(null);

  const elapsedSec = ((pausedAt ?? now) - startedAt) / 1000;
  const pos = positionAt(workout, elapsedSec);

  // Heart-rate trace for the profile: one reading every 2 s while riding,
  // a null when the strap has no reading so the line breaks there.
  const [hrTrace, setHrTrace] = useState<HrSample[]>(() => seedHr ?? []);
  const latest = useRef({ bpm, elapsedSec, hrTrace });
  useEffect(() => {
    latest.current = { bpm, elapsedSec, hrTrace };
  });
  useEffect(() => {
    if (pausedAt !== null) return;
    const id = setInterval(() => {
      const { bpm: b, elapsedSec: t } = latest.current;
      if (t >= workout.totalSec) return;
      setHrTrace((prev) => addHrSample(prev, { t: Math.max(0, t), bpm: b ?? null }));
    }, 2000);
    return () => clearInterval(id);
  }, [pausedAt, workout.totalSec]);

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
        onDone(workout.totalSec, latest.current.hrTrace);
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

  // The profile runs to the bottom edge under the buttons; reserve their height
  // (plus the gap below them) so bar tops and the heart-rate line stay above.
  const controlsRef = useRef<HTMLDivElement>(null);
  const [reservePx, setReservePx] = useState(88);
  useEffect(() => {
    const el = controlsRef.current;
    if (!el) return;
    const measure = () => setReservePx(Math.round(el.offsetHeight + parseFloat(getComputedStyle(el).bottom || "0") + 10));
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Controls are hidden while riding so a knee or sweaty hand can't pause or
  // exit by accident. Any tap brings them up; they tuck away 3 s after the
  // last tap. While paused they stay up (Resume has to be reachable).
  const [controlsUp, setControlsUp] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reveal = useCallback(() => {
    setControlsUp(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsUp(false), CONTROLS_MS);
  }, []);
  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);
  const shown = controlsUp || pausedAt !== null;

  const b = pos.block;
  const next = pos.next;

  return (
    <main className={`ride ${b.kind}${pausedAt !== null ? " paused" : ""}`} onPointerDown={reveal}>
      <RideBackground kind={b.kind} bpm={bpm} />
      <Blur key={`top-${pos.index}`} className="top" initialBlur={8} transition={{ duration: 0.35 }}>
        <span className="label">{zoneLabel(b)}</span>
        <span>{positionLabel(b, workout.blocks.length)}</span>
      </Blur>

      <div className="main">
        <div className={`time${pos.remainingSec >= 3600 ? " long" : ""}`} aria-label={clock(pos.remainingSec)}>
          <RollingClock sec={pos.remainingSec} />
        </div>
        {b.target.watts ? (
          <div
            className="watts"
            aria-label={b.target.watts.hi !== b.target.watts.lo ? `${b.target.watts.lo} to ${b.target.watts.hi} watts` : `${b.target.watts.lo} watts`}
          >
            <PowerIcon />
            <CountingNumber number={b.target.watts.lo} initiallyStable transition={WATTS_SPRING} />
            {b.target.watts.hi !== b.target.watts.lo && (
              <>–<CountingNumber number={b.target.watts.hi} initiallyStable transition={WATTS_SPRING} /></>
            )}
          </div>
        ) : (
          <div className="watts" style={{ fontSize: "clamp(1.6rem, 6vmin, 4rem)" }}>{b.target.raw || b.title}</div>
        )}
        {bpm !== undefined && (
          <div className="hr" aria-label={`${bpm} beats per minute`}>
            <span aria-hidden>♥</span>{bpm}
          </div>
        )}
        {pausedAt !== null && <p className="muted paused-note">Paused</p>}
      </div>

      <div className="ride-bottom" style={{ "--reserve": `${reservePx}px` } as React.CSSProperties}>
        <WorkoutProfile
          workout={workout}
          elapsedSec={Math.min(elapsedSec, workout.totalSec)}
          currentIndex={pos.index}
          hr={hrTrace}
          reservePx={reservePx}
          intensity={intensity}
          playhead={playhead}
          className="profile--ride"
        />
        <motion.div
          className="controls"
          ref={controlsRef}
          initial={false}
          animate={shown ? { y: 0, opacity: 1, scale: 1 } : { y: 120, opacity: 0, scale: 0.92 }}
          transition={DOCK_SPRING}
          // Off-screen controls must not catch a stray tap.
          inert={!shown}
          aria-hidden={!shown}
        >
          <button onClick={onExit}>Exit</button>
          <button onClick={() => jumpTo(pos.index - 1)} disabled={pos.index === 0}>Back</button>
          <button onClick={togglePause}>{pausedAt !== null ? "Resume" : "Pause"}</button>
          <button onClick={() => jumpTo(pos.index + 1)} disabled={!next}>Skip</button>
        </motion.div>
        {!shown && <p className="controls-hint" aria-hidden>Tap for controls</p>}
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

/**
 * Power mark to the left of the watt target, sized and placed like the heart
 * beside the heart rate. Drawn rather than the ⚡ emoji, which iOS renders in
 * colour; this one takes the number's colour.
 */
function PowerIcon() {
  return (
    <svg className="watts__icon" viewBox="0 0 16 24" aria-hidden>
      <path d="M10.5 0 1 13.5h6.2L4.8 24 15 9.8H8.6L10.5 0Z" fill="currentColor" />
    </svg>
  );
}
