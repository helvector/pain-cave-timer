import type { Block, ZoneCode } from "./workout/types";
import { ZONES } from "./workout/zones";

/**
 * Zone colours for the workout profile. One hue per zone, ordered cool to hot,
 * close to the convention TrainingPeaks and Zwift riders already read.
 */
export const ZONE_COLORS: Record<ZoneCode, string> = {
  Z1: "#8c9099",
  Z2: "#3fa9f5",
  Z3: "#3ecf6e",
  SS: "#d4dd3c",
  Z4: "#ffc933",
  Z5: "#ff8a2a",
  Z6: "#ff4b3a",
  Z7: "#b46cff",
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
  // A label spanning two zones ("Tempo-Threshold") is a target sitting on the
  // boundary; colour it by the lower zone so it reads differently from a
  // block the coach calls plain "Threshold" (the under vs the over).
  const codes = block.target.zone?.codes ?? [];
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
