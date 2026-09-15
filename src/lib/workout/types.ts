/**
 * Pain Cave Timer — workout data model.
 *
 * Everything the runtime needs is precomputed here at parse time:
 * a flat, ordered list of blocks with absolute durations, resolved watt
 * targets, set position, and the audio cue to play on entry. The runtime
 * never has to understand repeats, zones, or percentages.
 */

/** Which phase of the session a block belongs to. Drives colour and cue. */
export type BlockKind = "warmup" | "work" | "recovery" | "cooldown";

/**
 * Canonical power zone codes. Z1–Z7 follow the Coggan / TrainingPeaks
 * seven-zone model; SS is sweet spot (upper tempo / lower threshold),
 * which coaches prescribe often enough to deserve its own code.
 */
export type ZoneCode = "Z1" | "Z2" | "Z3" | "SS" | "Z4" | "Z5" | "Z6" | "Z7";

export interface Range {
  lo: number;
  hi: number;
}

/** Sound to play when a block begins. `start` is the first block only. */
export type Cue = "start" | "work" | "recovery";

export interface Target {
  /** Target text exactly as the coach wrote it, for the confirmation screen. */
  raw: string;
  /** Absolute watts. Resolved from %FTP when an FTP is supplied. */
  watts?: Range;
  /** Present when the coach wrote a percentage of FTP. */
  ftpPct?: Range;
  /** Zone label as written ("Tempo-Threshold") plus the codes it spans. */
  zone?: { label: string; codes: ZoneCode[] };
  cadenceRpm?: Range;
}

export interface Block {
  /** 0-based position in the flat list. */
  index: number;
  kind: BlockKind;
  /** Step title as written by the coach, e.g. "Active", "Warm up". */
  title: string;
  durationSec: number;
  /** Seconds from workout start; precomputed so the runtime can seek. */
  startSec: number;
  target: Target;
  cue: Cue;
  /** 1-based position within a repeat, e.g. interval 2 of 3. */
  set?: { index: number; count: number };
  notes?: string;
}

export interface Workout {
  /** ISO calendar date, yyyy-mm-dd. */
  date: string;
  title: string;
  isRestDay: boolean;
  /** Planned duration from the email header, if given. */
  plannedSec?: number;
  tss?: number;
  description?: string;
  blocks: Block[];
  /** Sum of block durations. */
  totalSec: number;
  /** Things the parser noticed that a human should glance at before riding. */
  warnings: string[];
  /** Lines the parser could not understand. Shown, never silently dropped. */
  unparsed: string[];
}

/** One TrainingPeaks schedule email covers two days. */
export interface ParsedEmail {
  subject?: string;
  receivedAt?: string;
  days: Workout[];
  warnings: string[];
}

/* ---- Intermediate tree, before repeats are expanded --------------------- */

export interface StepNode {
  type: "step";
  title?: string;
  durationSec: number;
  target: Target;
  notes?: string;
  /** Source line, for `unparsed` / warnings. */
  raw: string;
}

export interface RepeatNode {
  type: "repeat";
  count: number;
  children: WorkoutNode[];
  raw: string;
}

export type WorkoutNode = StepNode | RepeatNode;
