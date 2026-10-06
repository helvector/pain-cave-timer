import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseTrainingPeaksEmail } from "../src/lib/workout";
import { blockZone, profileBars, ZONE_COLORS } from "../src/lib/profile";

const ou = parseTrainingPeaksEmail(readFileSync("fixtures/trainingpeaks-overunder-3x16.html", "utf8"), {
  subject: "Schedule for Tuesday 10/06/2026 to Wednesday 10/07/2026",
}).days[0];

describe("blockZone", () => {
  it("uses the coach's zone label; Tempo-Threshold is under threshold", () => {
    // Warm up "Recovery-Endurance", Under "Tempo-Threshold", Over "Threshold".
    expect(ou.blocks.slice(0, 4).map((b) => blockZone(b))).toEqual(["Z1", "SS", "Z4", "SS"]);
    expect(blockZone(ou.blocks[5])).toBe("Z1"); // Recovery
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
