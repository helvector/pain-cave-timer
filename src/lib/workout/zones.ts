import type { Range, ZoneCode } from "./types";

/**
 * Zone table. Percentages of FTP follow the Coggan seven-zone model that
 * TrainingPeaks uses; sweet spot is the 88–94% band the coach's own
 * description quotes. Config, not regex: change here, not in the parser.
 */
export const ZONES: Record<ZoneCode, { name: string; ftpPct: Range; work: boolean }> = {
  Z1: { name: "Recovery", ftpPct: { lo: 0, hi: 55 }, work: false },
  Z2: { name: "Endurance", ftpPct: { lo: 56, hi: 75 }, work: false },
  Z3: { name: "Tempo", ftpPct: { lo: 76, hi: 90 }, work: true },
  SS: { name: "Sweet Spot", ftpPct: { lo: 88, hi: 94 }, work: true },
  Z4: { name: "Threshold", ftpPct: { lo: 91, hi: 105 }, work: true },
  Z5: { name: "VO2max", ftpPct: { lo: 106, hi: 120 }, work: true },
  Z6: { name: "Anaerobic", ftpPct: { lo: 121, hi: 150 }, work: true },
  Z7: { name: "Neuromuscular", ftpPct: { lo: 150, hi: 300 }, work: true },
};

const ZONE_ORDER: ZoneCode[] = ["Z1", "Z2", "Z3", "SS", "Z4", "Z5", "Z6", "Z7"];

/** Spellings coaches use, normalised to lowercase with spaces removed. */
const ALIASES: Record<string, ZoneCode> = {
  recovery: "Z1", activerecovery: "Z1", easy: "Z1", z1: "Z1", zone1: "Z1",
  endurance: "Z2", aerobic: "Z2", z2: "Z2", zone2: "Z2",
  tempo: "Z3", z3: "Z3", zone3: "Z3",
  sweetspot: "SS", ss: "SS", sst: "SS",
  threshold: "Z4", ftp: "Z4", lactatethreshold: "Z4", z4: "Z4", zone4: "Z4",
  vo2max: "Z5", vo2: "Z5", z5: "Z5", zone5: "Z5",
  anaerobic: "Z6", anaerobiccapacity: "Z6", z6: "Z6", zone6: "Z6",
  neuromuscular: "Z7", sprint: "Z7", z7: "Z7", zone7: "Z7",
};

function normalise(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Resolve a zone label to the codes it spans. TrainingPeaks joins
 * adjacent zones with a hyphen ("Recovery-Endurance", "Tempo-Threshold").
 * Returns [] when nothing matches so the caller can decide what to do.
 */
export function zoneCodesFor(label: string): ZoneCode[] {
  const codes: ZoneCode[] = [];
  for (const part of label.split(/\s*[-\/&+]\s*|\s+to\s+/i)) {
    const code = ALIASES[normalise(part)];
    if (code && !codes.includes(code)) codes.push(code);
  }
  return codes;
}

/** Highest zone in a set; drives work vs recovery when the title is unclear. */
export function topZone(codes: ZoneCode[]): ZoneCode | undefined {
  let best: ZoneCode | undefined;
  for (const c of codes) {
    if (!best || ZONE_ORDER.indexOf(c) > ZONE_ORDER.indexOf(best)) best = c;
  }
  return best;
}

/** Combined %FTP band for a label like "Recovery-Endurance" (lowest lo, highest hi). */
export function ftpPctForZones(codes: ZoneCode[]): Range | undefined {
  if (codes.length === 0) return undefined;
  return {
    lo: Math.min(...codes.map((c) => ZONES[c].ftpPct.lo)),
    hi: Math.max(...codes.map((c) => ZONES[c].ftpPct.hi)),
  };
}
