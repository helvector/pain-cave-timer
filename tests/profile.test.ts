import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseTrainingPeaksEmail } from "../src/lib/workout";
import { addHrSample, blockZone, hrPath, profileBars, shade, ZONE_COLORS, type HrSample } from "../src/lib/profile";

const ou = parseTrainingPeaksEmail(readFileSync("fixtures/trainingpeaks-overunder-3x16.html", "utf8"), {
  subject: "Schedule for Tuesday 10/06/2026 to Wednesday 10/07/2026",
}).days[0];

describe("blockZone", () => {
  it("uses the coach's zone label; Tempo-Threshold is under threshold", () => {
    // Warm up "Recovery-Endurance", Under "Tempo-Threshold", Over "Threshold".
    expect(ou.blocks.slice(0, 4).map((b) => blockZone(b))).toEqual(["Z2", "SS", "Z4", "SS"]);
    expect(blockZone(ou.blocks[5])).toBe("Z1"); // plain Recovery stays green
    expect(blockZone({ ...ou.blocks[0], target: { raw: "", zone: { label: "Endurance-Tempo", codes: ["Z2", "Z3"] } } })).toBe("Z2");
  });
  it("falls back to %FTP, then watts vs FTP, then kind", () => {
    const base = { ...ou.blocks[1], target: { raw: "" } };
    expect(blockZone({ ...base, target: { raw: "", ftpPct: { lo: 106, hi: 120 } } })).toBe("Z5");
    expect(blockZone({ ...base, target: { raw: "", watts: { lo: 180, hi: 200 } } }, 250)).toBe("Z3");
    expect(blockZone(base)).toBe("Z4");
  });
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
    expect([under.color, over.color, rec.color]).toEqual([ZONE_COLORS.SS, ZONE_COLORS.Z4, ZONE_COLORS.Z1]);
  });
});

describe("zone palette", () => {
  it("runs green, blue, yellow, yellow-orange, deep orange, then reds", () => {
    expect(ZONE_COLORS).toEqual({
      Z1: "#3ecf6e", Z2: "#3a8ee6", Z3: "#ffd23f", SS: "#ffaa2b",
      Z4: "#ff6a1a", Z5: "#ff3b30", Z6: "#d61f2c", Z7: "#a3122a",
    });
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
