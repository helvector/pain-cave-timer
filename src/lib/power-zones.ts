import type { ZoneCode } from "./workout/types";
import { DEFAULT_SETTINGS, resolveZones, type PowerZone } from "./settings";

export type { PowerZone } from "./settings";

/** Zone ids are fixed; names, tops and colours are editable on /admin. */
export type PowerZoneId = "recovery" | "endurance" | "tempo" | "threshold" | "vo2max" | "anaerobic";

/** The coach's zones (defaults until /admin saves others). */
export const POWER_ZONES: PowerZone[] = resolveZones(DEFAULT_SETTINGS.zones);

export const ZONE_COLORS = Object.fromEntries(POWER_ZONES.map((z) => [z.id, z.color])) as Record<PowerZoneId, string>;

/** The zone a wattage falls in; boundaries belong to the lower zone (145 W is Recovery). */
export function zoneForWatts(watts: number, zones: PowerZone[] = POWER_ZONES): PowerZone {
  return zones.find((z) => watts <= z.hi) ?? zones[zones.length - 1];
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
