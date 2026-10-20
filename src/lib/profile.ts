import type { Block, ZoneCode } from "./workout/types";
import { topZone, ZONES } from "./workout/zones";
import { CODE_TO_ZONE, POWER_ZONES, zoneForWatts, type PowerZone, type PowerZoneId } from "./power-zones";

export { POWER_ZONES, ZONE_COLORS, zoneForWatts, type PowerZone, type PowerZoneId } from "./power-zones";

/** Colour for a zone id within a zone set (edited zones from /admin, or the defaults). */
export function zoneColor(id: string, zones: PowerZone[] = POWER_ZONES): string {
  return zones.find((z) => z.id === id)?.color ?? "#888888";
}

const ORDER: ZoneCode[] = ["Z1", "Z2", "Z3", "SS", "Z4", "Z5", "Z6", "Z7"];

/**
 * Which of the rider's power zones colours a block: the middle of the watt
 * target decides it (220–235 W is Tempo, 240–250 W is Threshold). Without
 * watts, a %FTP target is converted with FTP; failing that the coach's zone
 * label is mapped across ("Recovery-Endurance" warm-ups count as endurance;
 * other spans take their lower zone); last resort is the block kind.
 */
export function blockZone(block: Block, ftp?: number, zones: PowerZone[] = POWER_ZONES): PowerZoneId {
  const w = block.target.watts;
  if (w) return zoneForWatts((w.lo + w.hi) / 2, zones).id as PowerZoneId;
  const pct = block.target.ftpPct;
  if (pct && ftp) return zoneForWatts((((pct.lo + pct.hi) / 2) * ftp) / 100, zones).id as PowerZoneId;
  const all = block.target.zone?.codes ?? [];
  const codes = all.length > 1 ? all.filter((c) => c !== "Z1") : all;
  const named = codes.length ? codes.reduce((lo, c) => (ORDER.indexOf(c) < ORDER.indexOf(lo) ? c : lo)) : undefined;
  if (named) return CODE_TO_ZONE[named];
  return ({ work: "threshold", recovery: "recovery", warmup: "endurance", cooldown: "endurance" } as const)[block.kind];
}

/**
 * Bar height for a block, in watts. Uses the top of the target range so the
 * profile reads like the coach's chart; steps with no watt target fall back
 * to %FTP or the coach's zone against FTP, or a low placeholder.
 */
export function blockHeight(block: Block, ftp?: number): number {
  const w = block.target.watts;
  if (w) return w.hi;
  const code = block.target.zone ? topZone(block.target.zone.codes) : undefined;
  const pct = block.target.ftpPct ?? (code ? ZONES[code].ftpPct : undefined);
  return ftp && pct ? (pct.hi / 100) * ftp : 0;
}

export interface ProfileBar {
  index: number;
  x: number;
  width: number;
  /** 0..1 of the chart height. */
  height: number;
  color: string;
  zone: PowerZoneId;
}

/** Geometry for the profile chart, in seconds along x and 0..1 along y. */
export function profileBars(blocks: Block[], ftp?: number, zones: PowerZone[] = POWER_ZONES): ProfileBar[] {
  const heights = blocks.map((b) => blockHeight(b, ftp));
  const max = Math.max(...heights, 1);
  // Like a training-app chart, the axis starts above zero so a 235 W under and
  // a 250 W over look different: the baseline sits well below the easiest
  // block's target, and never above 45% of the hardest.
  const positive = heights.filter((h) => h > 0);
  const min = positive.length ? Math.min(...positive) : 0;
  const floor = Math.min(min * 0.6, max * 0.45);
  return blocks.map((b, i) => {
    const zone = blockZone(b, ftp, zones);
    const raw = heights[i] > 0 ? (heights[i] - floor) / (max - floor || 1) : 0.18;
    return {
      index: b.index,
      x: b.startSec,
      width: b.durationSec,
      // Keep a visible floor so easy blocks never vanish.
      height: Math.max(0.12, Math.min(1, raw)) * 0.92,
      color: zoneColor(zone, zones),
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

/** Mix a #rrggbb colour with black; amount 0.25 = 25% black. */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => Math.round(((n >> shift) & 255) * (1 - amount));
  return `#${[16, 8, 0].map((sh) => ch(sh).toString(16).padStart(2, "0")).join("")}`;
}

/** Opacity of bars not yet ridden; bright enough that oranges stay orange on black. Ridden bars are 1. */
export const UNRIDDEN_OPACITY = 0.72;

/** Mix a #rrggbb colour with white; amount 0.3 = 30% white. */
export function tint(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => Math.round(((n >> shift) & 255) + (255 - ((n >> shift) & 255)) * amount);
  return `#${[16, 8, 0].map((sh) => ch(sh).toString(16).padStart(2, "0")).join("")}`;
}
