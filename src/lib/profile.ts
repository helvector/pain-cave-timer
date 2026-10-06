import type { Block, ZoneCode } from "./workout/types";
import { ZONES } from "./workout/zones";

/**
 * Zone colours for the workout profile, cool to hot:
 * recovery green, endurance mid blue, tempo yellow, under threshold
 * yellow-orange, threshold deep orange, then reds above threshold.
 */
export const ZONE_COLORS: Record<ZoneCode, string> = {
  Z1: "#3ecf6e", // recovery: green
  Z2: "#3a8ee6", // endurance: mid blue
  Z3: "#ffd23f", // tempo: yellow
  SS: "#ffaa2b", // under threshold / sweet spot: yellow-orange
  Z4: "#ff6a1a", // threshold (the overs): deep orange
  Z5: "#ff3b30", // VO2max: red
  Z6: "#d61f2c", // anaerobic: deeper red
  Z7: "#a3122a", // neuromuscular: crimson
};

const ORDER: ZoneCode[] = ["Z1", "Z2", "Z3", "SS", "Z4", "Z5", "Z6", "Z7"];

function zoneForPct(pct: number): ZoneCode {
  // Highest zone whose lower bound the target reaches (sweet spot excluded:
  // it overlaps Z3/Z4 and only applies when the coach names it).
  let best: ZoneCode = "Z1";
  for (const z of ORDER) if (z !== "SS" && pct >= ZONES[z].ftpPct.lo) best = z;
  return best;
}

/**
 * Which zone colours a block. The coach's own zone label wins (TrainingPeaks
 * writes one on every step); then %FTP; then watts against FTP; then a
 * guess from the block kind so nothing renders colourless.
 */
export function blockZone(block: Block, ftp?: number): ZoneCode {
  // "Tempo-Threshold" is just under threshold: its own yellow-orange, so the
  // unders read apart from both tempo and the "Threshold" overs. A span that
  // includes recovery ("Recovery-Endurance" warm-ups) is endurance riding, so
  // recovery is dropped from it; any other span takes its lower zone.
  const all = block.target.zone?.codes ?? [];
  if (all.includes("Z3") && all.includes("Z4")) return "SS";
  const codes = all.length > 1 ? all.filter((c) => c !== "Z1") : all;
  const named = codes.length ? codes.reduce((lo, c) => (ORDER.indexOf(c) < ORDER.indexOf(lo) ? c : lo)) : undefined;
  if (named) return named;
  if (block.target.ftpPct) return zoneForPct(block.target.ftpPct.hi);
  if (block.target.watts && ftp) return zoneForPct((block.target.watts.hi / ftp) * 100);
  return { work: "Z4", recovery: "Z1", warmup: "Z2", cooldown: "Z2" }[block.kind] as ZoneCode;
}

/**
 * Bar height for a block, in watts. Uses the top of the target range so the
 * profile reads like the coach's chart; steps with no watt target fall back
 * to their zone's midpoint against FTP, or a low placeholder.
 */
export function blockHeight(block: Block, ftp?: number): number {
  const w = block.target.watts;
  if (w) return w.hi;
  const pct = block.target.ftpPct ?? ZONES[blockZone(block, ftp)].ftpPct;
  return ftp ? (pct.hi / 100) * ftp : 0;
}

export interface ProfileBar {
  index: number;
  x: number;
  width: number;
  /** 0..1 of the chart height. */
  height: number;
  color: string;
  zone: ZoneCode;
}

/** Geometry for the profile chart, in seconds along x and 0..1 along y. */
export function profileBars(blocks: Block[], ftp?: number): ProfileBar[] {
  const heights = blocks.map((b) => blockHeight(b, ftp));
  const max = Math.max(...heights, 1);
  // Like a training-app chart, the axis starts above zero so a 235 W under and
  // a 250 W over look different: the baseline sits well below the easiest
  // block's target, and never above 45% of the hardest.
  const positive = heights.filter((h) => h > 0);
  const min = positive.length ? Math.min(...positive) : 0;
  const floor = Math.min(min * 0.6, max * 0.45);
  return blocks.map((b, i) => {
    const zone = blockZone(b, ftp);
    const raw = heights[i] > 0 ? (heights[i] - floor) / (max - floor || 1) : 0.18;
    return {
      index: b.index,
      x: b.startSec,
      width: b.durationSec,
      // Keep a visible floor so easy blocks never vanish.
      height: Math.max(0.12, Math.min(1, raw)) * 0.92,
      color: ZONE_COLORS[zone],
      zone,
    };
  });
}

/** One heart-rate reading at a point in the workout; null marks a dropout. */
export interface HrSample {
  /** Seconds into the workout. */
  t: number;
  bpm: number | null;
}

/**
 * Fixed heart-rate scale for the profile, so the line doesn't rescale
 * mid-ride. The top is the rider's max heart rate (200), so the line touching
 * the top of the chart means flat out.
 */
export const HR_RANGE = { lo: 60, hi: 200 };

/**
 * SVG path data for the heart-rate line in the profile's coordinate space
 * (x in workout seconds, y 0..1 top-down). A null sample, time going
 * backwards (Back), or a jump forward (Skip) starts a new segment.
 */
export function hrPath(samples: HrSample[], range = HR_RANGE): string {
  const y = (bpm: number) => {
    const n = (Math.min(range.hi, Math.max(range.lo, bpm)) - range.lo) / (range.hi - range.lo);
    return +(1 - n * 0.92).toFixed(4);
  };
  let d = "";
  let pen = false;
  let lastT = -Infinity;
  for (const s of samples) {
    // Break on a dropout, a Back jump, or a Skip jump (gap well over the 2 s cadence).
    if (s.bpm === null || s.t < lastT || s.t - lastT > 6) pen = false;
    if (s.bpm !== null) {
      d += `${pen ? "L" : "M"}${+s.t.toFixed(1)} ${y(s.bpm)}`;
      pen = true;
    }
    lastT = s.t;
  }
  return d;
}

/**
 * Append a reading, first dropping anything at or after its time so a Back
 * jump overwrites the old trace rather than drawing over it.
 */
export function addHrSample(samples: HrSample[], next: HrSample): HrSample[] {
  const kept = samples.filter((s) => s.t < next.t);
  // Collapse consecutive dropouts.
  if (next.bpm === null && kept.at(-1)?.bpm === null) return kept;
  return [...kept, next];
}
