import type { AudioSettings } from "./settings";
import type { Block, Workout } from "./workout/types";

export interface Position {
  block: Block;
  index: number;
  /** Whole seconds left in the current block (ceil, so 0 only at the boundary). */
  remainingSec: number;
  /** Seconds into the current block. */
  elapsedInBlockSec: number;
  next?: Block;
  finished: boolean;
}

/**
 * Where in the workout an elapsed time falls. Pure; the ride screen calls it
 * on every tick with wall-clock elapsed so drift never accumulates.
 */
export function positionAt(workout: Workout, elapsedSec: number): Position {
  const blocks = workout.blocks;
  const last = blocks[blocks.length - 1];
  if (elapsedSec >= workout.totalSec) {
    return { block: last, index: blocks.length - 1, remainingSec: 0, elapsedInBlockSec: last.durationSec, finished: true };
  }
  const e = Math.max(0, elapsedSec);
  let index = blocks.findIndex((b) => e < b.startSec + b.durationSec);
  if (index < 0) index = blocks.length - 1;
  const block = blocks[index];
  const elapsedInBlockSec = e - block.startSec;
  return {
    block,
    index,
    remainingSec: Math.ceil(block.durationSec - elapsedInBlockSec),
    elapsedInBlockSec,
    next: blocks[index + 1],
    finished: false,
  };
}

/** m:ss, or h:mm:ss past an hour. */
export function clock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}

/** Short target string for the big screen: "220–235" or "250". */
export function wattsLabel(block: Block): string | undefined {
  const w = block.target.watts;
  if (!w) return undefined;
  return w.lo === w.hi ? String(w.lo) : `${w.lo}–${w.hi}`;
}

/** What to call the block at a glance: the coach's zone if any, else its kind. */
export function zoneLabel(block: Block): string {
  const label = block.target.zone?.label;
  const role = block.part && /^(Over|Under)$/.test(block.title) ? block.title : undefined;
  if (label) return role ? `${role} · ${label.replace(/-/g, " · ")}` : label.replace(/-/g, " · ");
  if (role) return role;
  return { warmup: "Warm up", work: "Work", recovery: "Recovery", cooldown: "Cool down" }[block.kind];
}

/** Top-right position text on the ride screen: "2 of 3 · 3/4", "2 of 3", or "5 / 17". */
export function positionLabel(block: Block, total: number): string {
  const parts = [block.set ? `${block.set.index} of ${block.set.count}` : undefined, block.part ? `${block.part.index}/${block.part.count}` : undefined].filter(Boolean);
  return parts.length ? parts.join(" · ") : `${block.index + 1} / ${total}`;
}

/** One of the coach's extra instructions for a block, shown under the zone label. */
export interface CoachCue {
  kind: "cadence" | "rpe" | "hr";
  value: string;
  unit: string;
}

const range = (lo: number, hi: number) => (lo === hi ? String(lo) : `${lo}–${hi}`);

/**
 * Cadence, effort and heart-rate instructions the coach wrote for a block,
 * from the parsed target first and the step's notes as a fallback
 * ("RPE: 7-8 Heart Rate: 93-96% of THR"). Cadence is always present: "Open"
 * when the coach left it to the rider.
 */
export function coachCues(block: Block): CoachCue[] {
  const { cadenceRpm, hrBpm, hrPctThr } = block.target;
  const notes = block.notes ?? "";
  const cues: CoachCue[] = [];
  cues.push({ kind: "cadence", value: cadenceRpm ? range(cadenceRpm.lo, cadenceRpm.hi) : "Open", unit: "rpm" });
  const rpe = notes.match(/RPE\s*:?\s*(\d+(?:\.\d+)?)(?:\s*[-–]\s*(\d+(?:\.\d+)?))?/i);
  if (rpe) cues.push({ kind: "rpe", value: rpe[2] ? `${rpe[1]}–${rpe[2]}` : rpe[1], unit: "RPE" });
  if (hrBpm) cues.push({ kind: "hr", value: range(hrBpm.lo, hrBpm.hi), unit: "bpm" });
  else if (hrPctThr) cues.push({ kind: "hr", value: range(hrPctThr.lo, hrPctThr.hi), unit: "% THR" });
  else {
    const hr = notes.match(/(\d+)(?:\s*[-–]\s*(\d+))?\s*%\s*(?:of\s*)?THR/i);
    if (hr) cues.push({ kind: "hr", value: hr[2] ? `${hr[1]}–${hr[2]}` : hr[1], unit: "% THR" });
  }
  return cues;
}

/** The block's cadence for the confirmation screen: "80–95 rpm", or "Open" when the coach gave none. */
export function cadenceLabel(block: Block): string {
  const c = block.target.cadenceRpm;
  return c ? `${range(c.lo, c.hi)} rpm` : "Open";
}

/** True on the final interval of a repeat: the "last one" of the set. */
export function isLastOfSet(block: Block): boolean {
  return block.kind === "work" && !!block.set && block.set.count > 1 && block.set.index === block.set.count;
}

/** Blocks this long or shorter get no last-minute cue: it would land on or near the block's own start. */
export const LAST_MINUTE_MIN_BLOCK_SEC = 90;

/**
 * Which timed audio cue is due at this whole second of a block, if any:
 * a countdown tick on each of the last `audio.countdown` seconds, or the
 * last-minute cue at 60 s left. The ride screen keys these per block so
 * each fires once.
 */
export function timedCue(remainingSec: number, durationSec: number, audio: AudioSettings): "tick" | "lastMinute" | undefined {
  if (remainingSec >= 1 && remainingSec <= audio.countdown) return "tick";
  if (audio.lastMinute && remainingSec === 60 && durationSec > LAST_MINUTE_MIN_BLOCK_SEC) return "lastMinute";
  return undefined;
}
