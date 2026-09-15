import type { BlockKind, StepNode, Target } from "./types";
import { parseDuration } from "./duration";
import { parseCadence, parsePowerTarget, pctToWatts, type TargetOptions } from "./target";
import { ftpPctForZones, topZone, ZONES, zoneCodesFor } from "./zones";

/** Regex source for any duration spelling parseDuration accepts. */
const DUR = String.raw`(?:\d+:\d{1,2}(?::\d{2})?|(?:\d+(?:\.\d+)?\s*(?:hours?|hrs?|h|minutes?|mins?|m|'|seconds?|secs?|s|")(?![a-z])\s*)+)`;

export interface StepParse {
  step?: StepNode;
  /** Fragments of the line that were not understood. */
  leftovers: string[];
}

/**
 * Parse one step line:
 *   "20 min @ 138-188 W - Recovery-Endurance"
 *   "15 min @ 220-235 W - Tempo-Threshold - 80-95 rpm"
 *   "Active 5 min @ Z4"           (title in front)
 *   "5 min Z2"                    (no @)
 *   "1 min on"                    (on/off shorthand, title after duration)
 * Returns no step when the line has no duration.
 */
export function parseStepLine(line: string, opts: TargetOptions = {}, title?: string): StepParse {
  const raw = line.trim();
  const leftovers: string[] = [];
  // Segments separated by " - " (TrainingPeaks joins target, zone, cadence this way).
  const segments = raw.split(/\s+[-–]\s+/);
  const head = segments.shift() ?? "";

  const m = head.match(new RegExp(String.raw`^(?:(.*?)\s+)?(${DUR})\s*(?:@\s*|\s+)?(.*)$`, "i"));
  if (!m) return { leftovers: [raw] };
  const [, before, durText, after] = m;
  const durationSec = parseDuration(durText);
  if (durationSec === undefined) return { leftovers: [raw] };

  let stepTitle = title ?? before?.trim() ?? "";
  let target: Target = { raw: "" };
  let notes: string | undefined;

  let rest = after.trim();
  if (rest) {
    const t = parsePowerTarget(rest, opts);
    if (t) target = t;
    else if (!stepTitle && /^[a-z][a-z ]{0,20}$/i.test(rest)) {
      stepTitle = rest; // "1 min on"
      rest = "";
    } else leftovers.push(rest);
  }

  for (let k = 0; k < segments.length; k++) {
    const s = segments[k].trim();
    if (!s) continue;
    if (/^notes?\b/i.test(s)) {
      // Everything after "Notes" belongs to the note, dashes included.
      notes = [s.replace(/^notes?\s*[-:]?\s*/i, ""), ...segments.slice(k + 1)].filter(Boolean).join(" - ").trim();
      break;
    }
    const cad = parseCadence(s);
    if (cad) {
      target.cadenceRpm = cad;
      continue;
    }
    const codes = zoneCodesFor(s);
    if (codes.length > 0 && !target.zone) {
      target.zone = { label: s, codes };
      if (!target.ftpPct) target.ftpPct = ftpPctForZones(codes);
      if (!target.watts && target.ftpPct && opts.ftp) target.watts = pctToWatts(target.ftpPct, opts.ftp);
      continue;
    }
    // A power target after a dash ("10 min - 250 W") is unusual but harmless.
    const t = !target.raw ? parsePowerTarget(s, opts) : undefined;
    if (t) {
      target = { ...t, cadenceRpm: target.cadenceRpm };
      continue;
    }
    leftovers.push(s);
  }
  if (!target.raw) target.raw = [rest, target.zone?.label].filter(Boolean).join(" - ");

  return {
    step: { type: "step", title: stepTitle || undefined, durationSec, target, notes, raw },
    leftovers,
  };
}

const TITLE_KINDS: Array<[RegExp, BlockKind]> = [
  [/warm/i, "warmup"],
  [/cool/i, "cooldown"],
  [/^(recovery|rest|off|easy|float|rbi|recover)\b/i, "recovery"],
  [/^(active|work|interval|on|hard|effort|main|sprint|attack|surge)\b/i, "work"],
];

/**
 * Decide the block kind from the coach's title first, then the target.
 * Returns the kind plus a flag saying whether it was a guess.
 */
export function inferKind(title: string | undefined, target: Target, ftp?: number): { kind: BlockKind; guessed: boolean } {
  if (title) {
    for (const [re, kind] of TITLE_KINDS) if (re.test(title.trim())) return { kind, guessed: false };
  }
  const zone = target.zone ? topZone(target.zone.codes) : undefined;
  if (zone) return { kind: ZONES[zone].work ? "work" : "recovery", guessed: false };
  const pct = target.ftpPct ?? (target.watts && ftp ? { lo: (target.watts.lo / ftp) * 100, hi: (target.watts.hi / ftp) * 100 } : undefined);
  if (pct) return { kind: pct.hi >= ZONES.Z3.ftpPct.lo ? "work" : "recovery", guessed: false };
  return { kind: "work", guessed: true };
}
