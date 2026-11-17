"use client";

import { motion } from "motion/react";
import type { Workout } from "@/lib/workout/types";
import { clock, positionAt, wattsLabel } from "@/lib/timer";
import { elapsedSec, type RideSession } from "@/lib/ride-session";

export interface ResumeOffer {
  session: RideSession;
  workout: Workout;
  /** When the offer was made (epoch ms), so the numbers hold still while it's open. */
  at: number;
}

const timeOfDay = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/**
 * Shown over the start screen when an unfinished ride from today is saved:
 * resume it (the clock carries on from the original start, so time away
 * counts) or discard it.
 */
export function ResumeSheet({ offer, onResume, onDiscard }: { offer: ResumeOffer; onResume: () => void; onDiscard: () => void }) {
  const { session: s, workout: w, at } = offer;
  const t = elapsedSec(s, at);
  const pos = positionAt(w, t);
  const watts = wattsLabel(pos.block);
  const paused = s.pausedAt !== null;
  return (
    <div className="resume" role="dialog" aria-modal="true" aria-labelledby="resume-title">
      <motion.div className="resume__scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }} />
      <motion.div
        className="resume__sheet"
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 34 }}
      >
        <p className="resume__kicker">{paused ? "Paused ride" : "Ride in progress"}</p>
        <h2 id="resume-title" className="resume__title">Resume ride?</h2>
        <p className="resume__workout">{w.title}</p>
        <dl className="resume__facts">
          <div><dt>Started</dt><dd>{timeOfDay(s.startedAt)}</dd></div>
          <div><dt>{paused ? "Paused at" : "Ridden"}</dt><dd>{clock(t)}</dd></div>
          <div><dt>Block</dt><dd>{pos.index + 1}<small> of {w.blocks.length}</small></dd></div>
        </dl>
        <p className="resume__now muted">
          {paused ? "Picks up paused, where you stopped." : "Picks up where the clock is now, so time away counts:"}{" "}
          {clock(pos.remainingSec)} left of {clock(pos.block.durationSec)}{watts ? ` at ${watts} W` : ""}.
        </p>
        <div className="resume__actions">
          <button onClick={onDiscard}>Discard</button>
          <button className="primary" onClick={onResume}>Resume</button>
        </div>
      </motion.div>
    </div>
  );
}
