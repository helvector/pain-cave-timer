import type { Block, BlockKind, StepNode, WorkoutNode } from "./types";
import { inferKind } from "./step";

interface FlatStep extends StepNode {
  set?: { index: number; count: number };
}

/** Expand repeat groups into a flat list, tagging each copy with its set position. */
export function expandRepeats(nodes: WorkoutNode[]): FlatStep[] {
  const out: FlatStep[] = [];
  for (const node of nodes) {
    if (node.type === "step") {
      out.push({ ...node });
      continue;
    }
    for (let i = 1; i <= node.count; i++) {
      for (const child of expandRepeats(node.children)) {
        // Innermost repeat wins; nested repeats keep only their own position.
        out.push({ ...child, set: child.set ?? { index: i, count: node.count } });
      }
    }
  }
  return out;
}

export interface BuildResult {
  blocks: Block[];
  warnings: string[];
}

/**
 * Turn flat steps into runtime blocks: kind, start offsets, cues, and set
 * positions inferred for lists TrainingPeaks has already flattened.
 */
export function buildBlocks(steps: FlatStep[], ftp?: number): BuildResult {
  const warnings: string[] = [];
  let t = 0;
  const blocks: Block[] = steps.map((s, index) => {
    const { kind, guessed } = inferKind(s.title, s.target, ftp);
    if (guessed) warnings.push(`Step ${index + 1} ("${s.raw}") has no clear intensity; treated as work.`);
    const block: Block = {
      index,
      kind,
      title: s.title ?? defaultTitle(kind),
      durationSec: s.durationSec,
      startSec: t,
      target: s.target,
      cue: index === 0 ? "start" : kind === "work" ? "work" : "recovery",
      set: s.set,
      part: s.group ? { index: s.group.part, count: s.group.parts } : undefined,
      groupId: s.group?.id,
      notes: s.notes,
    };
    t += s.durationSec;
    return block;
  });
  annotateGroups(blocks);
  annotateSets(blocks);
  return { blocks, warnings };
}

/**
 * Multi-step intervals (one email list item, several steps):
 * - label alternating low/high targets "Under" and "Over", as coaches write "4U / 4O";
 * - a step down inside the interval gets the recovery cue, a step up the work cue;
 * - repeated identical intervals get "1 of 3" set numbers, carried onto the
 *   recovery that follows each one.
 */
export function annotateGroups(blocks: Block[]): void {
  const groups = new Map<number, Block[]>();
  for (const b of blocks) if (b.groupId !== undefined) groups.set(b.groupId, [...(groups.get(b.groupId) ?? []), b]);
  if (groups.size === 0) return;

  const mid = (b: Block) => (b.target.watts ? (b.target.watts.lo + b.target.watts.hi) / 2 : undefined);
  for (const members of groups.values()) {
    const levels = [...new Set(members.map(mid).filter((m): m is number => m !== undefined))].sort((a, b) => a - b);
    if (levels.length === 2 && members.length >= 2) {
      for (const b of members) b.title = mid(b) === levels[1] ? "Over" : "Under";
    }
    members.forEach((b, k) => {
      if (k === 0 || b.index === 0) return;
      const prev = mid(members[k - 1]);
      const cur = mid(b);
      if (prev !== undefined && cur !== undefined && cur < prev) b.cue = "recovery";
    });
  }

  // Number repeated identical intervals.
  const sig = (members: Block[]) => members.map((b) => `${b.durationSec}|${b.target.watts?.lo}|${b.target.watts?.hi}`).join(",");
  const ordered = [...groups.values()];
  const runs: Block[][][] = [];
  for (const g of ordered) {
    const last = runs[runs.length - 1];
    if (last && sig(last[0]) === sig(g)) last.push(g);
    else runs.push([g]);
  }
  for (const run of runs) {
    if (run.length < 2) continue;
    run.forEach((members, i) => {
      const set = { index: i + 1, count: run.length };
      for (const b of members) b.set = set;
      // The recovery right after an interval belongs to it.
      for (let j = members[members.length - 1].index + 1; j < blocks.length && blocks[j].kind === "recovery" && blocks[j].groupId === undefined; j++) {
        blocks[j].set = set;
      }
    });
  }
}

function defaultTitle(kind: BlockKind): string {
  return { warmup: "Warm up", work: "Work", recovery: "Recovery", cooldown: "Cool down" }[kind];
}

function signature(b: Block): string {
  const t = b.target;
  return [b.durationSec, t.watts?.lo, t.watts?.hi, t.ftpPct?.lo, t.ftpPct?.hi, t.zone?.label].join("|");
}

/**
 * TrainingPeaks emails arrive with repeats already unrolled. Recover the
 * "2 of 3" position by finding runs of identical work blocks separated only
 * by recovery blocks. Blocks that already carry a set position are left alone.
 */
export function annotateSets(blocks: Block[]): void {
  let run: { sig: string; work: number[]; from: number } | undefined;

  const close = (end: number) => {
    if (run && run.work.length >= 2) {
      const count = run.work.length;
      let current = 0;
      for (let i = run.from; i < end; i++) {
        const b = blocks[i];
        if (b.set) continue;
        if (b.kind === "work") current++;
        if (current > 0 && (b.kind === "work" || b.kind === "recovery")) b.set = { index: current, count };
      }
    }
    run = undefined;
  };

  blocks.forEach((b, i) => {
    if (b.groupId !== undefined) {
      close(i); // multi-step intervals are numbered by annotateGroups
      return;
    }
    if (b.kind === "work") {
      const sig = signature(b);
      if (run && run.sig !== sig) close(i);
      if (!run) run = { sig, work: [], from: i };
      run.work.push(i);
    } else if (b.kind !== "recovery") {
      close(i);
    }
  });
  close(blocks.length);
}
