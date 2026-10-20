import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, resolveZones, validateSettings, zoneTopsFromFtp } from "../src/lib/settings";
import { zoneForWatts } from "../src/lib/power-zones";

describe("settings", () => {
  it("defaults are the coach's table", () => {
    expect(resolveZones(DEFAULT_SETTINGS.zones).map((z) => `${z.name} ${z.lo}-${z.hi}`)).toEqual([
      "Recovery 0-145", "Endurance 146-197", "Tempo 198-236", "Threshold 237-275", "VO2 Max 276-314", "Anaerobic Capacity 315-2000",
    ]);
  });

  it("calculates zone tops from FTP with the TrainingPeaks percentages", () => {
    // FTP 262 reproduces the coach's table except Recovery's top (144 vs his 145).
    expect(zoneTopsFromFtp(262)).toEqual([144, 197, 236, 275, 314, 2000]);
    expect(zoneTopsFromFtp(300)).toEqual([165, 225, 270, 315, 360, 2000]);
  });

  it("accepts edited zones and colours", () => {
    const edited = { ...DEFAULT_SETTINGS, zones: DEFAULT_SETTINGS.zones.map((z, i) => ({ ...z, hi: z.hi + (i < 5 ? 10 : 0), color: "#ABCDEF" })), playhead: "comet" };
    const r = validateSettings(edited);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.settings.zones[0]).toEqual({ id: "recovery", name: "Recovery", hi: 155, color: "#abcdef" });
      expect(r.settings.playhead).toBe("comet");
      expect(zoneForWatts(150, resolveZones(r.settings.zones)).id).toBe("recovery");
    }
  });

  it.each([
    [{ zones: [] }, /Expected 6 zones/],
    [{ ...DEFAULT_SETTINGS, zones: DEFAULT_SETTINGS.zones.map((z, i) => (i === 2 ? { ...z, hi: 150 } : z)) }, /Tempo: top must be/],
    [{ ...DEFAULT_SETTINGS, zones: DEFAULT_SETTINGS.zones.map((z, i) => (i === 1 ? { ...z, color: "green" } : z)) }, /colour must be/],
    [{ ...DEFAULT_SETTINGS, zones: DEFAULT_SETTINGS.zones.map((z, i) => (i === 0 ? { ...z, name: " " } : z)) }, /needs a name/],
    [{ ...DEFAULT_SETTINGS, ftp: 5 }, /FTP must be/],
  ])("rejects bad input %#", (input, msg) => {
    const r = validateSettings(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(msg);
  });

  it("falls back to the default style for an unknown playhead", () => {
    const r = validateSettings({ ...DEFAULT_SETTINGS, playhead: "fireworks" });
    expect(r.ok && r.settings.playhead).toBe("ember");
  });
});
