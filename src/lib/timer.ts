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
