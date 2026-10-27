import type { Range, Target } from "./types";
import { ftpPctForZones, zoneCodesFor } from "./zones";

export interface TargetOptions {
  /** Athlete FTP in watts. Used to resolve %FTP and zone-only targets. */
  ftp?: number;
  /** Athlete threshold heart rate in BPM. Used to resolve "% of THR" targets. */
  thr?: number;
}

function range(lo: string, hi?: string): Range {
  const a = Number(lo);
  const b = hi === undefined ? a : Number(hi);
  return { lo: Math.min(a, b), hi: Math.max(a, b) };
}

const NUM = String.raw`(\d+(?:\.\d+)?)`;
const RANGE = String.raw`${NUM}\s*(?:-|–|to)\s*${NUM}|${NUM}`;

/**
 * Parse the part of a step after "@": "138-188 W", "250w", "76-85% FTP",
 * "85%", "Z4", "zone 4", "sweet spot". Returns undefined if the text is not
 * a power target (heart-rate and RPE targets are left for the caller to
 * report as unparsed).
 */
export function parsePowerTarget(text: string, opts: TargetOptions = {}): Target | undefined {
  const raw = text.trim();
  const s = raw.toLowerCase();

  const watts = s.match(new RegExp(String.raw`^(?:${RANGE})\s*(?:w|watts?)$`));
  if (watts) {
    const r = watts[1] !== undefined ? range(watts[1], watts[2]) : range(watts[3]);
    return { raw, watts: r };
  }

  const pct = s.match(new RegExp(String.raw`^(?:${RANGE})\s*%(?:\s*(?:of\s*)?ftp)?$`));
  if (pct) {
    const r = pct[1] !== undefined ? range(pct[1], pct[2]) : range(pct[3]);
    return { raw, ftpPct: r, watts: opts.ftp ? pctToWatts(r, opts.ftp) : undefined };
  }

  const codes = zoneCodesFor(raw);
  if (codes.length > 0) {
    const ftpPct = ftpPctForZones(codes);
    return {
      raw,
      zone: { label: raw, codes },
      ftpPct,
      watts: opts.ftp && ftpPct ? pctToWatts(ftpPct, opts.ftp) : undefined,
    };
  }
  return undefined;
}

export function pctToWatts(pct: Range, ftp: number): Range {
  return { lo: Math.round((pct.lo / 100) * ftp), hi: Math.round((pct.hi / 100) * ftp) };
}

/** "80-95 rpm" → range; undefined otherwise. */
export function parseCadence(text: string): Range | undefined {
  const m = text.trim().toLowerCase().match(new RegExp(String.raw`^(?:${RANGE})\s*rpm$`));
  if (!m) return undefined;
  return m[1] !== undefined ? range(m[1], m[2]) : range(m[3]);
}

/** The session-wide "Cadence: 80-100 RPM" line in a workout description; undefined if absent. */
export function parseDescriptionCadence(description: string | undefined): Range | undefined {
  const m = description?.match(new RegExp(String.raw`cadence\s*:\s*((?:${RANGE})\s*rpm)`, "i"));
  return m ? parseCadence(m[1]) : undefined;
}

/**
 * Pull a heart-rate target out of free text such as
 * "RPE: 7-8 Heart Rate: 93-96% of THR" or "HR 140-150 bpm".
 * Returns undefined when there is none.
 */
export function parseHeartRateTarget(text: string, opts: TargetOptions = {}): Pick<Target, "hrPctThr" | "hrBpm"> | undefined {
  const s = text.toLowerCase();
  const pct = s.match(new RegExp(String.raw`(?:heart\s*rate|hr)\s*:?\s*(?:${RANGE})\s*%\s*(?:of\s*)?(?:thr|lthr|threshold)`));
  if (pct) {
    const r = pct[1] !== undefined ? range(pct[1], pct[2]) : range(pct[3]);
    return { hrPctThr: r, hrBpm: opts.thr ? pctToWatts(r, opts.thr) : undefined };
  }
  const bpm = s.match(new RegExp(String.raw`(?:heart\s*rate|hr)\s*:?\s*(?:${RANGE})\s*bpm`));
  if (bpm) return { hrBpm: bpm[1] !== undefined ? range(bpm[1], bpm[2]) : range(bpm[3]) };
  return undefined;
}
