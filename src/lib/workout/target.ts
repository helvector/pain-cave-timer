import type { Range, Target } from "./types";
import { ftpPctForZones, zoneCodesFor } from "./zones";

export interface TargetOptions {
  /** Athlete FTP in watts. Used to resolve %FTP and zone-only targets. */
  ftp?: number;
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
