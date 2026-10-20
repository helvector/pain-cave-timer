/**
 * Rider settings stored server-side (Vercel Blob, `settings.json`) and edited
 * on /admin: power zones in the coach's table format and the "now" line style.
 * Pure: shared by the API route, the admin page and the app.
 */

export const PLAYHEAD_STYLES = ["ember", "comet", "plasma", "stardust"] as const;
export type PlayheadStyle = (typeof PLAYHEAD_STYLES)[number];

export const PLAYHEAD_LABELS: Record<PlayheadStyle, { name: string; blurb: string }> = {
  ember: { name: "Ember", blurb: "White-hot line, sparks drifting up and back, heat haze behind." },
  comet: { name: "Comet", blurb: "Bright head with a long vapour tail and twinkling stars in it." },
  plasma: { name: "Plasma", blurb: "Zone-coloured line that breathes, smoke puffs and fast sparks." },
  stardust: { name: "Stardust", blurb: "Fine line shedding a slow drift of glittering dust." },
};

/** One zone as stored: its top in watts; its bottom is the previous top + 1 (first starts at 0). */
export interface ZoneSetting {
  id: string;
  name: string;
  hi: number;
  color: string;
}

export interface Settings {
  zones: ZoneSetting[];
  playhead: PlayheadStyle;
  /** FTP last used with "Calculate from FTP", for reference. */
  ftp?: number;
  updatedAt?: string;
}

/** The coach's zones, Oct 2026. */
export const DEFAULT_SETTINGS: Settings = {
  zones: [
    { id: "recovery", name: "Recovery", hi: 145, color: "#6fc3ff" },
    { id: "endurance", name: "Endurance", hi: 197, color: "#3ecf6e" },
    { id: "tempo", name: "Tempo", hi: 236, color: "#ffd23f" },
    { id: "threshold", name: "Threshold", hi: 275, color: "#ffaa2b" },
    { id: "vo2max", name: "VO2 Max", hi: 314, color: "#ff6a1a" },
    { id: "anaerobic", name: "Anaerobic Capacity", hi: 2000, color: "#ff3b30" },
  ],
  playhead: "ember",
};

/**
 * The coach's table follows the standard TrainingPeaks power-zone formula:
 * zone tops at 55, 75, 90, 105 and 120% of FTP, the last zone open to 2,000 W.
 * His numbers come from an FTP of about 262 W.
 */
export const ZONE_TOP_PCTS = [0.55, 0.75, 0.9, 1.05, 1.2] as const;

export function zoneTopsFromFtp(ftp: number): number[] {
  return [...ZONE_TOP_PCTS.map((p) => Math.round(ftp * p)), 2000];
}

export interface PowerZone {
  id: string;
  name: string;
  lo: number;
  hi: number;
  color: string;
}

/** Stored zones → zones with their low bounds filled in. */
export function resolveZones(zones: ZoneSetting[]): PowerZone[] {
  return zones.map((z, i) => ({ ...z, lo: i === 0 ? 0 : zones[i - 1].hi + 1 }));
}

const HEX = /^#[0-9a-f]{6}$/i;

/** Check a settings payload from the network; returns a clean copy or an error message. */
export function validateSettings(input: unknown): { ok: true; settings: Settings } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "Expected an object" };
  const raw = input as Record<string, unknown>;
  if (!Array.isArray(raw.zones) || raw.zones.length !== DEFAULT_SETTINGS.zones.length) {
    return { ok: false, error: `Expected ${DEFAULT_SETTINGS.zones.length} zones` };
  }
  const zones: ZoneSetting[] = [];
  let prev = -1;
  for (const [i, z] of (raw.zones as Record<string, unknown>[]).entries()) {
    const hi = Number(z?.hi);
    const name = String(z?.name ?? "").trim().slice(0, 40);
    const color = String(z?.color ?? "");
    if (!name) return { ok: false, error: `Zone ${i + 1} needs a name` };
    if (!Number.isInteger(hi) || hi <= prev || hi > 5000) return { ok: false, error: `${name}: top must be a whole number above ${prev}` };
    if (!HEX.test(color)) return { ok: false, error: `${name}: colour must be #rrggbb` };
    zones.push({ id: DEFAULT_SETTINGS.zones[i].id, name, hi, color: color.toLowerCase() });
    prev = hi;
  }
  const playhead = PLAYHEAD_STYLES.includes(raw.playhead as PlayheadStyle) ? (raw.playhead as PlayheadStyle) : DEFAULT_SETTINGS.playhead;
  const ftp = raw.ftp === undefined || raw.ftp === null || raw.ftp === "" ? undefined : Number(raw.ftp);
  if (ftp !== undefined && !(ftp > 50 && ftp < 1000)) return { ok: false, error: "FTP must be between 50 and 1000 W" };
  return { ok: true, settings: { zones, playhead, ftp } };
}
