import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseTrainingPeaksEmail } from "../src/lib/workout";
import { addHrSample, blockZone, hrPath, POWER_ZONES, profileBars, shade, tint, ZONE_COLORS, zoneForWatts, type HrSample } from "../src/lib/profile";

const ou = parseTrainingPeaksEmail(readFileSync("fixtures/trainingpeaks-overunder-3x16.html", "utf8"), {
  subject: "Schedule for Tuesday 10/06/2026 to Wednesday 10/07/2026",
}).days[0];

describe("blockZone (rider's power zones)", () => {
  it("colours by the middle of the watt target", () => {
    // Warm up 138-188 (163), Under 220-235 (227.5), Over 240-250 (245), Recovery 3-135 (69).
    expect(ou.blocks.slice(0, 4).map((b) => blockZone(b))).toEqual(["endurance", "tempo", "threshold", "tempo"]);
    expect(blockZone(ou.blocks[5])).toBe("recovery");
  });
  it("falls back to %FTP with FTP, then the coach's label, then the kind", () => {
    const base = { ...ou.blocks[1], target: { raw: "" } };
    expect(blockZone({ ...base, target: { raw: "", ftpPct: { lo: 106, hi: 120 } } }, 260)).toBe("vo2max"); // mid 113% × 260 = 293.8 W
    expect(blockZone({ ...base, target: { raw: "", zone: { label: "Endurance-Tempo", codes: ["Z2", "Z3"] } } })).toBe("endurance");
    expect(blockZone({ ...base, target: { raw: "", zone: { label: "Recovery-Endurance", codes: ["Z1", "Z2"] } } })).toBe("endurance");
    expect(blockZone({ ...base, target: { raw: "", zone: { label: "VO2max", codes: ["Z5"] } } })).toBe("vo2max");
    expect(blockZone(base)).toBe("threshold");
  });
});

describe("zoneForWatts", () => {
  it.each([
    [0, "recovery"], [145, "recovery"], [146, "endurance"], [197, "endurance"], [198, "tempo"],
    [236, "tempo"], [237, "threshold"], [275, "threshold"], [276, "vo2max"], [314, "vo2max"],
    [315, "anaerobic"], [900, "anaerobic"], [5000, "anaerobic"],
  ])("%d W → %s", (w, id) => expect(zoneForWatts(w).id).toBe(id));
});

describe("profileBars", () => {
  const bars = profileBars(ou.blocks);
  it("lays bars end to end across the session", () => {
    expect(bars).toHaveLength(17);
    expect(bars[0].x).toBe(0);
    expect(bars[16].x + bars[16].width).toBe(5400);
  });
  it("scales from a baseline so small target steps are visible", () => {
    const over = bars[2], under = bars[1], rec = bars[5], warm = bars[0];
    expect(over.height).toBeCloseTo(0.92);
    // Floor = 0.6 × 135 W = 81 W, so the under sits at (235-81)/(250-81) of full.
    expect(under.height).toBeCloseTo(((235 - 81) / (250 - 81)) * 0.92);
    expect(over.height - under.height).toBeGreaterThan(0.08);
    expect(rec.height).toBeGreaterThanOrEqual(0.12);
    expect(rec.height).toBeLessThan(warm.height);
    expect(warm.height).toBeLessThan(under.height);
    expect([under.color, over.color, rec.color]).toEqual([ZONE_COLORS.tempo, ZONE_COLORS.threshold, ZONE_COLORS.recovery]);
  });
});

describe("zone palette", () => {
  it("runs light blue, green, yellow, yellow-orange, orange, red", () => {
    expect(POWER_ZONES.map((z) => [z.name, z.lo, z.hi, z.color])).toEqual([
      ["Recovery", 0, 145, "#6fc3ff"], ["Endurance", 146, 197, "#3ecf6e"], ["Tempo", 198, 236, "#ffd23f"],
      ["Threshold", 237, 275, "#ffaa2b"], ["VO2 Max", 276, 314, "#ff6a1a"], ["Anaerobic Capacity", 315, 2000, "#ff3b30"],
    ]);
  });
});

describe("heart-rate line", () => {
  it("maps bpm onto the fixed 60-200 scale (max HR at the top)", () => {
    expect(hrPath([{ t: 0, bpm: 60 }, { t: 2, bpm: 200 }])).toBe("M0 1L2 0.08");
    expect(hrPath([{ t: 0, bpm: 40 }, { t: 2, bpm: 230 }])).toBe("M0 1L2 0.08"); // clamped
  });
  it("breaks the line at a dropout", () => {
    expect(hrPath([{ t: 0, bpm: 125 }, { t: 2, bpm: null }, { t: 4, bpm: 125 }])).toBe("M0 0.5729M4 0.5729");
  });
  it("breaks the line across a Skip jump", () => {
    expect(hrPath([{ t: 0, bpm: 125 }, { t: 2, bpm: 125 }, { t: 300, bpm: 125 }])).toBe("M0 0.5729L2 0.5729M300 0.5729");
  });
  it("is empty with no readings", () => {
    expect(hrPath([])).toBe("");
    expect(hrPath([{ t: 0, bpm: null }])).toBe("");
  });
  it("a Back jump replaces the trace from that point on", () => {
    let s: HrSample[] = [];
    for (const [t, bpm] of [[0, 100], [2, 110], [4, 120], [6, 130]] as const) s = addHrSample(s, { t, bpm });
    s = addHrSample(s, { t: 3, bpm: 140 });
    expect(s.map((x) => x.t)).toEqual([0, 2, 3]);
  });
  it("collapses repeated dropouts", () => {
    let s: HrSample[] = [{ t: 0, bpm: 100 }];
    s = addHrSample(s, { t: 2, bpm: null });
    s = addHrSample(s, { t: 4, bpm: null });
    expect(s).toEqual([{ t: 0, bpm: 100 }, { t: 2, bpm: null }]);
  });
});

describe("shade", () => {
  it("mixes 25% black into a colour", () => {
    expect(shade("#ffffff", 0.25)).toBe("#bfbfbf");
    expect(shade("#ff6a1a", 0.25)).toBe("#bf5014");
    expect(shade("#000000", 0.25)).toBe("#000000");
  });
});

describe("tint", () => {
  it("mixes white into a colour", () => {
    expect(tint("#000000", 0.5)).toBe("#808080");
    expect(tint("#ff6a1a", 0)).toBe("#ff6a1a");
    expect(tint("#3a8ee6", 1)).toBe("#ffffff");
  });
});
