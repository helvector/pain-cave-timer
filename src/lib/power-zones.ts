import type { ZoneCode } from "./workout/types";

/**
 * The rider's own power zones, in absolute watts (from the coach, Oct 2026).
 * Colours run cool to hot: light blue, green, yellow, yellow-orange, orange, red.
 * Update this table when the coach issues new zones; everything that colours
 * by zone (profile bars, confirmation dots) reads from here.
 */
export const POWER_ZONES = [
  { id: "recovery", name: "Recovery", lo: 0, hi: 145, color: "#6fc3ff" },
  { id: "endurance", name: "Endurance", lo: 146, hi: 197, color: "#3ecf6e" },
  { id: "tempo", name: "Tempo", lo: 198, hi: 236, color: "#ffd23f" },
  { id: "threshold", name: "Threshold", lo: 237, hi: 275, color: "#ffaa2b" },
  { id: "vo2max", name: "VO2 Max", lo: 276, hi: 314, color: "#ff6a1a" },
  { id: "anaerobic", name: "Anaerobic Capacity", lo: 315, hi: 2000, color: "#ff3b30" },
] as const;

export type PowerZoneId = (typeof POWER_ZONES)[number]["id"];
export type PowerZone = (typeof POWER_ZONES)[number];

export const ZONE_COLORS = Object.fromEntries(POWER_ZONES.map((z) => [z.id, z.color])) as Record<PowerZoneId, string>;

/** The zone a wattage falls in; boundaries belong to the lower zone (145 W is Recovery). */
export function zoneForWatts(watts: number): PowerZone {
  return POWER_ZONES.find((z) => watts <= z.hi) ?? POWER_ZONES[POWER_ZONES.length - 1];
}

/** Coach label codes mapped onto the rider's zones, for steps with no watt target. */
export const CODE_TO_ZONE: Record<ZoneCode, PowerZoneId> = {
  Z1: "recovery",
  Z2: "endurance",
  Z3: "tempo",
  SS: "tempo",
  Z4: "threshold",
  Z5: "vo2max",
  Z6: "anaerobic",
  Z7: "anaerobic",
};
